import {
  existsSync,
  readFileSync,
  writeFileSync,
  renameSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  createReadStream,
} from 'node:fs'
import { resolve, sep } from 'node:path'
import { randomUUID, createHash } from 'node:crypto'
import { ProjectStore, problem } from './project-store.mjs'
import { demoProjects } from '../demo/manifest.mjs'
import { preparedEvidence, projectResult } from './project-evidence.mjs'
import { answer } from './answer.mjs'
import { suggestQueries } from './query-suggestions.mjs'
import { restoreDemoDocuments } from './demo-documents.mjs'

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/
const preparedId = (project, query) => {
  const h = createHash('sha256')
    .update(project + '/' + query)
    .digest('hex')
    .slice(0, 32)
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
export class ProjectApi {
  constructor(corpus, directory, engineVersion) {
    this.store = new ProjectStore(corpus, directory)
    this.engineVersion = engineVersion
    this.queryRoot = resolve(directory, 'project-queries')
    mkdirSync(this.queryRoot, { recursive: true })
    this.jobs = new Map()
    this.queue = []
    this.active = null
    this.scopeCache = new Map()
    this.evidence = new Map()
    for (const project of this.store.list())
      for (const job of this.history(project.id, false)) {
        if (['queued', 'running'].includes(job.state)) {
          job.state = 'failed'
          job.error = 'Interrupted by a backend restart. Run the query again.'
          this.persist(job)
        }
      }
    this.prepareSeeds()
  }
  folder(projectId) {
    this.store.get(projectId)
    if (!/^[a-zA-Z0-9-]{1,80}$/.test(projectId))
      throw problem(400, 'Invalid project ID.')
    return resolve(this.queryRoot, projectId)
  }
  scope(projectId, ids) {
    const scope = this.store.scope(projectId, ids)
    if (this.scopeCache.has(scope.version))
      return this.scopeCache.get(scope.version)
    this.scopeCache.set(scope.version, scope)
    while (this.scopeCache.size > 2)
      this.scopeCache.delete(this.scopeCache.keys().next().value)
    return scope
  }
  persist(job) {
    const folder = this.folder(job.projectId)
    mkdirSync(folder, { recursive: true })
    const file = resolve(folder, job.id + '.json')
    writeFileSync(file + '.tmp', JSON.stringify(this.serialize(job, false)))
    renameSync(file + '.tmp', file)
  }
  raw(projectId, id) {
    if (!uuid.test(id)) throw problem(404, 'Query not found in this project.')
    const key = projectId + '/' + id
    if (this.jobs.has(key)) return this.jobs.get(key)
    const file = resolve(this.folder(projectId), id + '.json')
    if (!existsSync(file))
      throw problem(404, 'Query not found in this project.')
    try {
      const job = JSON.parse(readFileSync(file, 'utf8'))
      if (job.projectId === projectId && job.id === id) return job
    } catch {
      /* A partial or foreign record cannot be returned. */
    }
    throw problem(404, 'Query not found in this project.')
  }
  stale(job) {
    try {
      return (
        job.engineVersion !== this.engineVersion ||
        this.store.scope(job.projectId, job.documentIds).version !==
          job.scopeVersion
      )
    } catch {
      return true
    }
  }
  serialize(job, check = true) {
    const stale = check && job.state === 'completed' && this.stale(job)
    return {
      id: job.id,
      projectId: job.projectId,
      question: job.question,
      state: job.state,
      stage: job.stage,
      documentIds: job.documentIds,
      scopeVersion: job.scopeVersion,
      engineVersion: job.engineVersion,
      sourceOnly: job.sourceOnly,
      prepared: job.prepared || false,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
      stale,
      result: stale ? undefined : job.result,
      error: job.error,
      saved: this.store.get(job.projectId).savedQueryIds.includes(job.id),
    }
  }
  history(projectId, summaries = true) {
    const folder = this.folder(projectId),
      rows = []
    if (existsSync(folder))
      for (const file of readdirSync(folder).filter(
        (n) => uuid.test(n.replace(/\.json$/, '')) && n.endsWith('.json'),
      )) {
        try {
          const job = this.raw(projectId, file.slice(0, -5))
          rows.push(
            summaries ? { ...this.serialize(job), result: undefined } : job,
          )
        } catch {
          /* Skip unreadable records. */
        }
      }
    return rows
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .slice(0, 200)
  }
  prepareSeeds(only) {
    for (const spec of demoProjects.filter((p) => !only || p.id === only)) {
      const scope = this.scope(spec.id)
      for (const issue of spec.issues) {
        try {
          this.evidence.set(
            spec.id + '/' + issue.id,
            preparedEvidence(issue, scope.corpus, spec.id),
          )
        } catch (error) {
          console.warn(
            'Prepared finding withheld:',
            spec.id,
            issue.id,
            error.message,
          )
        }
      }
      for (const query of spec.queries) {
        const result = this.evidence.get(spec.id + '/' + query.issueId)
        if (!result) continue
        const id = preparedId(spec.id, query.id)
        const job = {
          id,
          projectId: spec.id,
          question: query.question,
          state: 'completed',
          stage: 'Prepared source-verified comparison',
          sourceOnly: false,
          prepared: true,
          documentIds: scope.corpus.documents.map((d) => d.id),
          scopeVersion: scope.version,
          engineVersion: this.engineVersion,
          createdAt: '2026-11-06T17:00:00.000Z',
          completedAt: new Date().toISOString(),
          result,
        }
        this.jobs.set(spec.id + '/' + id, job)
        this.persist(job)
      }
    }
  }
  issues(projectId) {
    const project = this.store.get(projectId),
      spec = demoProjects.find((p) => p.id === projectId)
    return (spec?.issues || []).map(({ proofs: _proofs, ...issue }) => {
      const evidence = this.evidence.get(projectId + '/' + issue.id)
      const query = spec.queries.find((q) => q.issueId === issue.id)
      return {
        ...issue,
        prepared: true,
        verified: !!evidence,
        status: project.issueStates[issue.id]?.status || 'open',
        queryId: evidence ? preparedId(projectId, query.id) : null,
        citations:
          evidence?.references.map((r) => ({
            doc: r.doc,
            page: r.page,
            label: this.store.documents.get(r.doc)?.label,
            excerpt: r.excerpt,
          })) || [],
      }
    })
  }
  project(projectId) {
    const project = this.store.get(projectId),
      issues = this.issues(projectId)
    return {
      ...project,
      documentCount: project.documentIds.length,
      openIssueCount: issues.filter((i) => i.status === 'open' && i.verified)
        .length,
    }
  }
  eraseHistory(projectId) {
    for (const [key, job] of this.jobs)
      if (job.projectId === projectId) {
        job.controller?.abort()
        this.jobs.delete(key)
      }
    this.queue = this.queue.filter((j) => j.projectId !== projectId)
    const folder = this.folder(projectId)
    if (!folder.startsWith(this.queryRoot + sep))
      throw problem(500, 'Unsafe project-history path.')
    if (existsSync(folder)) rmSync(folder, { recursive: true, force: true })
  }
  async work() {
    if (this.active) return
    const job = this.queue.shift()
    if (!job) return
    if (job.state === 'cancelled') {
      void this.work()
      return
    }
    this.active = job
    job.state = 'running'
    try {
      const scope = this.scope(job.projectId, job.documentIds)
      const result = await answer(job.question, scope.index, {
        publicBase: '',
        token: '',
        signal: job.controller.signal,
        sourceOnly: job.sourceOnly,
        progress: (stage) => {
          job.stage = stage
        },
      })
      if (
        ['no_evidence', 'related_evidence', 'insufficient_evidence'].includes(
          result.mode,
        )
      )
        result.suggestions = suggestQueries(job.question, scope.index)
      if (job.controller.signal.aborted) throw new Error('Cancelled')
      const allowed = new Set(job.documentIds)
      if (
        result.documents.some((d) => !allowed.has(d.id)) ||
        result.references.some((r) => !allowed.has(r.doc))
      )
        throw new Error('Query returned evidence outside its project scope')
      job.result = projectResult(result, job.projectId)
      job.state = 'completed'
      job.stage = 'Complete'
      job.completedAt = new Date().toISOString()
    } catch (error) {
      job.state = job.controller.signal.aborted ? 'cancelled' : 'failed'
      job.error =
        job.state === 'cancelled'
          ? 'Query cancelled.'
          : 'Could not complete the scoped query. Please retry.'
      console.warn('Project query:', error.message)
    } finally {
      if (this.jobs.has(job.projectId + '/' + job.id)) {
        try {
          this.persist(job)
        } catch {
          /* Deleted projects cannot resurrect history. */
        }
      }
      this.active = null
      setImmediate(() => void this.work())
    }
  }
  async submit(projectId, input) {
    const question =
      typeof input.question === 'string' ? input.question.trim() : ''
    if (!question || question.length > 6000)
      throw problem(400, 'Enter a question of 1 to 6000 characters.')
    if (input.sourceOnly !== undefined && typeof input.sourceOnly !== 'boolean')
      throw problem(400, 'sourceOnly must be a boolean.')
    const scope = this.scope(projectId, input.documentIds)
    const id = input.id || randomUUID()
    if (!uuid.test(id)) throw problem(400, 'Query ID must be a UUID.')
    let previous
    try {
      previous = this.raw(projectId, id)
    } catch (error) {
      if (error.status !== 404) throw error
    }
    if (previous) {
      if (
        previous.question !== question ||
        previous.sourceOnly !== (input.sourceOnly === true) ||
        previous.scopeVersion !== scope.version
      )
        throw problem(409, 'Query ID belongs to a different query or scope.')
      return this.serialize(previous)
    }
    if (this.queue.length >= 4)
      throw problem(429, 'The local backend is busy. Try shortly.')
    const job = {
      id,
      projectId,
      question,
      documentIds: scope.corpus.documents.map((d) => d.id),
      scopeVersion: scope.version,
      engineVersion: this.engineVersion,
      sourceOnly: input.sourceOnly === true,
      state: 'queued',
      stage: 'Waiting for project search',
      createdAt: new Date().toISOString(),
      controller: new AbortController(),
    }
    const spec = demoProjects.find((p) => p.id === projectId)
    const prepared =
      !job.sourceOnly &&
      spec?.queries.find(
        (q) => q.question.toLowerCase() === question.toLowerCase(),
      )
    if (prepared) {
      try {
        job.result = preparedEvidence(
          spec.issues.find((i) => i.id === prepared.issueId),
          scope.corpus,
          projectId,
        )
        job.state = 'completed'
        job.prepared = true
        job.stage = 'Prepared source-verified comparison'
        job.completedAt = new Date().toISOString()
      } catch {
        /* Restricted selections must use only the evidence they actually contain. */
      }
    }
    this.jobs.set(projectId + '/' + id, job)
    this.persist(job)
    if (job.state === 'queued') {
      this.queue.push(job)
      void this.work()
    }
    return this.serialize(job)
  }
  async handle(req, url, res, json, readBody) {
    const pathname = url.pathname
    const input = async () => {
      if (!String(req.headers['content-type']).startsWith('application/json'))
        throw problem(415, 'Send application/json.')
      const value = await readBody(req)
      if (!value || typeof value !== 'object' || Array.isArray(value))
        throw problem(400, 'Send a JSON object.')
      return value
    }
    if (pathname === '/v1/reference-collections' && req.method === 'GET') {
      const ids = new Set(this.store.collections.flatMap((c) => c.documentIds))
      return json(200, {
        collections: this.store.collections,
        documents: [...ids].map((id) => {
          const { filePath: _path, ...doc } = this.store.documents.get(id)
          return {
            ...doc,
            category: 'reference',
            file: `/v1/documents/${id}/file`,
          }
        }),
      })
    }
    if (pathname === '/v1/projects') {
      if (req.method === 'GET')
        return json(200, {
          projects: this.store.list().map((p) => this.project(p.id)),
        })
      if (req.method === 'POST')
        return json(201, { project: this.store.create(await input()) })
      throw problem(405, 'Method not allowed.')
    }
    const match = pathname.match(/^\/v1\/projects\/([a-zA-Z0-9-]+)(.*)$/)
    if (!match) throw problem(404, 'Project route not found.')
    const [, projectId, route] = match
    const project = this.store.get(projectId)
    if (!route) {
      if (req.method === 'GET')
        return json(200, {
          project: this.project(projectId),
          documents: project.documentIds.map((id) =>
            this.store.document(projectId, id),
          ),
          queries: this.history(projectId),
          issues: this.issues(projectId),
          collections: this.store.collections.filter((c) =>
            project.collectionIds.includes(c.id),
          ),
        })
      if (req.method === 'PATCH')
        return json(200, {
          project: this.store.update(projectId, await input()),
        })
      if (req.method === 'DELETE') {
        if (project.protectedDemo)
          throw problem(403, 'Demonstration projects cannot be deleted.')
        this.eraseHistory(projectId)
        this.store.remove(projectId)
        return json(200, { deleted: true })
      }
    }
    if (route === '/reset' && req.method === 'POST') {
      if (!project.protectedDemo)
        throw problem(400, 'Only demonstration projects have a reset state.')
      this.eraseHistory(projectId)
      restoreDemoDocuments(undefined, projectId)
      this.store.reset(projectId)
      this.prepareSeeds(projectId)
      return json(200, { project: this.project(projectId) })
    }
    const issueMatch = route.match(/^\/issues\/([a-z0-9-]+)$/)
    if (issueMatch && req.method === 'PATCH')
      return json(200, {
        state: this.store.setIssue(
          projectId,
          issueMatch[1],
          (await input()).status,
        ),
      })
    const fileMatch = route.match(/^\/documents\/(doc-[a-f0-9]+)\/file$/)
    if (fileMatch && req.method === 'GET') {
      this.store.document(projectId, fileMatch[1])
      const doc = this.store.documents.get(fileMatch[1]),
        size = statSync(doc.filePath).size
      let start = 0,
        end = size - 1
      const headers = {
        'Content-Type': 'application/pdf',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, no-store',
      }
      if (req.headers.range) {
        const range = String(req.headers.range).match(/^bytes=(\d+)-(\d*)$/)
        if (
          !range ||
          Number(range[1]) >= size ||
          (range[2] && Number(range[2]) < Number(range[1]))
        ) {
          res.writeHead(416, { 'Content-Range': `bytes */${size}` })
          res.end()
          return
        }
        start = Number(range[1])
        end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1
        res.writeHead(206, {
          ...headers,
          'Content-Length': end - start + 1,
          'Content-Range': `bytes ${start}-${end}/${size}`,
        })
      } else res.writeHead(200, { ...headers, 'Content-Length': size })
      createReadStream(doc.filePath, { start, end }).pipe(res)
      return
    }
    if (route === '/queries') {
      if (req.method === 'GET')
        return json(200, { queries: this.history(projectId) })
      if (req.method === 'POST')
        return json(202, await this.submit(projectId, await input()))
    }
    const queryMatch = route.match(/^\/queries\/([a-f0-9-]{36})$/)
    if (queryMatch) {
      const job = this.raw(projectId, queryMatch[1])
      if (req.method === 'GET') return json(200, this.serialize(job))
      if (req.method === 'PATCH') {
        this.store.saveQuery(projectId, job.id, (await input()).saved)
        return json(200, this.serialize(job))
      }
      if (req.method === 'DELETE') {
        job.controller?.abort()
        job.state = 'cancelled'
        this.persist(job)
        return json(200, this.serialize(job))
      }
    }
    throw problem(404, 'Project route not found.')
  }
}

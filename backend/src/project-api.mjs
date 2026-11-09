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
import { resolve, sep, basename } from 'node:path'
import { randomUUID, createHash } from 'node:crypto'
import { compareIfcDocuments, readIfcProperties } from './ifc-comparison.mjs'
import { root } from './config.mjs'
import { ProjectStore, problem } from './project-store.mjs'
import { demoProjects } from '../demo/manifest.mjs'
import { preparedEvidence, projectResult, ifcFindingEvidence } from './project-evidence.mjs'
import { answer, renderUnits } from './answer.mjs'
import { lookup, UnitIndex } from './lookup.mjs'
import { suggestQueries } from './query-suggestions.mjs'
import { assistQuery } from './clarify.mjs'
import {
  restoreDemoDocuments,
  demoDocumentDirectory,
} from './demo-documents.mjs'
import { buildIndex } from './indexer.mjs'
import {
  stageImport,
  discardImport,
  removeProjectImports,
  finishImport,
  setImportCategory,
} from './project-imports.mjs'

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
    this.comparisonCache = new Map()
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
    if (this.store.get(job.projectId).deletedQueryIds?.includes(job.id)) return
    const folder = this.folder(job.projectId)
    mkdirSync(folder, { recursive: true })
    const file = resolve(folder, job.id + '.json')
    writeFileSync(file + '.tmp', JSON.stringify(this.serialize(job, false)))
    renameSync(file + '.tmp', file)
  }
  raw(projectId, id) {
    if (!uuid.test(id)) throw problem(404, 'Query not found in this project.')
    if (this.store.get(projectId).deletedQueryIds?.includes(id))
      throw problem(404, 'Query not found in this project.')
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
      if(job.ifcFinding||job.result?.mode==='ifc_comparison'){
        const current=this.comparison(job.projectId)
        // Legacy persisted reports lack the root marker. Their deterministic
        // query ID still binds the original finding and model/source signature.
        if(!current.issues.some(issue=>issue.queryId===job.id&&issue.verified))return true
        if(job.ifcFinding&&this.comparisonCache.get(job.projectId)?.signature!==job.ifcFinding.signature)return true
      }
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
      ...(job.ifcFinding?{ifcFinding:job.ifcFinding}:{}),
      createdAt: job.createdAt,
      completedAt: job.completedAt,
      stale,
      // Lets history lists flag unanswered questions without the full result.
      outcome: stale ? undefined : job.result?.assist?.outcome,
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
  prepareSeeds(only, queryId) {
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
        let result = this.evidence.get(spec.id + '/' + query.issueId)
        if (query.sourceOnly) {
          const found = lookup(query.question, new UnitIndex(scope.corpus))
          result = projectResult(
            renderUnits(
              found.sections,
              scope.corpus,
              '',
              '',
              found.mode,
              found.notes,
            ),
            spec.id,
          )
        }
        if (!result) continue
        const id = preparedId(spec.id, query.id)
        if (queryId && queryId !== id) continue
        if (this.store.get(spec.id).deletedQueryIds?.includes(id)) continue
        const job = {
          id,
          projectId: spec.id,
          question: query.question,
          state: 'completed',
          stage: 'Prepared source-verified comparison',
          sourceOnly: !!query.sourceOnly,
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
  comparison(projectId, force = false) {
    const project = this.store.get(projectId)
    const scope = this.store.scope(projectId)
    const documents = scope.corpus.documents
    const models = [],
      errors = []
    const files = new Set(
      documents
        .filter((d) => d.modelFile && basename(d.modelFile) === d.modelFile)
        .map((d) => resolve(demoDocumentDirectory, d.modelFile)),
    )
    // Legacy demonstration projects have their IFC beside the original project packages.
    if (project.protectedDemo) {
      const normalized = (name) => name.replace(/[^a-z0-9]/gi, '').toLowerCase()
      const directory = resolve(root, 'IFC')
      for (const name of existsSync(directory) ? readdirSync(directory) : []) {
        if (name.toLowerCase().endsWith('.ifc') &&
            normalized(name.slice(0, -4)) === normalized(project.name))
          files.add(resolve(directory, name))
      }
    }
    const contents = [...files].map((file) => {
      try {
        return { name: basename(file), text: readFileSync(file, 'utf8') }
      } catch {
        errors.push(`Could not read ${basename(file)}.`)
        return { name: basename(file), text: '' }
      }
    })
    const signature = createHash('sha256')
      .update(scope.version + JSON.stringify(contents))
      .digest('hex')
    const cached = this.comparisonCache.get(projectId)
    if (!force && cached?.signature === signature) return cached.result
    for (const file of contents) {
      try {
        const elements = readIfcProperties(file.text)
        models.push({ name: file.name, elements })
        const unsupported=elements.flatMap(element=>element.properties).filter(property=>(property.explicitUnit||property.unitRequired)&&!property.measurementUnit).length
        if (unsupported) errors.push(`${file.name}: ${unsupported} measured properties were excluded because their numeric value/unit definitions are unsupported, missing or ambiguous.`)
        if (!elements.length)
          errors.push(`${file.name}: no supported element property sets found.`)
      } catch (error) {
        errors.push(`${file.name}: ${error.message}`)
      }
    }
    if (!contents.length)
      errors.push('No IFC model is associated with this project.')
    const result = {
      ...compareIfcDocuments(models, documents, scope.corpus.passages),
      errors,
    }
    for(const issue of result.issues){
      const evidence=ifcFindingEvidence(issue,scope.corpus,projectId)
      issue.queryId=evidence?preparedId(projectId,'ifc/'+issue.id+'/'+signature):null
      issue.verified=!!evidence
      if(evidence)this.evidence.set(projectId+'/'+issue.id,{signature,result:evidence,queryId:issue.queryId})
    }
    this.comparisonCache.set(projectId, { signature, result })
    return result
  }
  openIfcFinding(projectId,id){
    const issue=this.comparison(projectId).issues.find(issue=>issue.queryId===id&&issue.verified)
    const evidence=issue&&this.evidence.get(projectId+'/'+issue.id)
    if(!evidence?.result)throw problem(404,'Current IFC finding evidence is unavailable in this project.')
    // An explicit Inspect evidence action can open a new report for a current
    // finding; deleting history must not remove the finding or its evidence.
    this.store.reopenQuery(projectId,id)
    const scope=this.scope(projectId)
    const now=new Date().toISOString()
    const job={id,projectId,question:issue.title,state:'completed',stage:'Source-verified IFC property comparison',sourceOnly:true,prepared:false,
      documentIds:scope.corpus.documents.map(document=>document.id),scopeVersion:scope.version,engineVersion:this.engineVersion,
      createdAt:now,completedAt:now,result:evidence.result,ifcFinding:{issueId:issue.id,signature:evidence.signature}}
    this.jobs.set(projectId+'/'+id,job);this.persist(job)
    return job
  }
  readQuery(projectId,id){
    let job
    try{job=this.raw(projectId,id)}catch(error){
      if(error.status!==404)throw error
      const spec=demoProjects.find(project=>project.id===projectId)
      const query=spec?.queries.find(query=>query.issueId&&preparedId(projectId,query.id)===id)
      if(query&&this.evidence.has(projectId+'/'+query.issueId)){
        this.store.reopenQuery(projectId,id)
        this.prepareSeeds(projectId,id)
        return this.raw(projectId,id)
      }
      return this.openIfcFinding(projectId,id)
    }
    // An engine update may invalidate the cached rendering while the current
    // model finding and source signature are unchanged. Rebuild from freshly
    // anchored evidence; never release the stale cached body itself.
    if((job.ifcFinding||job.result?.mode==='ifc_comparison')&&this.stale(job)&&this.comparison(projectId).issues.some(issue=>issue.queryId===id&&issue.verified))return this.openIfcFinding(projectId,id)
    return job
  }
  issues(projectId) {
    const project = this.store.get(projectId),
      spec = demoProjects.find((p) => p.id === projectId)
    const prepared = (spec?.issues || []).map(
      ({ proofs: _proofs, ...issue }) => {
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
      },
    )
    return [
      ...prepared,
      ...this.comparison(projectId).issues.map((issue) => ({
        ...issue,
        status: project.issueStates[issue.id]?.status || 'open',
      })),
    ]
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
  deleteQuery(projectId, id) {
    if (!uuid.test(id)) throw problem(404, 'Query not found in this project.')
    const deleted = this.store.get(projectId).deletedQueryIds?.includes(id)
    const job = deleted ? this.jobs.get(projectId + '/' + id) : this.raw(projectId, id)
    this.store.forgetQuery(projectId, id)
    job?.controller?.abort()
    if (job) job.state = 'cancelled'
    this.queue = this.queue.filter(candidate => candidate !== job && !(candidate.projectId === projectId && candidate.id === id))
    this.jobs.delete(projectId + '/' + id)
    const file = resolve(this.folder(projectId), id + '.json')
    rmSync(file, {force:true})
    rmSync(file + '.tmp', {force:true})
    return {id, projectId, deleted:true}
  }
  dropUploads(projectId) {
    const corpus = this.store.corpus,
      keep = (doc) =>
        !(doc.ownerProjectId === projectId && doc.originalFilename)
    const ids = new Set(corpus.documents.filter(keep).map((d) => d.id))
    this.store.corpus = {
      ...corpus,
      documents: corpus.documents.filter(keep),
      passages: corpus.passages.filter((p) => ids.has(p.doc)),
      units: corpus.units.filter((u) => ids.has(u.doc)),
    }
    this.store.documents = new Map(
      this.store.corpus.documents.map((d) => [d.id, d]),
    )
    this.scopeCache.clear()
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
      result.assist = assistQuery(job.question, scope.index, result)
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
    if (this.store.get(projectId).deletedQueryIds?.includes(id))
      throw problem(410, 'This query was deleted. Run a new query to search again.')
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
        (q) => q.issueId && q.question.toLowerCase() === question.toLowerCase(),
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
  resetProject(projectId) {
    if (this.importing)
      throw problem(
        409,
        'Wait for the current document import to finish before resetting.',
      )
    this.eraseHistory(projectId)
    removeProjectImports(projectId)
    this.dropUploads(projectId)
    restoreDemoDocuments(undefined, projectId)
    this.store.reset(projectId)
    this.prepareSeeds(projectId)
  }
  resetDemo() {
    if (this.importing)
      throw problem(
        409,
        'Wait for the current document import to finish before resetting.',
      )
    this.store.restoreSeeds()
    const removed = []
    for (const project of this.store.list()) {
      if (project.protectedDemo || project.persistOnReset === true) continue
      this.eraseHistory(project.id)
      this.store.remove(project.id)
      removeProjectImports(project.id)
      this.dropUploads(project.id)
      removed.push(project.id)
    }
    for (const project of demoProjects) this.resetProject(project.id)
    return {
      removedProjectIds: removed,
      projects: this.store.list().map((p) => this.project(p.id)),
    }
  }
  async handle(req, url, res, json, readBody) {
    const pathname = url.pathname
    if (pathname === '/v1/demo/reset' && req.method === 'POST')
      return json(200, this.resetDemo())
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
    if (route === '/documents/import' && req.method === 'POST') {
      if (this.importing)
        throw problem(
          409,
          'Another document is being indexed. Try again shortly.',
        )
      this.importing = true
      let file
      let committed = false
      try {
        file = stageImport(projectId, await input())
        const added = await buildIndex(() => {}, [file])
        if (
          added.failures.length ||
          !added.documents.length ||
          !added.passages.length
        )
          throw problem(
            422,
            'No searchable text could be extracted from this PDF.',
          )
        const ids = new Set(added.documents.map((d) => d.id)),
          old = this.store.corpus
        const corpus = {
          ...old,
          documents: [
            ...old.documents.filter((d) => !ids.has(d.id)),
            ...added.documents,
          ],
          passages: [
            ...old.passages.filter((p) => !ids.has(p.doc)),
            ...added.passages,
          ],
          units: [...old.units.filter((u) => !ids.has(u.doc)), ...added.units],
        }
        const updated = this.store.attach(projectId, added.documents, corpus)
        committed = true
        try {
          finishImport(projectId, file)
        } catch {
          /* Startup completes a pending manifest write. */
        }
        this.scopeCache.clear()
        if (project.protectedDemo) this.prepareSeeds(projectId)
        return json(201, {
          project: updated,
          documents: added.documents.map((d) =>
            this.store.document(projectId, d.id),
          ),
        })
      } catch (error) {
        if (file && !committed) discardImport(projectId, file)
        throw error
      } finally {
        this.importing = false
      }
    }
    if (!route) {
      if (req.method === 'GET')
        return json(200, {
          project: this.project(projectId),
          documents: project.documentIds.map((id) =>
            this.store.document(projectId, id),
          ),
          queries: this.history(projectId),
          issues: this.issues(projectId),
          comparison: this.comparison(projectId),
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
        removeProjectImports(projectId)
        this.dropUploads(projectId)
        return json(200, { deleted: true })
      }
    }
    if (route === '/reset' && req.method === 'POST') {
      if (!project.protectedDemo)
        throw problem(400, 'Only demonstration projects have a reset state.')
      this.resetProject(projectId)
      return json(200, { project: this.project(projectId) })
    }
    if (route === '/rescan' && req.method === 'POST') {
      // Revalidate prepared document evidence and recompute current model checks.
      for (const key of this.evidence.keys())
        if (key.startsWith(projectId + '/')) this.evidence.delete(key)
      this.scopeCache.clear()
      if (project.protectedDemo) this.prepareSeeds(projectId)
      const comparison = this.comparison(projectId, true)
      return json(200, { ...comparison, issues: this.issues(projectId) })
    }
    if (route === '/compare-ifc' && req.method === 'POST')
      return json(200, this.comparison(projectId, true))
    const issueMatch = route.match(/^\/issues\/([a-z0-9-]+)$/)
    if (issueMatch && req.method === 'PATCH')
      return json(200, {
        state: this.store.setIssue(
          projectId,
          issueMatch[1],
          (await input()).status,
          this.comparison(projectId).issues.map((issue) => issue.id),
        ),
      })
    const documentMatch=route.match(/^\/documents\/(doc-[a-f0-9]+)$/)
    if (documentMatch && req.method==='PATCH') {
      this.store.document(projectId,documentMatch[1])
      const document=this.store.documents.get(documentMatch[1])
      if (document.ownerProjectId!==projectId || !document.originalFilename)
        throw problem(403,'Only uploaded documents can have their category changed.')
      if (this.importing) throw problem(409,'Wait for the current document import to finish before editing categories.')
      const {category}=await input()
      setImportCategory(projectId,document.id,category)
      const old=this.store.corpus
      try {
        this.store.attach(projectId,[{...document,category}],{...old,documents:old.documents.map(record=>record.id===document.id?{...record,category}:record)})
      } catch(error) {
        setImportCategory(projectId,document.id,document.category)
        throw error
      }
      this.scopeCache.clear()
      this.comparisonCache.clear()
      for (const key of this.evidence.keys()) if (key.startsWith(projectId+'/')) this.evidence.delete(key)
      if (project.protectedDemo) this.prepareSeeds(projectId)
      return json(200,{document:this.store.document(projectId,document.id),project:this.project(projectId)})
    }
    const modelMatch = route.match(/^\/documents\/(doc-[a-f0-9]+)\/model$/)
    if (modelMatch && req.method === 'GET') {
      this.store.document(projectId, modelMatch[1])
      const doc = this.store.documents.get(modelMatch[1])
      if (
        !doc.modelFile ||
        basename(doc.modelFile) !== doc.modelFile ||
        !doc.modelFile.endsWith('.ifc')
      )
        throw problem(404, 'This document has no associated IFC model.')
      const path = resolve(demoDocumentDirectory, doc.modelFile)
      if (!existsSync(path))
        throw problem(
          503,
          'Model file is unavailable. Restart the backend to restore it.',
        )
      res.writeHead(200, {
        'Content-Type': 'application/x-step',
        'Content-Disposition': `attachment; filename="${doc.modelFile}"`,
        'Content-Length': statSync(path).size,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      })
      createReadStream(path).pipe(res)
      return
    }
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
      if (req.method === 'DELETE')
        return json(200, this.deleteQuery(projectId, queryMatch[1]))
      const job=req.method==='GET'?this.readQuery(projectId,queryMatch[1]):this.raw(projectId,queryMatch[1])
      if (req.method === 'GET') return json(200, this.serialize(job))
      if (req.method === 'PATCH') {
        this.store.saveQuery(projectId, job.id, (await input()).saved)
        return json(200, this.serialize(job))
      }
    }
    throw problem(404, 'Project route not found.')
  }
}

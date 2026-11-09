import http from 'node:http'
import {
  createReadStream,
  statSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  existsSync,
  mkdirSync,
} from 'node:fs'
import { resolve, extname, sep } from 'node:path'
import { randomUUID, timingSafeEqual, createHash } from 'node:crypto'
import { config, stateDir } from './config.mjs'
import { buildIndex } from './indexer.mjs'
import { SearchIndex } from './search.mjs'
import { answer } from './answer.mjs'
import { suggestQueries } from './query-suggestions.mjs'
import { assistQuery } from './clarify.mjs'
import { readFrontendLocation } from './frontend-location.mjs'
import { ProjectApi } from './project-api.mjs'
import { scopedCorpus } from './project-store.mjs'

const historyDir = resolve(stateDir, 'queries')
const localModelManifest =
  config.llamaManifest && existsSync(config.llamaManifest)
    ? readFileSync(config.llamaManifest, 'utf8')
    : ''
const verifierManifest =
  config.entailmentDir &&
  existsSync(resolve(config.entailmentDir, 'source.json'))
    ? readFileSync(resolve(config.entailmentDir, 'source.json'), 'utf8')
    : ''
const engineVersion = createHash('sha256')
  .update(
    [
      'answer.mjs',
      'search.mjs',
      'indexer.mjs',
      'config.mjs',
      'model.mjs',
      'local-evidence.mjs',
      'query-suggestions.mjs',
      'clarify.mjs',
      'project-api.mjs',
      'project-imports.mjs',
      'project-description.mjs',
      'project-store.mjs',
      'project-evidence.mjs',
      'reference-collections.mjs',
      'demo-documents.mjs',
      '../demo/manifest.mjs',
      '../demo/project-packages.mjs',
      '../demo/model-documents.mjs',
      '../demo/reference-sources.mjs',
      'local-synthesis.mjs',
      'linked-tables.mjs',
      'related-criteria.mjs',
      'evidence-guards.mjs',
      'answer-completeness.mjs',
      'generation-policy.mjs',
      'review-coverage.mjs',
      'synthesis-repair.mjs',
      'evidence-units.mjs',
      'applicability.mjs',
      'retrieval-plan.mjs',
      'calculations.mjs',
      'source-lookup.mjs',
      'entailment.mjs',
      'entailment.py',
      'catalog.mjs',
      'units.mjs',
      'lookup.mjs',
      '../extract.py',
      '../native-table-layout.py',
    ]
      .map((file) => readFileSync(new URL(file, import.meta.url), 'utf8'))
      .join('') +
      config.provider +
      config.model +
      config.gatewayModel +
      config.llamaModel +
      config.llamaUrl +
      config.releaseForVerifier +
      localModelManifest +
      config.extractiveOnly +
      config.localSynthesis +
      JSON.stringify({synthesisPolicy: config.localSynthesisPolicy, reasoning: config.localReasoning, reasoningTokens: config.localReasoningTokens, contextTokens: config.localContextTokens, findingsPerCheck: config.maxFindingsPerCheck}) +
      config.entailmentDir +
      config.entailmentPython +
      verifierManifest,
  )
  .digest('hex')
const corpusVersion = () =>
  searchIndex?.corpus.documents
    .map((d) => d.version + ':' + (d.extractionVersion || ''))
    .sort()
    .join(':')
mkdirSync(historyDir, { recursive: true })
const jobs = new Map(),
  queue = []
const cancellations = new Map()
let corpus,
  searchIndex,
  projectApi,
  activeJob = null
let indexing = {
  ready: false,
  stage: 'Starting document index',
  completed: 0,
  total: 0,
}
const allowedOrigin = (origin, req) => {
  if (
    origin === `https://${req.headers.host}` ||
    origin === `http://${req.headers.host}`
  )
    return true
  if (
    config.extraOrigins.includes(origin) ||
    origin === new URL(config.frontendUrl).origin
  )
    return true
  try {
    const u = new URL(origin)
    return (
      ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname) &&
      ['http:', 'https:'].includes(u.protocol)
    )
  } catch {
    return false
  }
}
const sameToken = (value) => {
  const a = Buffer.from(value || ''),
    b = Buffer.from(config.token)
  return a.length === b.length && timingSafeEqual(a, b)
}
const serialize = (job) => ({
  id: job.id,
  question: job.question,
  sourceOnly: job.sourceOnly === true,
  state: job.state,
  stage: job.stage,
  createdAt: job.createdAt,
  completedAt: job.completedAt,
  result: job.result,
  error: job.error,
  stale:
    job.state === 'completed' &&
    (job.engineVersion !== engineVersion ||
      job.corpusVersion !== corpusVersion()),
  engineVersion: job.engineVersion,
  corpusVersion: job.corpusVersion,
})
function persist(job) {
  const path = resolve(historyDir, `${job.id}.json`)
  writeFileSync(path + '.tmp', JSON.stringify(serialize(job)))
  renameSync(path + '.tmp', path)
}
function findJob(id) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null
  if (jobs.has(id)) return jobs.get(id)
  const file = resolve(historyDir, `${id}.json`)
  if (existsSync(file)) {
    try {
      return JSON.parse(readFileSync(file, 'utf8'))
    } catch {
      return null
    }
  }
  return null
}
async function work() {
  if (activeJob || !indexing.ready) return
  const job = queue.shift()
  if (!job) return
  if (job.state === 'cancelled') {
    void work()
    return
  }
  activeJob = job
  job.state = 'running'
  try {
    job.result = await answer(job.question, searchIndex, {
      publicBase: '',
      token: config.token,
      signal: job.controller.signal,
      sourceOnly: job.sourceOnly === true,
      progress: (stage) => (job.stage = stage),
    })
    if (
      ['no_evidence', 'insufficient_evidence', 'related_evidence'].includes(
        job.result.mode,
      )
    )
      job.result.suggestions = suggestQueries(job.question, searchIndex)
    job.result.assist = assistQuery(job.question, searchIndex, job.result)
    job.engineVersion = engineVersion
    job.corpusVersion = corpusVersion()
    if (job.controller.signal.aborted) throw new Error('Cancelled')
    job.state = 'completed'
    job.stage = 'Complete'
    job.completedAt = new Date().toISOString()
    persist(job)
  } catch (error) {
    job.state = job.controller.signal.aborted ? 'cancelled' : 'failed'
    job.error =
      job.state === 'cancelled'
        ? 'Query cancelled.'
        : 'Could not complete this query. Try again.'
    console.warn('Query:', error.message)
  } finally {
    activeJob = null
    setImmediate(work)
  }
}
async function body(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    chunks.push(chunk)
    size += chunk.length
    if (
      size >
      (new URL(req.url, 'http://localhost').pathname.endsWith(
        '/documents/import',
      )
        ? 17 * 1024 * 1024
        : 40000)
    ) {
      const e = new Error('Request is too large')
      e.status = 413
      throw e
    }
  }
  try {
    const input = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (!input || typeof input !== 'object' || Array.isArray(input))
      throw new Error('Expected an object')
    return input
  } catch {
    const e = new Error('Invalid JSON')
    e.status = 400
    throw e
  }
}
export const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin
  const json = (status, data) => {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    })
    res.end(JSON.stringify(data))
  }
  res.setHeader('Vary', 'Origin')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  if (origin) {
    if (!allowedOrigin(origin, req))
      return json(403, { error: 'This browser origin is not allowed.' })
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader(
      'Access-Control-Expose-Headers',
      'Content-Length, Content-Range, Accept-Ranges, Content-Type',
    )
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, Range',
      'Access-Control-Allow-Private-Network': 'true',
      'Access-Control-Max-Age': '600',
    })
    res.end()
    return
  }
  try {
    const url = new URL(req.url, 'http://127.0.0.1')
    if (
      req.method === 'GET' &&
      (['/app', '/app/', '/basis.svg', '/basis-logo.png'].includes(
        url.pathname,
      ) ||
        /^\/(assets|documents)\//.test(url.pathname))
    ) {
      const frontend = readFrontendLocation(),
        file = resolve(
          frontend,
          url.pathname.startsWith('/app')
            ? 'index.html'
            : '.' + decodeURIComponent(url.pathname),
        )
      if (
        !file.startsWith(frontend + sep) ||
        !existsSync(file) ||
        !statSync(file).isFile()
      )
        return json(404, {
          error: 'Local frontend not built. Start with the one-click launcher.',
        })
      const types = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'text/javascript',
        '.mjs': 'text/javascript',
        '.css': 'text/css',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.pdf': 'application/pdf',
      }
      res.writeHead(200, {
        'Content-Type': types[extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
      })
      createReadStream(file).pipe(res)
      return
    }
    const supplied =
      req.headers.authorization?.replace(/^Bearer\s+/i, '') ||
      url.searchParams.get('token')
    if (url.pathname === '/health' && req.method === 'GET')
      return json(200, {
        service: 'basis-backend-matvey',
        version: 1,
        ...indexing,
        ...(indexing.ready && projectApi
          ? {
              completed: projectApi.store.corpus.documents.length,
              total:
                projectApi.store.corpus.documents.length +
                (corpus?.failures.length || 0),
            }
          : {}),
        stage: sameToken(supplied)
          ? indexing.stage
          : indexing.ready
            ? 'Ready'
            : 'Indexing documents',
        documents: searchIndex?.corpus.documents.length || 0,
        passages: searchIndex?.corpus.passages.length || 0,
        projectDocuments:
          (projectApi?.store.corpus || corpus)?.documents.filter(
            (d) => d.projectArtifact,
          ).length || 0,
        importing: !!projectApi?.importing,
        failures: corpus?.failures.length || 0,
        model:
          config.provider === 'extractive'
            ? 'none (offline source lookup)'
            : config.provider === 'gateway'
              ? config.gatewayModel
              : config.provider === 'llamacpp'
                ? config.llamaModel
                : config.model,
        units: corpus?.units?.length || 0,
        provider: config.provider,
        generationPolicy: config.extractiveOnly ? 'extractive' : config.localSynthesisPolicy,
        activeQueries: Number(!!activeJob) + Number(!!projectApi?.active),
        queuedQueries:
          queue.filter((j) => j.state === 'queued').length +
          (projectApi?.queue.length || 0),
      })
    if (!sameToken(supplied))
      return json(401, { error: 'Connection key is missing or incorrect.' })
    if (
      url.pathname === '/v1/reference-collections' ||
      url.pathname === '/v1/demo/reset' ||
      /^\/v1\/projects(?:\/|$)/.test(url.pathname)
    ) {
      if (!projectApi || !indexing.ready)
        return json(503, {
          error: 'Project documents are still indexing.',
          stage: indexing.stage,
        })
      return await projectApi.handle(req, url, res, json, body)
    }
    if (url.pathname === '/v1/documents' && req.method === 'GET') {
      if (!indexing.ready)
        return json(503, {
          error: 'Documents are still indexing.',
          stage: indexing.stage,
        })
      return json(200, {
        failures: corpus.failures.map((f) => ({
          name: f.name,
          error:
            'PDF text extraction failed or returned no usable passages. See the local index log.',
        })),
        documents: searchIndex.corpus.documents.map(
          ({ filePath: _filePath, ...d }) => ({
            ...d,
            file: `/v1/documents/${d.id}/file?token=${encodeURIComponent(config.token)}`,
          }),
        ),
      })
    }
    const fileMatch = url.pathname.match(
      /^\/v1\/documents\/([a-z0-9-]+)\/file$/,
    )
    if (fileMatch && req.method === 'GET') {
      const doc = searchIndex?.corpus.documents.find(
        (d) => d.id === fileMatch[1],
      )
      if (!doc) return json(404, { error: 'Document not found.' })
      const size = statSync(doc.filePath).size,
        headers = {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'inline',
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'private, max-age=3600',
        }
      if (req.headers.range) {
        const range = req.headers.range.match(/^bytes=(\d*)-(\d*)$/)
        if (!range || (!range[1] && !range[2])) {
          res.writeHead(416, { 'Content-Range': `bytes */${size}` })
          res.end()
          return
        }
        const start = range[1]
            ? Number(range[1])
            : Math.max(0, size - Number(range[2])),
          end =
            range[1] && range[2]
              ? Math.min(size - 1, Number(range[2]))
              : size - 1
        if (start > size - 1 || start > end) {
          res.writeHead(416, { 'Content-Range': `bytes */${size}` })
          res.end()
          return
        }
        res.writeHead(206, {
          ...headers,
          'Content-Length': end - start + 1,
          'Content-Range': `bytes ${start}-${end}/${size}`,
        })
        createReadStream(doc.filePath, { start, end }).pipe(res)
      } else {
        res.writeHead(200, { ...headers, 'Content-Length': size })
        createReadStream(doc.filePath).pipe(res)
      }
      return
    }
    if (url.pathname === '/v1/queries' && req.method === 'POST') {
      if (!indexing.ready)
        return json(503, {
          error: 'Documents are still indexing.',
          stage: indexing.stage,
        })
      if (!String(req.headers['content-type']).startsWith('application/json'))
        return json(415, { error: 'Send application/json.' })
      const input = await body(req),
        question =
          typeof input.question === 'string' ? input.question.trim() : ''
      if (!question || question.length > 6000)
        return json(400, {
          error: 'Enter a question between 1 and 6000 characters.',
        })
      if (
        input.sourceOnly !== undefined &&
        typeof input.sourceOnly !== 'boolean'
      )
        return json(400, { error: 'sourceOnly must be a boolean.' })
      if (
        input.id !== undefined &&
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
          input.id,
        )
      )
        return json(400, { error: 'Request id must be a UUID.' })
      const id = input.id || randomUUID(),
        previous = findJob(id)
      if (previous)
        return previous.question === question &&
          (previous.sourceOnly === true) === (input.sourceOnly === true)
          ? json(202, serialize(previous))
          : json(409, {
              error: 'Request id already belongs to another question.',
            })
      if (cancellations.has(id))
        return json(202, {
          id,
          question,
          state: 'cancelled',
          stage: 'Cancelled',
        })
      if (queue.filter((j) => j.state === 'queued').length >= 4)
        return json(429, {
          error: 'The local backend is busy. Try again shortly.',
        })
      const job = {
        id,
        question,
        sourceOnly: input.sourceOnly === true,
        state: 'queued',
        stage: 'Waiting for the local reviewer',
        createdAt: new Date().toISOString(),
        controller: new AbortController(),
      }
      jobs.set(job.id, job)
      queue.push(job)
      void work()
      return json(202, serialize(job))
    }
    if (url.pathname === '/v1/queries' && req.method === 'GET') {
      const entries = readdirSync(historyDir)
        .filter((f) => f.endsWith('.json'))
        .map((file) => {
          try {
            const j = JSON.parse(
              readFileSync(resolve(historyDir, file), 'utf8'),
            )
            return {
              id: j.id,
              question: j.question,
              state: j.state,
              createdAt: j.createdAt,
              completedAt: j.completedAt,
            }
          } catch {
            return null
          }
        })
        .filter(Boolean)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 100)
      return json(200, { queries: entries })
    }
    const queryMatch = url.pathname.match(/^\/v1\/queries\/([a-f0-9-]{36})$/)
    if (queryMatch) {
      const job = findJob(queryMatch[1])
      if (!job && req.method === 'DELETE') {
        for (const [id, time] of cancellations)
          if (time < Date.now() - 60000) cancellations.delete(id)
        if (cancellations.size >= 512)
          cancellations.delete(cancellations.keys().next().value)
        cancellations.set(queryMatch[1], Date.now())
        return json(200, { id: queryMatch[1], state: 'cancelled' })
      }
      if (!job) return json(404, { error: 'Query not found.' })
      if (req.method === 'GET') return json(200, serialize(job))
      if (req.method === 'DELETE') {
        if (job.controller && ['queued', 'running'].includes(job.state)) {
          job.controller.abort()
          job.state = 'cancelled'
          job.stage = 'Cancelled'
        }
        return json(200, { id: job.id, state: job.state })
      }
    }
    return json(404, { error: 'Endpoint not found.' })
  } catch (error) {
    console.error(error.message)
    if (!res.headersSent)
      json(error.status || 500, {
        error: error.status
          ? error.message
          : 'The local backend could not handle this request.',
      })
    else res.end()
  }
})
server.requestTimeout = 180000
server.listen(config.port, '127.0.0.1', () =>
  console.log(`basis Matvey backend: http://127.0.0.1:${config.port}`),
)
server.on('error', (error) => {
  console.error(error.message)
  process.exitCode = 1
})
buildIndex((stage, completed, total) => {
  indexing = { ready: false, stage, completed, total }
  console.log(stage)
})
  .then((result) => {
    corpus = result
    searchIndex = new SearchIndex(
      scopedCorpus(
        corpus,
        corpus.documents.filter((d) => !d.projectArtifact).map((d) => d.id),
      ),
    )
    projectApi = new ProjectApi(corpus, stateDir, engineVersion)
    indexing = {
      ready: corpus.documents.length > 0,
      stage: corpus.documents.length ? 'Ready' : 'No readable documents found',
      completed: corpus.documents.length,
      total: corpus.documents.length + corpus.failures.length,
    }
    console.log(`${corpus.passages.length} searchable passages ready`)
  })
  .catch((error) => {
    indexing.stage = 'Indexing failed'
    console.error(error)
  })
function close() {
  for (const job of jobs.values()) job.controller?.abort()
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 2000).unref()
}
process.on('SIGINT', close)
process.on('SIGTERM', close)

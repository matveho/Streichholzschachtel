import { useEffect, useMemo, useRef, useState } from 'react'
import type { Reference } from './data'
import type { ReportBlock } from './QueryReport'
export type BackendMode = 'static' | 'main' | 'matvey'
export type BackendSettings = {
  mode: BackendMode
  mainUrl: string
  matveyUrl: string
  key: string
  mainKey: string
}
export type DocumentRecord = {
  model?: string
  label: string
  code: string
  title: string
  edition: string
  file: string
  pages: number
  initialPage: number
  source: string
  pageSizes?: Record<number, [number, number]>
}
export type LiveResult = {
  documents: Record<string, DocumentRecord>
  references: Reference[]
  report: ReportBlock[]
  mode: string
  notes: string[]
  id: string
  suggestions?: QuerySuggestion[]
  assist?: QueryAssist
}
export type QueryOutcome =
  'answered' | 'vague' | 'partial' | 'not_found' | 'jurisdiction' | 'off_topic'
/** Conversational help the backend attaches to every finished query. */
export type QueryAssist = {
  outcome: QueryOutcome
  /** Municipality named in the question that the documents don't cover. */
  jurisdiction?: string
  /** Kind of document that would probably answer the question. */
  missing?: string
  /** Specific parameters the question leaves out, e.g. the pipe diameter. */
  details: string[]
  /** Answerable sample questions, offered when the search isn't engineering. */
  examples?: string[]
  /** Each option has already been checked to produce a sourced answer. */
  clarifications: {
    question: string
    options: { label: string; question: string }[]
  }[]
}
export type QuerySuggestion = {
  question: string
  sourceLabel: string
  page: number
  preview: string
  sourceOnly: true
}
const defaults: BackendSettings = {
  mode: 'matvey',
  mainUrl: '',
  matveyUrl: location.origin + '/local-api',
  key: '',
  mainKey: '',
}
export function readSettings(): BackendSettings {
  return { ...defaults }
}
export function saveSettings(value: BackendSettings) {
  try {
    localStorage.setItem('basis.backends.v1', JSON.stringify(value))
  } catch {}
}
export const baseUrl = (s: BackendSettings) =>
  (s.mode === 'main' ? s.mainUrl : s.matveyUrl).replace(/\/$/, '')
export const connectionKey = (s: BackendSettings) =>
  s.mode === 'main' ? s.mainKey : s.key
export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}
export async function api(
  s: BackendSettings,
  path: string,
  init: RequestInit = {},
) {
  const base = baseUrl(s)
  if (!base) throw new Error('Set the backend URL in Home first.')
  const secret = connectionKey(s)
  const response = await fetch(base + path, {
    ...init,
    signal: init.signal
      ? AbortSignal.any([init.signal, AbortSignal.timeout(120000)])
      : AbortSignal.timeout(120000),
    headers: {
      ...(secret ? { Authorization: 'Bearer ' + secret } : {}),
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  })
  let body
  try {
    body = await response.json()
  } catch {
    throw new ApiError(
      response.status,
      'The backend did not return a usable response.',
    )
  }
  if (!response.ok)
    throw new ApiError(
      response.status,
      body.error || `Backend returned ${response.status}`,
    )
  return body
}
/** A finished query job as the backend returns it. */
export type QueryJob = {
  projectId?: string
  documentIds?: string[]
  id: string
  state: string
  result?: unknown
}

type RawResult = Omit<LiveResult, 'documents' | 'id'> & {
  documents: (DocumentRecord & { id: string })[]
}

/** Turns a completed job into a result, pinning document links to the backend. */
function liveResult(
  settings: BackendSettings,
  job: QueryJob,
  projectId?: string,
  projectDocuments?: Record<string, DocumentRecord>,
): LiveResult {
  const result = job.result as RawResult,
    docs: Record<string, DocumentRecord> = {}
  if (projectId && job.projectId !== projectId)
    throw new Error('Query belongs to a different project.')
  for (const record of result.documents) {
    if (projectId) {
      const scoped = projectDocuments?.[record.id]
      if (!scoped || (job.documentIds && !job.documentIds.includes(record.id)))
        throw new Error('A query source is unavailable in this project.')
      docs[record.id] = {
        ...scoped,
        initialPage:
          Number.isInteger(record.initialPage) &&
          record.initialPage >= 1 &&
          record.initialPage <= scoped.pages
            ? record.initialPage
            : scoped.initialPage,
      }
      continue
    }
    const file = new URL(record.file, baseUrl(settings))
    if (file.origin !== new URL(baseUrl(settings)).origin)
      throw new Error('The backend returned a document on a different server.')
    const secret = connectionKey(settings)
    if (secret) file.searchParams.set('token', secret)
    docs[record.id] = { ...record, file: file.href }
  }
  const validRect = (rect: Reference['rect']) =>
    Array.isArray(rect) &&
    rect.length === 4 &&
    rect.every(Number.isFinite) &&
    rect[0] >= 0 &&
    rect[1] >= 0 &&
    rect[2] > 0 &&
    rect[3] > 0
  const references = result.references.flatMap((ref) => {
    const regions = (ref.regions ?? [ref.rect]).filter(validRect)
    if (
      !regions.length ||
      !docs[ref.doc] ||
      !Number.isInteger(ref.page) ||
      ref.page < 1 ||
      ref.page > docs[ref.doc].pages
    )
      return []
    return [{ ...ref, regions, rect: regions[0] }]
  })
  if (references.length === result.references.length)
    return { ...result, references, documents: docs, id: job.id }
  const available = new Set(references.map((ref) => ref.id))
  const report = result.report.map((block) => ({
    ...block,
    sentences: block.sentences.map((sentence) => ({
      ...sentence,
      refs: sentence.refs?.filter((id) => available.has(id)),
    })),
  }))
  return {
    ...result,
    report,
    references,
    documents: docs,
    id: job.id,
    notes: [...result.notes, 'Some citation locations are unavailable.'],
  }
}

export function useLiveQuery(
  settings: BackendSettings,
  question: string,
  retry: number,
  sourceOnly = false,
  projectId?: string,
  existingJobId?: string,
  /** An already fetched job, shown immediately instead of fetched again. */
  preloaded?: QueryJob,
  projectDocuments?: Record<string, DocumentRecord>,
) {
  const path = projectId
    ? `/v1/projects/${encodeURIComponent(projectId)}/queries`
    : '/v1/queries'
  const key = JSON.stringify([
    settings,
    question,
    retry,
    sourceOnly,
    projectId,
    existingJobId,
  ])
  const ready = useMemo(() => {
    if (
      settings.mode === 'static' ||
      !question ||
      retry ||
      !existingJobId ||
      preloaded?.id !== existingJobId ||
      preloaded.state !== 'completed' ||
      !preloaded.result
    )
      return null
    try {
      return {
        data: liveResult(settings, preloaded, projectId, projectDocuments),
        error: '',
      }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Unusable result.',
      }
    }
  }, [
    settings,
    question,
    retry,
    existingJobId,
    preloaded,
    projectId,
    projectDocuments,
  ])
  const cancelRef = useRef<() => void>(() => {})
  const [state, setState] = useState<{
    key: string
    phase: string
    data: LiveResult | null
    error: string
  }>({ key: '', phase: '', data: null, error: '' })
  useEffect(() => {
    if (settings.mode === 'static' || !question || ready) return
    const controller = new AbortController()
    let jobId = '',
      finished = false,
      createdHere = false,
      cancellable = false
    cancelRef.current = () => {
      controller.abort()
      if (jobId && (createdHere || cancellable))
        void api(settings, `${path}/${jobId}`, { method: 'DELETE' }).catch(
          () => {},
        )
      setState({ key, phase: '', data: null, error: 'Query cancelled.' })
    }
    async function run() {
      try {
        const cacheKey =
          'basis.result.' +
          JSON.stringify([
            settings.mode,
            baseUrl(settings),
            question,
            sourceOnly,
            projectId,
          ])
        let job
        if (existingJobId && !retry) {
          job = await api(settings, `${path}/${existingJobId}`, {
            signal: controller.signal,
          })
          if (job.id !== existingJobId)
            throw new Error('Unexpected query response. Please retry.')
          if (job.stale)
            throw new Error(
              'Project documents changed. Run this query again from the project dashboard.',
            )
        } else if (!retry) {
          try {
            const saved = localStorage.getItem(cacheKey)
            if (saved)
              job = await api(settings, path + '/' + saved, {
                signal: controller.signal,
              })
          } catch {}
        }
        if (
          !job ||
          job.stale ||
          (!existingJobId && job.state !== 'completed')
        ) {
          const requestedId =
            settings.mode === 'matvey' ? crypto.randomUUID() : undefined
          if (requestedId) jobId = requestedId
          createdHere = true
          job = await api(settings, path, {
            method: 'POST',
            body: JSON.stringify({
              question,
              sourceOnly,
              ...(projectId
                ? {
                    documentIds:
                      preloaded?.documentIds ??
                      Object.keys(projectDocuments ?? {}),
                  }
                : {}),
              ...(requestedId ? { id: requestedId } : {}),
            }),
            signal: controller.signal,
          })
        }
        jobId = job.id
        cancellable = ['queued', 'running'].includes(job.state)
        const deadline = Date.now() + 120000
        while (!controller.signal.aborted) {
          if (Date.now() > deadline)
            throw new Error(
              'Query is taking longer than expected. Reopen it from history to check its progress.',
            )
          if (job.id !== jobId || (projectId && job.projectId !== projectId))
            throw new Error('Unexpected query response. Please retry.')
          if (job.state === 'completed') {
            const data = liveResult(settings, job, projectId, projectDocuments)
            try {
              localStorage.setItem(cacheKey, job.id)
            } catch {}
            finished = true
            setState({
              key,
              phase: 'Complete',
              data,
              error: '',
            })
            return
          }
          if (['failed', 'cancelled'].includes(job.state))
            throw new Error(job.error || 'Query was cancelled.')
          setState({
            key,
            phase: job.stage || 'Searching documents',
            data: null,
            error: '',
          })
          await new Promise<void>((resolve, reject) => {
            const stop = () => {
              clearTimeout(t)
              reject(new Error('Cancelled'))
            }
            const t = setTimeout(() => {
              controller.signal.removeEventListener('abort', stop)
              resolve()
            }, 1000)
            controller.signal.addEventListener('abort', stop, { once: true })
          })
          job = await api(settings, `${path}/${jobId}`, {
            signal: controller.signal,
          })
        }
      } catch (error) {
        if (!controller.signal.aborted)
          setState({
            key,
            phase: '',
            data: null,
            error:
              error instanceof Error
                ? error.message
                : 'Unable to connect to the backend.',
          })
      }
    }
    void run()
    return () => {
      controller.abort()
      if (jobId && createdHere && !finished)
        void api(settings, `${path}/${jobId}`, { method: 'DELETE' }).catch(
          () => {},
        )
    }
  }, [
    key,
    settings,
    question,
    retry,
    sourceOnly,
    projectId,
    existingJobId,
    path,
    projectDocuments,
    preloaded,
    ready,
  ])
  if (ready)
    return {
      phase: ready.data ? 'Complete' : '',
      ...ready,
      busy: false,
      cancel: () => cancelRef.current(),
    }
  if (settings.mode === 'static' || !question)
    return {
      phase: '',
      data: null,
      error: '',
      busy: false,
      cancel: () => cancelRef.current(),
    }
  return state.key === key
    ? {
        ...state,
        busy: !state.data && !state.error,
        cancel: () => cancelRef.current(),
      }
    : {
        phase: 'Connecting to backend',
        data: null,
        error: '',
        busy: true,
        cancel: () => cancelRef.current(),
      }
}

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Reference } from './data'
import type { ReportBlock } from './QueryReport'
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
export const baseUrl = location.origin + '/local-api'
export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}
export async function api(path: string, init: RequestInit = {}) {
  const response = await fetch(baseUrl + path, {
    ...init,
    headers: {
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
export type QueryJob = { id: string; state: string; result?: unknown }

type RawResult = Omit<LiveResult, 'documents' | 'id'> & {
  documents: (DocumentRecord & { id: string })[]
}

/** Turns a completed job into a result, pinning document links to the backend. */
function liveResult(job: QueryJob): LiveResult {
  const result = job.result as RawResult,
    docs: Record<string, DocumentRecord> = {}
  for (const record of result.documents) {
    const file = new URL(record.file, baseUrl)
    if (file.origin !== new URL(baseUrl).origin)
      throw new Error('The backend returned a document on a different server.')
    docs[record.id] = { ...record, file: file.href }
  }
  return { ...result, documents: docs, id: job.id }
}

export function useLiveQuery(
  question: string,
  projectId: string,
  existingJobId?: string,
  /** An already fetched job, shown immediately instead of fetched again. */
  preloaded?: QueryJob,
) {
  const path = `/v1/projects/${encodeURIComponent(projectId)}/queries`
  const key = JSON.stringify([projectId, existingJobId])
  const ready = useMemo(() => {
    if (
      !question ||
      !existingJobId ||
      preloaded?.id !== existingJobId ||
      preloaded.state !== 'completed' ||
      !preloaded.result
    )
      return null
    try {
      return { data: liveResult(preloaded), error: '' }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Unusable result.',
      }
    }
  }, [question, existingJobId, preloaded])
  const cancelRef = useRef<() => void>(() => {})
  const [state, setState] = useState<{
    key: string
    phase: string
    data: LiveResult | null
    error: string
  }>({ key: '', phase: '', data: null, error: '' })
  useEffect(() => {
    if (!question || !existingJobId || ready) return
    const controller = new AbortController()
    let cancellable = false
    const url = path + '/' + existingJobId
    cancelRef.current = () => {
      controller.abort()
      if (cancellable) void api(url, { method: 'DELETE' }).catch(() => {})
      setState({ key, phase: '', data: null, error: 'Query cancelled.' })
    }
    async function run() {
      try {
        let job = await api(url, { signal: controller.signal })
        if (job.stale)
          throw new Error(
            'Project documents changed. Run the query again from the project dashboard.',
          )
        cancellable = ['queued', 'running'].includes(job.state)
        while (!controller.signal.aborted) {
          if (job.state === 'completed') {
            const data = liveResult(job)
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
          job = await api(url, {
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
    return () => controller.abort()
  }, [key, question, existingJobId, path, ready])
  if (ready)
    return {
      phase: ready.data ? 'Complete' : '',
      ...ready,
      busy: false,
      cancel: () => cancelRef.current(),
    }
  if (!question)
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

import { useEffect, useRef, useState } from 'react'
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
export function useLiveQuery(
  settings: BackendSettings,
  question: string,
  retry: number,
  sourceOnly = false,
  projectId?: string,
  existingJobId?: string,
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
  const cancelRef = useRef<() => void>(() => {})
  const [state, setState] = useState<{
    key: string
    phase: string
    data: LiveResult | null
    error: string
  }>({ key: '', phase: '', data: null, error: '' })
  useEffect(() => {
    if (settings.mode === 'static' || !question) return
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
              ...(requestedId ? { id: requestedId } : {}),
            }),
            signal: controller.signal,
          })
        }
        jobId = job.id
        cancellable = ['queued', 'running'].includes(job.state)
        while (!controller.signal.aborted) {
          if (job.state === 'completed') {
            const result = job.result,
              docs: Record<string, DocumentRecord> = {}
            for (const record of result.documents) {
              const file = new URL(record.file, baseUrl(settings))
              if (file.origin !== new URL(baseUrl(settings)).origin)
                throw new Error(
                  'The backend returned a document on a different server.',
                )
              const secret = connectionKey(settings)
              if (secret) file.searchParams.set('token', secret)
              docs[record.id] = { ...record, file: file.href }
            }
            try {
              localStorage.setItem(cacheKey, job.id)
            } catch {}
            finished = true
            setState({
              key,
              phase: 'Complete',
              data: { ...result, documents: docs, id: job.id },
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
  ])
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

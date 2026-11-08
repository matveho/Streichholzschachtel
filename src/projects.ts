import { api, readSettings, baseUrl, connectionKey } from './backend'
import type { DocumentRecord } from './backend'
export type Project = {
  id: string
  name: string
  client: string
  location: string
  description: string
  descriptionMode?: 'auto' | 'manual'
  discipline: string
  protectedDemo: boolean
  persistOnReset: boolean
  documentIds: string[]
  collectionIds: string[]
  documentCount: number
  openIssueCount: number
}
export type ProjectDocument = DocumentRecord & {
  id: string
  category: string
  ownerProjectId?: string
  projectArtifact?: boolean
  filename?: string
}
export type Collection = {
  id: string
  title: string
  authority: string
  jurisdiction: string
  description: string
  documentIds: string[]
  documentCount: number
  missingFiles?: string[]
}
export type ProjectQuery = {
  documentIds?: string[]
  id: string
  projectId: string
  question: string
  sourceOnly: boolean
  state: string
  createdAt: string
  saved: boolean
  prepared: boolean
  stale: boolean
  error?: string
  /** How the answer turned out; set by the backend's conversation layer. */
  outcome?: string
}
export type ProjectIssue = {
  id: string
  title: string
  explanation: string
  status: string
  prepared: boolean
  verified: boolean
  queryId: string | null
  citations: { doc: string; page: number; label: string; excerpt: string }[]
}
export type ProjectData = {
  project: Project
  documents: ProjectDocument[]
  queries: ProjectQuery[]
  issues: ProjectIssue[]
  collections: Collection[]
}
export const projectPath = (id: string) =>
  '/v1/projects/' + encodeURIComponent(id)
export const requestProject = (path: string, method: string, value?: unknown) =>
  api(readSettings(), path, {
    method,
    ...(value === undefined ? {} : { body: JSON.stringify(value) }),
  })
export function projectDocumentMap(
  records: ProjectDocument[],
): Record<string, DocumentRecord> {
  const settings = readSettings(),
    origin = new URL(baseUrl(settings)).origin
  return Object.fromEntries(
    records.map((doc) => {
      const file = new URL(doc.file, baseUrl(settings))
      if (file.origin !== origin)
        throw new Error('A project document pointed to a different server.')
      const key = connectionKey(settings)
      if (key) file.searchParams.set('token', key)
      let model: string | undefined
      if (doc.model) {
        const url = new URL(doc.model, baseUrl(settings))
        if (url.origin !== origin)
          throw new Error('A project model pointed to a different server.')
        if (key) url.searchParams.set('token', key)
        model = url.href
      }
      return [doc.id, { ...doc, file: file.href, model }]
    }),
  )
}

import { api, baseUrl } from './backend'
import type { DocumentRecord } from './backend'
export type Project = {
  issuesEnabled?: boolean
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
  projectArtifact?: boolean
  originalFilename?: string
  ownerProjectId?: string
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
  id: string
  projectId: string
  question: string
  sourceOnly: boolean
  documentIds?: string[]
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
  category?: string
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
  comparison?: {
    modelCount: number
    checkedAt: string
    errors: string[]
    coverage: {
      doc: string
      label: string
      category: string
      checks: number
      status: string
      reason?: string
    }[]
  }
}
export const projectPath = (id: string) =>
  '/v1/projects/' + encodeURIComponent(id)
export const requestProject = (path: string, method: string, value?: unknown) =>
  api(path, {
    method,
    ...(value === undefined ? {} : { body: JSON.stringify(value) }),
  })
export function projectDocumentMap(
  records: ProjectDocument[],
): Record<string, DocumentRecord> {
  const origin = new URL(baseUrl).origin
  return Object.fromEntries(
    records.map((doc) => {
      const file = new URL(doc.file, baseUrl)
      if (file.origin !== origin)
        throw new Error('A project document pointed to a different server.')
      let model: string | undefined
      if (doc.model) {
        const url = new URL(doc.model, baseUrl)
        if (url.origin !== origin)
          throw new Error('A project model pointed to a different server.')
        model = url.href
      }
      return [doc.id, { ...doc, file: file.href, model }]
    }),
  )
}

import { useState } from 'react'
import { AppHeader } from './AppHeader'
import { DocumentContext } from './DocumentContext'
import { PdfPane } from './PdfPane'
import { ScopedQueryBar } from './ScopedQueryBar'
import type { DocumentRecord } from './backend'
import type { Reference } from './data'

const emptyReferences: Reference[] = []
export function ProjectDocumentReader({
  projectId,
  projectName,
  documentId,
  documents,
  onRun,
}: {
  projectId: string
  projectName: string
  documentId: string
  documents: Record<string, DocumentRecord>
  onRun: (question: string, documentIds: string[]) => Promise<void>
}) {
  const [question, setQuestion] = useState('')
  const [documentIds, setDocumentIds] = useState([documentId])
  const [busy, setBusy] = useState(false)
  const doc = documents[documentId]
  return (
    <DocumentContext.Provider value={documents}>
      <main className="workspace">
        <AppHeader
          context={projectName}
          homeHref={'#project/' + projectId}
          onNew={() => {}}
          showNewQuery={false}
        />
        <ScopedQueryBar
          value={question}
          onChange={setQuestion}
          documents={documents}
          documentId={documentId}
          documentIds={documentIds}
          onScopeChange={setDocumentIds}
          busy={busy}
          onSubmit={async (question, ids) => {
            setBusy(true)
            try {
              await onRun(question, ids)
            } finally {
              setBusy(false)
            }
          }}
        />
        {doc.model && (
          <div className="model-document-toolbar">
            <a className="model-download" href={doc.model} download>
              Download IFC
            </a>
          </div>
        )}
        <div className="project-document-view">
          <PdfPane
            key={documentId}
            id={documentId}
            active={emptyReferences}
            navigationKey={0}
            sourceReferences={emptyReferences}
            onSelectReferences={() => {}}
          />
        </div>
      </main>
    </DocumentContext.Provider>
  )
}

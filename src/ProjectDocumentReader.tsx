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
  const [mode,setMode] = useState<'document'|'project'>('document')
  const [focused,setFocused] = useState(documentId)
  const [pair,setPair] = useState([documentId])
  const [opened,setOpened] = useState([documentId])
  const doc = documents[focused] || documents[documentId]
  const shown=(mode==='document'?[focused]:pair.filter(id=>documentIds.includes(id))).filter(id=>!!documents[id])
  function choosePair(ids:string[],first=focused){
    const next=[...new Set([...(ids.includes(first)?[first]:[]),...pair.filter(id=>ids.includes(id)),...ids])].slice(0,2)
    setPair(next)
    setOpened(previous=>[...new Set([...previous,...next])])
    if(next.length&&!ids.includes(focused))setFocused(next[0])
  }
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
          documentId={focused}
          documentIds={documentIds}
          onScopeChange={(ids)=>{
            setDocumentIds(ids)
            if(mode==='project')choosePair(ids)
          }}
          onModeChange={(next,ids)=>{
            setMode(next)
            if(next==='project')choosePair(ids)
          }}
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
        <section className="document-workspace" aria-label="Document workspace">
          {mode==='project' && (
            <div className="document-tabs reader-document-controls" role="toolbar" aria-label="Project document views">
              {[0,1].map(position=>(
                <label key={position}>
                  {position===0?'Left document':'Right document'}
                  <select
                    aria-label={position===0?'Left document':'Right document'}
                    value={shown[position] || ''}
                    onChange={event=>{
                      const id=event.target.value
                      setPair(previous=>position===0?[id,...previous.slice(1)]:[previous[0],id])
                      setOpened(previous=>[...new Set([...previous,id])])
                      setFocused(id)
                    }}
                    disabled={!documentIds.length || (position===1 && documentIds.length<2)}
                  >
                    {!shown[position] && <option value="">Select a document</option>}
                    {documentIds.filter(id=>id!==shown[1-position]).map(id=>(
                      <option key={id} value={id}>{documents[id]?.title}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          )}
          {!shown.length && <p className="project-empty">Select documents to inspect and search.</p>}
          <div className={'document-panes reader-document-panes '+(mode==='project'?'split':'tabs')} data-view={mode==='project'?'multiple':'single'}>
            {opened.map(id=>(
              <div key={id} className={'pane-slot '+(shown.includes(id)?'':'hidden')} style={{order:shown.indexOf(id)}}
                onPointerDown={()=>setFocused(id)} onFocusCapture={()=>setFocused(id)}>
                <PdfPane id={id} active={emptyReferences} navigationKey={0}
                  sourceReferences={emptyReferences} onSelectReferences={()=>{}} />
              </div>
            ))}
          </div>
        </section>
      </main>
    </DocumentContext.Provider>
  )
}

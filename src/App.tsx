import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  Search,
  Columns2,
  PanelTop,
  Copy,
  Check,
  X,
  FileText,
  Maximize2,
  Minimize2,
} from 'lucide-react'
import { DocumentContext } from './DocumentContext'
import { useLiveQuery } from './backend'
import type { DocumentRecord, QueryJob } from './backend'
import type { DocId } from './data'
import { PdfPane } from './PdfPane'
import { QueryReport } from './QueryReport'
import { QuerySuggestions } from './QuerySuggestions'
import { QueryAssist, QueryThread } from './QueryAssist'
import { outcomeOf } from './assist'
import type { ThreadTurn } from './assist'
import { AppHeader } from './AppHeader'
import { ScopedQueryBar } from './ScopedQueryBar'

/** Where a new search came from, so the query tab can keep the thread. */
export type RunContext = {
  from: string
  choice?: string
  /** A rephrased question: searched on its own, starting a new thread. */
  fresh?: boolean
  documentIds?: string[]
}

const narrowViewer = window.matchMedia('(max-width: 720px)')
function subscribeViewerWidth(update: () => void) {
  narrowViewer.addEventListener('change', update)
  return () => narrowViewer.removeEventListener('change', update)
}

export function QueryWorkspace({
  entry,
  onRun,
  onNew,
  projectName,
  projectDocuments,
  draft,
  onDraftChange,
  thread = [],
  finding = false,
  preloadedJob,
  onUpload,
}: {
  entry: {
    projectId: string
    queryId?: string
    prompt: string
    sourceOnly?: boolean
    documentIds?: string[]
  }
  onRun: (
    prompt: string,
    sourceOnly?: boolean,
    context?: RunContext,
  ) => void | Promise<void>
  onNew: () => void
  projectName?: string
  projectDocuments?: Record<string, DocumentRecord>
  /** Unsent text restored when returning to this query's tab. */
  draft?: string
  onDraftChange?: (text: string) => void
  /** Earlier questions asked in this query's tab. */
  thread?: ThreadTurn[]
  /** The finished job for this query, if already fetched. */
  finding?: boolean
  preloadedJob?: QueryJob
  /** Opens the project's document upload; absent where uploads aren't possible. */
  onUpload?: () => void
}) {
  const [query, setQuery] = useState(draft ?? entry.prompt)
  const [submitted, setSubmitted] = useState(entry.prompt)
  const [queryScope, setQueryScope] = useState(
    () => entry.documentIds ?? Object.keys(projectDocuments ?? {}),
  )
  const live = useLiveQuery(
    submitted,
    entry.projectId,
    entry.queryId,
    preloadedJob,
  )
  const documents = live.data?.documents ?? projectDocuments ?? {}
  const report = live.data?.report ?? []
  const references = live.data?.references ?? []
  const sourceIds = Object.keys(documents)
  const noAnswer =
    !!live.data &&
    ['no_evidence', 'insufficient_evidence'].includes(live.data.mode) &&
    sourceIds.length === 0
  const datasetKey = live.data?.id ?? 'pending'

  const cited = finding
    ? references.filter(
        (ref) =>
          documents[ref.doc] &&
          ref.rect?.length === 4 &&
          ref.rect.every(Number.isFinite) &&
          ref.rect[2] > 0 &&
          ref.rect[3] > 0,
      )
    : []
  const primary =
    cited.find((ref) => documents[ref.doc].category === 'design') ?? cited[0]
  const alternatives = cited.filter((ref) => ref.doc !== primary?.doc)
  const other =
    alternatives.find(
      (ref) => projectDocuments?.[ref.doc]?.category === 'reference',
    ) ?? alternatives[0]
  const initialPair = primary && other ? [primary, other] : []
  const initialDocs = initialPair.length
    ? initialPair.map((ref) => ref.doc)
    : sourceIds.slice(0, 2)
  const [anchorId, setAnchorId] = useState<string | undefined>(
    initialPair[0]?.id,
  )
  const anchor = cited.find((ref) => ref.id === anchorId)
  const narrow = useSyncExternalStore(
    subscribeViewerWidth,
    () => narrowViewer.matches,
  )
  const [preferredLayout, setLayout] = useState<'split' | 'tabs'>('split')
  const layout = narrow ? 'tabs' : preferredLayout
  const [tab, setTab] = useState<DocId>(initialDocs[0] ?? '')
  const [comparison, setComparison] = useState<DocId[]>(initialDocs)
  const [opened, setOpened] = useState<DocId[]>(initialDocs)
  const [focusedPane, setFocusedPane] = useState(0)
  const [hover, setHover] = useState<string[] | null>(null)
  const [pinned, setPinned] = useState<string[]>(
    initialPair.map((ref) => ref.id),
  )
  const [navigationKey, setNavigationKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState('')
  const [copied, setCopied] = useState(false)
  const [resultHeight, setResultHeight] = useState(264)
  const [expanded, setExpanded] = useState(false)
  const input = useRef<HTMLTextAreaElement>(null)
  const [previousDataset, setPreviousDataset] = useState(datasetKey)
  if (datasetKey !== previousDataset) {
    setPreviousDataset(datasetKey)
    setAnchorId(initialPair[0]?.id)
    setTab(initialDocs[0] ?? '')
    setComparison(initialDocs)
    setOpened(initialDocs)
    setPinned(
      (initialPair.length ? initialPair : references.slice(0, 2)).map(
        (r) => r.id,
      ),
    )
    setHover(null)
  }
  const preview =
    anchor && hover
      ? cited.find((r) => hover.includes(r.id) && r.doc !== anchor.doc)
      : undefined
  const displayedPair =
    anchor && preview ? [anchor.doc, preview.doc] : comparison
  const displayedTab = preview?.doc ?? tab
  const ids = anchor
    ? [anchor.id, ...(preview ? [preview.id] : pinned)]
    : (hover ?? pinned)
  const active = references.filter((r) => ids.includes(r.id))
  // Off-topic, not found and other-jurisdiction results carry no source text.
  const nothingToCopy =
    !!live.data &&
    ['not_found', 'jurisdiction', 'off_topic'].includes(
      outcomeOf(live.data.mode, live.data.assist),
    )
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAnchorId(undefined)
        setPinned([])
        setHover(null)
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])
  function selectDocument(id: DocId) {
    if (initialPair.length) {
      const ref = cited.find((r) => r.doc === id)
      if (ref) {
        if (id !== anchor?.doc) reveal([ref.id], true)
        else setTab(id)
        return
      }
    }
    setTab(id)
    setOpened((prev) => (prev.includes(id) ? prev : [...prev, id]))
    setComparison((prev) =>
      prev.includes(id)
        ? prev
        : prev.map((doc, i) => (i === focusedPane ? id : doc)),
    )
  }
  function reveal(refs: string[], pin = false) {
    if (pin) {
      setPinned(
        anchor &&
          refs.every((id) => cited.find((r) => r.id === id)?.doc === anchor.doc)
          ? [
              ...pinned.filter(
                (id) => cited.find((r) => r.id === id)?.doc !== anchor.doc,
              ),
              ...refs,
            ]
          : refs,
      )
      setNavigationKey((k) => k + 1)
    } else setHover(refs)
    const first = references.find((r) => r.id === refs[0])
    if (first) {
      const citedDocs = [
        ...new Set(
          refs
            .map((ref) => references.find((r) => r.id === ref)?.doc)
            .filter((id): id is DocId => !!id),
        ),
      ]
      if (anchor) {
        if (!pin) {
          setOpened((prev) => [...new Set([...prev, ...citedDocs])])
          return
        }
        const next = refs
          .map((id) => cited.find((r) => r.id === id))
          .find((r) => r && r.doc !== anchor.doc)
        if (next) {
          setTab(next.doc)
          setComparison([anchor.doc, next.doc])
          setOpened((prev) => [...new Set([...prev, anchor.doc, next.doc])])
        } else {
          setTab(first.doc)
          if (pin && first.doc === anchor.doc) setAnchorId(first.id)
        }
        return
      }
      setTab(first.doc)
      setOpened((prev) => [...new Set([...prev, ...citedDocs.slice(0, 2)])])
      setComparison((prev) =>
        citedDocs.length > 1
          ? citedDocs.slice(0, 2)
          : prev.includes(first.doc)
            ? prev
            : prev.map((doc, i) => (i === focusedPane ? first.doc : doc)),
      )
    }
  }
  /** Runs a project search while this result stays on screen. */
  function runInPlace(question: string, context: RunContext) {
    setBusy(true)
    setPending(question)
    void Promise.resolve(
      onRun(question, false, { documentIds: queryScope, ...context }),
    ).finally(() => {
      setBusy(false)
      setPending('')
    })
  }
  /** Runs a clarified or more detailed version of the current question. */
  function refine(question: string, choice: string) {
    if (busy) return
    setQuery(question)
    runInPlace(question, { from: submitted, choice })
  }
  function rephrase() {
    setExpanded(false)
    input.current?.focus()
    input.current?.select()
  }
  function newQuery() {
    setBusy(false)
    setExpanded(false)
    setQuery('')
    setSubmitted('')
    setPinned([])
    setHover(null)
    input.current?.focus()
    onNew()
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(
        `${submitted}\n\n${report.map((block) => [block.heading, block.sentences.map((s) => `${s.text}${s.refs?.length ? ` [${s.refs.join(', ')}]` : ''}`).join(' ')].filter(Boolean).join('\n')).join('\n\n')}\n\n${references.map((r) => `[${r.id}] ${documents[r.doc].label}, ${r.label}. ${documents[r.doc].source}`).join('\n')}`,
      )
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }
  function resize(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    const start = event.clientY,
      height = resultHeight
    const el = event.currentTarget
    const move = (e: PointerEvent) =>
      setResultHeight(
        Math.max(
          160,
          Math.min(window.innerHeight * 0.6, height + start - e.clientY),
        ),
      )
    const end = () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', end)
      el.removeEventListener('pointercancel', end)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', end)
    el.addEventListener('pointercancel', end)
  }
  return (
    <DocumentContext.Provider value={documents}>
      <main
        className={`workspace ${expanded || noAnswer ? 'report-expanded' : ''}`}
        style={
          { '--result-height': `${resultHeight}px` } as React.CSSProperties
        }
      >
        <AppHeader
          onNew={newQuery}
          homeHref={'#project/' + entry.projectId}
          context={projectName}
          showNewQuery={false}
        />
        <ScopedQueryBar
          value={query}
          onChange={(text) => {
            setQuery(text)
            onDraftChange?.(text)
          }}
          documents={projectDocuments ?? documents}
          documentId={tab || entry.documentIds?.[0]}
          documentIds={queryScope}
          onScopeChange={setQueryScope}
          busy={busy || live.busy}
          inputRef={input}
          onSubmit={(question, documentIds) =>
            runInPlace(question, { from: submitted, fresh: true, documentIds })
          }
        />
        <section className="document-workspace" aria-label="Document workspace">
          <div
            className="document-tabs"
            role="toolbar"
            aria-label="Document layout"
          >
            <div
              className="tab-list"
              role="tablist"
              aria-label="Source documents"
            >
              {(initialPair.length
                ? [...new Set(cited.map((r) => r.doc))]
                : sourceIds
              ).map((id) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={displayedTab === id}
                  className={`document-tab ${displayedTab === id ? 'selected' : ''} ${active.some((r) => r.doc === id) ? 'has-source' : ''}`}
                  title={documents[id].title}
                  onClick={() => selectDocument(id)}
                >
                  <FileText size={14} />
                  <span>{documents[id].label}</span>
                  <span className="tab-title">{documents[id].title}</span>
                </button>
              ))}
            </div>
            {!narrow && (
              <div className="layout-controls">
                {!anchor && layout === 'split' && sourceIds.length > 2 && (
                  <select
                    className="compare-select"
                    aria-label="Compare document"
                    value={comparison[1]}
                    onChange={(e) => {
                      const id = e.target.value as DocId
                      setComparison((prev) => [prev[0], id])
                      setOpened((prev) =>
                        prev.includes(id) ? prev : [...prev, id],
                      )
                      setTab(id)
                    }}
                  >
                    {sourceIds
                      .filter((id) => id !== comparison[0])
                      .map((id) => (
                        <option key={id} value={id}>
                          {documents[id].title}
                        </option>
                      ))}
                  </select>
                )}
                <button
                  className={layout === 'tabs' ? 'active' : ''}
                  aria-label="Single document view"
                  aria-pressed={layout === 'tabs'}
                  title="Single document"
                  onClick={() => setLayout('tabs')}
                >
                  <PanelTop size={15} />
                </button>
                <button
                  className={layout === 'split' ? 'active' : ''}
                  aria-label="Side-by-side view"
                  aria-pressed={layout === 'split'}
                  title="Side by side"
                  onClick={() => setLayout('split')}
                >
                  <Columns2 size={15} />
                </button>
              </div>
            )}
          </div>
          <div className={`document-panes ${layout}`}>
            {sourceIds.map((id) => (
              <div
                className={`pane-slot ${(layout === 'tabs' ? displayedTab !== id : !displayedPair.includes(id)) ? 'hidden' : ''}`}
                style={{ order: displayedPair.indexOf(id) }}
                onPointerDown={() => setFocusedPane(comparison.indexOf(id))}
                onFocusCapture={() =>
                  setFocusedPane(Math.max(0, comparison.indexOf(id)))
                }
                key={id}
              >
                {opened.includes(id) && (
                  <PdfPane
                    id={id}
                    evidenceView={initialPair.length > 0}
                    pinnedSource={anchor?.doc === id}
                    onPinSource={
                      initialPair.length && layout === 'split'
                        ? () => {
                            if (anchor?.doc === id) {
                              setAnchorId(undefined)
                              return
                            }
                            const ref =
                              active.find((r) => r.doc === id) ??
                              cited.find((r) => r.doc === id)
                            if (!ref) return
                            setAnchorId(ref.id)
                            setPinned(
                              comparison.flatMap((doc) => {
                                const source =
                                  active.find((r) => r.doc === doc) ??
                                  cited.find((r) => r.doc === doc)
                                return source ? [source.id] : []
                              }),
                            )
                            setComparison([
                              id,
                              ...comparison.filter((doc) => doc !== id),
                            ])
                          }
                        : undefined
                    }
                    active={active}
                    navigationKey={anchor?.doc === id ? 0 : navigationKey}
                    onSelectReferences={(refIds) => reveal(refIds, true)}
                    sourceReferences={references}
                  />
                )}
              </div>
            ))}
          </div>
        </section>
        <div
          className="resize-handle"
          role="separator"
          aria-label="Resize consolidated result"
          aria-orientation="horizontal"
          aria-valuenow={resultHeight}
          tabIndex={0}
          onPointerDown={resize}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault()
              setResultHeight((h) =>
                Math.max(
                  160,
                  Math.min(
                    window.innerHeight * 0.6,
                    h + (e.key === 'ArrowUp' ? 24 : -24),
                  ),
                ),
              )
            }
          }}
        >
          <span />
        </div>
        <section
          className="result-panel"
          aria-label="Consolidated query result"
        >
          <div className="result-header">
            <h1>Query result</h1>
            {pending && (
              <span className="searching-note" role="status">
                Searching: {pending}
              </span>
            )}
            <div className="result-actions">
              {pinned.length > 0 && (
                <button
                  onClick={() => {
                    setAnchorId(undefined)
                    setPinned([])
                    setHover(null)
                  }}
                  title="Clear selected sources"
                >
                  <X size={13} />
                  Clear selection
                </button>
              )}
              {live.data && !nothingToCopy && (
                <button
                  onClick={copy}
                  title="Copy result with source references"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              )}
              {!noAnswer && (
                <button
                  onClick={() => setExpanded((v) => !v)}
                  aria-label={
                    expanded ? 'Restore result panel' : 'Expand result panel'
                  }
                  title={expanded ? 'Restore panel' : 'Expand panel'}
                >
                  {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </button>
              )}
            </div>
          </div>
          <div
            className={`result-content ${busy ? 'is-loading' : ''}`}
            aria-busy={busy || live.busy}
          >
            {submitted && !live.data ? (
              <div className="empty-result" role="status">
                <span>{live.error || live.phase}</span>
                {live.busy && <button onClick={live.cancel}>Cancel</button>}
                {live.error && (
                  <button
                    onClick={() =>
                      onRun(submitted, entry.sourceOnly, {
                        from: submitted,
                        documentIds: queryScope,
                      })
                    }
                  >
                    Retry
                  </button>
                )}
              </div>
            ) : !submitted ? (
              <div className="empty-result">
                <Search size={20} />
                <span>Enter a query to inspect the project documents.</span>
              </div>
            ) : (
              <>
                <QueryThread thread={thread} />
                {live.data && (
                  <QueryAssist
                    key={live.data.id}
                    mode={live.data.mode}
                    assist={live.data.assist}
                    question={submitted}
                    suggestions={live.data.suggestions}
                    inProject
                    onRefine={refine}
                    onRephrase={rephrase}
                    onUpload={onUpload}
                  />
                )}
                {!nothingToCopy && (
                  <QueryReport
                    blocks={report}
                    sourceReferences={references}
                    selected={ids}
                    onPreview={(refs) => (refs ? reveal(refs) : setHover(null))}
                    onSelect={(refs) => reveal(refs, true)}
                  />
                )}
                {live.data &&
                  !live.data.assist &&
                  [
                    'no_evidence',
                    'insufficient_evidence',
                    'related_evidence',
                  ].includes(live.data.mode) && (
                    <QuerySuggestions
                      suggestions={live.data.suggestions ?? []}
                      onSelect={(suggestion) =>
                        onRun(suggestion.question, true, {
                          documentIds: queryScope,
                          from: submitted,
                          choice: suggestion.question,
                        })
                      }
                    />
                  )}
              </>
            )}
            {live.data?.notes?.length ? (
              <details className="result-notes">
                <summary>Source notes</summary>
                <p>{live.data.notes.join(' ')}</p>
              </details>
            ) : null}
          </div>
        </section>
      </main>
    </DocumentContext.Provider>
  )
}

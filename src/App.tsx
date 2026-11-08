import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  Search,
  Columns2,
  PanelTop,
  ArrowUpRight,
  Copy,
  Check,
  X,
  FileText,
  Maximize2,
  Minimize2,
  CornerDownLeft,
} from 'lucide-react'
import { documents as staticDocuments, referenceSets, queryCases } from './data'
import { DocumentContext } from './DocumentContext'
import { readSettings, useLiveQuery } from './backend'
import type { BackendSettings, DocumentRecord, QueryJob } from './backend'
import { navigate } from './navigation'
import type { DocId } from './data'
import { PdfPane } from './PdfPane'
import { QueryReport } from './QueryReport'
import { QuerySuggestions } from './QuerySuggestions'
import { QueryHome } from './QueryHome'
import { QueryAssist, QueryThread } from './QueryAssist'
import { clarificationRounds, outcomeOf } from './assist'
import type { ThreadTurn } from './assist'
import { AppHeader } from './AppHeader'
import { readHistory, saveHistory } from './history'
import type { HistoryEntry } from './history'

/** Where a new search came from, so the query tab can keep the thread. */
export type RunContext = {
  from: string
  choice?: string
  /** A rephrased question: searched on its own, starting a new thread. */
  fresh?: boolean
}

export function QueryWorkspace({
  entry,
  onRun,
  settings,
  onNew,
  projectName,
  projectDocuments,
  draft,
  onDraftChange,
  thread = [],
  preloadedJob,
  onUpload,
  uploadNote = "Add the required PDF to the backend's documents folder, then restart it.",
}: {
  entry: HistoryEntry
  settings: BackendSettings
  onRun: (
    prompt: string,
    caseId: string,
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
  preloadedJob?: QueryJob
  /** Opens the project's document upload; absent where uploads aren't possible. */
  onUpload?: () => void
  /** Shown instead of the upload button when `onUpload` is absent. */
  uploadNote?: string
}) {
  const queryCase = queryCases.find((c) => c.id === entry.caseId)!
  const exampleQuery = queryCase.prompt
  settings =
    !entry.projectId &&
    entry.id === entry.caseId &&
    entry.prompt === exampleQuery
      ? { ...settings, mode: 'static' }
      : settings
  const [query, setQuery] = useState(draft ?? entry.prompt)
  const [submitted, setSubmitted] = useState(entry.prompt)
  const [retry, setRetry] = useState(0)
  const live = useLiveQuery(
    settings,
    submitted,
    retry,
    entry.sourceOnly === true,
    entry.projectId,
    entry.queryId,
    preloadedJob,
    projectDocuments,
  )
  const documents =
    settings.mode === 'static'
      ? staticDocuments
      : (live.data?.documents ?? projectDocuments ?? {})
  const report =
    settings.mode === 'static' ? queryCase.report : (live.data?.report ?? [])
  const references =
    settings.mode === 'static'
      ? referenceSets[entry.caseId]
      : (live.data?.references ?? [])
  const sourceIds =
    settings.mode === 'static' ? queryCase.documentIds : Object.keys(documents)
  const noAnswer =
    settings.mode !== 'static' &&
    !!live.data &&
    ['no_evidence', 'insufficient_evidence'].includes(live.data.mode) &&
    sourceIds.length === 0
  const datasetKey =
    settings.mode === 'static' ? entry.caseId : (live.data?.id ?? 'pending')

  const [layout, setLayout] = useState<'split' | 'tabs'>('split')
  const [tab, setTab] = useState<DocId>(sourceIds[0] ?? '')
  const [comparison, setComparison] = useState<DocId[]>(sourceIds.slice(0, 2))
  const [opened, setOpened] = useState<DocId[]>(sourceIds.slice(0, 2))
  const [focusedPane, setFocusedPane] = useState(0)
  const [hover, setHover] = useState<string[] | null>(null)
  const [pinned, setPinned] = useState<string[]>(
    entry.prompt === exampleQuery ? queryCase.initialReferences : [],
  )
  const [navigationKey, setNavigationKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState('')
  const [copied, setCopied] = useState(false)
  const [resultHeight, setResultHeight] = useState(264)
  const [expanded, setExpanded] = useState(false)
  const input = useRef<HTMLTextAreaElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [previousDataset, setPreviousDataset] = useState(datasetKey)
  if (datasetKey !== previousDataset) {
    setPreviousDataset(datasetKey)
    setTab(sourceIds[0] ?? '')
    setComparison(sourceIds.slice(0, 2))
    setOpened(sourceIds.slice(0, 2))
    setPinned(references.slice(0, 2).map((r) => r.id))
    setHover(null)
  }
  const ids = hover ?? pinned
  const active = references.filter((r) => ids.includes(r.id))
  const isPrepared = (text: string) =>
    !entry.projectId &&
    text.toLowerCase().replace(/\s+/g, ' ') ===
      exampleQuery.toLowerCase().replace(/\s+/g, ' ')
  const supported =
    settings.mode === 'static' ? isPrepared(submitted) : !!live.data
  // Off-topic, not found and other-jurisdiction results carry no source text.
  const nothingToCopy =
    !!live.data &&
    ['not_found', 'jurisdiction', 'off_topic'].includes(
      outcomeOf(live.data.mode, live.data.assist),
    )
  useEffect(() => () => clearTimeout(timer.current), [])
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPinned([])
        setHover(null)
      }
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault()
        input.current?.focus()
        input.current?.select()
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])
  function selectDocument(id: DocId) {
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
      setPinned(refs)
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
  function search() {
    if (!query.trim() || busy) return
    if (entry.projectId) {
      // Typing a new question is a rephrase: search it alone.
      runInPlace(query.trim(), { from: submitted, fresh: true })
      return
    }
    setBusy(true)
    timer.current = setTimeout(() => {
      if (query.trim() === entry.prompt) {
        setSubmitted(query.trim())
        setRetry((r) => r + 1)
      }
      setBusy(false)
      setPinned(isPrepared(query.trim()) ? queryCase.initialReferences : [])
      onRun(query.trim(), entry.caseId, false, { from: submitted })
      setHover(null)
      setNavigationKey((k) => k + 1)
    }, 500)
  }
  /** Runs a project search while this result stays on screen. */
  function runInPlace(question: string, context: RunContext) {
    setBusy(true)
    setPending(question)
    void Promise.resolve(onRun(question, entry.caseId, false, context)).finally(
      () => {
        setBusy(false)
        setPending('')
      },
    )
  }
  /** Runs a clarified or more detailed version of the current question. */
  function refine(question: string, choice: string) {
    if (busy) return
    setQuery(question)
    if (entry.projectId) runInPlace(question, { from: submitted, choice })
    else onRun(question, entry.caseId, false, { from: submitted, choice })
  }
  function rephrase() {
    setExpanded(false)
    input.current?.focus()
    input.current?.select()
  }
  function newQuery() {
    clearTimeout(timer.current)
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
          homeHref={entry.projectId ? '#project/' + entry.projectId : '#home'}
          context={projectName}
          showNewQuery={!entry.projectId}
        />
        <form
          className="query-bar"
          onSubmit={(e) => {
            e.preventDefault()
            search()
          }}
        >
          <label className="sr-only" htmlFor="query">
            Query
          </label>
          <div className="query-field">
            <Search size={19} />
            <textarea
              ref={input}
              id="query"
              rows={1}
              value={query}
              placeholder={
                entry.projectId
                  ? "Search this project's documents…"
                  : 'Enter a query…'
              }
              onChange={(e) => {
                setQuery(e.target.value)
                onDraftChange?.(e.target.value)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  search()
                }
              }}
            />
            <kbd>Ctrl K</kbd>
          </div>
          <button
            className="run-query"
            disabled={!query.trim() || busy}
            type="submit"
          >
            {busy || live.busy ? 'Searching…' : 'Search'}
            <CornerDownLeft size={15} />
          </button>
        </form>
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
              {sourceIds.map((id) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={tab === id}
                  className={`document-tab ${tab === id ? 'selected' : ''} ${active.some((r) => r.doc === id) ? 'has-source' : ''}`}
                  title={documents[id].title}
                  onClick={() => selectDocument(id)}
                >
                  <FileText size={14} />
                  <span>{documents[id].label}</span>
                  <span className="tab-title">{documents[id].title}</span>
                </button>
              ))}
            </div>
            <div className="layout-controls">
              {layout === 'split' && sourceIds.length > 2 && (
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
          </div>
          <div className={`document-panes ${layout}`}>
            {sourceIds.map((id) => (
              <div
                className={`pane-slot ${(layout === 'tabs' ? tab !== id : !comparison.includes(id)) ? 'hidden' : ''}`}
                style={{ order: comparison.indexOf(id) }}
                onPointerDown={() => setFocusedPane(comparison.indexOf(id))}
                onFocusCapture={() =>
                  setFocusedPane(Math.max(0, comparison.indexOf(id)))
                }
                key={id}
              >
                {opened.includes(id) && (
                  <PdfPane
                    id={id}
                    active={active}
                    navigationKey={navigationKey}
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
            {settings.mode !== 'static' && !entry.projectId && (
              <span className="live-mode">
                {entry.projectId
                  ? 'Project sources'
                  : settings.mode === 'matvey'
                    ? 'Matvey’s backend'
                    : 'Backend (main)'}
                {live.data
                  ? ' · ' +
                    ([
                      'extractive_answer',
                      'source_lookup',
                      'version_answer',
                      'source_evidence',
                    ].includes(live.data.mode)
                      ? 'Source text'
                      : ['no_evidence', 'insufficient_evidence'].includes(
                            live.data.mode,
                          )
                        ? 'No supported answer'
                        : live.data.mode === 'related_evidence'
                          ? 'Related source text'
                          : 'Cited findings')
                  : ''}
              </span>
            )}
            <div className="result-actions">
              {pinned.length > 0 && (
                <button
                  onClick={() => {
                    setPinned([])
                    setHover(null)
                  }}
                  title="Clear selected sources"
                >
                  <X size={13} />
                  Clear selection
                </button>
              )}
              {supported && !nothingToCopy && (
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
            {settings.mode !== 'static' && submitted && !live.data ? (
              <div className="empty-result" role="status">
                <span>{live.error || live.phase}</span>
                {live.busy && <button onClick={live.cancel}>Cancel</button>}
                {live.error && (
                  <button
                    onClick={() =>
                      entry.projectId
                        ? onRun(submitted, entry.caseId, entry.sourceOnly)
                        : setRetry((r) => r + 1)
                    }
                  >
                    Retry
                  </button>
                )}
              </div>
            ) : !submitted ? (
              <div className="empty-result">
                <Search size={20} />
                <span>
                  {entry.projectId
                    ? 'Enter a query to inspect the project documents.'
                    : 'Enter a query to inspect the local documents.'}
                </span>
                {!entry.projectId && (
                  <button
                    onClick={() => {
                      setQuery(exampleQuery)
                      setSubmitted(exampleQuery)
                      setPinned(queryCase.initialReferences)
                    }}
                  >
                    Load example
                    <ArrowUpRight size={14} />
                  </button>
                )}
              </div>
            ) : !supported ? (
              <div className="empty-result">
                <Search size={20} />
                <span>
                  Search processing is not connected. Open a previous query to
                  inspect a prepared result.
                </span>
                <button
                  onClick={() => {
                    setQuery(exampleQuery)
                    setSubmitted(exampleQuery)
                    setPinned(queryCase.initialReferences)
                  }}
                >
                  Load example
                  <ArrowUpRight size={14} />
                </button>
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
                    rounds={clarificationRounds(thread)}
                    inProject={!!entry.projectId}
                    onRefine={refine}
                    onRephrase={rephrase}
                    onUpload={onUpload}
                    uploadNote={uploadNote}
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
                        onRun(suggestion.question, entry.caseId, true, {
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

function routeId() {
  if (location.hash === '#home') return 'home'
  if (location.hash === '#new') return 'new'
  try {
    return location.hash.startsWith('#query/')
      ? decodeURIComponent(location.hash.slice(7))
      : 'storm'
  } catch {
    return 'storm'
  }
}
function subscribeRoute(update: () => void) {
  window.addEventListener('hashchange', update)
  return () => window.removeEventListener('hashchange', update)
}
export default function App() {
  const [settings] = useState(readSettings)
  const [history, setHistory] = useState(readHistory)
  const route = useSyncExternalStore(subscribeRoute, routeId, () => 'storm')
  const [draftCase, setDraftCase] = useState('storm')
  function newQuery(caseId = 'storm') {
    setDraftCase(caseId)
    navigate('new')
  }
  function runQuery(prompt: string, caseId: string, sourceOnly = false) {
    const previous = history.find(
      (entry) =>
        entry.id !== entry.caseId &&
        entry.prompt === prompt &&
        (entry.sourceOnly === true) === sourceOnly,
    )
    const entry: HistoryEntry = {
      id: previous?.id ?? crypto.randomUUID(),
      title: prompt,
      prompt,
      caseId,
      sourceOnly,
    }
    setHistory((prev) => {
      const next = [entry, ...prev.filter((item) => item.id !== entry.id)]
      saveHistory(next)
      return next
    })
    navigate('query/' + encodeURIComponent(entry.id))
  }
  if (route === 'home')
    return <QueryHome entries={history} onNew={() => newQuery()} />
  const entry =
    route === 'new'
      ? { id: 'new', title: '', prompt: '', caseId: draftCase }
      : (history.find((entry) => entry.id === route) ??
        history.find((entry) => entry.id === 'storm')!)
  return (
    <QueryWorkspace
      key={entry.id + entry.caseId + settings.mode}
      settings={settings}
      entry={entry}
      onRun={runQuery}
      onNew={() => newQuery(entry.caseId)}
    />
  )
}

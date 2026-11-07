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
import type { BackendSettings } from './backend'
import { navigate } from './navigation'
import type { DocId } from './data'
import { PdfPane } from './PdfPane'
import { QueryReport } from './QueryReport'
import { QueryHome } from './QueryHome'
import { AppHeader } from './AppHeader'
import { readHistory, saveHistory } from './history'
import type { HistoryEntry } from './history'

function QueryWorkspace({
  entry,
  onRun,
  settings,
  onNew,
}: {
  entry: HistoryEntry
  settings: BackendSettings
  onRun: (prompt: string, caseId: string) => void
  onNew: () => void
}) {
  const queryCase = queryCases.find((c) => c.id === entry.caseId)!
  const exampleQuery = queryCase.prompt
  settings =
    entry.id === entry.caseId && entry.prompt === exampleQuery
      ? { ...settings, mode: 'static' }
      : settings
  const [query, setQuery] = useState(entry.prompt)
  const [submitted, setSubmitted] = useState(entry.prompt)
  const [retry, setRetry] = useState(0)
  const live = useLiveQuery(settings, submitted, retry)
  const documents =
    settings.mode === 'static' ? staticDocuments : (live.data?.documents ?? {})
  const report =
    settings.mode === 'static' ? queryCase.report : (live.data?.report ?? [])
  const references =
    settings.mode === 'static'
      ? referenceSets[entry.caseId]
      : (live.data?.references ?? [])
  const sourceIds =
    settings.mode === 'static' ? queryCase.documentIds : Object.keys(documents)
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
    text.toLowerCase().replace(/\s+/g, ' ') ===
    exampleQuery.toLowerCase().replace(/\s+/g, ' ')
  const supported =
    settings.mode === 'static' ? isPrepared(submitted) : !!live.data
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
    setBusy(true)
    timer.current = setTimeout(() => {
      if (query.trim() === entry.prompt) {
        setSubmitted(query.trim())
        setRetry((r) => r + 1)
      }
      setBusy(false)
      setPinned(isPrepared(query.trim()) ? queryCase.initialReferences : [])
      onRun(query.trim(), entry.caseId)
      setHover(null)
      setNavigationKey((k) => k + 1)
    }, 500)
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
        className={`workspace ${expanded ? 'report-expanded' : ''}`}
        style={
          { '--result-height': `${resultHeight}px` } as React.CSSProperties
        }
      >
        <AppHeader onNew={newQuery} />
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
              rows={2}
              value={query}
              placeholder="Enter a query…"
              onChange={(e) => setQuery(e.target.value)}
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
            {settings.mode !== 'static' && (
              <span className="live-mode">
                {settings.mode === 'matvey'
                  ? 'Matvey’s backend'
                  : 'Backend (main)'}
                {live.data ? ' · ' + live.data.mode.replaceAll('_', ' ') : ''}
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
              {supported && (
                <button
                  onClick={copy}
                  title="Copy result with source references"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              )}
              <button
                onClick={() => setExpanded((v) => !v)}
                aria-label={
                  expanded ? 'Restore result panel' : 'Expand result panel'
                }
                title={expanded ? 'Restore panel' : 'Expand panel'}
              >
                {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
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
                  <button onClick={() => setRetry((r) => r + 1)}>Retry</button>
                )}
              </div>
            ) : !submitted ? (
              <div className="empty-result">
                <Search size={20} />
                <span>Enter a query to inspect the local documents.</span>
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
              <QueryReport
                blocks={report}
                sourceReferences={references}
                selected={ids}
                onPreview={(refs) => (refs ? reveal(refs) : setHover(null))}
                onSelect={(refs) => reveal(refs, true)}
              />
            )}
            {live.data?.notes?.length ? (
              <p className="result-notes">{live.data.notes.join(' ')}</p>
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
  function runQuery(prompt: string, caseId: string) {
    const previous = history.find(
      (entry) => entry.id !== entry.caseId && entry.prompt === prompt,
    )
    const entry: HistoryEntry = {
      id: previous?.id ?? crypto.randomUUID(),
      title: prompt,
      prompt,
      caseId,
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

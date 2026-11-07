import { useEffect, useRef, useState } from 'react'
import {
  Search,
  Columns2,
  PanelTop,
  Plus,
  ArrowUpRight,
  Copy,
  Check,
  X,
  FileText,
  Link2,
  CornerDownLeft,
} from 'lucide-react'
import { documents, exampleQuery, findings, references } from './data'
import type { DocId } from './data'
import { PdfPane } from './PdfPane'

export default function App() {
  const [query, setQuery] = useState(exampleQuery)
  const [submitted, setSubmitted] = useState(exampleQuery)
  const [layout, setLayout] = useState<'split' | 'tabs'>('split')
  const [tab, setTab] = useState<DocId>('guidelines')
  const [hover, setHover] = useState<string[] | null>(null)
  const [pinned, setPinned] = useState<string[]>(['1', '2'])
  const [navigationKey, setNavigationKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [resultHeight, setResultHeight] = useState(264)
  const input = useRef<HTMLTextAreaElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const ids = hover ?? pinned
  const active = references.filter((r) => ids.includes(r.id))
  const supported = submitted === exampleQuery
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
  function reveal(refs: string[], pin = false) {
    if (pin) {
      setPinned(refs)
      setNavigationKey((k) => k + 1)
    } else setHover(refs)
    const first = references.find((r) => r.id === refs[0])
    if (first) setTab(first.doc)
  }
  function search() {
    if (!query.trim() || busy) return
    setBusy(true)
    timer.current = setTimeout(() => {
      setSubmitted(query.trim())
      setBusy(false)
      setPinned(query.trim() === exampleQuery ? ['1', '2'] : [])
      setHover(null)
      setNavigationKey((k) => k + 1)
    }, 500)
  }
  function newQuery() {
    clearTimeout(timer.current)
    setBusy(false)
    setQuery('')
    setSubmitted('')
    setPinned([])
    setHover(null)
    input.current?.focus()
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(
        `${submitted}\n\n${findings.map((f) => `${f.title}: ${f.text} [${f.refs.join(', ')}]`).join('\n\n')}\n\n${references.map((r) => `[${r.id}] Vol. ${documents[r.doc].code}, ${r.label}. ${documents[r.doc].source}`).join('\n')}`,
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
    <main
      className="workspace"
      style={{ '--result-height': `${resultHeight}px` } as React.CSSProperties}
    >
      <header className="app-header">
        <div className="brand-mark">
          C<span>▱</span>
        </div>
        <strong>CONSTRUCTION INTELLIGENCE</strong>
        <span className="header-divider" />
        <span className="workspace-name">Edmonton · Drainage standards</span>
        <button className="new-query" onClick={newQuery}>
          <Plus size={14} />
          New query
        </button>
      </header>
      <form
        className="query-bar"
        onSubmit={(e) => {
          e.preventDefault()
          search()
        }}
      >
        <label htmlFor="query">
          QUERY <span>01</span>
        </label>
        <div className="query-field">
          <Search size={19} />
          <textarea
            ref={input}
            id="query"
            rows={2}
            value={query}
            placeholder="Enter a query across the local documents…"
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
          {busy ? 'Searching…' : 'Search'}
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
            {(Object.keys(documents) as DocId[]).map((id) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                className={`document-tab ${tab === id ? 'selected' : ''}`}
                onClick={() => setTab(id)}
              >
                <FileText size={14} />
                <span>Vol. {documents[id].code}</span>
                <span className="tab-title">
                  {id === 'guidelines'
                    ? 'Design Guidelines'
                    : 'Stormwater Management'}
                </span>
                <span className="tab-count">
                  {references.filter((r) => r.doc === id).length}
                </span>
              </button>
            ))}
          </div>
          <div className="layout-controls">
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
          {(Object.keys(documents) as DocId[]).map((id) => (
            <div
              className={`pane-slot ${layout === 'tabs' && tab !== id ? 'hidden' : ''}`}
              key={id}
            >
              <PdfPane id={id} active={active} navigationKey={navigationKey} />
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
      <section className="result-panel" aria-label="Consolidated query result">
        <div className="result-header">
          <Link2 size={15} />
          <h1>Consolidated result</h1>
          {supported && (
            <span className="result-count">
              5 findings <span>·</span> 2 documents
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
              <button onClick={copy} title="Copy result with source references">
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            )}
          </div>
        </div>
        <div
          className={`result-content ${busy ? 'is-loading' : ''}`}
          aria-busy={busy}
        >
          {!submitted ? (
            <div className="empty-result">
              <Search size={20} />
              <span>Enter a query to inspect the local documents.</span>
              <button
                onClick={() => {
                  setQuery(exampleQuery)
                  setSubmitted(exampleQuery)
                  setPinned(['1', '2'])
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
                This frontend contains one prepared query. Search processing is
                not connected.
              </span>
              <button
                onClick={() => {
                  setQuery(exampleQuery)
                  setSubmitted(exampleQuery)
                  setPinned(['1', '2'])
                }}
              >
                Load example
                <ArrowUpRight size={14} />
              </button>
            </div>
          ) : (
            <>
              <div className="result-scope">
                <span className="scope-tag">MINOR STORM SYSTEM</span>
                <span>20 ha · Edmonton · 2025 editions</span>
                <span className="fixture-tag">Example query</span>
              </div>
              <div className="findings">
                {findings.map((finding, i) => (
                  <div
                    className={`finding ${finding.refs.every((r) => ids.includes(r)) ? 'is-active' : ''}`}
                    key={finding.title}
                  >
                    <span className="finding-index">0{i + 1}</span>
                    <div>
                      <button
                        className="finding-text"
                        onMouseEnter={() => reveal(finding.refs)}
                        onMouseLeave={() => setHover(null)}
                        onFocus={() => reveal(finding.refs)}
                        onBlur={() => setHover(null)}
                        onClick={() => reveal(finding.refs, true)}
                      >
                        <strong>{finding.title}.</strong> {finding.text}
                      </button>
                      <span className="citations">
                        {finding.refs.map((refId) => {
                          const ref = references.find((r) => r.id === refId)!
                          return (
                            <button
                              key={refId}
                              className={ids.includes(refId) ? 'active' : ''}
                              title={`Vol. ${documents[ref.doc].code} · ${ref.label} (PDF page ${ref.page})`}
                              aria-label={`Source ${refId}: Vol. ${documents[ref.doc].code}, ${ref.label}`}
                              onMouseEnter={() => reveal([refId])}
                              onMouseLeave={() => setHover(null)}
                              onFocus={() => reveal([refId])}
                              onBlur={() => setHover(null)}
                              onClick={() => reveal([refId], true)}
                            >
                              {refId}
                            </button>
                          )
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
      <footer className="status-bar">
        <span>
          <i />
          LOCAL DOCUMENTS
        </span>
        <span>
          2 PDFs <span className="status-sep">/</span> 234 pages
        </span>
        <span className="status-hint">
          Hover to trace · Click to select · Esc to clear
        </span>
        <span>
          {active.length} source{active.length === 1 ? '' : 's'} highlighted
        </span>
      </footer>
    </main>
  )
}

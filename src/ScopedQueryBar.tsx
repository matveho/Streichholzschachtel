import { useEffect, useId, useRef, useState } from 'react'
import type { RefObject } from 'react'
import {
  Search,
  CornerDownLeft,
  ChevronDown,
  FileText,
  Files,
} from 'lucide-react'
import type { DocumentRecord } from './backend'

export function ScopedQueryBar({
  value,
  onChange,
  onSubmit,
  documents,
  documentId,
  documentIds,
  onScopeChange,
  onModeChange,
  busy = false,
  inputRef,
}: {
  value: string
  onChange: (value: string) => void
  onSubmit: (question: string, documentIds: string[]) => void | Promise<void>
  documents: Record<string, DocumentRecord>
  documentId?: string
  documentIds: string[]
  onScopeChange: (ids: string[]) => void
  onModeChange?: (mode: 'document' | 'project', ids: string[]) => void
  busy?: boolean
  inputRef?: RefObject<HTMLTextAreaElement | null>
}) {
  const all = Object.keys(documents)
  const [mode, setMode] = useState<'document' | 'project'>(() =>
    documentIds.length === 1 && documentIds[0] === documentId
      ? 'document'
      : 'project',
  )
  const [projectSelection, setProjectSelection] = useState(() =>
    documentIds.length === 1 && documentIds[0] === documentId
      ? all
      : documentIds,
  )
  const [choosing, setChoosing] = useState(false)
  const [filter, setFilter] = useState('')
  const ownRef = useRef<HTMLTextAreaElement>(null)
  const field = inputRef ?? ownRef
  const picker = useRef<HTMLDivElement>(null)
  const pickerButton = useRef<HTMLButtonElement>(null)
  const pickerId = useId()
  const selected = documentIds.filter((id) => !!documents[id])
  useEffect(() => {
    if (
      mode === 'document' &&
      documentId &&
      (documentIds.length !== 1 || documentIds[0] !== documentId)
    )
      onScopeChange([documentId])
  }, [mode, documentId, documentIds, onScopeChange])
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault()
        field.current?.focus()
        field.current?.select()
      }
      if (event.key === 'Escape' && choosing) {
        setChoosing(false)
        pickerButton.current?.focus()
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [field, choosing])
  useEffect(() => {
    if (!choosing) return
    const close = (event: PointerEvent) => {
      if (!picker.current?.contains(event.target as Node)) setChoosing(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [choosing])
  function choose(ids: string[]) {
    setProjectSelection(ids)
    onScopeChange(ids)
  }
  function submit() {
    if (value.trim() && selected.length && !busy) {
      setChoosing(false)
      void onSubmit(value.trim(), selected)
    }
  }
  return (
    <form
      className="scoped-query"
      aria-label="Document search"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <div className="scoped-query-input">
        <div className="query-field">
          <Search size={19} />
          <label htmlFor="query" className="sr-only">
            Query
          </label>
          <textarea
            ref={field}
            id="query"
            rows={1}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={
              mode === 'document'
                ? 'Search within this document…'
                : 'Search across project documents…'
            }
            onKeyDown={(event) => {
              if (
                event.key === 'Enter' &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault()
                submit()
              }
            }}
          />
          <kbd>Ctrl K</kbd>
        </div>
        <button
          className="run-query"
          type="submit"
          disabled={!value.trim() || !selected.length || busy}
        >
          {busy ? 'Searching…' : 'Search'}
          <CornerDownLeft size={15} />
        </button>
      </div>
      <div className="query-scope-row">
        <span className="query-scope-caption">Search in</span>
        <div
          className="query-scope-options"
          role="group"
          aria-label="Search scope"
        >
          {documentId && (
            <button
              type="button"
              disabled={busy}
              aria-pressed={mode === 'document'}
              onClick={() => {
                setMode('document')
                setChoosing(false)
                onScopeChange([documentId])
                onModeChange?.('document', [documentId])
              }}
            >
              <FileText size={13} />
              This document
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            aria-pressed={mode === 'project'}
            onClick={() => {
              setMode('project')
              const ids=projectSelection.filter((id) => !!documents[id])
              onScopeChange(ids)
              onModeChange?.('project', ids)
            }}
          >
            <Files size={13} />
            Project documents
            {mode === 'project' && (
              <span className="query-scope-count">{selected.length}</span>
            )}
          </button>
        </div>
        {mode === 'document' ? (
          <span
            className="query-scope-title"
            title={documents[documentId!]?.title}
          >
            {documents[documentId!]?.title}
          </span>
        ) : (
          <div className="query-scope-picker" ref={picker}>
            <button
              ref={pickerButton}
              type="button"
              disabled={busy}
              aria-expanded={choosing}
              aria-controls={pickerId}
              onClick={() => setChoosing(!choosing)}
            >
              Choose documents
              <ChevronDown size={13} />
            </button>
            {choosing && (
              <div
                id={pickerId}
                className="query-scope-popover"
                role="region"
                aria-label="Select search documents"
              >
                <input
                  aria-label="Filter search documents"
                  placeholder="Find a document…"
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                />
                <div className="query-scope-selection">
                  <span>
                    {selected.length} of {all.length} selected
                  </span>
                  <button type="button" onClick={() => choose(all)}>
                    Select all
                  </button>
                  <button type="button" onClick={() => choose([])}>
                    Clear
                  </button>
                </div>
                <div className="query-scope-document-list">
                  {all
                    .filter((id) =>
                      (documents[id].title + ' ' + documents[id].label)
                        .toLowerCase()
                        .includes(filter.toLowerCase()),
                    )
                    .map((id) => (
                      <label key={id}>
                        <input
                          type="checkbox"
                          checked={selected.includes(id)}
                          onChange={(event) =>
                            choose(
                              event.target.checked
                                ? [...selected, id]
                                : selected.filter((value) => value !== id),
                            )
                          }
                        />
                        <span>
                          {documents[id].title}
                          <small>{documents[id].label}</small>
                        </span>
                      </label>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
        {!selected.length && (
          <span className="query-scope-empty" role="status">
            Select at least one document.
          </span>
        )}
      </div>
    </form>
  )
}

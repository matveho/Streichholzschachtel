import { useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import type { QueryTabsApi } from './useQueryTabs'

export function QueryTabBar({
  tabs,
  dashboard,
}: {
  tabs: QueryTabsApi
  dashboard?: { href: string; active: boolean }
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const cancelled = useRef(false)
  if (!tabs.tabs.length && !dashboard) return null
  function commit(key: string) {
    if (!cancelled.current && draft.trim()) tabs.rename(key, draft.trim())
    cancelled.current = false
    setEditing(null)
  }
  return (
    <nav className="query-tabs" aria-label="Open queries">
      <div className="query-tab-list">
        {dashboard && (
          <div className={`query-tab ${dashboard.active ? 'selected' : ''}`}>
            <a
              className="query-tab-name"
              href={dashboard.href}
              aria-current={dashboard.active ? 'page' : undefined}
            >
              Project dashboard
            </a>
          </div>
        )}
        {tabs.tabs.map((tab) => {
          const selected = !dashboard?.active && tab.key === tabs.active
          return (
            <div
              className={`query-tab ${selected ? 'selected' : ''}`}
              key={tab.key}
            >
              {editing === tab.key ? (
                <input
                  className="query-tab-rename"
                  aria-label="Rename query tab"
                  autoFocus
                  value={draft}
                  size={Math.max(draft.length, 6)}
                  maxLength={60}
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => commit(tab.key)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur()
                    if (e.key === 'Escape') {
                      e.stopPropagation()
                      cancelled.current = true
                      e.currentTarget.blur()
                    }
                  }}
                />
              ) : (
                <button
                  aria-current={selected ? 'page' : undefined}
                  className="query-tab-name"
                  title="Double-click to rename"
                  onClick={() => tabs.select(tab.key)}
                  onDoubleClick={() => {
                    setDraft(tab.name)
                    setEditing(tab.key)
                  }}
                >
                  {tab.name}
                </button>
              )}
              <button
                className="query-tab-close"
                aria-label={`Close ${tab.name}`}
                title="Close"
                onClick={() => tabs.close(tab.key)}
              >
                <X size={12} />
              </button>
            </div>
          )
        })}
      </div>
      <button
        aria-label="Open new query tab"
        title="Open new query tab"
        onClick={tabs.openNew}
      >
        <Plus size={15} />
      </button>
    </nav>
  )
}

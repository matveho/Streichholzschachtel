import { useState } from 'react'
import { ArrowUpRight, Search } from 'lucide-react'
import { AppHeader } from './AppHeader'
import { documents, queryCases } from './data'
import type { HistoryEntry } from './history'
import { navigateLink } from './navigation'

export function QueryHome({
  entries,
  onNew,
}: {
  entries: HistoryEntry[]
  onNew: () => void
}) {
  const [filter, setFilter] = useState('')
  const shown = entries.filter((entry) =>
    `${entry.title} ${entry.prompt}`
      .toLowerCase()
      .includes(filter.toLowerCase()),
  )
  return (
    <main className="workspace home-screen">
      <AppHeader home onNew={onNew} />
      <section className="query-history" aria-label="Query history">
        <div className="history-toolbar">
          <h1>Previous queries</h1>
          <label className="history-filter">
            <Search size={14} />
            <input
              aria-label="Filter queries"
              placeholder="Filter queries"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </label>
        </div>
        <div className="history-list">
          {shown.map((entry) => {
            const sources = queryCases.find(
              (c) => c.id === entry.caseId,
            )!.documentIds
            return (
              <a
                className="history-entry"
                href={`#query/${encodeURIComponent(entry.id)}`}
                onClick={navigateLink}
                key={entry.id}
              >
                <div>
                  <h2>{entry.title}</h2>
                  <p>{entry.prompt}</p>
                  {entry.id === entry.caseId && (
                    <span className="history-sources">
                      {sources.map((id) => documents[id].label).join(' · ')}
                    </span>
                  )}
                </div>
                <ArrowUpRight size={17} />
              </a>
            )
          })}
          {!shown.length && (
            <p className="history-empty">No matching queries.</p>
          )}
        </div>
      </section>
    </main>
  )
}

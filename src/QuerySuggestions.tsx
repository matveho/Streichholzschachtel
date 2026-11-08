import { ArrowUpRight } from 'lucide-react'
import type { QuerySuggestion } from './backend'

export function QuerySuggestions({
  suggestions,
  onSelect,
}: {
  suggestions: QuerySuggestion[]
  onSelect: (suggestion: QuerySuggestion) => void
}) {
  if (!suggestions.length) return null
  return (
    <section className="query-suggestions" aria-label="Related source queries">
      <h2>Related source queries</h2>
      <div>
        {suggestions.map((suggestion) => (
          <button
            key={suggestion.question}
            type="button"
            onClick={() => onSelect(suggestion)}
          >
            <span className="suggestion-question">
              {suggestion.question}
              <ArrowUpRight size={14} aria-hidden="true" />
            </span>
            <span className="suggestion-preview">{suggestion.preview}</span>
            <span className="suggestion-source">
              {suggestion.sourceLabel} · p. {suggestion.page}
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

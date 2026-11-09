import { useDocuments } from './DocumentContext'
import type { Reference } from './data'

export type ReportBlock = {
  heading?: string
  sentences: { text: string; refs?: string[] }[]
}

export function QueryReport({
  blocks,
  selected,
  onPreview,
  onSelect,
  sourceReferences,
}: {
  blocks: ReportBlock[]
  selected: string[]
  onPreview: (refs: string[] | null) => void
  onSelect: (refs: string[]) => void
  sourceReferences: Reference[]
}) {
  const documents = useDocuments()
  return (
    <article className="query-report" aria-label="Query report">
      {blocks.map((block, index) => (
        <section key={index}>
          {block.heading && <h2>{block.heading}</h2>}
          <p>
            {block.sentences.map((sentence, i) => (
              <span key={i}>
                {sentence.refs?.length ? (
                  <>
                    <span
                      role="button"
                      tabIndex={0}
                      className={`report-sentence ${sentence.refs.every((id) => selected.includes(id)) ? 'selected' : ''}`}
                      onMouseEnter={() => onPreview(sentence.refs!)}
                      onMouseLeave={() => onPreview(null)}
                      onFocus={() => onPreview(sentence.refs!)}
                      onBlur={() => onPreview(null)}
                      onClick={() => onSelect(sentence.refs!)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          onSelect(sentence.refs!)
                        }
                      }}
                    >
                      {sentence.text}
                    </span>
                    <sup className="citations">
                      {sentence.refs.map((id) => {
                        const ref = sourceReferences.find((r) => r.id === id)
                        if (!ref) return null
                        return (
                          <button
                            key={id}
                            className={selected.includes(id) ? 'active' : ''}
                            title={`${documents[ref.doc].label} · ${ref.label} (PDF page ${ref.page})`}
                            aria-label={`Source ${id}: ${documents[ref.doc].label}, ${ref.label}`}
                            onMouseEnter={() => onPreview([id])}
                            onMouseLeave={() => onPreview(null)}
                            onFocus={() => onPreview([id])}
                            onBlur={() => onPreview(null)}
                            onClick={() => onSelect([id])}
                          >
                            {id}
                          </button>
                        )
                      })}
                    </sup>
                  </>
                ) : (
                  sentence.text
                )}{' '}
              </span>
            ))}
          </p>
        </section>
      ))}
    </article>
  )
}

import { useState } from 'react'
import {
  ArrowUpRight,
  ListFilter,
  CornerDownLeft,
  FileUp,
  SlidersHorizontal,
  PencilLine,
  SearchX,
} from 'lucide-react'
import type { QueryAssist as Assist, QuerySuggestion } from './backend'
import { outcomeOf } from './assist'
import type { ThreadTurn } from './assist'

function Refine({
  question,
  placeholder,
  onRefine,
  autoFocus = false,
}: {
  question: string
  placeholder: string
  onRefine: (question: string, choice: string) => void
  autoFocus?: boolean
}) {
  const [detail, setDetail] = useState(question)
  return (
    <form
      className="assist-refine"
      onSubmit={(e) => {
        e.preventDefault()
        const extra = detail.trim()
        if (!extra) return
        if (extra === question.trim()) return
        onRefine(extra, 'Search revised')
      }}
    >
      <input
        aria-label="Revised search"
        placeholder={placeholder}
        value={detail}
        autoFocus={autoFocus}
        maxLength={2000}
        onChange={(e) => setDetail(e.target.value)}
      />
      <button
        type="submit"
        disabled={!detail.trim() || detail.trim() === question.trim()}
      >
        Run search
        <CornerDownLeft size={13} />
      </button>
    </form>
  )
}

function Clarifications({
  assist,
  onRefine,
}: {
  assist?: Assist
  onRefine: (question: string, choice: string) => void
}) {
  const [selected, setSelected] = useState<{
    question: string
    label: string
  } | null>(null)
  if (!assist?.clarifications.length) return null
  return (
    <form
      className="assist-clarifications"
      onSubmit={(e) => {
        e.preventDefault()
        if (selected) onRefine(selected.question, selected.label)
      }}
    >
      {assist.clarifications.map((c) => (
        <fieldset className="assist-choice" key={c.question}>
          <legend>
            {/system/i.test(c.question)
              ? 'System'
              : /development/i.test(c.question)
                ? 'Development type'
                : 'Search parameter'}
          </legend>
          <div className="assist-options">
            {c.options.map((option) => (
              <label key={option.question}>
                <input
                  type="radio"
                  name="search-parameter"
                  checked={selected?.question === option.question}
                  onChange={() => setSelected(option)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <button type="submit" className="assist-apply" disabled={!selected}>
        Apply and search
      </button>
    </form>
  )
}

/** Concrete parameters that would make the question answerable. */
function Details({ details, lead }: { details?: string[]; lead: string }) {
  if (!details?.length) return null
  return (
    <div className="assist-details">
      <span>{lead}</span>
      <ul>
        {details.map((detail) => (
          <li key={detail}>{detail}</li>
        ))}
      </ul>
    </div>
  )
}

/** Close matches the user may have meant, each a runnable question. */
function Alternatives({
  assist,
  suggestions,
  onRefine,
}: {
  assist?: Assist
  suggestions: QuerySuggestion[]
  onRefine: (question: string, choice: string) => void
}) {
  if (!assist?.clarifications.length && !suggestions.length) return null
  return (
    <div className="assist-alternatives">
      <Clarifications assist={assist} onRefine={onRefine} />
      {suggestions.length > 0 && (
        <ul className="assist-meant">
          {suggestions.map((s) => (
            <li key={s.question}>
              <button
                type="button"
                onClick={() => onRefine(s.question, s.question)}
              >
                <span className="assist-meant-question">
                  {s.question}
                  <ArrowUpRight size={14} aria-hidden="true" />
                </span>
                <span className="assist-meant-preview">{s.preview}</span>
                <span className="assist-meant-source">
                  {s.sourceLabel} · p. {s.page}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * Search refinement shown above a query result: close alternatives, the
 * parameters still missing, or why nothing matched and what to upload. It
 * never adds engineering content of its own.
 */
export function QueryAssist({
  mode,
  assist,
  question,
  suggestions = [],
  inProject,
  onRefine,
  onRephrase,
  onUpload,
}: {
  mode: string
  assist?: Assist
  question: string
  /** Related source queries from the backend, shown as "did you mean". */
  suggestions?: QuerySuggestion[]
  inProject: boolean
  onRefine: (question: string, choice: string) => void
  onRephrase: () => void
  onUpload?: () => void
}) {
  const outcome = outcomeOf(mode, assist)
  const where = inProject ? "this project's documents" : 'the indexed standards'
  const actions = (
    <div className="assist-actions">
      {onUpload && (
        <button type="button" className="assist-primary" onClick={onUpload}>
          <FileUp size={14} />
          Upload documents
        </button>
      )}
      <button type="button" onClick={onRephrase}>
        <PencilLine size={14} />
        Edit search
      </button>
    </div>
  )

  if (outcome === 'off_topic')
    return (
      <section
        className="assist"
        role="status"
        aria-label="Search not recognized"
      >
        <h2>
          <ListFilter size={16} />
          Search not recognized
        </h2>
        <p>
          No engineering topic was identified in “{question}”. Specify an asset
          and requirement, such as storm service minimum slope.
        </p>
        <div className="assist-actions">
          <button type="button" onClick={onRephrase}>
            <PencilLine size={14} /> Edit search
          </button>
        </div>
        {!!assist?.examples?.length && (
          <div className="assist-details">
            <span>Example searches</span>
            <ul className="assist-examples">
              {assist.examples.map((example) => (
                <li key={example}>
                  <button
                    type="button"
                    onClick={() => onRefine(example, example)}
                  >
                    {example}
                    <ArrowUpRight size={13} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    )

  if (outcome === 'answered') return null

  if (outcome === 'vague')
    return (
      <section
        className="assist"
        role="status"
        aria-label="Search parameters required"
      >
        <h2>
          <SlidersHorizontal size={16} />
          Specify search parameters
        </h2>
        <p>
          Specify the asset, requirement and applicable condition to narrow the
          search. Any related provisions below require an applicability review.
        </p>
        <Clarifications assist={assist} onRefine={onRefine} />
        <Details details={assist?.details} lead="Search parameters" />
        <Refine
          question={question}
          placeholder="e.g. minimum slope for a 150 mm storm service"
          onRefine={onRefine}
        />
      </section>
    )

  if (outcome === 'jurisdiction')
    return (
      <section
        className="assist assist-warning"
        role="status"
        aria-label="Outside the indexed documents"
      >
        <h2>
          <SearchX size={16} />
          Jurisdiction outside search scope:{' '}
          {assist?.jurisdiction ?? 'another municipality'}
        </h2>
        <p>
          The selected references do not establish requirements for{' '}
          {assist?.jurisdiction ?? 'this jurisdiction'}. Select the applicable
          reference collection in the project settings, add its standards, or
          revise the location.
        </p>
        {actions}
      </section>
    )

  if (outcome === 'not_found')
    return (
      <section
        className="assist assist-warning"
        role="status"
        aria-label="No matching provisions found"
      >
        <h2>
          <SearchX size={16} />
          No matching provisions found
        </h2>
        <p>
          No supported answer was identified in {where}.
          {assist?.missing && ` Potential source gap: ${assist.missing}.`}{' '}
          Review document coverage before revising the search.
        </p>
        <Details details={assist?.details} lead="Search parameters" />
        {actions}
        <Refine
          question={question}
          placeholder="Asset, requirement and condition"
          onRefine={onRefine}
        />
      </section>
    )

  // partial: the closest related source text follows below this card.
  return (
    <section className="assist" role="status" aria-label="Refine search">
      <h2>
        <SlidersHorizontal size={16} />
        Search refinement required
      </h2>
      <p>
        No provision in {where} states this directly. The closest related source
        text is below; confirm it applies before relying on it.
        {assist?.missing &&
          ` Potential source gap: ${assist.missing}, not identified in the selected documents.`}
      </p>
      <Alternatives
        assist={assist}
        suggestions={suggestions}
        onRefine={onRefine}
      />
      <Details details={assist?.details} lead="Search parameters" />
      <Refine
        question={question}
        placeholder="Add detail, e.g. pipe diameter, land use or document"
        onRefine={onRefine}
      />
      {actions}
    </section>
  )
}

/** Previous search revisions, oldest first. */
export function QueryThread({ thread }: { thread: ThreadTurn[] }) {
  const [showAll, setShowAll] = useState(false)
  if (!thread.length) return null
  const hidden = showAll ? 0 : Math.max(0, thread.length - 3)
  return (
    <ol className="query-thread" aria-label="Search revision history">
      {hidden > 0 && (
        <li>
          <button
            type="button"
            className="thread-more"
            onClick={() => setShowAll(true)}
          >
            Show {hidden} earlier {hidden === 1 ? 'search' : 'searches'}
          </button>
        </li>
      )}
      {thread.slice(hidden).map((turn, i) => (
        <li key={hidden + i}>
          <span className="thread-question">{turn.question}</span>
          {turn.choice && (
            <span className="thread-choice">
              <CornerDownLeft size={12} aria-hidden="true" />
              {turn.choice}
            </span>
          )}
        </li>
      ))}
    </ol>
  )
}

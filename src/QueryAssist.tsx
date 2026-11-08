import { useState } from 'react'
import {
  ArrowUpRight,
  BookOpen,
  CornerDownLeft,
  FileUp,
  MessageCircleQuestion,
  PencilLine,
  SearchX,
} from 'lucide-react'
import type { QueryAssist as Assist, QuerySuggestion } from './backend'
import { maxRounds, outcomeOf } from './assist'
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
  const [detail, setDetail] = useState('')
  return (
    <form
      className="assist-refine"
      onSubmit={(e) => {
        e.preventDefault()
        const extra = detail.trim()
        if (!extra) return
        onRefine(`${question.trim().replace(/[?.!\s]+$/, '')}, ${extra}`, extra)
      }}
    >
      <input
        aria-label="Add detail to your question"
        placeholder={placeholder}
        value={detail}
        autoFocus={autoFocus}
        maxLength={300}
        onChange={(e) => setDetail(e.target.value)}
      />
      <button type="submit" disabled={!detail.trim()}>
        Ask
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
  if (!assist?.clarifications.length) return null
  return (
    <div className="assist-clarifications">
      {assist.clarifications.map((c) => (
        <div className="assist-choice" key={c.question}>
          <span>{c.question}</span>
          <div role="group" aria-label={c.question}>
            {c.options.map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => onRefine(option.question, option.label)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
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
 * Conversational help shown above a query result: close alternatives, the
 * parameters still missing, or why nothing matched and what to upload. It
 * never adds engineering content of its own.
 */
export function QueryAssist({
  mode,
  assist,
  question,
  suggestions = [],
  rounds,
  inProject,
  onRefine,
  onRephrase,
  onUpload,
  uploadNote,
}: {
  mode: string
  assist?: Assist
  question: string
  /** Related source queries from the backend, shown as "did you mean". */
  suggestions?: QuerySuggestion[]
  rounds: number
  inProject: boolean
  onRefine: (question: string, choice: string) => void
  onRephrase: () => void
  onUpload?: () => void
  uploadNote: string
}) {
  const [refining, setRefining] = useState(false)
  const outcome = outcomeOf(mode, assist)
  const asking = rounds < maxRounds
  const where = inProject ? "this project's documents" : 'the indexed standards'
  const actions = (
    <div className="assist-actions">
      {onUpload ? (
        <button type="button" className="assist-primary" onClick={onUpload}>
          <FileUp size={14} />
          Upload documents
        </button>
      ) : (
        <span className="assist-note">{uploadNote}</span>
      )}
      <button type="button" onClick={onRephrase}>
        <PencilLine size={14} />
        Rephrase question
      </button>
    </div>
  )

  if (outcome === 'off_topic')
    return (
      <section
        className="assist"
        role="status"
        aria-label="Not an engineering question"
      >
        <h2>
          <BookOpen size={16} />
          Basis searches engineering design standards
        </h2>
        <p>
          “{question}” doesn’t look like an engineering question, so there is
          nothing in {where} to match it against. Basis answers questions about
          municipal engineering requirements (drainage, water, roads, bridges,
          lighting) and cites the source page for every answer. It works best
          with specific technical terms: the element, the requirement and the
          condition.
        </p>
        {!!assist?.examples?.length && (
          <div className="assist-details">
            <span>Try a question like:</span>
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

  if (outcome === 'answered') {
    const chips = asking && !!assist?.clarifications.length
    return (
      <section className="assist assist-inline" aria-label="Refine this result">
        {chips && <Clarifications assist={assist} onRefine={onRefine} />}
        {!!assist?.details.length && (
          <p className="assist-precision">
            For a more precise answer, state{' '}
            {assist.details
              .map((d) => d.replace(/\.$/, '').replace(/^The /, 'the '))
              .join('; ')}
            .
          </p>
        )}
        {refining ? (
          <Refine
            question={question}
            autoFocus
            placeholder="Add the missing detail, e.g. 300 mm sanitary sewer"
            onRefine={onRefine}
          />
        ) : (
          <button
            type="button"
            className="assist-link"
            onClick={() => setRefining(true)}
          >
            Not what you meant?
          </button>
        )}
      </section>
    )
  }

  if (outcome === 'vague')
    return (
      <section
        className="assist"
        role="status"
        aria-label="Question needs detail"
      >
        <h2>
          <MessageCircleQuestion size={16} />
          Add detail for a sourced answer
        </h2>
        <p>
          A search this short matches too many provisions to give a reliable
          answer, so the result below is only the closest match.
        </p>
        <Details details={assist?.details} lead="Specify:" />
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
          Outside the indexed jurisdiction:{' '}
          {assist?.jurisdiction ?? 'another municipality'}
        </h2>
        <p>
          The indexed documents are City of Edmonton (EPCOR) standards. Their
          values can’t be applied as{' '}
          {assist?.jurisdiction ?? 'another municipality'}’s requirements.
          Upload that municipality’s standards to search them, or restate the
          question for Edmonton.
        </p>
        {actions}
      </section>
    )

  if (outcome === 'not_found')
    return (
      <section
        className="assist assist-warning"
        role="status"
        aria-label="Nothing found"
      >
        <h2>
          <SearchX size={16} />
          Sorry, no provision in {where} addresses this
        </h2>
        <p>
          {assist?.missing
            ? `This is typically governed by ${assist.missing}, which isn’t in the database.`
            : 'The governing standard or report may not be in the database yet.'}{' '}
          Try uploading the required document if necessary, or restate the
          question with the specific element, parameter and condition.
        </p>
        <Details details={assist?.details} lead="It may also help to state:" />
        {actions}
        <Refine
          question={question}
          placeholder="Or add detail to your question"
          onRefine={onRefine}
        />
      </section>
    )

  // partial: the closest related source text follows below this card.
  return (
    <section
      className="assist"
      role="status"
      aria-label="Narrow down the question"
    >
      <h2>
        <MessageCircleQuestion size={16} />
        No direct answer. Did you mean one of these?
      </h2>
      <p>
        No provision in {where} states this directly. The closest related source
        text is below; confirm it applies before relying on it.
        {assist?.missing &&
          ` A direct answer probably needs ${assist.missing}, which isn’t in the database.`}
      </p>
      {asking ? (
        <Alternatives
          assist={assist}
          suggestions={suggestions}
          onRefine={onRefine}
        />
      ) : (
        <p className="assist-note">
          Still no direct answer after narrowing. The governing document may not
          be uploaded yet.
        </p>
      )}
      <Details
        details={assist?.details}
        lead="To get a direct answer, specify:"
      />
      <Refine
        question={question}
        placeholder="Add detail, e.g. pipe diameter, land use or document"
        onRefine={onRefine}
      />
      {actions}
    </section>
  )
}

/** Earlier steps of this tab's conversation, oldest first. */
export function QueryThread({ thread }: { thread: ThreadTurn[] }) {
  const [showAll, setShowAll] = useState(false)
  if (!thread.length) return null
  const hidden = showAll ? 0 : Math.max(0, thread.length - 3)
  return (
    <ol className="query-thread" aria-label="Conversation so far">
      {hidden > 0 && (
        <li>
          <button
            type="button"
            className="thread-more"
            onClick={() => setShowAll(true)}
          >
            Show {hidden} earlier {hidden === 1 ? 'question' : 'questions'}
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

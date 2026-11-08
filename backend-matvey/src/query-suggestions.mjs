import { UnitIndex, lookup, isEngineeringQuery } from './lookup.mjs'
import { tokens, lookupStopwords } from './search.mjs'
import { foreignJurisdiction } from './catalog.mjs'

const noise = new Set(
  tokens(
    'show find tell source text provisions requirements minimum maximum design please specific unknown approved city epcor edmonton document standard guide height width length depth rating speed limit area volume value',
    lookupStopwords,
  ),
)
const subject = (text) =>
  new Set(
    tokens(text, lookupStopwords).filter(
      (t) => !noise.has(t) && !/^\d/.test(t),
    ),
  )
const overlap = (a, b) => [...a].filter((t) => b.has(t)).length

// Alternatives change the search scope visibly. They never turn an unsupported
// engineering answer into an approval. Every option is run through the same
// offline lookup used when the user selects it.
export function suggestQueries(question, searchIndex, limit = 3) {
  if (!isEngineeringQuery(question)) return []
  const index = (searchIndex.unitIndex ??= new UnitIndex(searchIndex.corpus))
  if (foreignJurisdiction(question, index.corpus.documents)) return []
  const asked = subject(question)
  if (!asked.size) return []
  const output = [],
    seen = new Set()
  for (const { unit } of index.score(question).slice(0, 40)) {
    if (
      unit.kind !== 'body' ||
      unit.type === 'heading' ||
      unit.text.length < 25 ||
      !unit.regions?.length
    )
      continue
    const doc = index.docs.get(unit.doc)
    if (doc.status === 'superseded') continue
    const topic = (unit.table || unit.heading || '')
      .replace(/^(?:Table\s+)?\d+(?:\.\d+)*[.:]?\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (topic.length < 8 || topic.length > 150 || subject(topic).size < 2)
      continue
    const key = topic.toLowerCase()
    if (seen.has(key) || !overlap(asked, subject(unit.text + ' ' + topic)))
      continue
    const alternative = `What are the requirements for ${topic.replace(/[.:;]$/, '')}?`
    const result = lookup(alternative, index)
    if (result.mode !== 'extractive_answer') continue
    const supported = result.sections
      .flatMap((s) => s.sentences.flatMap((s) => s.units || []))
      .filter(
        (u) => u.kind === 'body' && u.regions?.length && u.text.length >= 25,
      )
    if (
      !supported.length ||
      !supported.some((u) => u.doc === unit.doc) ||
      !supported.some((u) => overlap(asked, subject(u.text + ' ' + u.frame)))
    )
      continue
    seen.add(key)
    const first = supported.find((u) => u.doc === unit.doc)
    output.push({
      question: alternative,
      sourceLabel: doc.label,
      page: first.page,
      preview:
        first.text.length > 220
          ? first.text.slice(0, 217).trimEnd() + '…'
          : first.text,
      sourceOnly: true,
    })
    if (output.length >= Math.min(3, limit)) break
  }
  return output
}

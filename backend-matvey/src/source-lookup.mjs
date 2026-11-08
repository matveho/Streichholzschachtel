import { tokens } from './search.mjs'
import { evidenceUnits } from './evidence-units.mjs'
import { applicableEvidence } from './applicability.mjs'

const canonical = (text) =>
  text
    .replace(/\bcatch[ -]?basins?\b/gi, 'CB')
    .replace(/\bgrades?\b/gi, 'slope')
export function sourceLookup(question, passages) {
  if (
    !/^\s*what\b/i.test(question) ||
    !/\b(?:minimum|maximum)\b/i.test(question) ||
    question.length > 125
  )
    return null
  const ignored = new Set(
    tokens('minimum maximum required when where each other'),
  )
  if (/\bsewers?\b/i.test(question))
    for (const word of tokens('mains pipes')) ignored.add(word)
  const terms = [...new Set(tokens(canonical(question)))].filter(
    (t) => !ignored.has(t) && !/^\d/.test(t),
  )
  if (terms.length < 3) return null
  const bound = /\bminimum\b/i.test(question) ? /\bminimum\b/i : /\bmaximum\b/i
  const property = question.match(
    /\b(?:minimum|maximum)\s+(.+?)(?=\s+(?:of|for|when|where|is|are|shall|must|required)\b|[?]|$)/i,
  )?.[1]
  if (!property) return null
  const propertyTerms = tokens(canonical(property))
  const boundWord = tokens(
    bound.source.includes('minimum') ? 'minimum' : 'maximum',
  )[0]
  const candidates = applicableEvidence(
    question,
    evidenceUnits(passages, 18000, { groupParagraphs: false }),
  )
    .units.map((u) => {
      const words = new Set(tokens(canonical(u.excerpt)))
      const matched = terms.filter((t) => words.has(t)).length
      const ordered = tokens(canonical(u.excerpt))
      const boundMatchesProperty = ordered.some(
        (word, i) =>
          word === boundWord &&
          propertyTerms.every((term) =>
            ordered
              .slice(i + 1, i + 1 + propertyTerms.length + 2)
              .includes(term),
          ),
      )
      return { ...u, score: matched / terms.length, boundMatchesProperty }
    })
    .filter(
      (u) =>
        u.score === 1 &&
        u.boundMatchesProperty &&
        bound.test(u.excerpt) &&
        /\d/.test(u.excerpt) &&
        u.excerpt.length < 550,
    )
    .sort((a, b) => b.score - a.score || a.excerpt.length - b.excerpt.length)
  const best = candidates[0]
  if (!best) return null
  return [
    {
      heading: 'Source provision',
      claims: [
        {
          text: best.excerpt[0].toUpperCase() + best.excerpt.slice(1),
          evidence: [
            {
              passage: best.passage,
              excerpt: best.excerpt,
              regions: best.regions,
            },
          ],
        },
      ],
    },
  ]
}

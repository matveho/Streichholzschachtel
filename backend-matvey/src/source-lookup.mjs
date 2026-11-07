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
  const candidates = applicableEvidence(question, evidenceUnits(passages))
    .units.map((u) => {
      const words = new Set(tokens(canonical(u.excerpt)))
      const matched = terms.filter((t) => words.has(t)).length
      return { ...u, score: matched / terms.length }
    })
    .filter(
      (u) => u.score === 1 && /\d/.test(u.excerpt) && u.excerpt.length < 550,
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

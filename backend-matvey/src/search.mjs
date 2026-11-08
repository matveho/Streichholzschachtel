import { normalize } from './indexer.mjs'

const stop = new Set(
  'a an the and or of to for in on at by is are was were be been being it its this that these those with from as should can could would must shall may what which how do does did we our i you your have has had than into before after about there their they them please review determine explain tell find requirements requirement apply applies applicable needed need enough use using design proposed project document documents guide guidelines standard standards'.split(
    ' ',
  ),
)
function stem(word) {
  if (/^footings?$/.test(word)) return 'footing'
  // Match engineering nouns to their verbs without conflating short words.
  return word
    .replace(/(?:ations|ation)$/, 'ate')
    .replace(/(?:ctions|ction)$/, 'ct')
    .replace(/ies$/, 'y')
    .replace(/(?:ments|ment)$/, '')
    .replace(/(?:ings|ing|ed)$/, '')
    .replace(/s$/, '')
    .replace(/e$/, '')
}
export function tokens(text, stopwords = stop) {
  return (
    normalize(text)
      .toLowerCase()
      .replace(/(\p{L})[-‐‑](?=\p{L})/gu, '$1 ')
      .replace(/\bm[³3]\b/g, 'cubicmetres')
      .replace(/\bm[²2]\b/g, 'squaremetres')
      .match(/[\p{L}][\p{L}\d-]{1,}|\d+(?:\.\d+)?/gu)
      ?.filter((t) => !stopwords.has(t))
      .map((t) => (t.length > 4 ? stem(t) : t)) ?? []
  )
}
// Lookup keeps words such as "review", "design" and "requirements" because a
// precise provision often turns on them; inverse document frequency weighs them.
export const lookupStopwords = new Set(
  [...stop]
    .filter(
      (w) =>
        !/^(review|design|use|using|requirements?|apply|applies|applicable|needed|need|standards?|guidelines?|guide|documents?|project|proposed)$/.test(
          w,
        ),
    )
    .concat(['will', 'want', 'know', 'like', 'get', 'go', 'my', 'me', 'any', 'all', 'there', 'here']),
)
const concepts = [
  ['cover', 'burial', 'depth', 'frost', 'freezing', 'insulation'],
  ['compaction', 'compacted', 'traffic', 'vehicles', 'infiltration'],
  ['detention', 'pond', 'storage', 'modelling', 'simulation'],
  ['guelph', 'permeameter', 'testing', 'conductivity'],
  ['expansion', 'expanded', 'catchment', 'capacity', 'runoff'],
  ['roof', 'leaders', 'downspouts'],
  ['storm', 'drainage', 'sewer'],
  ['sediment', 'erosion', 'contamination'],
  ['bioretention', 'lid', 'planter'],
  ['rainfall', 'storm', 'idf'],
  ['inspection', 'inspect', 'inspections'],
  ['construction', 'constructed', 'constructing'],
  ['frequency', 'weekly', 'daily', 'monthly'],
]

export class SearchIndex {
  constructor(corpus) {
    this.corpus = corpus
    this.status = new Map(corpus.documents.map((d) => [d.id, d.status]))
    this.entries = corpus.passages.map((p) => {
      const list = tokens(p.text)
      const counts = new Map()
      for (const t of list) counts.set(t, (counts.get(t) || 0) + 1)
      return { passage: p, counts, length: list.length }
    })
    this.average =
      this.entries.reduce((n, e) => n + e.length, 0) /
      Math.max(1, this.entries.length)
    this.frequency = new Map()
    for (const e of this.entries)
      for (const t of e.counts.keys())
        this.frequency.set(t, (this.frequency.get(t) || 0) + 1)
  }
  search(question, selectedIds) {
    const baseline = this.searchSingle(question, selectedIds)
    if (question.length < 140) return this.withReferencedSections(baseline)
    const parts = question
      .split(
        /[;?,]|\.(?=\s)|\band(?=\s+(?:what|which|how|whether|confirm|is|are|can|could|should|do|does|must|verify|check|state|review|identify|explain|find|list|provide|assess|evaluate|determine)\b)|\balso\b/i,
      )
      .map((s) => s.trim())
      .filter((s) => s.length > 25 && tokens(s).length >= 3)
      .slice(0, 6)
    if (parts.length < 2) return this.withReferencedSections(baseline)
    const groups = parts.map((part) =>
      this.searchSingle(part, selectedIds).slice(0, 3),
    )
    const candidates = [
      ...groups.flatMap((g) => g.slice(0, 1)),
      ...baseline.slice(0, 4),
      ...groups.flatMap((g) => g.slice(1)),
      ...baseline.slice(4),
    ]
    const chosen = [],
      counts = new Map()
    for (const p of candidates) {
      if (chosen.some((c) => c.id === p.id) || (counts.get(p.doc) || 0) >= 5)
        continue
      chosen.push(p)
      counts.set(p.doc, (counts.get(p.doc) || 0) + 1)
      if (chosen.length >= 12) break
    }
    return this.withReferencedSections(chosen)
  }
  withReferencedSections(passages) {
    const chosen = [...passages]
    const requested = []
    for (const source of passages.slice(0, 6)) {
      for (const match of source.text.matchAll(
        /\b(?:refer\s+to|see)\s+(?:Section\s+)?(\d+(?:\.\d+)+)/gi,
      )) {
        requested.push({ doc: source.doc, section: match[1] })
      }
    }
    for (const target of requested) {
      const found = this.corpus.passages.find(
        (p) =>
          p.doc === target.doc &&
          p.lines.some(
            (line) =>
              line.text === target.section ||
              line.text.startsWith(target.section + ' '),
          ),
      )
      if (!found || chosen.some((p) => p.id === found.id)) continue
      if (
        chosen.reduce((n, p) => n + p.text.length, 0) + found.text.length >
        18000
      )
        break
      chosen.push(found)
      if (chosen.length >= 14) break
    }
    return chosen
  }
  searchSingle(question, selectedIds) {
    const original = [...new Set(tokens(question))]
    const terms = new Map(original.map((t) => [t, /^\d/.test(t) ? 0.15 : 1]))
    const lowered = question.toLowerCase()
    for (const group of concepts)
      if (group.some((word) => lowered.includes(word)))
        for (const word of group)
          for (const t of tokens(word)) if (!terms.has(t)) terms.set(t, 0.28)
    const salient = original.filter(
      (t) =>
        !/^\d/.test(t) &&
        (this.frequency.get(t) || 0) < this.entries.length * 0.55,
    )
    if (!salient.length) return []
    const unknown = salient.filter((t) => !this.frequency.has(t))
    if (unknown.length >= 2 && unknown.length / salient.length >= 0.25)
      return []
    // A missing specialist subject (e.g. footing) cannot be answered by generic
    // matches such as building, new, safe or width.
    const broad = new Set(
      tokens(
        'minimum maximum safe new existing width height size building office required alone serving square metre millimetre while',
      ),
    )
    const subjects = salient.filter((t) => !broad.has(t))
    if (subjects.length && subjects.every((t) => !this.frequency.has(t)))
      return []
    if (
      subjects.some((t) => !this.frequency.has(t)) &&
      subjects.filter((t) => this.frequency.has(t)).length < 2
    )
      return []
    const scored = this.entries
      .filter(
        (e) => !selectedIds?.length || selectedIds.includes(e.passage.doc),
      )
      .map((e) => {
        let score = 0,
          matched = 0
        for (const [t, weight] of terms) {
          const tf = e.counts.get(t) || 0
          if (!tf) continue
          const df = this.frequency.get(t) || 0
          const idf = Math.log(
            1 + (this.entries.length - df + 0.5) / (df + 0.5),
          )
          score +=
            (weight * idf * (tf * 2.2)) /
            (tf + 1.2 * (0.25 + (0.75 * e.length) / this.average))
          if (original.includes(t)) matched++
        }
        const coverage =
          salient.filter((t) => e.counts.has(t)).length /
          Math.max(1, salient.length)
        score *= 0.65 + coverage
        // Prefer actual question phrases over pages that merely repeat common
        // terms or happen to contain the project's numerical assumptions.
        const phraseTerms = original.filter((t) => !/^\d/.test(t))
        const body = tokens(e.passage.text).join(' ')
        for (let i = 0; i < phraseTerms.length - 1; i++)
          if (body.includes(phraseTerms.slice(i, i + 2).join(' '))) score += 3
        // Older editions repeat current text; prefer the edition in force.
        if (this.status?.get(e.passage.doc) === 'superseded') score *= 0.5
        // Low-quality glyph maps are withheld rather than silently rewritten.
        if (
          [...e.passage.text].filter((c) => {
            const n = c.charCodeAt(0)
            return n < 32 && n !== 9 && n !== 10 && n !== 13
          }).length > 2
        )
          score *= 0.2
        return { ...e.passage, score, coverage, matched }
      })
      .filter((p) => p.score > 1.8 && p.matched >= Math.min(2, salient.length))
      .sort((a, b) => b.score - a.score)
    if (!scored.length || scored[0].coverage < 0.12) return []
    const chosen = [],
      perDoc = new Map()
    for (const p of scored) {
      if ((perDoc.get(p.doc) || 0) >= 5) continue
      if (
        chosen.some(
          (c) =>
            c.doc === p.doc &&
            c.page === p.page &&
            Math.abs(c.lines[0].rect[1] - p.lines[0].rect[1]) < 110,
        )
      )
        continue
      chosen.push(p)
      perDoc.set(p.doc, (perDoc.get(p.doc) || 0) + 1)
      if (chosen.length === 14) break
    }
    return chosen.filter((p) => p.score >= chosen[0].score * 0.5).slice(0, 10)
  }
}

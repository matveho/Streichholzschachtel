// Deterministic, offline question answering over evidence units.
//
// Every statement in the result is either verbatim source text (a table row or
// sentence with its PDF regions) or a version statement built from the
// document catalog and cited to the cover, Terms of Use or revision page that
// establishes it. Nothing here generates engineering content.

import { tokens as baseTokens, lookupStopwords } from './search.mjs'
const tokens = (text) => baseTokens(text, lookupStopwords)
import { seriesInQuestion, foreignJurisdiction } from './catalog.mjs'

// Domain vocabulary that differs between how people ask and how standards write.
const rewrites = [
  [/\bthermal movement\b/gi, ' thermal expansion contraction '],
  [/\bI\s*&\s*I\b/gi, ' inflow infiltration '],
  [/\bmanholes?\b/gi, ' maintenance hole '],
  [/\bper capita\b/gi, ' per capita person '],
  [/\bsewage\b/gi, ' sewage sanitary '],
  [/\bhectares?\b/gi, ' ha hectare '],
  [/\bwater mains?\b/gi, ' water main '],
  // Pipe burial is specified as cover, bury, invert or obvert depth.
  [
    /\bcover depth\b|\bdepth of cover\b|\bburial depth\b/gi,
    ' cover depth bury invert ',
  ],
  [/\bbelow (?:the )?finished grade\b/gi, ' below finished grade depth '],
  [/\bfinal acceptance certificate\b/gi, ' final acceptance FAC '],
  [/\bFAC\b/g, ' final acceptance FAC '],
  [/\bCCC\b/g, ' construction completion CCC '],
  [/\bas-built\b/gi, ' as-built record '],
  [/\bR[-\s]?values?\b/g, ' rvalue '],
  [/\banaly[sz]\w*/gi, ' analysis '],
  [
    /\bSWMFs?\b|\bstormwater (?:management )?(?:ponds?|facilit(?:y|ies))\b/gi,
    ' SWMF stormwater pond ',
  ],
  [
    /\bESC\b|\berosion and sediment(?:ation)? control\b/gi,
    ' ESC erosion sediment control ',
  ],
  [/\bPHD\b|\bpeak hour demand\b/gi, ' peak hour demand PHD '],
  [/\bMDD\b|\bmaximum day demand\b/gi, ' maximum day demand MDD '],
  [/\bADD\b|\baverage day demand\b/g, ' average day demand ADD '],
]
// Question concepts whose answers use different words. These terms can raise a
// match but never count against coverage.
const expansions = [
  [
    /\bhow often\b|\bfrequency\b|\bhow frequently\b/i,
    'weekly daily monthly annually frequency',
  ],
  [/\bhow long\b|\bduration\b/i, 'days hours years months period'],
  [/\bwho\b.*\b(manufactur|supplier|make|makes)\w*/i, 'manufacturer supplier'],
]
const canon = (text) =>
  rewrites.reduce(
    (t, [pattern, replacement]) => t.replace(pattern, replacement),
    text,
  )
const unitTokens = (text) => new Set(tokens(canon(text)))
const bigrams = (list) => {
  const set = new Set()
  for (let i = 0; i < list.length - 1; i++) set.add(`${list[i]} ${list[i + 1]}`)
  return set
}
// Questions asking for a quantity are answered by text that states one.
// Footnote markers, bylaw numbers, section numbers and years are not values.
const statesValue = (text) =>
  /\d/.test(
    text
      .replace(/\[\d+\]/g, '')
      .replace(/#\s*\d+/g, '')
      .replace(/^(?:\d+(?:\.\d+)+|[ivx]+\.)\s*\|?/i, '')
      .replace(/\b(?:19|20)\d{2}\b/g, ''),
  )
const upperShare = (text) => {
  const letters = text.match(/\p{L}/gu) || []
  return (
    letters.filter((c) => c === c.toUpperCase()).length /
    Math.max(1, letters.length)
  )
}
const valueQuestion =
  /\b(how (much|many|deep|far|wide|long|often)|what (?:is|are) the (?:minimum|maximum|required)|rate|coefficients?|allowance|density|pressure|fire flow|slope|depth|percentage|percent|clearance|spacing|diameter|cover|units per|flow rate)\b/i

const generic = new Set(
  tokens(
    'edmonton city epcor development developments minimum maximum new value values what which area areas type types land apply applies applicable use using used need needed requirement requirements required require design should',
  ),
)

export class UnitIndex {
  constructor(corpus) {
    this.corpus = corpus
    this.docs = new Map(corpus.documents.map((d) => [d.id, d]))
    this.entries = corpus.units.map((unit) => {
      const sequence = tokens(canon(unit.text))
      return {
        unit,
        text: new Set(sequence),
        pairs: bigrams(sequence),
        frame: unitTokens(unit.frame),
        recent: unitTokens(unit.recent),
      }
    })
    this.position = new Map(corpus.units.map((u, i) => [u, i]))
    this.df = new Map()
    for (const e of this.entries)
      for (const t of new Set([...e.text, ...e.frame, ...e.recent]))
        this.df.set(t, (this.df.get(t) || 0) + 1)
  }
  idf(t) {
    const df = this.df.get(t) || 0
    return Math.log(1 + (this.entries.length - df + 0.5) / (df + 0.5))
  }
  score(question, { series = [], allowSuperseded = false } = {}) {
    const terms = [...new Set(tokens(canon(question)))].filter(
      (t) => this.df.has(t) && !/^\d+$/.test(t),
    )
    const numbers = [...new Set(tokens(question))].filter((t) => /^\d/.test(t))
    const weights = new Map(
      terms.map((t) => [t, this.idf(t) * (generic.has(t) ? 0.3 : 1)]),
    )
    const bonus = new Map()
    for (const [pattern, words] of expansions)
      if (pattern.test(question))
        for (const t of tokens(words))
          if (this.df.has(t) && !weights.has(t))
            bonus.set(t, this.idf(t) * 0.35)
    // A subject no indexed document mentions (e.g. "R-value") is evidence the
    // collection cannot answer; it counts against every unit's coverage.
    const unknown = [...new Set(tokens(canon(question)))].filter(
      (t) =>
        !this.df.has(t) && !/^\d/.test(t) && t.length > 2 && !generic.has(t),
    )
    const total =
      [...weights.values()].reduce((a, b) => a + b, 0) +
      unknown.length * this.idf('\u0000')
    if (!weights.size) return []
    const phrases = [...bigrams(tokens(canon(question)))].filter((p) =>
      p.split(' ').every((t) => !generic.has(t) && !/^\d/.test(t)),
    )
    const wantsValue = valueQuestion.test(question)
    const scored = []
    for (const e of this.entries) {
      const doc = this.docs.get(e.unit.doc)
      if (series.length && !series.includes(doc.series)) continue
      // A table title or column heading defines a row; a lead-in only hints.
      const frameWeight = e.unit.type === 'row' ? 0.75 : 0.45
      let hit = 0
      for (const [t, w] of weights)
        hit += e.text.has(t)
          ? w
          : e.frame.has(t)
            ? frameWeight * w
            : e.recent.has(t)
              ? 0.35 * w
              : 0
      if (!hit) continue
      let extra = 0
      for (const [t, w] of bonus) if (e.text.has(t)) extra = Math.max(extra, w)
      let score = (hit + extra) / total
      score += Math.min(
        0.24,
        0.08 * phrases.filter((p) => e.pairs.has(p)).length,
      )
      for (const n of numbers) if (e.unit.text.includes(n)) score += 0.05
      if (wantsValue && !statesValue(e.unit.text)) score *= 0.7
      if (e.unit.type === 'heading') score *= 0.6
      // Drawing annotations and headings are set in capitals; requirements are not.
      if (e.unit.text.length > 30 && upperShare(e.unit.text) > 0.85)
        score *= 0.5
      // A sentence introducing a table of values answers a value question.
      if (
        wantsValue &&
        e.unit.type === 'text' &&
        /\bTable \d+(?:\.\d+)* (?:shows|lists|gives|provides|summari[sz]es)\b/.test(
          e.unit.text,
        )
      )
        score *= 1.15
      if (e.unit.kind === 'revisions') score *= 0.5
      if (e.unit.kind === 'terms') score *= 0.7
      if (doc.status === 'superseded' && !allowSuperseded) score *= 0.55
      // An addendum that explicitly replaced this section is the most specific source.
      if (
        doc.kind === 'addendum' &&
        doc.replaces?.some((r) => r.pattern.test(e.unit.frame))
      )
        score *= 1.05
      if (e.unit.text.length > 500) score *= 0.85
      if (e.unit.type !== 'row' && e.unit.text.length < 12) score *= 0.6
      scored.push({ unit: e.unit, score })
    }
    return scored.sort((a, b) => b.score - a.score)
  }
}

const footnoteRefs = (text) =>
  [...text.matchAll(/\[(\d{1,2})\]/g)].map((m) => m[1])

// Column-heading lines between a table's title and its first value row, so a
// bare value ("Hotels | 50") is shown with its unit ("(m3/day)").
function tableHeader(row, index) {
  const all = index.corpus.units
  let i = index.position.get(row)
  while (i > 0 && index.position.get(row) - i < 80) {
    const u = all[i]
    if (u.doc !== row.doc) return []
    if (u.type === 'heading' && u.text === row.table) break
    i--
  }
  if (all[i]?.text !== row.table) return []
  const header = []
  for (let j = i + 1; j < all.length && header.length < 5; j++) {
    const u = all[j]
    if (u.type === 'heading') continue
    if (u.type === 'row' && statesValue(u.text.split('|').at(-1))) break
    if (u.text.length < 100) header.push(u)
  }
  return header
}

function footnotesFor(units, index, chosen) {
  const notes = []
  for (const u of chosen) {
    if (!/\[\d{1,2}\]/.test(u.text)) continue
    for (const n of footnoteRefs(u.text)) {
      const note = index.corpus.units.find(
        (x) =>
          x.doc === u.doc &&
          (x.page === u.page || x.page === u.page + 1) &&
          new RegExp(`^${n}\\s+\\p{Lu}`, 'u').test(x.text),
      )
      if (note && !notes.includes(note) && !chosen.includes(note)) {
        // A footnote block may hold several notes; quote only the referenced one.
        const own = note.text.match(
          new RegExp(
            `(?:^|\\s)(${n}\\s+\\p{Lu}.*?)(?=\\s\\d{1,2}\\s+\\p{Lu}|$)`,
            'u',
          ),
        )?.[1]
        notes.push(own && own !== note.text ? { ...note, text: own } : note)
      }
    }
  }
  return notes
}

function dedupe(candidates, index) {
  // Identical wording in an addendum and the edition that adopted it is one fact.
  const seen = new Map()
  const result = []
  for (const c of candidates) {
    const key = c.unit.text.toLowerCase().replace(/\W+/g, '')
    if (seen.has(key)) {
      seen.get(key).duplicates.push(c.unit)
      continue
    }
    const entry = { ...c, duplicates: [] }
    seen.set(key, entry)
    result.push(entry)
  }
  for (const entry of result) {
    // Prefer the addendum that replaced this section as the primary citation.
    const addendum = entry.duplicates.find(
      (u) => index.docs.get(u.doc).kind === 'addendum',
    )
    if (addendum) {
      entry.duplicates = [
        entry.unit,
        ...entry.duplicates.filter((u) => u !== addendum),
      ]
      entry.unit = addendum
    }
  }
  return result
}

function versionNotes(units, index, question) {
  const notes = []
  const docs = [...new Set(units.map((u) => u.doc))].map((id) =>
    index.docs.get(id),
  )
  for (const doc of docs) {
    if (doc.status === 'superseded')
      notes.push({
        text: `${doc.label} ${doc.edition} is superseded${doc.supersededBy ? ` by ${doc.supersededBy}` : ''}${doc.supersededNote ? `. ${doc.supersededNote}` : ''}. Confirm against the current edition.`,
      })
  }
  // Addenda that replaced a section the answer comes from.
  for (const addendum of index.corpus.documents.filter(
    (d) => d.kind === 'addendum',
  )) {
    for (const r of addendum.replaces || []) {
      const relevant = units.some((u) => {
        const doc = index.docs.get(u.doc)
        return (
          doc.series === addendum.series &&
          (r.pattern.test(u.context) ||
            r.pattern.test(u.text) ||
            r.pattern.test(question))
        )
      })
      if (!relevant) continue
      const purpose = index.corpus.units.find(
        (u) => u.doc === addendum.id && /removed and replaced/i.test(u.text),
      )
      notes.push({
        text: `Version check: ${r.note}${addendum.incorporatedInto ? ` The replacement table is carried into ${addendum.incorporatedInto}.` : ''} The superseded table was titled “${r.oldTitle}”.`,
        units: purpose ? [purpose] : [],
      })
    }
  }
  return notes
}

// --- intents ----------------------------------------------------------------

const editionIntent =
  /\b(which|what) (edition|version)\b|\bcurrently in effect\b|\bin effect\b|\beffective\b|\b(take|took|takes|came into|come into) (effect|force)\b|\blast (updated|revised|published)\b|\b(latest|current|newest) (edition|version)\b|\bwhen was\b.*\b(updated|published|released|issued)\b/i
const changeIntent =
  /\bwhat (has )?changed\b|\bchanges?\b.*\b(between|in|to|since)\b|\brevisions?\b|\bwhat('s| is) new\b|\bdifferences?\b|\bdiffer\b/i
const monthYear =
  /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/i

function seriesDocs(index, series) {
  return index.corpus.documents.filter((d) => d.series === series)
}

function editionAnswer(question, index, series) {
  const sections = []
  for (const s of series) {
    const docs = seriesDocs(index, s)
    const current = docs.find(
      (d) => d.status === 'current' && d.kind !== 'addendum',
    )
    if (!current) continue
    const own = index.corpus.units.filter((u) => u.doc === current.id)
    const effective = own.find((u) => /effective as of/i.test(u.text))
    const editionWords = current.edition.split(' ')
    const cover =
      own.find(
        (u) =>
          u.page <= 3 &&
          new RegExp(`^${editionWords[0]}\\s+${editionWords[1]}$`, 'i').test(
            u.text,
          ),
      ) ||
      own.find(
        (u) =>
          u.page <= 3 &&
          u.text.toLowerCase().includes(current.edition.toLowerCase()),
      )
    const sentences = [
      {
        text: `${current.label} (${current.title}) — the current edition in the indexed documents is ${current.edition}.`,
        units: [cover].filter(Boolean),
      },
    ]
    if (effective)
      sentences.push({ text: `“${effective.text}”`, units: [effective] })
    else if (current.effective && current.effective !== current.edition)
      sentences.push({
        text: `Effective: ${current.effective}.`,
        units: [cover].filter(Boolean),
      })
    for (const a of docs.filter((d) => d.kind === 'addendum'))
      sentences.push({
        text: `${a.label} (${a.edition}) also applies to this volume${a.incorporatedInto ? `; its changes are carried into ${a.incorporatedInto}` : ''}.`,
        units: index.corpus.units
          .filter(
            (u) =>
              u.doc === a.id && /removed and replaced|Purpose/i.test(u.text),
          )
          .slice(0, 1),
      })
    for (const old of docs.filter((d) => d.status === 'superseded'))
      sentences.push({
        text: `The ${old.edition} edition (${old.filePath.split(/[\\/]/).pop()}) is also in the collection and is superseded by the ${current.edition} edition.`,
        units: [],
      })
    sections.push({ heading: `${current.label} edition`, sentences })
  }
  return sections.length
    ? { mode: 'version_answer', sections, notes: [] }
    : null
}

function changeAnswer(question, index, series) {
  const sections = []
  const period = question.match(monthYear)
  for (const s of series) {
    const docs = seriesDocs(index, s).filter((d) => d.kind !== 'addendum')
    const current = docs.find((d) => d.status === 'current') || docs[0]
    if (!current) continue
    let rows = index.corpus.units.filter(
      (u) =>
        u.doc === current.id &&
        u.kind === 'revisions' &&
        !/^(?:Section|Δ #|LIST OF REVISIONS|Table of Revisions)\b/i.test(
          u.text,
        ) &&
        !/^The following is a list/i.test(u.text),
    )
    if (period) {
      const dated = rows.filter((u) =>
        u.text.toLowerCase().includes(period[0].toLowerCase()),
      )
      if (dated.length) rows = dated
    }
    if (!rows.length) continue
    const sentences = [
      {
        text: `The list of revisions in ${current.label} ${current.edition} records ${rows.length} change${rows.length === 1 ? '' : 's'}${period ? ` dated ${period[0]}` : ''}:`,
        units: index.corpus.units
          .filter(
            (u) => u.doc === current.id && /list of revisions/i.test(u.text),
          )
          .slice(0, 1),
      },
      ...rows.slice(0, 40).map((u) => ({ text: u.text, units: [u] })),
    ]
    const previous = docs.filter((d) => d.status === 'superseded')
    if (previous.length)
      sentences.push({
        text: `Previous edition in the collection: ${previous.map((d) => d.edition).join(', ')}.`,
        units: [],
      })
    sections.push({
      heading: `Changes in ${current.label} ${current.edition}`,
      sentences,
    })
  }
  return sections.length
    ? { mode: 'version_answer', sections, notes: [] }
    : null
}

function notFound(question, reason) {
  return {
    mode: 'no_evidence',
    sections: [
      {
        heading: 'Not found in the indexed documents',
        sentences: [{ text: reason, units: [] }],
      },
    ],
    notes: [],
    candidates: [],
  }
}

const sameTable = (a, b) =>
  a.doc === b.doc &&
  Math.abs(a.page - b.page) <= 1 &&
  a.type === 'row' &&
  b.type === 'row' &&
  (a.table || a.heading) === (b.table || b.heading)

export function lookup(question, index) {
  const foreign = foreignJurisdiction(question, index.corpus.documents)
  if (foreign)
    return notFound(
      question,
      `${foreign} design standards are not in the indexed documents. The collection covers City of Edmonton (EPCOR) standards only, so their values cannot be used as ${foreign} requirements.`,
    )
  const series = seriesInQuestion(question)
  if (series.length && changeIntent.test(question)) {
    const result = changeAnswer(question, index, series)
    if (result) return result
  }
  if (series.length && editionIntent.test(question)) {
    const result = editionAnswer(question, index, series)
    if (result) return result
  }
  const allowSuperseded =
    /\b(previous|old|older|prior|former|20(?:1\d|2[0-2]))\b/i.test(question)
  let candidates = index.score(question, { series, allowSuperseded })
  if (series.length && (!candidates.length || candidates[0].score < 0.5))
    candidates = index.score(question, { allowSuperseded })
  candidates = dedupe(candidates.slice(0, 60), index)
  const top = candidates[0]
  if (!top || top.score < 0.5)
    return {
      ...notFound(
        question,
        'This specific requirement was not found in the indexed documents. No passage covered enough of the question to give a sourced answer.',
      ),
      candidates: candidates.slice(0, 30),
    }
  const chosen = [top]
  for (const c of candidates.slice(1, 20)) {
    if (chosen.length >= 4) break
    const sibling = chosen.some((x) => sameTable(x.unit, c.unit))
    if (
      (sibling && c.score >= top.score * 0.8) ||
      (!sibling && c.score >= top.score * 0.93 && c.unit.doc === top.unit.doc)
    )
      chosen.push(c)
  }
  // A second table that answers almost as well (e.g. runoff by zoning and by
  // land use) is shown too, with its own title, rather than silently dropped.
  if (top.unit.type === 'row') {
    const other = candidates
      .slice(1, 20)
      .find(
        (c) =>
          c.unit.type === 'row' &&
          !chosen.includes(c) &&
          !chosen.some((x) => sameTable(x.unit, c.unit)) &&
          c.score >= top.score * 0.9,
      )
    if (other) {
      chosen.push(other)
      for (const c of candidates.slice(1, 20))
        if (
          chosen.length < 7 &&
          !chosen.includes(c) &&
          sameTable(c.unit, other.unit) &&
          c.score >= other.score * 0.8
        )
          chosen.push(c)
    }
  }
  const add = (unit) => {
    if (!chosen.some((c) => c.unit === unit))
      chosen.push({ unit, score: top.score, duplicates: [] })
  }
  const all = index.corpus.units
  const rowBlock = (unit) => {
    // Contiguous rows of one table on one page around this unit.
    let start = index.position.get(unit),
      end = start
    const same = (u) =>
      u && u.type === 'row' && u.doc === unit.doc && u.page === unit.page
    while (same(all[start - 1])) start--
    while (same(all[end + 1])) end++
    return all.slice(start, end + 1)
  }
  // A small table (a value and its alternatives) is answered as a whole.
  for (const c of [...chosen])
    if (c.unit.type === 'row') {
      const block = rowBlock(c.unit)
      if (block.length <= 4) block.forEach(add)
    }
  // A heading or lead-in sentence is answered by the small table right after it.
  if (!statesValue(top.unit.text) && valueQuestion.test(question)) {
    const next = all
      .slice(index.position.get(top.unit) + 1, index.position.get(top.unit) + 5)
      .find((u) => u.type === 'row' && u.doc === top.unit.doc)
    if (next) {
      const block = rowBlock(next)
      if (block.length <= 6) block.forEach(add)
    }
  }
  // A lead-in ending "...as follows:" is answered by what follows it.
  if (/:\s*$/.test(top.unit.text)) {
    const start = index.position.get(top.unit) + 1
    for (const u of all.slice(start, start + 6)) {
      if (u.doc !== top.unit.doc || u.type === 'heading') break
      add(u)
    }
  }
  // A matching table note brings the rows that reference it.
  const note = top.unit.text.match(/^(\d{1,2})\s+\p{Lu}/u)
  if (note) {
    const rows = all.filter(
      (u) =>
        u.doc === top.unit.doc &&
        u.page === top.unit.page &&
        u.type === 'row' &&
        footnoteRefs(u.text).includes(note[1]),
    )
    const asked = new Set(tokens(canon(question)))
    const matching = rows.filter((u) =>
      tokens(canon(u.text)).some((t) => asked.has(t)),
    )
    for (const row of (matching.length ? matching : rows).slice(0, 6)) add(row)
  }
  // Prose that points at a table ("Table 1.2 shows...") brings the table rows.
  const tableRef =
    top.unit.type === 'text' && top.unit.text.match(/\bTable (\d+(?:\.\d+)*)\b/)
  if (tableRef)
    all
      .filter(
        (u) =>
          u.doc === top.unit.doc &&
          u.type === 'row' &&
          u.table?.startsWith(`Table ${tableRef[1]}:`),
      )
      .slice(0, 12)
      .forEach(add)
  // One section per source table or clause, headed by where it comes from;
  // sections keep the order in which they were chosen, units keep page order.
  const sections = []
  for (const c of chosen) {
    const doc = index.docs.get(c.unit.doc)
    const where =
      (c.unit.type === 'row' && c.unit.table) || c.unit.heading || ''
    const heading = `${where ? where.slice(0, 90) + ' — ' : ''}${doc.label}, ${doc.edition}`
    let section = sections.find((s) => s.heading === heading)
    if (!section)
      sections.push(
        (section = {
          heading,
          sentences: [],
          table: c.unit.type === 'row' ? c.unit.table : '',
        }),
      )
    section.sentences.push({
      text: c.unit.text,
      units: [c.unit],
      alsoIn: c.duplicates,
    })
  }
  for (const section of sections) {
    section.sentences.sort(
      (a, b) => index.position.get(a.units[0]) - index.position.get(b.units[0]),
    )
    const header =
      section.table && tableHeader(section.sentences[0].units[0], index)
    if (header?.length)
      section.sentences.unshift({
        text: `Columns: ${header.map((u) => u.text).join(' · ')}`,
        units: header,
      })
    delete section.table
  }
  const units = sections.flatMap((s) => s.sentences.flatMap((x) => x.units))
  const footnotes = footnotesFor(index.corpus.units, index, units)
  if (footnotes.length)
    sections.push({
      heading: 'Conditions from the table notes',
      sentences: footnotes.map((u) => ({ text: u.text, units: [u] })),
    })
  const notes = versionNotes(units, index, question)
  const echoed = new Set()
  for (const c of chosen)
    for (const d of c.duplicates) {
      const doc = index.docs.get(d.doc)
      // Superseded copies are not listed: identical wording in an old file can
      // come from a later re-issue, so it does not show when a value began.
      if (echoed.has(doc.id) || doc.status === 'superseded') continue
      echoed.add(doc.id)
      const quoted =
        c.unit.text.length > 70 ? `${c.unit.text.slice(0, 67)}…` : c.unit.text
      notes.push({
        text: `“${quoted}” also appears in ${doc.label} ${doc.edition} (PDF page ${d.page}).`,
        units: [d],
      })
    }
  if (notes.length)
    sections.push({ heading: 'Version and applicability', sentences: notes })
  return {
    mode: 'extractive_answer',
    sections,
    notes: [
      'Verbatim source text; applicability to a specific project still needs engineering review.',
    ],
    candidates: candidates.slice(0, 30),
  }
}

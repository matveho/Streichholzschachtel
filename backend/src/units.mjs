// Answerable evidence units: table rows and sentences with exact PDF regions.
//
// Lines come from the extractor in top-left PDF points. Lines of one PyMuPDF
// block that stack vertically form a cell; cells sharing a vertical band form a
// table row. A single-cell band is prose and is split into sentences.

const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' })
const height = (r) => r[3] - r[1]

function cellsFromLines(lines) {
  const byBlock = new Map()
  for (const line of lines) {
    const key = line.block ?? 0
    if (!byBlock.has(key)) byBlock.set(key, [])
    byBlock.get(key).push(line)
  }
  const cells = []
  for (const blockLines of byBlock.values()) {
    const open = []
    for (const line of [...blockLines].sort((a, b) => a.rect[1] - b.rect[1])) {
      const target = open.find((cell) => {
        const last = cell.lines.at(-1).rect
        const gap = line.rect[1] - last[3]
        const overlapX =
          Math.min(last[2], line.rect[2]) - Math.max(last[0], line.rect[0])
        return overlapX > 0 && gap < Math.max(4, 0.8 * height(last))
      })
      if (target) target.lines.push(line)
      else open.push({ lines: [line] })
    }
    cells.push(...open)
  }
  return splitAtRowBoundaries(cells).map(withRect)
}

// Values centred on a wrapped label sit between two lines, so this is loose.
const overlapY = (a, b) =>
  Math.min(a[3], b[3]) - Math.max(a[1], b[1]) >
  0.3 * Math.min(height(a), height(b))

// A stacked cell spans two table rows when separate cells beside it align with
// its lines one by one (e.g. two zoning labels next to "100 L/s" and "180 L/s").
// Lines of one multi-line neighbour cell (a wrapped list) do not split it.
function splitAtRowBoundaries(cells) {
  const owner = new Map()
  cells.forEach((cell) => cell.lines.forEach((l) => owner.set(l, cell)))
  const all = cells.flatMap((c) => c.lines)
  const result = []
  for (const cell of cells) {
    let current = [cell.lines[0]]
    for (let k = 1; k < cell.lines.length; k++) {
      const prev = cell.lines[k - 1].rect,
        cur = cell.lines[k].rect
      const beside = (r) =>
        all.filter(
          (l) =>
            owner.get(l) !== cell &&
            overlapY(l.rect, r) &&
            (l.rect[0] >= cell.lines[k].rect[2] ||
              l.rect[2] <= cell.lines[k].rect[0]),
        )
      const before = beside(prev).filter((l) => !overlapY(l.rect, cur))
      const after = beside(cur).filter((l) => !overlapY(l.rect, prev))
      const boundary = before.some((a) =>
        after.some(
          (b) =>
            owner.get(a) !== owner.get(b) &&
            Math.min(a.rect[2], b.rect[2]) - Math.max(a.rect[0], b.rect[0]) > 0,
        ),
      )
      if (boundary) {
        result.push({ lines: current })
        current = []
      }
      current.push(cell.lines[k])
    }
    result.push({ lines: current })
  }
  return result
}

function withRect(cell) {
  {
    cell.rect = [
      Math.min(...cell.lines.map((l) => l.rect[0])),
      Math.min(...cell.lines.map((l) => l.rect[1])),
      Math.max(...cell.lines.map((l) => l.rect[2])),
      Math.max(...cell.lines.map((l) => l.rect[3])),
    ]
  }
  return cell
}

function rowsFromCells(cells) {
  const parent = cells.map((_, i) => i)
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])))
  for (let i = 0; i < cells.length; i++)
    for (let j = i + 1; j < cells.length; j++) {
      const a = cells[i].rect,
        b = cells[j].rect
      const overlapY = Math.min(a[3], b[3]) - Math.max(a[1], b[1])
      const overlapX = Math.min(a[2], b[2]) - Math.max(a[0], b[0])
      if (overlapX < 1 && overlapY > 0.4 * Math.min(height(a), height(b)))
        parent[find(i)] = find(j)
    }
  const groups = new Map()
  cells.forEach((cell, i) => {
    const root = find(i)
    if (!groups.has(root)) groups.set(root, [])
    groups.get(root).push(cell)
  })
  return [...groups.values()]
    .flatMap(splitStackedValues)
    .map((group) => {
      group.sort((a, b) => a.rect[0] - b.rect[0])
      return {
        cells: group,
        top: Math.min(...group.map((c) => c.rect[1])),
        left: Math.min(...group.map((c) => c.rect[0])),
      }
    })
    .sort((a, b) => a.top - b.top || a.left - b.left)
}

// A short value per line ("35", "100 L/s", "0.65 or 0.7 [4]", "h16").
const atom =
  /^(?:[\d.,]+(?:\s*(?:to|or|-|–)\s*[\d.,]+)?(?:\s*[a-zA-Z%³²/]{1,6}(?:\/[a-zA-Z]{1,3})?)?(?:\s*\[\d+\])?|h\d+)$/

// When one cell is a stacked column of values, each value starts its own row.
function splitStackedValues(group) {
  if (group.length < 2) return [group]
  const column = group
    .filter((c) => {
      // Optional header lines, then at least two stacked values.
      const first = c.lines.findIndex((l) => atom.test(l.text))
      return (
        first >= 0 &&
        first <= 2 &&
        c.lines.length - first >= 2 &&
        c.lines.slice(first).every((l) => atom.test(l.text))
      )
    })
    .sort((a, b) => b.lines.length - a.lines.length)[0]
  if (!column) return [group]
  const starts = column.lines.map((l) => l.rect[1])
  const rows = starts.map(() => [])
  for (const cell of group) {
    const parts = starts.map(() => [])
    for (const line of cell.lines) {
      const centre = (line.rect[1] + line.rect[3]) / 2
      let index = 0
      starts.forEach((top, i) => {
        if (top <= centre) index = i
      })
      parts[index].push(line)
    }
    parts.forEach((lines, i) => {
      if (lines.length) rows[i].push(withRect({ lines }))
    })
  }
  return rows.filter((r) => r.length)
}

const cellText = (cell) =>
  cell.lines
    .map((l) => l.text)
    .join(' ')
    .replace(/(\p{L})- (\p{Ll})/gu, '$1$2')
const regionOf = (line) => [
  line.rect[0],
  line.rect[1],
  line.rect[2] - line.rect[0],
  line.rect[3] - line.rect[1],
]

function sentencesOf(cell) {
  // Map sentence offsets back to the lines they occupy.
  let text = '',
    spans = []
  for (const line of cell.lines) {
    if (text) text += ' '
    spans.push([text.length, text.length + line.text.length, line])
    text += line.text
  }
  const result = []
  for (const s of segmenter.segment(text)) {
    const sentence = s.segment.trim()
    if (!sentence) continue
    const start = s.index,
      end = s.index + s.segment.length
    const lines = spans
      .filter(([a, b]) => b > start && a < end)
      .map(([, , line]) => line)
    if (
      result.length &&
      (sentence.length < 25 || /^[a-z(]/.test(sentence)) &&
      !/^\d+\s/.test(sentence)
    ) {
      const prev = result.at(-1)
      prev.text += ' ' + sentence
      for (const l of lines) if (!prev.lines.includes(l)) prev.lines.push(l)
      continue
    }
    result.push({ text: sentence, lines })
  }
  return result
}

// Section numbers start at 1; "0.14 For design..." is a value row, not a heading.
// Titles start with a capital: "1.25 times the runoff..." is prose.
const headingPattern =
  /^(?:[1-9]\d*(?:\.\d+)+|[1-9]\d*\.0)\s+\p{Lu}|^Table \d+(?:\.\d+)*\s*:/u

export function buildPageUnits(lines, meta, state) {
  const units = []
  const push = (text, unitLines, type, extra = {}) => {
    text = text.replace(/\s+/g, ' ').trim()
    if (!/[\p{L}\d]/u.test(text)) return
    const unit = {
      id: `${meta.doc}-u${meta.page}-${units.length}`,
      doc: meta.doc,
      page: meta.page,
      kind: meta.kind,
      extraction: meta.extraction || 'text',
      type,
      text,
      heading: state.heading,
      table: state.table,
      // frame: what the unit is part of; recent: the lead-in just before it.
      frame: [
        meta.title,
        state.heading,
        state.table,
        type === 'row' ? state.header : '',
      ]
        .filter(Boolean)
        .join(' '),
      recent: state.recent.slice(-2).join(' '),
      get context() {
        return `${this.frame} ${this.recent}`
      },
      regions: unitLines.map(regionOf),
      ...extra,
    }
    units.push(unit)
    state.recent.push(text.slice(0, 220))
    if (state.recent.length > 4) state.recent.shift()
  }
  state.header = ''
  let rowsSinceTitle = 0
  for (const row of rowsFromCells(cellsFromLines(lines))) {
    const texts = row.cells.map(cellText).filter((t) => t.trim())
    const joined = texts.join(' ')
    // Column headings (the first digit-free row of a table) give meaning to
    // the value rows beneath them.
    if (
      row.cells.length >= 2 &&
      rowsSinceTitle === 0 &&
      !/\d/.test(joined) &&
      joined.length < 300
    )
      state.header = texts.join(' | ')
    if (row.cells.length >= 2) rowsSinceTitle++
    const isHeading =
      (headingPattern.test(joined) && joined.length < 140) ||
      (texts.length === 2 &&
        /^[1-9]\d*(?:\.\d+)+$/.test(texts[0]) &&
        texts[1].length < 110 &&
        !/[.;:]$/.test(texts[1]))
    if (isHeading) {
      rowsSinceTitle = 0
      if (/^Table /.test(joined)) state.table = joined
      else {
        state.heading = joined
        state.table = ''
      }
      push(
        texts.join(' '),
        row.cells.flatMap((c) => c.lines),
        'heading',
      )
      continue
    }
    // A list marker beside its item ("ii. | The minimum...") is prose, not a table.
    const marker =
      texts.length === 2 &&
      /^(?:[•▪◦o]|(?:[ivxlcdm]+|[a-z]|\d{1,2})[.)])$/i.test(texts[0])
    const clause =
      texts.length === 2 &&
      /^[1-9]\d*(?:\.\d+)+[.)]?$/.test(texts[0]) &&
      texts[1].length > 60
    if (row.cells.length > 1 && texts.join(' | ').length < 700) {
      push(
        marker ? texts[1] : clause ? texts.join(' ') : texts.join(' | '),
        row.cells.flatMap((c) => c.lines),
        marker || clause ? 'text' : 'row',
      )
      continue
    }
    for (const cell of row.cells) {
      const text = cellText(cell)
      if (text.length < 320) push(text, cell.lines, 'text')
      else for (const s of sentencesOf(cell)) push(s.text, s.lines, 'text')
    }
  }
  return units
}

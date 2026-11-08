import {
  readdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve, basename } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { root, stateDir, knownFiles, config } from './config.mjs'
import { catalogEntry, annotateVersions } from './catalog.mjs'
import { buildPageUnits } from './units.mjs'

const run = promisify(execFile)
export function annotateSections(lines, previous = []) {
  let active = [...previous]
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i].text,
      next = lines[i + 1]
    let heading = text.match(/^([1-9]\d*(?:\.\d+)+)\.?\s+([A-Z].{1,100})$/)
    if (
      !heading &&
      /^[1-9]\d*(?:\.\d+)+\.?$/.test(text) &&
      next &&
      /^[A-Z]/.test(next.text) &&
      next.text.length < 110 &&
      next.text.split(/\s+/).length < 12 &&
      !/[.!?]$/.test(next.text) &&
      next.rect[0] >= lines[i].rect[0] - 2
    )
      heading = [null, text.replace(/\.$/, ''), next.text]
    if (heading && text.length < 110) {
      const id = heading[1]
      active = active.filter((s) => id.startsWith(s.match(/^\S+/)[0] + '.'))
      active.push(`${id} ${heading[2]}`)
    }
    lines[i].section = active.at(-1) || ''
    lines[i].sectionPath = [...active]
  }
  return active
}
export const normalize = (text) =>
  String(text)
    .normalize('NFKC')
    .replace(/\u00ad/g, '')
    .replace(/(\p{L})-\s*\n\s*(\p{L})/gu, '$1$2')
    .replace(/\s+/g, ' ')
    .trim()
const cacheVersion =
  'words-v5-' +
  createHash('sha256')
    .update(readFileSync(resolve(root, 'extract.py')))
    .digest('hex')
    .slice(0, 8)
const compactText = (text) =>
  normalize(text)
    .toLowerCase()
    .replace(/⁄/g, '/')
    .replace(/[^\p{L}\d.%/+*<>=≤≥-]/gu, '')
export function normalizeMeasurements(text) {
  return normalize(text)
    .replace(/\/hr\b/g, '/h')
    .replace(/\bm\s*\^\s*([23])\b/g, 'm$1')
    .replace(/\bsquare\s+met(?:re|er)s?\b/gi, 'm2')
    .replace(/\bcubic\s+met(?:re|er)s?\b/gi, 'm3')
    .replace(/\bmillimet(?:re|er)s?\b/gi, 'mm')
    .replace(/\bhectares?\b/gi, 'ha')
}
export function quantityUnits(text, dense = false) {
  const known =
    /^(?:mm|cm|km|m|m2|m3|ha|MPa|kPa|Pa|mPa|kN|N|kg|g|L|l|s|%|m3\/s|L\/s|m\/s|mm\/h)$/i
  return [
    ...normalizeMeasurements(text).matchAll(
      dense
        ? /(?<![\d.])(\d+(?:\.\d+)?)\s*(m3\/s|L\/s|m\/s|mm\/h|MPa|kPa|mPa|Pa|mm|cm|km|m2|m3|ha|kN|N|kg|g|L|l|s|%|m)/giu
        : /(?<![\d.])(\d+(?:\.\d+)?)\s*([\p{L}%]+[23]?(?:\/[\p{L}]+)?)/gu,
    ),
  ]
    .filter((m) => known.test(m[2]))
    .map((m) => `${Number(m[1])}:${m[2]}`)
}

async function extract(file) {
  const python =
    process.platform === 'win32'
      ? resolve(root, '.venv/Scripts/python.exe')
      : resolve(root, '.venv/bin/python')
  if (existsSync(python)) {
    const { stdout } = await run(python, [resolve(root, 'extract.py'), file], {
      maxBuffer: 80 * 1024 * 1024,
      windowsHide: true,
    })
    return JSON.parse(stdout)
  }
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const pdf = await getDocument({
    data: new Uint8Array(readFileSync(file)),
    useSystemFonts: true,
  }).promise
  const pages = []
  for (let n = 1; n <= pdf.numPages; n++) {
    const p = await pdf.getPage(n),
      v = p.getViewport({ scale: 1 }),
      content = await p.getTextContent()
    pages.push({
      width: v.width,
      height: v.height,
      words: content.items
        .filter((i) => i.str?.trim())
        .map((i) => {
          const [x, y] = v.convertToViewportPoint(
            i.transform[4],
            i.transform[5],
          )
          return [
            x,
            y - Math.abs(i.height),
            x + i.width,
            y + 2,
            i.str,
            0,
            Math.round(y / 3),
          ]
        }),
    })
  }
  await pdf.destroy()
  return { pages, metadata: {} }
}

export function linesFromWords(page) {
  const groups = new Map()
  for (const w of page.words) {
    if (!w[4]?.trim()) continue
    // Coordinates are already in rendered-page, top-left points.
    const key = `${w[5]}:${w[6]}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(w)
  }
  return [...groups.values()]
    .map((words) => {
      words.sort((a, b) => a[0] - b[0])
      let text = normalize(words.map((w) => w[4]).join(' '))
      if (page.extraction === 'ocr' && page.nativeText && /\s\*\s/.test(text)) {
        const cleaned = text.replace(/\s\*\s/g, ' ')
        if (compactText(page.nativeText).includes(compactText(cleaned)))
          text = cleaned
      }
      return {
        text,
        block: words[0][5],
        confidence:
          words.reduce((sum, w) => sum + (w[7] ?? 100), 0) /
          Math.max(1, words.length) /
          100,
        minConfidence: Math.min(
          ...words
            .filter((w) => /[\p{L}\d]{2}|\d/u.test(w[4]))
            .map((w) => (w[7] ?? 100) / 100),
          1,
        ),
        rect: [
          Math.min(...words.map((w) => w[0])),
          Math.min(...words.map((w) => w[1])),
          Math.max(...words.map((w) => w[2])),
          Math.max(...words.map((w) => w[3])),
        ],
      }
    })
    .sort((a, b) =>
      Math.abs(a.rect[1] - b.rect[1]) < 2
        ? a.rect[0] - b.rect[0]
        : a.rect[1] - b.rect[1],
    )
}

export function tableAwareLines(page, tables = []) {
  if (!tables.length || page.extraction === 'ocr') return linesFromWords(page)
  const remaining = new Set(page.words),
    groups = []
  const original = linesFromWords(page)
  for (let t = 0; t < tables.length; t++) {
    const table = tables[t]
    const boundaries = [
      ...new Set(
        table.rows.flatMap((row) =>
          row.filter(Boolean).flatMap((r) => [r[0], r[2]]),
        ),
      ),
    ].sort((a, b) => a - b)
    for (let x = 1; x < boundaries.length;) {
      if (boundaries[x] - boundaries[x - 1] < 15)
        boundaries.splice(x === boundaries.length - 1 ? x - 1 : x, 1)
      else x++
    }
    const snap = (x) =>
      boundaries.reduce(
        (best, v) => (Math.abs(v - x) < Math.abs(best - x) ? v : best),
        boundaries[0],
      )
    const cells = table.rows.map((row) =>
      row.map((rect) => {
        if (!rect) return null
        rect = [snap(rect[0]), rect[1], snap(rect[2]), rect[3]]
        if (rect[2] <= rect[0]) return null
        const words = page.words.filter((w) => {
          const x = (w[0] + w[2]) / 2,
            y = (w[1] + w[3]) / 2
          return x >= rect[0] && x < rect[2] && y >= rect[1] && y < rect[3]
        })
        return {
          rect,
          words,
          text: linesFromWords({ ...page, words })
            .map((l) => l.text)
            .join(' '),
        }
      }),
    )
    const firstItem = cells.findIndex((row) =>
      /^\d+$|^[A-Z]+[-–]\d+$/.test(row.find((cell) => cell?.text)?.text || ''),
    )
    const headers = cells
      .slice(0, firstItem > 0 ? firstItem : 1)
      .flat()
      .filter(Boolean)
    const caption =
      original
        .filter(
          (l) =>
            /^Table\s+\d/i.test(l.text) &&
            l.rect[3] <= table.rect[1] &&
            table.rect[1] - l.rect[3] < 70,
        )
        .at(-1)?.text || ''
    const seen = new Set(),
      lines = []
    cells.forEach((row, r) =>
      row.forEach((cell, c) => {
        if (!cell || seen.has(JSON.stringify(cell.rect))) return
        seen.add(JSON.stringify(cell.rect))
        const words = cell.words.filter((w) => remaining.has(w))
        words.forEach((w) => remaining.delete(w))
        lines.push(
          ...linesFromWords({ ...page, words }).map((line) => ({
            ...line,
            tableCell: `${t}:${r}:${c}`,
            tableColumn: [
              ...new Set(
                headers
                  .filter(
                    (h) =>
                      (h.rect[0] + h.rect[2]) / 2 >= cell.rect[0] &&
                      (h.rect[0] + h.rect[2]) / 2 < cell.rect[2],
                  )
                  .map((h) => h.text),
              ),
            ].join(' '),
            tableRowLabel: row
              .slice(0, 2)
              .map((cell) => cell?.text || '')
              .join(' ')
              .trim(),
            tableCaption: caption,
          })),
        )
      }),
    )
    if (lines.length) groups.push({ y: table.rect[1], lines })
  }
  groups.push(
    ...linesFromWords({ ...page, words: [...remaining] }).map((line) => ({
      y: line.rect[1],
      lines: [line],
    })),
  )
  return groups.sort((a, b) => a.y - b.y).flatMap((group) => group.lines)
}

async function tableLayout(file, hash) {
  const python = resolve(
    root,
    process.platform === 'win32'
      ? '.venv/Scripts/python.exe'
      : '.venv/bin/python',
  )
  if (!existsSync(python)) return {}
  const version = createHash('sha256')
    .update(readFileSync(resolve(root, 'native-table-layout.py')))
    .digest('hex')
    .slice(0, 10)
  const name = `${hash}-layout-${version}.json`
  const legacyCache = resolve(stateDir, name)
  const cache = existsSync(legacyCache)
    ? legacyCache
    : resolve(config.pdfCacheDir, name)
  if (existsSync(cache)) return JSON.parse(readFileSync(cache, 'utf8'))
  const { stdout } = await run(
    python,
    [resolve(root, 'native-table-layout.py'), file],
    { windowsHide: true, maxBuffer: 20 * 1024 * 1024, timeout: 300000 },
  )
  const layout = JSON.parse(stdout)
  writeFileSync(cache, JSON.stringify(layout))
  return layout
}

export async function buildIndex(progress = () => {}) {
  mkdirSync(config.pdfCacheDir, { recursive: true })
  const files = new Map()
  for (const dir of [
    resolve(root, '../public/documents'),
    resolve(root, 'documents'),
  ]) {
    if (existsSync(dir))
      for (const name of readdirSync(dir).filter((n) => /\.pdf$/i.test(n)))
        files.set(resolve(dir, name), name)
  }
  const documents = [],
    passages = [],
    units = [],
    failures = []
  for (const [file, name] of files) {
    const documentStart = documents.length,
      passageStart = passages.length,
      unitStart = units.length
    try {
      progress(`Reading ${name}`, documents.length, files.size)
      const hash = createHash('sha256').update(readFileSync(file)).digest('hex')
      if (documents.some((d) => d.version === hash)) continue
      const cacheName = `${hash}-${cacheVersion}.json`
      const legacyCache = resolve(stateDir, cacheName)
      const cache = existsSync(legacyCache)
        ? legacyCache
        : resolve(config.pdfCacheDir, cacheName)
      const extracted = existsSync(cache)
        ? JSON.parse(readFileSync(cache, 'utf8'))
        : await extract(file)
      if (!existsSync(cache)) writeFileSync(cache, JSON.stringify(extracted))
      const layout = await tableLayout(file, hash)
      const metadata = {
        ...(knownFiles[name] || {
          label: basename(name, '.pdf'),
          title: extracted.metadata.title || basename(name, '.pdf'),
          edition: 'Edition not supplied',
          source: '',
        }),
        ...(catalogEntry(hash) || {}),
      }
      const id = `doc-${hash.slice(0, 12)}`
      const record = {
        id,
        ...metadata,
        code: metadata.label,
        pages: extracted.pages.length,
        initialPage: 1,
        version: hash,
        filePath: file,
        pageSizes: {},
      }
      documents.push(record)
      let bibliography = false,
        activeSections = []
      const unitState = { heading: '', table: '', recent: [] }
      for (let n = 0; n < extracted.pages.length; n++) {
        const page = extracted.pages[n]
        record.pageSizes[n + 1] = [page.width, page.height]
        const lines = tableAwareLines(page, layout[n]).filter(
          (l) =>
            l.rect[1] > 55 &&
            l.rect[3] < page.height - 38 &&
            (l.text.length > 1 || /\d/.test(l.text)),
        )
        const text = lines.map((l) => l.text).join('\n')
        if (/^\s*(?:REFERENCES|BIBLIOGRAPHY)\s*$/im.test(text))
          bibliography = true
        else if (/^\s*(?:APPENDIX|APPENDICES)\b/im.test(text)) {
          bibliography = false
          activeSections = []
        }
        if (bibliography) continue
        // Contents and references are navigation, not evidence. Revision lists
        // and Terms of Use are kept but tagged: they answer version questions.
        if (
          /TABLE OF CONTENTS|^REFERENCES\b/im.test(text) ||
          text.match(/\.{5,}/g)?.length > 3
        )
          continue
        const kind =
          /LIST OF REVISIONS|Table of Revisions|list of revisions in/i.test(
            text,
          ) ||
          (text.match(
            /\b(?:Added|Revised|Deleted|Updated|Removed|updated to)\b/g,
          )?.length || 0) > 2 ||
          /(?:^|\n)\s*(?:Removed|Added|Revised|Deleted|Updated)\s+(?:from|to|Section|Table|Figure|["“])/im.test(
            text,
          )
            ? 'revisions'
            : /TERMS OF USE/i.test(text)
              ? 'terms'
              : 'body'
        units.push(
          ...buildPageUnits(
            lines,
            {
              doc: id,
              page: n + 1,
              kind,
              title: record.title,
              extraction: page.extraction || 'text',
            },
            unitState,
          ),
        )
        if (kind !== 'body') continue
        activeSections = annotateSections(lines, activeSections)
        let section = ''
        for (let start = 0; start < lines.length;) {
          const selected = []
          let length = 0,
            end = start
          const precedingHeading = section
          let firstHeading = ''
          while (end < lines.length && length < 1250) {
            const line = lines[end]
            if (
              /^[1-9]\d*(?:\.\d+)+\s+[A-Z]/u.test(line.text) &&
              line.text.length < 110
            ) {
              section = line.text
              if (!firstHeading) firstHeading = line.text
            }
            selected.push(line)
            length += line.text.length + 1
            end++
          }
          const body = selected.map((l) => l.text).join(' ')
          if (body.length > 100 && /\p{L}/u.test(body)) {
            const passage = {
              id: `${id}-p${n + 1}-${start}`,
              doc: id,
              page: n + 1,
              section: selected[0].section || firstHeading || precedingHeading,
              overview: /^\s*(?:PREFACE|INTRODUCTION)\b/im.test(text),
              text: body,
              lines: selected,
              pageWidth: page.width,
              pageHeight: page.height,
              extraction: page.extraction || 'text',
              nativeText: page.extraction === 'ocr' ? page.nativeText : '',
              kind,
              confidence:
                selected.reduce((sum, l) => sum + l.confidence, 0) /
                selected.length,
            }
            if (
              passage.extraction !== 'ocr' ||
              passage.lines.some((line) => locateQuote(passage, line.text))
            )
              passages.push(passage)
          }
          if (end === lines.length) break
          start = Math.max(start + 1, end - 3)
        }
      }
      if (passages.length === passageStart)
        throw new Error(
          'No usable text passages were found. Scanned PDFs need OCR before indexing.',
        )
    } catch (error) {
      documents.length = documentStart
      passages.length = passageStart
      units.length = unitStart
      failures.push({ name, error: error.message })
      progress(
        `Could not read ${name}: ${error.message}`,
        documents.length,
        files.size,
      )
    }
  }
  progress(
    `Indexed ${documents.length} documents`,
    documents.length,
    files.size,
  )
  annotateVersions(documents)
  return { documents, passages, units, failures }
}

export function locateQuote(passage, quote) {
  const text = normalize(passage.text),
    excerpt = normalize(quote)
  const start = text.toLowerCase().indexOf(excerpt.toLowerCase())
  if (excerpt.length < 18 || start < 0) return null
  if (/[\p{L}\d]/u.test(excerpt[0]) && /[\p{L}\d]/u.test(text[start - 1] || ''))
    return null
  if (
    /[\p{L}\d]/u.test(excerpt.at(-1)) &&
    /[\p{L}\d]/u.test(text[start + excerpt.length] || '')
  )
    return null
  if (passage.extraction === 'ocr') {
    if (passage.confidence < 0.8) return null
    // Compare OCR against the existing hidden layer when only its spacing was
    // broken. Quantities and punctuation must agree, not just matching keywords.
    if (
      passage.nativeText?.length > 100 &&
      !compactText(passage.nativeText).includes(compactText(excerpt))
    )
      return null
    if (passage.nativeText) {
      const originalUnits = new Set(
        quantityUnits(normalize(passage.nativeText).replace(/\s+/g, ''), true),
      )
      if (quantityUnits(excerpt).some((unit) => !originalUnits.has(unit)))
        return null
    }
  }
  const regions = []
  let cursor = 0
  for (const line of passage.lines) {
    const end = cursor + line.text.length
    if (end > start && cursor < start + excerpt.length) {
      if (
        passage.extraction === 'ocr' &&
        !passage.nativeText &&
        line.minConfidence < 0.65
      )
        return null
      const [x1, y1, x2, y2] = line.rect
      regions.push([x1, y1, x2 - x1, y2 - y1])
    }
    cursor = end + 1
  }
  if (!regions.length) return null
  return { excerpt: text.slice(start, start + excerpt.length), regions }
}

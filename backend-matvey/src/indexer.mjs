import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve, basename } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { root, stateDir, knownFiles } from './config.mjs'

const run = promisify(execFile)
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
export function quantityUnits(text, dense = false) {
  const known = /^(?:mm|cm|km|m|m2|m3|ha|MPa|kPa|Pa|mPa|kN|N|kg|g|L|l|s|%)$/i
  return [
    ...normalize(text).matchAll(
      dense
        ? /(?<![\d.])(\d+(?:\.\d+)?)\s*(MPa|kPa|mPa|Pa|mm|cm|km|m2|m3|ha|kN|N|kg|g|L|l|s|%|m)/giu
        : /(?<![\d.])(\d+(?:\.\d+)?)\s*([\p{L}%]+[23]?)/gu,
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

export async function buildIndex(progress = () => {}) {
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
    failures = []
  for (const [file, name] of files) {
    const documentStart = documents.length,
      passageStart = passages.length
    try {
      progress(`Reading ${name}`, documents.length, files.size)
      const hash = createHash('sha256').update(readFileSync(file)).digest('hex')
      if (documents.some((d) => d.version === hash)) continue
      const cache = resolve(stateDir, `${hash}-${cacheVersion}.json`)
      const extracted = existsSync(cache)
        ? JSON.parse(readFileSync(cache, 'utf8'))
        : await extract(file)
      if (!existsSync(cache)) writeFileSync(cache, JSON.stringify(extracted))
      const metadata = knownFiles[name] || {
        label: basename(name, '.pdf'),
        title: extracted.metadata.title || basename(name, '.pdf'),
        edition: 'Edition not supplied',
        source: '',
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
      let bibliography = false
      for (let n = 0; n < extracted.pages.length; n++) {
        const page = extracted.pages[n]
        record.pageSizes[n + 1] = [page.width, page.height]
        const lines = linesFromWords(page).filter(
          (l) =>
            l.rect[1] > 55 && l.rect[3] < page.height - 38 && l.text.length > 1,
        )
        const text = lines.map((l) => l.text).join('\n')
        if (/^\s*(?:REFERENCES|BIBLIOGRAPHY)\s*$/im.test(text))
          bibliography = true
        else if (/^\s*(?:APPENDIX|APPENDICES)\b/im.test(text))
          bibliography = false
        if (bibliography) continue
        // Contents, revision lists and references are navigation, not design evidence.
        if (
          /TABLE OF CONTENTS|LIST OF REVISIONS|^REFERENCES\b/im.test(text) ||
          text.match(/\.{5,}/g)?.length > 3 ||
          (text.match(/\b(?:Added|Revised|Deleted|Updated)\b/g)?.length || 0) >
            3
        )
          continue
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
              /^\d+(?:\.\d+)+\s+\p{L}/u.test(line.text) &&
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
              section: firstHeading || precedingHeading,
              text: body,
              lines: selected,
              pageWidth: page.width,
              pageHeight: page.height,
              extraction: page.extraction || 'text',
              nativeText: page.extraction === 'ocr' ? page.nativeText : '',
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
  return { documents, passages, failures }
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

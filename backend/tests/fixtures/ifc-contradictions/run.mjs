import assert from 'node:assert/strict'
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { extractPdf, linesFromWords } from '../../../src/indexer.mjs'
import {
  readIfcProperties,
  compareIfcDocuments,
} from '../../../src/ifc-comparison.mjs'

export const fixtureRoot = dirname(fileURLToPath(import.meta.url))
const categories = {
  reference: 'reference',
  'client requirements': 'client',
  design: 'design',
  'technical reports': 'report',
  'supporting materials': 'supporting',
}
export async function loadFixture() {
  const documents = [],
    passages = []
  for (const [folder, category] of Object.entries(categories)) {
    for (const name of readdirSync(resolve(fixtureRoot, folder))
      .filter((name) => name.endsWith('.pdf'))
      .sort()) {
      const filePath = resolve(fixtureRoot, folder, name)
      const id =
        'doc-' +
        createHash('sha256')
          .update(readFileSync(filePath))
          .digest('hex')
          .slice(0, 12)
      const extracted = await extractPdf(filePath)
      documents.push({
        id,
        label: name,
        title: name,
        filePath,
        category,
        projectArtifact: category !== 'reference',
      })
      for (const [index, page] of extracted.pages.entries()) {
        const lines = linesFromWords(page)
        passages.push({
          id: `${id}-p${index + 1}`,
          doc: id,
          page: index + 1,
          text: lines.map((line) => line.text).join(' '),
          lines,
        })
      }
    }
  }
  return { documents, passages }
}
export function scanFixture(corpus, modelName) {
  const model = {
    name: modelName,
    elements: readIfcProperties(
      readFileSync(resolve(fixtureRoot, 'models', modelName), 'utf8'),
    ),
  }
  return compareIfcDocuments([model], corpus.documents, corpus.passages)
}
export function verifyFixture(contradictory, compliant) {
  const expected = JSON.parse(
    readFileSync(resolve(fixtureRoot, 'expected.json'), 'utf8'),
  )
  const sort = (rows) =>
    rows.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  const actual = contradictory.issues.map((issue) => ({
    category: issue.category,
    file: issue.citations[0].label,
    element: issue.title.split(':')[0],
    property: issue.property,
    actual: issue.actual,
    expected: issue.expected,
    comparison: issue.comparison,
    page: issue.citations[0].page,
  }))
  assert.deepEqual(
    sort(actual),
    sort(expected),
    'Every planted contradiction must be found with the correct source page and values',
  )
  assert.equal(
    compliant.issues.length,
    0,
    'Compliant control must not produce discrepancies',
  )
  for (const result of [contradictory, compliant]) {
    assert.equal(result.coverage.length, 6)
    assert.equal(
      result.coverage.reduce((sum, file) => sum + file.checks, 0),
      6,
    )
    assert.equal(
      result.coverage.find((file) => file.label === 'qualitative-review.pdf')
        .status,
      'needs-review',
    )
  }
}
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ],
  )
function saveReport(contradictory, compliant) {
  const output = resolve(fixtureRoot, 'results')
  mkdirSync(output, { recursive: true })
  writeFileSync(
    resolve(output, 'issues.json'),
    JSON.stringify(
      { synthetic: true, expectedContradictions: 5, contradictory, compliant },
      null,
      2,
    ) + '\n',
  )
  const rows = contradictory.issues
    .map(
      (issue) =>
        `<tr><td>${escape(issue.category)}</td><td>${escape(issue.title)}</td><td>${escape(issue.actual)}</td><td>${escape(issue.comparison)} ${escape(issue.expected)}</td><td>${escape(issue.citations[0].label)} · p. ${issue.citations[0].page}<blockquote>${escape(issue.citations[0].excerpt)}</blockquote></td><td>${escape(issue.elementId)}<br>${escape(issue.globalId)}</td></tr>`,
    )
    .join('\n')
  writeFileSync(
    resolve(output, 'issues.html'),
    `<!doctype html><html lang="en"><meta charset="utf-8"><title>IFC contradiction test results</title><style>body{font:16px system-ui;margin:32px;color:#18222e}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccd3da;padding:12px;text-align:left;vertical-align:top}blockquote{margin:8px 0;font-size:14px}th{background:#eef2f6}</style><h1>IFC contradiction test results</h1><p>Synthetic QA only. All 5 planted discrepancies detected across the five document categories. Compliant control: 0 discrepancies. Six numeric checks per model; qualitative-review.pdf requires manual review.</p><table><thead><tr><th>Category</th><th>Finding</th><th>IFC value</th><th>Document value</th><th>Evidence</th><th>IFC identifiers</th></tr></thead><tbody>${rows}</tbody></table></html>`,
  )
  return output
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const corpus = await loadFixture()
  const contradictory = scanFixture(corpus, 'contradictory.ifc')
  const compliant = scanFixture(corpus, 'compliant.ifc')
  verifyFixture(contradictory, compliant)
  const output = saveReport(contradictory, compliant)
  console.log(
    `PASS: ${contradictory.issues.length}/5 planted discrepancies; ${compliant.issues.length} false positives in the compliant control.`,
  )
  for (const issue of contradictory.issues)
    console.log(
      `${issue.category}: ${issue.title} (${issue.actual} vs ${issue.comparison} ${issue.expected}; p. ${issue.citations[0].page})`,
    )
  console.log(
    'Reports:',
    resolve(output, 'issues.html'),
    resolve(output, 'issues.json'),
  )
}

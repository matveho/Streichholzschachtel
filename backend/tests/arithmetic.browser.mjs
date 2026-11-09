import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { chromium } from '@playwright/test'

const frontend = process.env.BASIS_FRONTEND_URL
assert.equal(frontend, 'http://127.0.0.1:8842/app')
assert.ok(process.env.BASIS_STATE_DIR?.includes('/verification/run-browser-'))
const api = new URL('/local-api/v1', frontend).href
const project = 'demo-mill-creek'
const documentId = 'doc-09e07f57e7a3'
const response = await fetch(`${api}/projects/${project}/queries`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    question: 'For a 42 ha storm sewer catchment, use Design Guidelines Table 2.1 as the selected calculation basis. The supplied five-year runoff is 1.20 m3/s and existing capacity is 900 L/s. Calculate the table-based design flow and capacity difference, treating the supplied figures as assumptions and leaving design approval unresolved.',
    documentIds: [documentId],
  }),
})
assert.ok(response.ok)
let job = await response.json()
for (let i = 0; i < 240 && ['queued', 'running'].includes(job.state); i++) {
  await new Promise(resolve => setTimeout(resolve, 500))
  job = await (await fetch(`${api}/projects/${project}/queries/${job.id}`)).json()
}
assert.equal(job.state, 'completed')
const arithmetic = job.result.arithmeticReview
assert.equal(arithmetic.status, 'arithmetic_only')
assert.equal(arithmetic.applicabilityConfirmed, false)
assert.ok(arithmetic.calculations.some(step => step.dimension === 'flow' && Math.abs(step.value - 1.5) < 1e-8 && step.unit === 'm3/s'))
const difference = arithmetic.calculations.find(step => step.dimension === 'flow' && step.operation === '-' && Math.abs(step.value - .6) < 1e-8 && step.unit === 'm3/s')
assert.ok(difference)
assert.ok(difference.sourceReferenceIds.length)
assert.ok(job.result.references.every(reference => reference.doc === documentId))
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  page.setDefaultTimeout(30000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`${frontend}/#project/${project}/query/${job.id}`)
  const report = page.getByRole('article', { name: 'Query report' })
  const heading = report.getByRole('heading', { name: 'Verified arithmetic · applicability requires review', exact: true })
  await heading.waitFor()
  assert.match(await report.innerText(), /900 L\/s/)
  assert.match(await report.innerText(), /0\.6/)
  for (const referenceId of difference.sourceReferenceIds) {
    await page.getByRole('button', { name: new RegExp('^Source ' + referenceId + ':') }).first().click()
    await page.locator('.source-highlight:visible').first().waitFor()
    await page.waitForFunction(() => document.querySelectorAll('.pdf-status').length === 0)
  }
  await page.reload()
  await heading.waitFor()
  assert.match(await report.innerText(), /source applicability and design approval require review/)
  mkdirSync('test-results', { recursive: true })
  await page.screenshot({ path: 'test-results/arithmetic-browser.png', fullPage: true })
  assert.deepEqual(errors, [])
  console.log('PASS mixed-unit source-grounded worksheet, original PDF highlights and persisted report')
} finally { await browser.close() }

import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const frontend = process.env.BASIS_FRONTEND_URL
assert.equal(frontend, 'http://127.0.0.1:8842/app')
assert.ok(process.env.BASIS_STATE_DIR?.includes('/verification/run-browser-'))
const base = new URL('/local-api/v1', frontend).href
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  })
  page.setDefaultTimeout(30000)
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(frontend + '/#project/demo-mill-creek')
  await page
    .getByRole('button', { name: 'Open new query tab', exact: true })
    .click()
  await page
    .locator('#query')
    .fill(
      'For a four-unit corner-lot infill, can a box planter replace conventional storm servicing, and what design and construction checks are needed?',
    )
  const submitted = page.waitForResponse(
    (response) =>
      response.url().endsWith('/projects/demo-mill-creek/queries') &&
      response.request().method() === 'POST',
  )
  await page.locator('.run-query').click()
  const job = await (await submitted).json()
  const report = page.getByRole('article', { name: 'Query report' })
  await report
    .getByRole('heading', {
      name: 'Selected evidence awaiting interpretation',
      exact: true,
    })
    .waitFor({ timeout: 120000 })
  const completed = await (
    await fetch(base + '/projects/demo-mill-creek/queries/' + job.id)
  ).json()
  assert.equal(completed.state, 'completed')
  assert.equal(completed.result.mode, 'local_synthesis')
  const checks = completed.result.review.checks
  assert.ok(checks.some((check) => check.status === 'partial_findings'))
  const cited = new Set(
    completed.result.report
      .filter((section) => !section.heading)
      .flatMap((section) =>
        section.sentences.flatMap((sentence) => sentence.refs || []),
      ),
  )
  const references = new Map(
    completed.result.references.map((reference) => [reference.id, reference]),
  )
  const sourceOnly = []
  for (const check of checks) {
    const coverage = check.evidenceCoverage
    if (!coverage) continue
    assert.equal(
      coverage.selectedSourceCount,
      coverage.citedSourceCount +
        coverage.sourceOnlyCount +
        coverage.unreportedSourceCount,
    )
    for (const source of coverage.provisions) {
      for (const id of source.referenceIds) {
        const reference = references.get(id)
        assert.equal(reference?.doc, source.doc)
        assert.equal(reference?.page, source.page)
        assert.equal(cited.has(id), source.status === 'cited_in_finding')
      }
      if (source.status === 'source_evidence_only')
        sourceOnly.push(...source.referenceIds)
    }
  }
  assert.ok(sourceOnly.length)
  await page
    .getByRole('button', { name: new RegExp('^Source ' + sourceOnly[0] + ':') })
    .first()
    .click()
  await page.locator('.source-highlight:visible').first().waitFor()
  await page.waitForFunction(
    () => document.querySelectorAll('.pdf-status').length === 0,
  )
  await page.reload()
  await report
    .getByRole('heading', {
      name: 'Selected evidence awaiting interpretation',
      exact: true,
    })
    .waitFor()
  assert.match(
    await report.innerText(),
    /selected source provisions cited in findings/,
  )
  mkdirSync('test-results', { recursive: true })
  await page.screenshot({
    path: 'test-results/review-coverage-browser.png',
    fullPage: true,
  })
  assert.deepEqual(errors, [])
  console.log(
    'PASS review submission, partial-check coverage, source-use invariants, pending-source PDF highlight and reload/history',
  )
} finally {
  await browser.close()
}

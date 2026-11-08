import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
const frontend = process.env.BASIS_FRONTEND_URL || 'http://127.0.0.1:8842/app'
const api = new URL('/local-api/v1', frontend).href
for (let i = 0; i < 120; i++) {
  try {
    if (
      (await (await fetch(new URL('/local-api/health', frontend))).json()).ready
    )
      break
  } catch {}
  if (i === 119) throw new Error('Backend not ready')
  await new Promise((r) => setTimeout(r, 250))
}
const browser = await chromium.launch({ ...(process.env.BASIS_BROWSER_CHANNEL ? { channel: process.env.BASIS_BROWSER_CHANNEL } : {}), headless: true })
mkdirSync('test-results', { recursive: true })
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  for (const id of ['parkview-exchange', 'north-ridge-highway']) {
    const data = await (await fetch(api + '/projects/' + id)).json()
    const model = data.documents.find((d) => d.model)
    assert.ok(model)
    await page.goto(frontend + '/#project/' + id)
    await page.getByRole('region', { name: 'Potential issues', exact: true }).waitFor()
    assert.equal(data.comparison.modelCount, 2, 'Both project models scanned automatically')
    if (id === 'parkview-exchange') {
      const automatic = data.issues.find((issue) => !issue.prepared)
      assert.ok(automatic, 'Actual IFC discrepancy exists before clicking Rescan')
      await page.getByRole('heading', { name: automatic.title, exact: true }).first().waitFor()
    }
    assert.equal(await page.getByRole('button', { name: 'Compare IFC', exact: true }).count(), 0)
    const scanResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith('/projects/' + id + '/rescan') &&
        response.request().method() === 'POST',
    )
    await page.getByRole('button', { name: 'Rescan', exact: true }).click()
    const response = await scanResponse
    assert.equal(response.status(), 200)
    const scan = await response.json()
    assert.equal(scan.modelCount, 2)
    assert.deepEqual(
      [...new Set(scan.coverage.map((d) => d.category))].sort(),
      ['client', 'design', 'reference', 'report', 'supporting'],
    )
    assert.ok(
      scan.coverage.some((d) => d.checks > 0),
      'Actual IFC values compared against document statements',
    )
    const panel = page.getByRole('region', {
      name: 'Potential issues',
      exact: true,
    })
    await panel.getByText(/^IFC scan:/).click()
    await panel.getByText('Technical reports', { exact: true }).waitFor()
    const dynamicIssues = scan.issues.filter((issue) => !issue.prepared)
    if (id === 'parkview-exchange') assert.ok(dynamicIssues.length > 0)
    if (dynamicIssues.length) {
      const finding = panel
        .locator('.project-issue')
        .filter({ hasText: dynamicIssues[0].title })
        .first()
      await finding.getByText('Inspect evidence', { exact: true }).click()
      assert.ok((await finding.textContent()).includes(dynamicIssues[0].citations[0].excerpt))
      await finding.getByRole('button', { name: 'Dismiss', exact: true }).click()
      await panel.getByRole('button', { name: /^Dismissed / }).click()
      await panel.locator('.project-issue').filter({ hasText: dynamicIssues[0].title }).first().waitFor()
      const rescanned = await fetch(api + '/projects/' + id + '/rescan', { method: 'POST' })
      assert.equal(rescanned.status, 200)
      assert.equal((await rescanned.json()).issues.find((i) => i.id === dynamicIssues[0].id).status, 'dismissed')
      await panel.locator('.project-issue').filter({ hasText: dynamicIssues[0].title }).first()
        .getByRole('button', { name: 'Restore', exact: true }).click()
      await panel.getByRole('button', { name: /^Open / }).click()
    }
    const download = page.waitForEvent('download')
    await page
      .getByRole('link', {
        name: 'Download IFC model for ' + data.project.name,
        exact: true,
      })
      .click()
    assert.equal((await download).suggestedFilename(), id + '.ifc')
    await page
      .locator('.project-document-row')
      .filter({ hasText: 'IFC model register' })
      .click()
    await page
      .getByRole('link', { name: 'Download IFC', exact: true })
      .waitFor()
    await page.locator('.textLayer span').first().waitFor()
    const query = data.queries.find(
      (q) => q.prepared && !q.stale && q.question.includes('IFC object'),
    )
    assert.ok(query, 'Completed real model-property query')
    const result = await (
      await fetch(api + '/projects/' + id + '/queries/' + query.id)
    ).json()
    assert.equal(result.result.mode, 'extractive_answer')
    assert.ok(result.result.references.some((r) => r.doc === model.id))
    await page.goto(frontend + '/#project/' + id + '/query/' + query.id)
    await page.getByRole('article', { name: 'Query report' }).waitFor()
    await page
      .getByRole('button', { name: /^Source 1:/ })
      .first()
      .click()
    await page.locator('.source-highlight:visible').first().waitFor()
    await page.waitForFunction(
      () => document.querySelectorAll('.pdf-status').length === 0,
    )
    await page.screenshot({ path: `test-results/${id}-ifc-search.png` })
  }
  assert.deepEqual(errors, [])
  console.log(
    'PASS live IFC comparison across all five categories, IFC downloads, model registers, property search and source navigation',
  )
} finally {
  await browser.close()
}

import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
const frontend = process.env.BASIS_FRONTEND_URL || 'http://127.0.0.1:8842/app'
const api = new URL('/local-api/v1', frontend).href
const browser = await chromium.launch({ ...(process.env.BASIS_BROWSER_CHANNEL ? { channel: process.env.BASIS_BROWSER_CHANNEL } : {}), headless: true })
mkdirSync('test-results', { recursive: true })
try {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1000 },
  })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(frontend + '/#projects')
  await expect(page.locator('.project-card').first()).toContainText(
    'Parkview Exchange',
  )
  for (const [id, issueId] of [
    ['parkview-exchange', 'sanitary-upstream-grade'],
    ['north-ridge-highway', 'pavement-traffic-inputs'],
  ]) {
    const d = await (await fetch(api + '/projects/' + id)).json()
    const issue = d.issues.find((i) => i.id === issueId)
    await page.goto(frontend + '/#project/' + id + '/query/' + issue.queryId)
    await page.getByRole('article', { name: 'Query report' }).waitFor()
    await page
      .getByRole('button', { name: /^Source 1:/ })
      .first()
      .click()
    await page.locator('.source-highlight:visible').first().waitFor()
    await page.locator('.report-sentence').first().hover()
    await expect
      .poll(() => page.locator('.source-highlight:visible').count())
      .toBeGreaterThanOrEqual(2)
    await page.waitForFunction(
      () => document.querySelectorAll('.pdf-status').length === 0,
    )
    await page.screenshot({ path: `test-results/${id}-comparison.png` })
    await page
      .getByRole('link', { name: 'Project dashboard', exact: true })
      .first()
      .click()
    await expect(page.locator('.project-document-row')).toHaveCount(
      d.documents.length,
    )
  }
  assert.deepEqual(errors, [])
  console.log(
    'PASS researched-project overview, both comparison workspaces, original highlights, multiple sources and dashboard navigation',
  )
} finally {
  await browser.close()
}

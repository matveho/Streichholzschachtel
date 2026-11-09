import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'

const origin = process.env.BASIS_FRONTEND_URL || 'http://127.0.0.1:5178'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  const submissions = []
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().endsWith('/v1/projects/parkview-exchange/queries'))
      submissions.push(r.postDataJSON())
  })
  await page.goto(origin + '/#project/parkview-exchange/new')
  const original = 'What insulation R-value is required for storm sewer cover?'
  await page.locator('#query').fill(original)
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  const alternatives = page.getByRole('region', {
    name: 'Related source queries',
  })
  await alternatives.waitFor({ timeout: 60000 })
  await page
    .getByRole('heading', {
      name: /No direct answer|Not found in the indexed documents|No supported answer/,
    })
    .waitFor()
  const first = alternatives.getByRole('button').first()
  const question = (
    await first.locator('.suggestion-question').innerText()
  ).trim()
  assert.ok(await first.locator('.suggestion-preview').innerText())
  mkdirSync('test-results', { recursive: true })
  const expand = page.getByRole('button', {
    name: 'Expand result panel',
    exact: true,
  })
  if (await expand.count()) await expand.click()
  await page.screenshot({ path: 'test-results/query-alternatives.png' })
  await first.click()
  await page.waitForFunction(() =>
    document.querySelector('.query-report .citations button'),
  )
  assert.equal(await page.locator('#query').inputValue(), question)
  assert.ok(
    submissions.some((s) => s.question === question && s.sourceOnly === true),
  )
  await page.locator('.citations button').first().click()
  await page.locator('.source-highlight').first().waitFor({ timeout: 60000 })
  await page.locator('.textLayer span').first().waitFor()
  assert.equal(await alternatives.count(), 0)
  await page.reload()
  await page.locator('.query-report').waitFor()
  assert.equal(await page.locator('#query').inputValue(), question)
  await page.getByRole('link', { name: 'Project dashboard', exact: true }).first().click()
  assert.ok(await page.getByRole('link').filter({ hasText: original }).count())
  assert.ok(await page.getByRole('link').filter({ hasText: question }).count())
  assert.deepEqual(errors, [])
  console.log(
    'PASS real no-results query -> source alternative -> original PDF highlight -> reload and history',
  )
} finally {
  await browser.close()
}

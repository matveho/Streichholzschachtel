import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'

const origin =
  process.env.BASIS_FRONTEND_URL || 'https://streichholzschachtel.vercel.app'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const page = await browser.newPage()
  await page.goto(origin + '/#home')
  await page
    .getByRole('heading', { name: 'Previous queries', exact: true })
    .waitFor()
  assert.equal(
    await page.getByRole('combobox', { name: 'Data source' }).count(),
    0,
  )
  assert.equal(await page.getByLabel('Connection key').count(), 0)
  assert.equal(
    await page
      .locator('.history-sources')
      .filter({ hasText: 'Example' })
      .count(),
    5,
  )
  const metadata = await page.evaluate(async () => {
    const r = await fetch('/local-api/v1/documents')
    const data = await r.json()
    return {
      status: r.status,
      count: data.documents.length,
      files: data.documents.map((d) => d.file),
    }
  })
  assert.equal(metadata.status, 200)
  assert.equal(metadata.count, 5)
  assert.ok(
    metadata.files.every(
      (file) => file.startsWith('/local-api/') && !file.includes('token='),
    ),
  )
  await page.getByRole('link', { name: /Minor storm sewer design/ }).click()
  await page.getByRole('article', { name: 'Query report' }).waitFor()
  await page.getByRole('link', { name: 'Home', exact: true }).click()
  await page.getByRole('button', { name: 'New query', exact: true }).click()
  await page
    .locator('#query')
    .fill(
      'What minimum vertical clearance is required where sewer mains cross each other?',
    )
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await page.waitForFunction(
    () => document.querySelector('.query-report')?.textContent.includes('300'),
    {},
    { timeout: 60000 },
  )
  await page.locator('.citations button').first().click()
  await page.locator('.source-highlight').first().waitFor()
  await page.locator('.textLayer span').first().waitFor()
  await page.locator('#query').fill('What is the capital of France?')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await page
    .getByRole('heading', { name: 'No supported answer', exact: true })
    .waitFor({ timeout: 30000 })
  assert.equal(await page.locator('.citations button').count(), 0)
  console.log(
    'PASS fresh browser: automatic remote connection without key, five examples, live query, PDF highlight and unsupported answer',
  )
} finally {
  await browser.close()
}

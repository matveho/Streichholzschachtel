import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'

const origin =
  process.env.BASIS_FRONTEND_URL || 'https://streichholzschachtel.vercel.app'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const page = await browser.newPage()
  await page.goto(origin + '/#projects')
  await page
    .getByRole('heading', { name: 'Projects', exact: true })
    .waitFor()
  assert.equal(
    await page.getByRole('combobox', { name: 'Data source' }).count(),
    0,
  )
  assert.equal(await page.getByLabel('Connection key').count(), 0)
  const metadata = await page.evaluate(async () => {
    const health = await (await fetch('/local-api/health')).json()
    const r = await fetch('/local-api/v1/documents')
    const data = await r.json()
    return {
      status: r.status,
      count: data.documents.length,
      files: data.documents.map((d) => d.file),
      expectedCount: health.documents,
      ready: health.ready,
      failures: health.failures,
    }
  })
  assert.equal(metadata.status, 200)
  assert.ok(metadata.ready)
  assert.equal(metadata.failures, 0)
  assert.ok(metadata.count > 0)
  assert.equal(metadata.count, metadata.expectedCount)
  assert.ok(
    metadata.files.every(
      (file) => file.startsWith('/local-api/') && !file.includes('token='),
    ),
  )
  await page.getByRole('link',{name:/Parkview Exchange Redevelopment/}).first().click()
  await page.getByRole('heading',{name:/Project documents/}).waitFor()
  await page.locator('details.project-issue').filter({hasText:'Sanitary upstream grade needs revision'}).locator('summary').first().click()
  await page.getByRole('button',{name:'Inspect evidence'}).first().click()
  await page.locator('.citations button').first().click()
  await page.locator('.source-highlight:visible').first().waitFor()
  console.log('PASS keyless project connection and cited evidence')
} finally {
  await browser.close()
}

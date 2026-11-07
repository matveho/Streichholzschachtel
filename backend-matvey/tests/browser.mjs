import { chromium } from '@playwright/test'
import { readFileSync, mkdirSync } from 'node:fs'
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
const key = readFileSync('state/session-token.txt', 'utf8').trim()
const connection = JSON.parse(readFileSync('state/connection.json', 'utf8'))
const frontend = process.env.BASIS_FRONTEND_URL || 'http://127.0.0.1:8787/app/'
const backend = process.env.BASIS_FRONTEND_URL
  ? connection.url
  : 'http://127.0.0.1:8787'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  })
  // Test a real public HTTPS origin, not a browser with security disabled.
  await page.goto('https://streichholzschachtel.vercel.app')
  const cors = await page.evaluate(
    async ({ url, key }) => {
      const r = await fetch(url + '/v1/documents', {
        headers: { Authorization: 'Bearer ' + key },
      })
      const d = await r.json()
      return { status: r.status, documents: d.documents?.length }
    },
    { url: connection.url, key },
  )
  assert.equal(cors.status, 200)
  assert.equal(cors.documents, 5)
  console.log(
    'PASS: real deployed HTTPS origin reads authenticated document metadata without CORS errors',
  )
  await page.goto(
    frontend.replace(/\/$/, '') +
      '/#connect?url=' +
      encodeURIComponent(backend) +
      '&key=' +
      encodeURIComponent(key),
  )
  await page
    .getByRole('heading', { name: 'Previous queries', exact: true })
    .waitFor()
  assert.equal(
    await page.evaluate(() => location.hash === '#home'),
    true,
    'Connection bootstrap should remove the key from the address bar',
  )
  assert.equal(
    await page
      .getByRole('combobox', { name: 'Data source', exact: true })
      .inputValue(),
    'matvey',
  )
  await page
    .getByRole('button', { name: 'Check connection', exact: true })
    .click()
  await page.getByText('Ready · 5 documents', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'New query', exact: true }).click()
  await page.locator('#query').fill('What is the capital of France?')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await page
    .getByRole('heading', { name: 'No supported answer', exact: true })
    .waitFor({ timeout: 20000 })
  assert.equal(await page.locator('.citations button').count(), 0)
  assert.equal(await page.getByRole('tab').count(), 0)
  assert.equal(
    await page
      .getByRole('region')
      .filter({ has: page.locator('canvas') })
      .count(),
    0,
  )
  await page
    .locator('#query')
    .fill(
      'What minimum vertical clearance is required where sewer mains cross each other?',
    )
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await page.waitForFunction(
    () => document.querySelector('.query-report')?.textContent.includes('300'),
    {},
    { timeout: 180000 },
  )
  assert.ok((await page.locator('.citations button').count()) > 0)
  await page.locator('.citations button').first().click()
  await page.locator('.source-highlight').first().waitFor()
  await page.locator('.textLayer span').first().waitFor()
  mkdirSync('test-results', { recursive: true })
  await page.screenshot({ path: resolve('test-results/live-workspace.png') })
  await page.getByRole('link', { name: 'Home', exact: true }).click()
  await page
    .getByRole('combobox', { name: 'Data source', exact: true })
    .selectOption('static')
  await page.getByRole('link', { name: /Minor storm sewer design/ }).click()
  await page.getByRole('article', { name: 'Query report' }).waitFor()
  console.log(
    'PASS: ' +
      frontend +
      ' connection bootstrap, mode switch, health check, explicit unsupported query, unseen live query, source PDF/highlight, and static restoration',
  )
} finally {
  await browser.close()
}

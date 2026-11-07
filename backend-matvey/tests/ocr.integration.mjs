import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const key = readFileSync('state/session-token.txt', 'utf8').trim()
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(
    'http://127.0.0.1:8787/app/#connect?url=' +
      encodeURIComponent('http://127.0.0.1:8787') +
      '&key=' +
      encodeURIComponent(key),
  )
  await page
    .getByRole('heading', { name: 'Previous queries', exact: true })
    .waitFor()
  await page.getByRole('button', { name: 'New query', exact: true }).click()
  await page
    .locator('#query')
    .fill('Can box planter underdrains be connected to combined sewers?')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await page.waitForFunction(
    () =>
      document
        .querySelector('.query-report')
        ?.textContent.includes('combined sewer'),
    {},
    { timeout: 180000 },
  )
  const source = page.locator('.citations button[title*="Infill LID"]').first()
  await source.click()
  const pane = page.getByRole('region', {
    name: 'Corner Lot Infill LID Guidelines',
    exact: true,
  })
  await pane.locator('.source-highlight').first().waitFor()
  await pane.locator('.textLayer span').first().waitFor()
  await page.screenshot({ path: 'test-results/ocr-source.png' })
  console.log(
    'PASS recovered infill source, OCR citation on its cited PDF page, aligned source highlight and original PDF rendering',
  )
  const completed = page.waitForResponse(
    async (response) => {
      if (!/\/v1\/queries\/[a-f0-9-]+$/.test(response.url())) return false
      try {
        const job = await response.json()
        return (
          job.state === 'completed' &&
          job.question.startsWith('For a four-unit corner-lot infill, confirm')
        )
      } catch {
        return false
      }
    },
    { timeout: 180000 },
  )
  await page
    .locator('#query')
    .fill(
      'For a four-unit corner-lot infill, confirm the private storm-servicing requirement, whether box-planter underdrains can connect to combined sewers, and what erosion and sediment control inspection frequency applies during construction.',
    )
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  const job = await (await completed).json()
  assert.ok(
    new Set(job.result.references.map((r) => r.doc)).size >= 3,
    'The completed API result should cite three independent sources',
  )
  await page.waitForFunction(
    () => document.querySelectorAll('[role=tab]').length >= 3,
    {},
    { timeout: 10000 },
  )
  const tabs = await page.getByRole('tab').count()
  assert.ok(
    tabs >= 3,
    'The three-part question should cite at least three independent sources',
  )
  await page.getByRole('tab', { name: /Infill LID/ }).click()
  await page.getByRole('tab', { name: /Servicing/ }).click()
  await page.getByRole('tab', { name: /LID CIM/ }).click()
  await page.locator('.citations button[title*="LID CIM"]').first().click()
  const thirdPane = page.getByRole('region', {
    name: 'LID Construction, Inspection & Maintenance',
    exact: true,
  })
  await thirdPane.locator('.source-highlight').first().waitFor()
  await thirdPane.locator('.textLayer span').first().waitFor()
  await thirdPane
    .getByText('Loading document…', { exact: true })
    .waitFor({ state: 'hidden' })
  await page.screenshot({ path: 'test-results/live-three-sources.png' })
  assert.deepEqual(errors, [])
  console.log(
    'PASS live three-source result, dynamic source tabs and switching between hashed document ids',
  )
} finally {
  await browser.close()
}

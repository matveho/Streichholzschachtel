import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'

const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  })
  // These checks cover the standalone example workspace. The project UI has
  // its own live backend checks; keep service availability out of this fixture.
  await page.route('**/v1/projects', (route) =>
    route.fulfill({ status: 404, contentType: 'application/json', body: '{}' }),
  )
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('http://127.0.0.1:5173/')
  assert.match(await page.locator('#query').inputValue(), /20 ha/)
  await page.getByRole('link', { name: 'Home', exact: true }).click()
  await page
    .getByRole('heading', { name: 'Previous queries', exact: true })
    .waitFor()
  assert.equal(await page.locator('.history-entry').count(), 5)
  await mkdir('test-results', { recursive: true })
  await page.screenshot({ path: 'test-results/home.png' })
  await page
    .getByRole('textbox', { name: 'Filter queries' })
    .fill('Corner-lot LID and servicing')
  assert.equal(await page.locator('.history-entry').count(), 1)
  await page.getByRole('link', { name: /Corner-lot LID and servicing/ }).click()
  await page.getByRole('article', { name: 'Query report' }).waitFor()
  assert.match(await page.locator('#query').inputValue(), /four-unit/)
  assert.equal(await page.getByRole('tab').count(), 3)
  assert.equal(await page.locator('.pane-slot:not(.hidden)').count(), 2)
  assert.equal(await page.locator('.document-tab.has-source').count(), 3)
  await page.waitForFunction(
    () => document.querySelectorAll('.pdf-status').length === 0,
  )
  await page
    .getByRole('button', {
      name: 'Source 12: LID CIM, §4.2.4 · p. 16',
      exact: true,
    })
    .first()
    .click()
  const construction = page.getByRole('region', {
    name: 'LID Construction, Inspection & Maintenance',
    exact: true,
  })
  await construction.waitFor()
  await construction.locator('.textLayer span').first().waitFor()
  await construction.locator('[data-reference="12"]').waitFor()
  assert.equal(await page.locator('.pane-slot:not(.hidden)').count(), 2)
  await page
    .getByRole('combobox', { name: 'Compare document' })
    .selectOption('infill')
  await page
    .getByRole('region', {
      name: 'Corner Lot Infill LID Guidelines',
      exact: true,
    })
    .waitFor()
  await page.screenshot({ path: 'test-results/three-sources.png' })
  await page
    .getByRole('button', { name: 'Single document view', exact: true })
    .click()
  for (const label of [/Infill LID/, /Servicing/, /LID CIM/]) {
    await page.getByRole('tab', { name: label }).click()
    assert.equal(await page.locator('.pane-slot:not(.hidden)').count(), 1)
  }
  await page.getByRole('button', { name: /^Box-planter underdrains/ }).click()
  await page.getByRole('heading', { name: 'Query result', exact: true }).hover()
  await page.waitForFunction(
    () =>
      document.querySelector(
        'input[aria-label="Page in Corner Lot Infill LID Guidelines"]',
      ).value === '18',
  )
  await page.locator('[data-reference="13"]').waitFor()
  await page.getByRole('link', { name: 'Home', exact: true }).click()
  await page.getByRole('button', { name: 'New query', exact: true }).click()
  await page.waitForFunction(
    () => document.querySelector('#query')?.value === '',
  )
  assert.equal(await page.locator('.query-report').count(), 0)
  const emptyJob = {
    id: crypto.randomUUID(),
    state: 'completed',
    result: {
      mode: 'no_evidence',
      documents: [],
      references: [],
      notes: [],
      suggestions: [],
      report: [
        {
          heading: 'No supported answer',
          sentences: [{ text: 'No applicable source text was found.' }],
        },
      ],
    },
  }
  await page.route(/\/local-api\/v1\/queries(?:\/[^/?]+)?$/, (route) =>
    route.fulfill({ json: emptyJob }),
  )
  await page
    .locator('#query')
    .fill('Check the foundation drainage requirements')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await page
    .getByRole('status', { name: 'Nothing found', exact: true })
    .waitFor()
  await page.getByRole('link', { name: 'Home', exact: true }).click()
  assert.equal(await page.locator('.history-entry').count(), 6)
  await page.reload()
  await page
    .getByRole('link', { name: /Check the foundation drainage requirements/ })
    .click()
  await page
    .getByRole('status', { name: 'Nothing found', exact: true })
    .waitFor()
  assert.equal(await page.locator('.query-report').count(), 0)
  await page.goto('http://127.0.0.1:5173/')
  assert.match(await page.locator('#query').inputValue(), /20 ha/)
  await page.getByRole('link', { name: 'Home', exact: true }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  )
  await page.getByRole('link', { name: /Corner-lot LID and servicing/ }).click()
  assert.equal(await page.getByRole('tab').count(), 3)
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  )
  assert.deepEqual(errors, [])
  console.log(
    'PASS: original landing screen, history/filter, three independent PDFs, third-source citation, comparison picker, all source tabs, page-specific highlights, new queries, persisted history, unsupported results, and mobile overflow.',
  )
} finally {
  await browser.close()
}

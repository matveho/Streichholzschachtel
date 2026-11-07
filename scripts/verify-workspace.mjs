import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'

const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('http://127.0.0.1:5173/')
  await page.locator('.textLayer span').first().waitFor()
  await page.waitForFunction(
    () => document.querySelectorAll('.pdf-status').length === 0,
  )
  await page.locator('.source-highlight[data-reference="2"]').waitFor()
  const minimap = page.getByRole('complementary', {
    name: 'Document minimap: Design Guidelines',
    exact: true,
  })
  await minimap.locator('.minimap-page.current img').waitFor()
  assert.equal(await page.locator('.minimap-page').count(), 234)
  assert.ok(
    (await page.locator('.minimap-page img').count()) < 45,
    'Thumbnails load on demand',
  )
  assert.equal(await minimap.locator('.minimap-mark.active').count(), 1)
  const overview = minimap.locator('.minimap-overview')
  const track = await overview.boundingBox()
  await overview.click({ position: { x: 5, y: track.height * 0.5 } })
  await page.waitForFunction(
    () =>
      document.querySelector('input[aria-label="Page in Design Guidelines"]')
        .value === '63',
  )
  await minimap
    .getByRole('button', {
      name: 'Jump to 4 cited passages, PDF page 10',
      exact: true,
    })
    .click()
  await page.waitForFunction(
    () =>
      document.querySelector('input[aria-label="Page in Design Guidelines"]')
        .value === '10',
  )
  await page
    .locator('.source-highlight[data-reference="6"]')
    .waitFor({ state: 'attached' })
  const viewer = page
    .getByRole('region', { name: 'Design Guidelines', exact: true })
    .locator('.pdf-scroll')
  await viewer.evaluate((el) => {
    el.scrollTop = 0
  })
  await page.waitForFunction(
    () =>
      document.querySelector('.pane-slot .minimap-viewport').style.top === '0%',
  )
  await minimap.locator('.minimap-page.current').focus()
  await page.keyboard.press('End')
  await page.waitForFunction(
    () =>
      document.querySelector('input[aria-label="Page in Design Guidelines"]')
        .value === '125',
  )
  await page
    .getByRole('button', {
      name: 'Toggle minimap Design Guidelines',
      exact: true,
    })
    .click()
  assert.equal(await page.locator('.document-minimap').count(), 1)
  await page
    .getByRole('button', {
      name: 'Toggle minimap Design Guidelines',
      exact: true,
    })
    .click()
  await page.getByRole('button', { name: /^Design storm\./ }).click()
  await page.getByRole('heading', { name: 'Consolidated result' }).hover()
  await page.waitForFunction(
    () => document.querySelectorAll('.pdf-status').length === 0,
  )
  await mkdir('test-results', { recursive: true })
  await page.screenshot({ path: 'test-results/workspace.png' })
  await page.getByRole('button', { name: /^Design storm\./ }).hover()
  assert.equal(await page.locator('.source-highlight').count(), 2)
  for (const id of ['1', '2']) {
    const visible = await page
      .locator(`[data-reference="${id}"]`)
      .evaluate((el) => {
        const rect = el.getBoundingClientRect(),
          parent = el.closest('.pdf-scroll').getBoundingClientRect()
        return rect.top >= parent.top && rect.bottom <= parent.bottom
      })
    assert.ok(visible, `Reference ${id} visible within its viewer`)
  }
  await page.getByRole('button', { name: /^Velocity\./ }).click()
  await page.getByRole('heading', { name: 'Consolidated result' }).hover()
  assert.equal(await page.locator('[data-reference="6"]').count(), 1)
  await page.keyboard.press('Escape')
  assert.equal(await page.locator('.source-highlight').count(), 0)
  await page
    .getByRole('button', { name: 'Single document view', exact: true })
    .click()
  await page.getByRole('tab', { name: /Vol. 3-02/ }).click()
  assert.equal(await page.locator('.pane-slot:not(.hidden)').count(), 1)
  await page
    .getByRole('button', {
      name: 'Next page in Stormwater Management & Design Manual',
      exact: true,
    })
    .click()
  assert.equal(
    await page
      .getByRole('spinbutton', {
        name: 'Page in Stormwater Management & Design Manual',
        exact: true,
      })
      .inputValue(),
    '13',
  )
  await page
    .getByRole('button', {
      name: 'Previous page in Stormwater Management & Design Manual',
      exact: true,
    })
    .click()
  assert.equal(
    await page
      .getByRole('spinbutton', {
        name: 'Page in Stormwater Management & Design Manual',
        exact: true,
      })
      .inputValue(),
    '12',
  )
  await page.getByRole('button', { name: /^Inputs still required\./ }).hover()
  await page.waitForFunction(
    () =>
      document.querySelector(
        'input[aria-label="Page in Stormwater Management & Design Manual"]',
      ).value === '13',
  )
  await page.waitForFunction(
    () => document.querySelectorAll('.pdf-status').length === 0,
  )
  await page.screenshot({ path: 'test-results/tabbed.png' })
  await page
    .getByRole('button', { name: 'Side-by-side view', exact: true })
    .click()
  await page.getByRole('button', { name: /^Design storm\./ }).click()
  await page.getByRole('heading', { name: 'Consolidated result' }).hover()
  await page.waitForFunction(
    () =>
      document.querySelector(
        'input[aria-label="Page in Stormwater Management & Design Manual"]',
      ).value === '12',
  )
  await page
    .getByRole('button', { name: 'Zoom in Design Guidelines', exact: true })
    .click()
  assert.match(await page.locator('.zoom-label').first().innerText(), /115%/)
  await page
    .getByRole('button', { name: 'Fit width Design Guidelines', exact: true })
    .click()
  const separator = page.getByRole('separator', {
    name: 'Resize consolidated result',
  })
  await separator.focus()
  await page.keyboard.press('ArrowUp')
  assert.equal(await separator.getAttribute('aria-valuenow'), '288')
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.getByRole('button', { name: 'Copy', exact: true }).click()
  assert.match(
    await page.evaluate(() => navigator.clipboard.readText()),
    /Vol. 3-03/,
  )
  await page.getByRole('button', { name: 'New query', exact: true }).click()
  assert.equal(await page.locator('#query').inputValue(), '')
  assert.ok(
    await page
      .getByRole('button', { name: 'Search', exact: true })
      .isDisabled(),
  )
  await page.locator('#query').fill('Another question')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await page
    .getByText('This frontend contains one prepared query.', { exact: false })
    .waitFor()
  assert.equal(await page.locator('.source-highlight').count(), 0)
  await page.getByRole('button', { name: 'Load example' }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: 'test-results/mobile.png' })
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    'No page-wide horizontal overflow',
  )
  assert.deepEqual(errors, [])
  console.log(
    'PASS: lazy minimaps, whole-file navigation, marker selection, viewport tracking, keyboard navigation, minimap toggles, PDFs, citation tracing, pin/clear, tabs, zoom, resize, clipboard, new query, mobile overflow, and browser errors.',
  )
} finally {
  await browser.close()
}

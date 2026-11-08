import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
const frontend = process.env.BASIS_FRONTEND_URL || 'http://127.0.0.1:8842/app'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
mkdirSync('test-results', { recursive: true })
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(frontend + '/#projects')
  await page.locator('.project-card').first().waitFor()
  await page.evaluate(() => document.fonts.ready)
  await expect
    .poll(() =>
      page
        .locator('.project-brand img')
        .evaluate((e) => e.complete && e.naturalWidth > 0),
    )
    .toBe(true)
  assert.equal(
    await page.locator('link[rel="icon"]').getAttribute('href'),
    '/basis-logo.png',
  )
  const style = await page.evaluate(() => ({
    background: getComputedStyle(document.documentElement).backgroundColor,
    text: getComputedStyle(document.documentElement).color,
    issue: getComputedStyle(document.documentElement)
      .getPropertyValue('--color-issues')
      .trim(),
    font: getComputedStyle(document.querySelector('.project-card h2'))
      .fontFamily,
    weight: getComputedStyle(document.querySelector('.project-card h2'))
      .fontWeight,
    header: document.querySelector('.app-header').getBoundingClientRect()
      .height,
  }))
  assert.equal(style.background, 'rgb(244, 255, 253)')
  assert.equal(style.text, 'rgb(1, 25, 54)')
  assert.ok(style.font.includes('Roboto Mono'))
  assert.equal(style.weight, '700')
  assert.ok(style.header >= 56)
  assert.equal(style.issue.toLowerCase(), '#ed254e')
  await page.screenshot({ path: 'test-results/design-projects.png' })
  await page.goto(frontend + '/#project/parkview-exchange')
  const query = page.getByRole('button', { name: 'Query Files', exact: true })
  await query.waitFor()
  assert.equal(
    await page
      .locator('.app-header')
      .getByRole('button', { name: /new query/i })
      .count(),
    0,
  )
  const qb = await query.boundingBox(),
    issues = await page
      .getByRole('heading', { name: 'Potential issues', exact: true })
      .boundingBox()
  assert.ok(qb.y + qb.height <= issues.y, 'Query action above Potential issues')
  const buttonColor = await query.evaluate(
    (e) => getComputedStyle(e).backgroundColor,
  )
  assert.equal(buttonColor, 'rgb(50, 127, 121)')
  await page.screenshot({ path: 'test-results/design-dashboard.png' })
  await query.click()
  await page.locator('.query-field textarea').waitFor()
  assert.equal(await page.locator('.app-header .new-query').count(), 0)
  await page
    .getByRole('link', { name: 'Project dashboard', exact: true })
    .first()
    .click()
  await query.waitFor()
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.locator('.workspace-settings-menu').waitFor()
  await page.screenshot({ path: 'test-results/design-settings.png' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(frontend + '/#projects')
  await page.locator('.project-card').first().waitFor()
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  )
  await page.screenshot({ path: 'test-results/design-mobile.png' })
  assert.deepEqual(errors, [])
  console.log(
    'PASS design palette, supplied logo/favicon, larger header, bold Roboto Mono, preserved button fill, relocated Query Files, settings and narrow layout',
  )
} finally {
  await browser.close()
}

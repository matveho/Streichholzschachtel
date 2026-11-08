import { integrationOrigin, launchIntegrationBrowser } from './vercel-routing.mjs'
import { chromium, expect } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
const origin = integrationOrigin(process.env.BASIS_FRONTEND_URL || 'http://127.0.0.1:8842/app')
assert.ok(
  [...(process.env.BASIS_VERCEL_UI === '1' ? ['https://streichholzschachtel.vercel.app'] : []), 'http://127.0.0.1:8842', 'http://localhost:8842'].includes(
    new URL(origin).origin,
  ),
  'Workspace reset checks require the isolated preview on 8842',
)
const browser = await launchIntegrationBrowser(chromium)
let createdId = ''
try {
  const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    }),
    errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('dialog', (d) => d.accept())
  await page.goto(origin + '/#projects')
  await page.locator('.project-card').nth(1).waitFor()
  await page.evaluate(async () => {
    for (const id of ['demo-mill-creek', 'demo-willow-creek']) {
      const response = await fetch('/local-api/v1/projects/' + id + '/reset', {
        method: 'POST',
      })
      if (!response.ok) throw new Error('Could not reset demo test state')
    }
  })
  await page.reload()
  await page.getByRole('heading', { name: 'Projects', exact: true }).waitFor()
  await page.locator('.project-card').nth(1).waitFor()
  await page
    .getByRole('link')
    .filter({ hasText: 'Mill Creek Corner Infill' })
    .click()
  await page
    .getByRole('heading', { name: 'Mill Creek Corner Infill', exact: true })
    .waitFor()
  assert.equal(
    await page.getByLabel('Delete project', { exact: true }).count(),
    0,
  )
  const issues = page.getByRole('region', { name: 'Potential issues' })
  await expect(issues.locator('article')).toHaveCount(2)
  await expect(page.locator('.project-document-row')).toHaveCount(13)
  await page.getByLabel('Filter project documents').fill('Client requirements')
  assert.equal(await page.locator('.project-document-row').count(), 1)
  await page.locator('.project-document-row').click()
  await page.locator('.textLayer span').first().waitFor({ timeout: 30000 })
  await page
    .getByRole('link', { name: 'Project dashboard', exact: true })
    .first()
    .click()
  await page
    .getByRole('region', { name: 'Potential issues' })
    .getByRole('button', { name: 'Inspect evidence' })
    .first()
    .click()
  await page.getByRole('article', { name: 'Query report' }).waitFor()
  await page.getByRole('button', { name: /^Source 1:/ }).first().click()
  await page.locator('.source-highlight').first().waitFor({ timeout: 30000 })
  await page
    .locator('.pdf-status')
    .first()
    .waitFor({ state: 'hidden', timeout: 30000 })
  await page.locator('.textLayer span').first().waitFor({ timeout: 30000 })
  assert.ok((await page.locator('.query-report').innerText()).includes('450'))
  assert.equal(await page.locator('.document-tab').count(), 3)
  await page
    .getByRole('button', { name: /^Source 3:/ })
    .first()
    .click()
  await page.locator('[data-reference="3"]').first().waitFor()
  await page
    .getByRole('button', { name: /^Source 1:/ })
    .first()
    .click()
  await expect(
    page.getByLabel('Page in Corner Lot Infill LID Guidelines', {
      exact: true,
    }),
  ).toHaveValue('18')
  await page.locator('.report-sentence').first().hover()
  await expect
    .poll(() => page.locator('.source-highlight:visible').count())
    .toBeGreaterThanOrEqual(2)
  await page.waitForFunction(
    () => document.querySelectorAll('.pdf-status').length === 0,
  )
  mkdirSync('test-results', { recursive: true })
  await page.screenshot({ path: 'test-results/project-evidence.png' })
  await page
    .getByRole('link', { name: 'Project dashboard', exact: true })
    .first()
    .click()
  await page
    .getByRole('region', { name: 'Potential issues' })
    .getByRole('button', { name: 'Dismiss', exact: true })
    .first()
    .click()
  await page.getByRole('button', { name: 'Dismissed 1', exact: true }).waitFor()
  await page.reload()
  await page.getByRole('button', { name: 'Dismissed 1', exact: true }).click()
  assert.equal(await issues.locator('article').count(), 1)
  await issues.getByRole('button', { name: 'Restore', exact: true }).click()
  await page.getByRole('button', { name: 'Open 2', exact: true }).waitFor()
  await page
    .getByRole('region', { name: 'Project query history' })
    .getByLabel('Save query')
    .first()
    .click()
  await page
    .getByRole('region', { name: 'Project query history' })
    .getByRole('button', { name: 'Saved', exact: true })
    .click()
  await expect(page.locator('.project-query-row')).toHaveCount(1)
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: 'Reset demo', exact: true }).click()
  await page.getByRole('heading', { name: 'Projects', exact: true }).waitFor()
  await page
    .getByRole('link')
    .filter({ hasText: 'Mill Creek Corner Infill' })
    .click()
  await page
    .getByRole('heading', { name: 'Mill Creek Corner Infill', exact: true })
    .waitFor()
  await page.getByRole('button', { name: 'Open 2', exact: true }).waitFor()
  await page.screenshot({ path: 'test-results/project-dashboard.png' })
  await page.getByRole('link', { name: 'Projects', exact: true }).click()
  await page
    .getByRole('link')
    .filter({ hasText: 'Willow Creek Bridge Renewal' })
    .click()
  await page
    .getByRole('heading', { name: 'Willow Creek Bridge Renewal', exact: true })
    .waitFor()
  await expect(page.locator('.project-document-row')).toHaveCount(6)
  assert.ok(
    !(await page.locator('.project-document-row').allInnerTexts())
      .join(' ')
      .includes('Infill LID'),
  )
  await page
    .getByRole('region', { name: 'Potential issues' })
    .getByRole('button', { name: 'Inspect evidence' })
    .first()
    .click()
  await page.getByRole('article', { name: 'Query report' }).waitFor()
  await page.getByRole('button', { name: /^Source 1:/ }).first().click()
  await page.locator('.source-highlight').first().waitFor({ timeout: 30000 })
  assert.ok((await page.locator('.query-report').innerText()).includes('2%'))
  await page
    .getByRole('link', { name: 'Project dashboard', exact: true })
    .first()
    .click()
  await page.getByRole('link', { name: 'Projects', exact: true }).click()
  await page.getByRole('button', { name: 'New project', exact: true }).click()
  await page
    .getByRole('textbox', { name: 'Project name', exact: true })
    .fill('QA browser project')
  await page.getByText('Project details', { exact: true }).click()
  await page
    .getByRole('textbox', { name: 'Client / owner', exact: true })
    .fill('Test owner')
  await page
    .getByRole('combobox', { name: 'Reference Collections' })
    .fill('water infrastructure')
  await page
    .getByRole('option')
    .filter({ hasText: 'Water Infrastructure' })
    .click()
  await page.locator('.selected-documents input').first().uncheck()
  await page
    .getByRole('button', { name: 'Create project', exact: true })
    .click()
  await page
    .getByRole('heading', { name: 'QA browser project', exact: true })
    .waitFor()
  createdId = page.url().split('#project/')[1]
  assert.equal(await page.locator('.project-document-row').count(), 2)
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page
    .getByRole('button', { name: 'Manage project', exact: true })
    .click()
  await expect(page.locator('.selected-documents input')).toHaveCount(3)
  for (const input of await page.locator('.selected-documents input').all())
    if (await input.isChecked()) await input.uncheck()
  await page.getByRole('button', { name: 'Save project', exact: true }).click()
  await expect(page.locator('.project-document-row')).toHaveCount(0)
  assert.ok(
    await page
      .getByRole('button', { name: 'Query Files', exact: true })
      .isDisabled(),
  )
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page
    .getByRole('button', { name: 'Delete project', exact: true })
    .click()
  await page.getByRole('heading', { name: 'Projects', exact: true }).waitFor()
  assert.equal(
    await page
      .getByRole('link')
      .filter({ hasText: 'QA browser project' })
      .count(),
    0,
  )
  createdId = ''
  await page.setViewportSize({ width: 390, height: 844 })
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  )
  assert.deepEqual(errors, [])
  console.log(
    'PASS project overview, protected demos, documents, original citations, evidence inspection, persistent dismissal, saved history, collection selection, project edits, deletion and responsive layout',
  )
} finally {
  if (createdId) {
    const p = await browser.newPage()
    await p.goto(origin)
    await p.evaluate(
      (id) => fetch('/local-api/v1/projects/' + id, { method: 'DELETE' }),
      createdId,
    )
  }
  await browser.close()
}

import { integrationOrigin, launchIntegrationBrowser } from './vercel-routing.mjs'
import { chromium, expect } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdirSync, copyFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('..', import.meta.url)),
  origin = integrationOrigin(process.env.BASIS_FRONTEND_URL || 'http://127.0.0.1:8842/app')
const folder = resolve(root, 'state/ui-test-files')
assert.ok(
  process.env.BASIS_TEST_DEMO_EDITS === '0' ||
    [...(process.env.BASIS_VERCEL_UI === '1' ? ['https://streichholzschachtel.vercel.app'] : []), 'http://127.0.0.1:8842', 'http://localhost:8842'].includes(
      new URL(origin).origin,
    ),
  'Destructive demo checks require the isolated preview; use BASIS_TEST_DEMO_EDITS=0 for non-reset checks elsewhere',
)
mkdirSync(folder, { recursive: true })
copyFileSync(
  resolve(root, 'output/pdf/mill-creek-client-brief.pdf'),
  resolve(folder, 'bridge-client-brief.pdf'),
)
copyFileSync(
  resolve(root, 'output/pdf/mill-creek-site-note.pdf'),
  resolve(folder, 'site-report.pdf'),
)
writeFileSync(resolve(folder, 'readme.txt'), 'Excluded from PDF import')
const browser = await launchIntegrationBrowser(chromium)
let createdId
try {
  const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    }),
    errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('dialog', (d) => d.accept())
  await page.goto(origin + '/#projects')
  await page.locator('.project-card').nth(1).waitFor()
  assert.equal(
    await page.getByText('Demonstration', { exact: true }).count(),
    0,
  )
  assert.ok(
    (await page.locator('.project-card').first().boundingBox()).height < 100,
  )
  await page.screenshot({
    path: resolve(root, 'test-results/compact-projects.png'),
  })
  await page
    .getByRole('link')
    .filter({ hasText: 'Mill Creek Corner Infill' })
    .click()
  await page
    .getByRole('heading', { name: 'Mill Creek Corner Infill', exact: true })
    .waitFor()
  await expect(
    page.getByRole('button', { name: 'Reset workspace', exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByText('Prepared findings', { exact: true }),
  ).toHaveCount(0)
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: 'Reset workspace', exact: true }).waitFor()
  await page.keyboard.press('Escape')
  if (process.env.BASIS_TEST_DEMO_EDITS !== '0') {
    await page
      .getByRole('button', { name: 'Edit description', exact: true })
      .click()
    await page
      .getByLabel('Project description', { exact: true })
      .fill('Editable review scope')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.locator('.project-scope')).toHaveText(
      'Editable review scope',
    )
    await page.reload()
    await expect(page.locator('.project-scope')).toHaveText(
      'Editable review scope',
    )
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await page.getByRole('button', { name: 'Reset workspace', exact: true }).click()
    await page.getByRole('heading', { name: 'Projects', exact: true }).waitFor()
    await page
      .getByRole('link')
      .filter({ hasText: 'Mill Creek Corner Infill' })
      .click()
    await page
      .getByRole('heading', { name: 'Mill Creek Corner Infill', exact: true })
      .waitFor()
    await expect(page.locator('.project-scope')).not.toHaveText(
      'Editable review scope',
    )
  }
  await page.getByRole('link', { name: 'Projects', exact: true }).click()
  await page.getByRole('button', { name: 'New project', exact: true }).click()
  await page
    .getByLabel('Project name', { exact: true })
    .fill('Folder import review')
  await page
    .getByRole('combobox', { name: 'Reference Collections' })
    .fill('bridge')
  await page
    .getByRole('option')
    .filter({ hasText: 'Bridge Design & Highway Infrastructure' })
    .click()
  await expect(page.locator('.selected-documents input')).toHaveCount(3)
  await page.locator('.selected-documents input').first().uncheck()
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Select folder', exact: true }).click()
  await (await chooser).setFiles(folder)
  await expect(page.locator('.pending-files li')).toHaveCount(2)
  await page.getByRole('button', { name: 'Add PDFs', exact: true }).waitFor()
  await page.screenshot({
    path: resolve(root, 'test-results/compact-project-editor.png'),
  })
  await page
    .getByRole('button', { name: 'Create project', exact: true })
    .click()
  await page
    .getByRole('heading', { name: 'Folder import review', exact: true })
    .waitFor({ timeout: 60000 })
  createdId = page.url().split('#project/')[1]
  await expect(page.locator('.project-document-row')).toHaveCount(4)
  await expect(page.locator('.project-scope')).toContainText(
    'client requirements',
  )
  await expect(page.locator('.project-scope')).toContainText(
    'technical reports',
  )
  await page
    .getByRole('button', { name: 'Edit description', exact: true })
    .click()
  await page
    .getByLabel('Project description', { exact: true })
    .fill('Manual engineering scope')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.locator('.project-scope')).toHaveText(
    'Manual engineering scope',
  )
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page
    .getByRole('button', { name: 'Manage project', exact: true })
    .click()
  const files = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Add PDFs', exact: true }).click()
  await (
    await files
  ).setFiles(resolve(root, 'output/pdf/mill-creek-concept-design.pdf'))
  await page.getByRole('button', { name: 'Save project', exact: true }).click()
  await expect(page.locator('.project-document-row')).toHaveCount(5, {
    timeout: 60000,
  })
  await expect(page.locator('.project-scope')).toHaveText(
    'Manual engineering scope',
  )
  await page.reload()
  await expect(page.locator('.project-document-row')).toHaveCount(5)
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page
    .getByRole('button', { name: 'Delete project', exact: true })
    .click()
  await page.getByRole('heading', { name: 'Projects', exact: true }).waitFor()
  createdId = undefined
  const invalid = resolve(root, 'state/ui-invalid-file.pdf')
  writeFileSync(invalid, '%PDF-1.7\ninvalid document')
  await page.getByRole('button', { name: 'New project', exact: true }).click()
  await page
    .getByLabel('Project name', { exact: true })
    .fill('Import retry review')
  const retryFiles = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Add PDFs', exact: true }).click()
  await (
    await retryFiles
  ).setFiles([resolve(folder, 'bridge-client-brief.pdf'), invalid])
  const created = page.waitForResponse(
    (r) => r.url().endsWith('/v1/projects') && r.request().method() === 'POST',
  )
  await page
    .getByRole('button', { name: 'Create project', exact: true })
    .click()
  createdId = (await (await created).json()).project.id
  await expect(page.getByRole('alert')).toContainText('No searchable text', {
    timeout: 30000,
  })
  await page
    .getByRole('button', {
      name: 'Remove file ui-invalid-file.pdf',
      exact: true,
    })
    .click()
  await page.getByRole('button', { name: 'Save project', exact: true }).click()
  await page
    .getByRole('heading', { name: 'Import retry review', exact: true })
    .waitFor()
  await expect(page.locator('.project-document-row')).toHaveCount(1)
  await page.getByRole('button', { name: 'Query Files', exact: true }).click()
  await page
    .locator('#query')
    .fill('What is the overall width of each box planter?')
  await page.locator('#query').press('Enter')
  await expect(page.locator('.query-report')).toContainText('400 mm', {
    timeout: 30000,
  })
  await page
    .getByRole('button', { name: /^Source 1:/ })
    .first()
    .click()
  await page.locator('.source-highlight:visible').first().waitFor()
  await page.locator('.textLayer span').first().waitFor()
  await expect(page.locator('.live-mode')).toHaveCount(0)
  await page
    .getByRole('link', { name: 'Project dashboard', exact: true })
    .first()
    .click()
  await page
    .getByRole('heading', { name: 'Import retry review', exact: true })
    .waitFor()
  await expect(page.locator('.project-document-row')).toHaveCount(1)
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page
    .getByRole('button', { name: 'Delete project', exact: true })
    .click()
  await page.getByRole('heading', { name: 'Projects', exact: true }).waitFor()
  createdId = undefined
  await page.setViewportSize({ width: 390, height: 844 })
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  )
  assert.deepEqual(errors, [])
  console.log(
    'PASS compact overview, hidden reset settings, editable descriptions, searchable collection picker, individual selection, native folder/PDF import, indexing, auto/manual descriptions and deletion',
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

// Intentionally destructive; target is fixed to the isolated preview runtime.
import { chromium, expect } from '@playwright/test'
import assert from 'node:assert/strict'
const origin = 'http://127.0.0.1:8842/app',
  api = 'http://127.0.0.1:8842/local-api/v1',
  ids = []
async function create(name) {
  const r = await fetch(api + '/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, collectionIds: [] }),
  })
  assert.equal(r.status, 201)
  const p = (await r.json()).project
  ids.push(p.id)
  return p
}
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const keep = await create('Keep browser check'),
    drop = await create('Temporary browser check')
  const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    }),
    errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(origin + '/#project/' + keep.id)
  await page.getByRole('heading', { name: keep.name, exact: true }).waitFor()
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(
    page.getByRole('checkbox', { name: 'Keep on reset', exact: true }),
  ).not.toBeChecked()
  await page
    .getByRole('checkbox', { name: 'Keep on reset', exact: true })
    .check()
  await expect(
    page.getByRole('checkbox', { name: 'Keep on reset', exact: true }),
  ).toBeChecked()
  await page.reload()
  await page.getByRole('heading', { name: keep.name, exact: true }).waitFor()
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(
    page.getByRole('checkbox', { name: 'Keep on reset', exact: true }),
  ).toBeChecked()
  await page.screenshot({ path: 'test-results/demo-retention-settings.png' })
  await page.goto(origin + '/#project/demo-mill-creek')
  await page
    .getByRole('heading', { name: 'Mill Creek Corner Infill', exact: true })
    .waitFor()
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(
    page.getByRole('checkbox', { name: 'Keep on reset', exact: true }),
  ).toBeChecked()
  await expect(
    page.getByRole('checkbox', { name: 'Keep on reset', exact: true }),
  ).toBeDisabled()
  await page.goto(origin + '/#projects')
  await page.locator('.project-card').nth(1).waitFor()
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  page.once('dialog', (dialog) => {
    assert.ok(dialog.message().includes('will be deleted'))
    dialog.accept()
  })
  await page.getByRole('button', { name: 'Reset workspace', exact: true }).click()
  await expect(
    page.getByRole('link').filter({ hasText: drop.name }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('link').filter({ hasText: keep.name }),
  ).toHaveCount(1)
  await page.getByRole('link').filter({ hasText: keep.name }).click()
  await page.getByRole('heading', { name: keep.name, exact: true }).waitFor()
  await page.goto(origin + '/#project/' + keep.id + '/new')
  await page.locator('#query').waitFor()
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(
    page.getByRole('checkbox', { name: 'Keep on reset', exact: true }),
  ).toBeChecked()
  const patch = page.waitForResponse(
    (r) =>
      r.url().endsWith('/v1/projects/' + keep.id) &&
      r.request().method() === 'PATCH',
  )
  await page
    .getByRole('checkbox', { name: 'Keep on reset', exact: true })
    .uncheck()
  assert.equal((await patch).status(), 200)
  await page.keyboard.press('Escape')
  await page.goto(origin + '/#projects')
  await page.locator('.project-card').nth(1).waitFor()
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Reset workspace', exact: true }).click()
  await expect(
    page.getByRole('link').filter({ hasText: keep.name }),
  ).toHaveCount(0)
  await expect(page.locator('.project-card')).toHaveCount(2)
  assert.deepEqual(errors, [])
  console.log(
    'PASS subtle Settings persistence toggle, reload persistence, locked examples, global reset cleanup, and query-workspace opt-out',
  )
} finally {
  for (const id of ids)
    await fetch(api + '/projects/' + id, { method: 'DELETE' })
  await browser.close()
}

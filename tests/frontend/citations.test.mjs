import { test } from 'node:test'
import assert from 'node:assert/strict'
import { expect } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { setup, link, job, project, document, fixturePdf } from './fixture.mjs'

test('citation highlights both table cells at their text coordinates', async (t) => {
  const p = await setup(t)
  await p.goto(link('alpha', '/query/initial'))
  await p
    .getByRole('button', { name: /^Source 1:/ })
    .first()
    .click()
  const marks = p.locator('.source-highlight:visible')
  await expect(marks).toHaveCount(2)
  for (const [i, label] of ['Pipe S1', '200 mm'].entries()) {
    const text = p
      .locator('.textLayer span:visible')
      .filter({ hasText: label })
      .first()
    await expect(text).toBeVisible()
    const aligned = await text.evaluate((span, index) => {
      const pane = span.closest('.pdf-pane')
      const mark = pane
        .querySelectorAll('.source-highlight')
        [index].getBoundingClientRect()
      const cell = span.getBoundingClientRect()
      const x = cell.x + cell.width / 2,
        y = cell.y + cell.height / 2
      return (
        x >= mark.left && x <= mark.right && y >= mark.top && y <= mark.bottom
      )
    }, i)
    assert.ok(aligned, label)
  }
})

test('a missing citation rectangle cannot create a highlight or crash the report', async (t) => {
  const j = job('alpha')
  delete j.result.references[0].rect
  delete j.result.references[0].regions
  const p = await setup(t, (path) =>
    path.endsWith('/queries/initial') ? { json: j } : undefined,
  )
  await p.goto(link('alpha', '/query/initial'))
  await expect(p.getByRole('article')).toContainText('Verified alpha')
  await expect(p.locator('.source-highlight')).toHaveCount(0)
  await expect(p.getByRole('button', { name: /^Source 1:/ })).toHaveCount(0)
})

test('original EPCOR table cell stays aligned across zoom, split and narrow views', async (t) => {
  const pid = 'alpha',
    second = {
      ...document(pid),
      id: 'standard',
      title: 'EPCOR standard',
      label: 'Vol. 3-03',
      file: '/documents/design-guidelines.pdf',
      pages: 125,
      pageSizes: { 8: [612, 792] },
    }
  const j = job(pid)
  j.result.documents.push(second)
  j.result.references.push({
    id: '2',
    doc: 'standard',
    page: 8,
    label: 'Table 1.1',
    rect: [331.87, 152.16, 19.34, 11.12],
    regions: [[331.87, 152.16, 19.34, 11.12]],
  })
  j.result.report[0].sentences[0].refs.push('2')
  const p = await setup(t, (path) => {
    if (path.endsWith('/queries/initial')) return { json: j }
    if (path === '/v1/projects/alpha')
      return {
        json: {
          project: { ...project(pid), documentIds: ['doc-alpha', 'standard'] },
          documents: [document(pid), second],
          issues: [],
          collections: [],
          queries: [j],
        },
      }
  })
  await p.route('**/documents/design-guidelines.pdf', (r) =>
    r.fulfill({
      path: fileURLToPath(
        new URL(
          '../../public/documents/design-guidelines.pdf',
          import.meta.url,
        ),
      ),
      contentType: 'application/pdf',
    }),
  )
  await p.goto(link(pid, '/query/initial'))
  const select = p.getByRole('button', { name: /^Source 2:/ }).first()
  await select.click()
  async function check() {
    const pane = p.getByRole('region', { name: 'EPCOR standard', exact: true })
    await expect(
      pane.getByLabel('Page in EPCOR standard', { exact: true }),
    ).toHaveValue('8')
    await expect
      .poll(() =>
        pane.evaluate((el) => {
          const mark = el
            .querySelector('[data-reference="2"]')
            ?.getBoundingClientRect()
          if (!mark) return false
          return Array.from(el.querySelectorAll('.textLayer span')).some(
            (span) => {
              if (span.textContent.trim() !== '1.00') return false
              const b = span.getBoundingClientRect(),
                x = b.x + b.width / 2,
                y = b.y + b.height / 2
              return (
                x >= mark.left &&
                x <= mark.right &&
                y >= mark.top &&
                y <= mark.bottom
              )
            },
          )
        }),
      )
      .toBe(true)
  }
  await check()
  await p.getByLabel('Zoom in EPCOR standard', { exact: true }).click()
  await check()
  await p.getByRole('button', { name: 'Single document view' }).click()
  await p.setViewportSize({ width: 620, height: 850 })
  await p
    .getByRole('button', { name: /^Source 1:/ })
    .first()
    .click()
  await select.click()
  await check()
})

test('failed PDF can reload and exposes no highlight during the failure', async (t) => {
  const p = await setup(t)
  let failed = true
  await p.route('**/pdf/alpha', (r) =>
    failed
      ? r.fulfill({ status: 500, body: 'Failed' })
      : r.fulfill({ contentType: 'application/pdf', body: fixturePdf() }),
  )
  await p.goto(link('alpha', '/query/initial'))
  await p
    .getByRole('button', { name: /^Source 1:/ })
    .first()
    .click()
  await expect(p.getByText('Unable to render document.')).toBeVisible()
  await expect(p.locator('.source-highlight')).toHaveCount(0)
  failed = false
  await p.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(p.locator('.source-highlight:visible')).toHaveCount(2)
})

test('a delayed source load cannot draw into the next project', async (t) => {
  const p = await setup(t)
  let release, seen
  const pending = new Promise((r) => (release = r)),
    started = new Promise((r) => (seen = r))
  await p.route('**/pdf/alpha', async (r) => {
    seen()
    await pending
    await r.fulfill({ contentType: 'application/pdf', body: fixturePdf() })
  })
  await p.goto(link('alpha', '/query/initial'))
  await started
  await p.goto(link('beta', '/query/initial'))
  await p
    .getByRole('button', { name: /^Source 1:/ })
    .first()
    .click()
  await expect(
    p
      .getByRole('region', { name: 'Drawing beta', exact: true })
      .locator('.source-highlight'),
  ).toHaveCount(2)
  release()
  await expect(
    p.getByRole('region', { name: 'Drawing alpha', exact: true }),
  ).toHaveCount(0)
})

test('PDF page geometry is recovered when optional page sizes are absent', async (t) => {
  const doc = document('alpha')
  delete doc.pageSizes
  const p = await setup(t, (path) =>
    path === '/v1/projects/alpha'
      ? {
          json: {
            project: project('alpha'),
            documents: [doc],
            queries: [],
            issues: [],
            collections: [],
          },
        }
      : undefined,
  )
  await p.goto(link('alpha', '/query/initial'))
  await p
    .getByRole('button', { name: /^Source 1:/ })
    .first()
    .click()
  const canvas = p.locator('.pdf-pane canvas').first()
  await expect(p.locator('.source-highlight:visible')).toHaveCount(2)
  const size = await canvas.boundingBox()
  assert.ok(Math.abs(size.width / size.height - 400 / 500) < 0.01)
})
test('thumbnails follow the scoped file URL even when two projects reuse a document ID', async (t) => {
  const page = await setup(t, (path) => {
    const match = path.match(/^\/v1\/projects\/(alpha|beta)$/)
    if (!match) return
    const id = match[1],
      doc = { ...document(id), id: 'shared' }
    return {
      json: {
        project: { ...project(id), documentIds: ['shared'] },
        documents: [doc],
        issues: [],
        queries: [],
        collections: [],
      },
    }
  })
  await page.route('**/pdf/beta', (r) =>
    r.fulfill({
      body: fixturePdf('Beta cover sheet'),
      contentType: 'application/pdf',
    }),
  )
  const urls = []
  for (const id of ['alpha', 'beta']) {
    await page.goto(link(id, '/document/shared'))
    const image = page.locator('.minimap-page[data-page="1"] img')
    await expect(image).toBeVisible()
    urls.push(await image.getAttribute('src'))
  }
  assert.notEqual(urls[0], urls[1])
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { expect } from '@playwright/test'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { setup, link, project, document, fixturePdf } from './fixture.mjs'

test('ordinary project creation retries only failed imports and preserves manual descriptions', async (t) => {
  let created = 0,
    imports = 0,
    patch,
    selection,
    catalogDown = true
  const bytes = []
  const p = await setup(t, (path, req) => {
    if (path.endsWith('reference-collections')) {
      if (catalogDown)
        return { status: 503, json: { error: 'Index unavailable' } }
      return {
        json: {
          collections: [
            {
              id: 'c',
              title: 'Reference set',
              authority: 'City',
              jurisdiction: 'AB',
              documentIds: ['doc-alpha'],
              documentCount: 1,
            },
          ],
          documents: [document('alpha')],
        },
      }
    }
    if (path === '/v1/projects' && req.method() === 'POST') {
      created++
      selection = req.postDataJSON()
      return { json: { project: project('created') } }
    }
    if (path.endsWith('/documents/import')) {
      bytes.push(req.postDataJSON().content)
      imports++
      if (imports === 2) return { status: 422, json: { error: 'Index failed' } }
      return { status: 201, json: { documents: [{ id: 'import-' + imports }] } }
    }
    if (req.method() === 'PATCH') {
      patch = req.postDataJSON()
      return { json: { project: project('created') } }
    }
  })
  await p.goto('http://localhost/#projects')
  const opener = p.getByRole('button', { name: 'New project' })
  await opener.click()
  const modal = p.getByRole('dialog')
  await expect(modal.getByLabel('Project name')).toBeFocused()
  await modal.getByRole('button', { name: 'Close project editor' }).focus()
  await p.keyboard.press('Shift+Tab')
  await expect(
    modal.getByRole('button', { name: 'Cancel', exact: true }),
  ).toBeFocused()
  await p.keyboard.press('Escape')
  await expect(opener).toBeFocused()
  await opener.click()
  await expect(modal.getByRole('alert')).toContainText('Index unavailable')
  catalogDown = false
  await modal.getByRole('button', { name: 'Retry' }).click()
  await modal.getByLabel('Project name').fill('Water review')
  await modal.getByRole('combobox').fill('Reference set')
  await modal.getByRole('combobox').press('Enter')
  await modal.getByRole('checkbox').first().uncheck()
  await modal.locator('summary').click()
  await modal.getByPlaceholder('Automatic from documents').fill('Manual scope')
  await modal
    .getByLabel('Add PDF files', { exact: true })
    .setInputFiles(
      ['A', 'B'].map((v) => ({
        name: 'same.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from(v),
      })),
    )
  await modal
    .getByRole('button', { name: 'Create project', exact: true })
    .click()
  await expect(modal.getByRole('alert')).toContainText('same.pdf')
  assert.deepEqual(selection.documentIds, [])
  assert.equal(selection.description, 'Manual scope')
  await modal.getByRole('button', { name: 'Save project', exact: true }).click()
  await expect(modal).toHaveCount(0)
  assert.equal(created, 1)
  assert.equal(imports, 3)
  assert.equal(bytes[1], bytes[2])
  assert.notEqual(bytes[0], bytes[1])
  assert.deepEqual(patch.documentIds, ['import-1'])
})

test('switching project during metadata load prevents a late dashboard from appearing', async (t) => {
  let release, entered
  const pending = new Promise((r) => (release = r)),
    requested = new Promise((r) => (entered = r))
  const p = await setup(t, async (path) => {
    if (path === '/v1/projects/alpha') {
      entered()
      await pending
    }
  })
  await p.goto(link('alpha'))
  await requested
  await p.goto(link('beta'))
  await expect(
    p.getByRole('heading', { name: 'Project beta', exact: true }),
  ).toBeVisible()
  release()
  await expect(
    p.getByRole('link', { name: /Drawing beta/ }).first(),
  ).toBeVisible()
  await expect(p.getByRole('link', { name: /Drawing alpha/ })).toHaveCount(0)
})

test('folder import waits for indexing, regenerates description and deletes an ordinary project', async (t) => {
  const folder = await mkdtemp(join(tmpdir(), 'basis-ui-pdfs-'))
  t.after(() => rm(folder, { recursive: true, force: true }))
  await writeFile(join(folder, 'survey.pdf'), fixturePdf())
  await writeFile(join(folder, 'notes.txt'), 'other file')
  let indexed = false,
    removed = false,
    description = 'Edited scope',
    finish,
    seen
  const pending = new Promise((r) => (finish = r)),
    started = new Promise((r) => (seen = r))
  const p = await setup(t, async (path, req) => {
    if (path === '/v1/projects/alpha' && req.method() === 'PATCH') {
      description = req.postDataJSON().description || 'Generated from survey'
      return { json: { project: { ...project('alpha'), description } } }
    }
    if (path === '/v1/projects/alpha' && req.method() === 'DELETE') {
      removed = true
      return { json: { deleted: true } }
    }
    if (path === '/v1/projects/alpha') {
      const docs = indexed ? [document('alpha')] : []
      return {
        json: {
          project: {
            ...project('alpha'),
            documentIds: docs.map((d) => d.id),
            description,
            descriptionMode: 'manual',
          },
          documents: docs,
          queries: [],
          collections: [],
          issues: [],
        },
      }
    }
    if (path.endsWith('/documents/import')) {
      seen()
      await pending
      indexed = true
      return { status: 201, json: { documents: [document('alpha')] } }
    }
  })
  await p.goto(link('alpha'))
  await expect(p.getByRole('button', { name: 'Query Files' })).toBeDisabled()
  await p.getByRole('button', { name: 'Settings', exact: true }).click()
  await p.getByRole('button', { name: 'Manage project' }).click()
  const modal = p.getByRole('dialog')
  await modal.getByLabel('Select document folder').setInputFiles(folder)
  await expect(modal.getByRole('alert')).toContainText('excluded')
  await modal.locator('summary').click()
  await expect(modal.getByPlaceholder('Automatic from documents')).toHaveValue(
    'Edited scope',
  )
  await modal
    .getByRole('button', { name: 'Generate description from documents' })
    .click()
  await modal.getByRole('button', { name: 'Save project', exact: true }).click()
  await started
  await expect(modal.getByRole('status')).toContainText('Indexing')
  await expect(p.getByRole('button', { name: 'Query Files' })).toBeDisabled()
  finish()
  await expect(modal).toHaveCount(0)
  await expect(p.getByRole('button', { name: 'Query Files' })).toBeEnabled()
  await p.reload()
  await expect(
    p.getByText('Generated from survey', { exact: true }),
  ).toBeVisible()
  await p.getByRole('button', { name: 'Settings', exact: true }).click()
  p.once('dialog', (d) => d.accept())
  await p.getByRole('button', { name: 'Delete project' }).click()
  await expect(p).toHaveURL(/#projects$/)
  assert.ok(removed)
})

test('individually associated references can be deselected without selecting a collection', async (t) => {
  let updated
  const p = await setup(t, (path, req) => {
    if (req.method() === 'PATCH') {
      updated = req.postDataJSON()
      return { json: { project: project('alpha') } }
    }
  })
  await p.goto(link('alpha'))
  await p.getByRole('button', { name: 'Settings', exact: true }).click()
  await p.getByRole('button', { name: 'Manage project' }).click()
  const modal = p.getByRole('dialog'),
    checkbox = modal.getByRole('checkbox', { name: /Drawing alpha/ })
  await expect(checkbox).toBeChecked()
  await checkbox.uncheck()
  await modal.getByRole('button', { name: 'Save project', exact: true }).click()
  await expect(modal).toHaveCount(0)
  assert.deepEqual(updated.documentIds, [])
})

test('malformed or foreign project metadata gives a recoverable error', async (t) => {
  let bad = true
  const p = await setup(t, (path) => {
    if (path !== '/v1/projects/alpha') return
    const doc = document('alpha')
    if (bad) doc.file = 'https://unexpected.invalid/private.pdf'
    return {
      json: {
        project: project('alpha'),
        documents: [doc],
        collections: [],
        issues: [],
        queries: [],
      },
    }
  })
  await p.goto(link('alpha', '/document/doc-alpha'))
  await expect(p.getByRole('alert')).toContainText('different server')
  bad = false
  await p.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(p.locator('.textLayer span:visible').first()).toBeVisible()
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import { resolve } from 'node:path'

test('create from references and a categorized upload, then rename and reload', async () => {
  const browser = await chromium.launch({ channel: 'chrome' })
  try {
    const page = await browser.newPage()
    const ref = {
      id: 'criteria',
      title: 'Design criteria',
      label: 'Standard',
      category: 'reference',
      edition: '2025',
      pages: 2,
    }
    const uploaded = {
      id: 'upload',
      title: 'Field notes',
      label: 'Field notes',
      category: 'supporting',
      projectArtifact: true,
      pages: 1,
    }
    const collection = {
      id: 'standards',
      title: 'Municipal standards',
      documentIds: [ref.id],
      documentCount: 1,
      authority: 'Municipality',
    }
    let project
    const docs = [ref]
    let submittedCategory
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url())
      assert.equal(url.hostname, 'localhost')
      const path = url.pathname
      if (!path.startsWith('/local-api/'))
        return route.fulfill({
          path: resolve('dist', '.' + (path === '/' ? '/index.html' : path)),
        })
      const method = route.request().method()
      let json
      if (path.endsWith('/reference-collections'))
        json = { documents: [ref], collections: [collection] }
      else if (path.endsWith('/documents/import')) {
        submittedCategory = route.request().postDataJSON().category
        docs.push(uploaded)
        project.documentIds.push(uploaded.id)
        json = { project, documents: [uploaded] }
      } else if (path.endsWith('/projects') && method === 'POST') {
        project = { ...route.request().postDataJSON(), id: 'ordinary' }
        json = { project }
      } else if (path.endsWith('/projects'))
        json = { projects: project ? [project] : [] }
      else if (path.endsWith('/projects/ordinary') && method === 'PATCH') {
        Object.assign(project, route.request().postDataJSON())
        json = { project }
      } else if (path.endsWith('/projects/ordinary'))
        json = {
          project,
          documents: docs,
          collections: [collection],
          issues: [],
          queries: [],
        }
      else
        return route.fulfill({
          status: 404,
          json: { error: 'Unknown endpoint' },
        })
      return route.fulfill({ json })
    })
    await page.goto('http://localhost/#projects')
    const button = (name) => page.getByRole('button', { name, exact: true })
    await button('New project').click()
    await page.getByLabel('Project name', { exact: true }).fill('First name')
    await page
      .getByRole('combobox', { name: 'Reference Collections' })
      .fill('municipal')
    await page.getByRole('option').first().click()
    await page
      .getByLabel('Add PDF files')
      .setInputFiles({
        name: 'field.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4'),
      })
    await page.getByLabel('Type for field.pdf').selectOption('report')
    await button('Create project').click()
    await page
      .getByRole('heading', { name: 'First name', exact: true })
      .waitFor()
    assert.deepEqual(project.collectionIds, ['standards'])
    assert.equal(submittedCategory, 'report')
    const reports = page
      .locator('details.project-document-group')
      .filter({ has: page.getByRole('heading', { name: /Technical reports/ }) })
    await reports.getByText('Field notes', { exact: true }).waitFor()
    await button('Rename project').click()
    await page
      .getByLabel('Project name', { exact: true })
      .fill('Renamed project')
    await button('Save').click()
    await page.getByRole('heading', { name: 'Renamed project' }).waitFor()
    await page.reload()
    await page.getByRole('heading', { name: 'Renamed project' }).waitFor()
    await reports.getByText('Field notes', { exact: true }).waitFor()
    await button('Settings').click()
    await button('Manage project').click()
    await page.getByLabel('Type for Field notes').selectOption('design')
    await button('Save project').click()
    await page
      .locator('details.project-document-group')
      .filter({ has: page.getByRole('heading', { name: /Design documents/ }) })
      .getByText('Field notes', { exact: true })
      .waitFor()
  } finally {
    await browser.close()
  }
})

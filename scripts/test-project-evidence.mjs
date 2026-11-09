import test from 'node:test'
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { chromium, expect } from '@playwright/test'

test('recover the project connection and open cited evidence from project history', async () => {
  const browser = await chromium.launch({ channel: 'chrome' })
  try {
    const page = await browser.newPage()
    const doc = {
      id: 'criteria',
      title: 'Drainage design guidelines',
      label: 'Vol. 3-03',
      category: 'reference',
      edition: 'May 2025',
      pages: 125,
      initialPage: 1,
      file: '/documents/design-guidelines.pdf',
      pageSizes: { 8: [612, 792] },
    }
    const project = {
      id: 'review',
      name: 'Servicing review',
      collectionIds: [],
      documentIds: [doc.id],
      documentCount: 1,
      openIssueCount: 0,
    }
    const job = {
      id: 'grade',
      projectId: project.id,
      question: 'What is the upstream grade?',
      state: 'completed',
      createdAt: '2026-11-08',
      result: {
        mode: 'extractive_answer',
        notes: [],
        documents: [doc],
        references: [
          {
            id: '1',
            doc: doc.id,
            page: 8,
            label: 'Table 1.1',
            rect: [331.87, 152.16, 19.34, 11.12],
          },
        ],
        report: [
          { sentences: [{ text: 'The table lists 1.00%.', refs: ['1'] }] },
        ],
      },
    }
    let submittedJob
    let available = false
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url())
      assert.equal(url.hostname, 'localhost')
      const path = url.pathname
      if (!path.startsWith('/local-api/'))
        return route.fulfill({
          path: resolve('dist', '.' + (path === '/' ? '/index.html' : path)),
        })
      if (path === '/local-api/v1/projects')
        return available
          ? route.fulfill({ json: { projects: [project] } })
          : route.fulfill({ status: 404, json: { error: 'Not found' } })
      if (path === '/local-api/v1/projects/review')
        return route.fulfill({
          json: {
            project,
            documents: [doc],
            queries: [job],
            issues: [],
            collections: [],
          },
        })
      if (path === '/local-api/v1/projects/review/queries/grade')
        return route.fulfill({ json: job })
      if (
        path === '/local-api/v1/projects/review/queries' &&
        route.request().method() === 'POST'
      ) {
        const { question, id } = route.request().postDataJSON()
        assert.equal(question, 'Check the design grade')
        submittedJob = { ...job, id, question }
        return route.fulfill({ json: submittedJob })
      }
      if (
        submittedJob &&
        path === '/local-api/v1/projects/review/queries/' + submittedJob.id
      )
        return route.fulfill({ json: submittedJob })
      throw new Error('Unexpected API request: ' + path)
    })
    await page.goto('http://localhost/#projects')
    await expect(page.getByRole('alert')).toContainText('project workspace API')
    available = true
    await page.getByRole('button', { name: 'Retry' }).click()
    await page.getByRole('link', { name: /Servicing review/ }).click()
    await page.getByRole('link', { name: /What is the upstream grade/ }).click()
    await page.locator('.citations button').first().click()
    const pane = page.locator('.pdf-pane:visible')
    await expect(pane.locator('.page-control input')).toHaveValue('8')
    const mark = pane.locator('.source-highlight').first()
    await expect(mark).toBeVisible()
    await expect(pane.locator('.textLayer')).toContainText('1.00')
    await page.reload()
    await expect(page.locator('.query-report')).toContainText('1.00%')
    await page
      .getByRole('link', { name: 'Project dashboard', exact: true })
      .first()
      .click()
    await expect(
      page.getByRole('heading', { name: 'Servicing review', exact: true }),
    ).toBeVisible()
    await page
      .getByRole('button', { name: 'New query', exact: true })
      .first()
      .click()
    await page.locator('#query').fill('Check the design grade')
    await page.getByRole('button', { name: 'Search', exact: true }).click()
    await expect(page.locator('.query-report')).toContainText('1.00%')
  } finally {
    await browser.close()
  }
})

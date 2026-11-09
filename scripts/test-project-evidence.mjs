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
    const drawings = {
      ...doc,
      id: 'sheet',
      category: 'design',
      label: 'Drawing',
    }
    const brief = {
      ...doc,
      id: 'brief',
      category: 'client',
      label: 'Owner brief',
    }
    const sources = [doc, drawings, brief]
    const review = {
      ...job,
      id: 'finding',
      result: {
        ...job.result,
        documents: sources,
        references: sources.map((d, i) => ({
          ...job.result.references[0],
          doc: d.id,
          id: String(i + 1),
        })),
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
            documents: sources,
            queries: [job],
            issues: [
              {
                id: 'check',
                status: 'open',
                verified: true,
                title: 'Check design criterion',
                queryId: 'finding',
                citations: [],
              },
            ],
            comparison: {
              modelCount: 2,
              errors: [],
              coverage: Array.from({ length: 17 }, (_, i) => ({
                doc: 'file-' + i,
                label: 'Document ' + i,
                category: 'reference',
                checks: i < 4 ? 2 : 0,
                reason: 'No matching element identifier.',
              })),
            },
            collections: [],
          },
        })
      if (path === '/local-api/v1/projects/review/queries/finding')
        return route.fulfill({ json: review })
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
    const scanButton = page.getByRole('button', { name: 'Scan details' })
    const issues = page.getByRole('region', { name: 'Potential issues' })
    const before = await issues.boundingBox()
    await scanButton.click()
    const scan = page.getByRole('dialog', { name: 'IFC scan coverage' })
    await expect(scan).toContainText('4 of 17 files compared against 2 models')
    await expect(scan.getByRole('listitem')).toHaveCount(4)
    await scan.getByRole('button', { name: 'Not compared (13)' }).click()
    await expect(scan.getByRole('listitem')).toHaveCount(13)
    assert.equal((await issues.boundingBox()).height, before.height)
    assert(
      await scan
        .locator('.scan-list')
        .evaluate((el) => el.scrollHeight > el.clientHeight),
    )
    await page.keyboard.press('Escape')
    await expect(scanButton).toBeFocused()
    await page.getByText('Check design criterion', { exact: true }).click()
    await page.getByRole('button', { name: 'Inspect evidence' }).click()
    const visiblePanes = page.locator('.pdf-pane:visible')
    await expect(visiblePanes).toHaveCount(2)
    await expect(visiblePanes.locator('[data-reference="2"]')).toBeVisible()
    await expect(visiblePanes.locator('[data-reference="1"]')).toBeVisible()
    await page.getByRole('tab', { name: /Owner brief/ }).click()
    await expect(visiblePanes.locator('[data-reference="2"]')).toBeVisible()
    await expect(visiblePanes.locator('[data-reference="3"]')).toBeVisible()
    await page.getByRole('button', { name: 'Pin Owner brief' }).click()
    await page.getByRole('tab', { name: /Vol. 3-03/ }).click()
    await expect(visiblePanes.locator('[data-reference="1"]')).toBeVisible()
    await expect(visiblePanes.locator('[data-reference="3"]')).toBeVisible()
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(visiblePanes).toHaveCount(1)
    await page.setViewportSize({ width: 1366, height: 768 })
    await page
      .getByRole('link', { name: 'Project dashboard', exact: true })
      .first()
      .click()
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

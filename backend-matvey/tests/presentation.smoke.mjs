// Read-only presenter check: never resets projects, dismissals or query history.
import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'

const frontend = process.env.BASIS_FRONTEND_URL || 'http://127.0.0.1:8812/app'
const base = new URL('/local-api', frontend).href
async function get(path) {
  const response = await fetch(base + path, {
    signal: AbortSignal.timeout(15000),
  })
  assert.ok(response.ok, `${path}: HTTP ${response.status}`)
  return response.json()
}
const health = await get('/health')
assert.ok(
  health.ready && !health.failures,
  'Index must be ready without failures',
)
const projects = (await get('/v1/projects')).projects
const demos = []
for (const id of ['demo-mill-creek', 'demo-willow-creek']) {
  assert.equal(
    projects.filter((p) => p.id === id).length,
    1,
    'One seed per stable ID',
  )
  const data = await get('/v1/projects/' + id)
  assert.equal(data.project.protectedDemo, true)
  assert.ok(data.documents.length >= 6)
  assert.ok(
    data.issues.length >= 2 &&
      data.issues.every((i) => i.verified && i.citations.length >= 2),
  )
  for (const document of data.documents) {
    if (document.projectArtifact) assert.equal(document.ownerProjectId, id)
    const response = await fetch(
      base + '/v1/projects/' + id + '/documents/' + document.id + '/file',
      {
        headers: { Range: 'bytes=0-3' },
        signal: AbortSignal.timeout(15000),
      },
    )
    assert.equal(response.status, 206, document.title)
    assert.equal(await response.text(), '%PDF')
  }
  const seededQueryIds = new Set(data.issues.map((issue) => issue.queryId))
  const queries = data.queries.filter((q) => seededQueryIds.has(q.id))
  assert.ok(queries.length >= 2)
  for (const query of queries) {
    const job = await get('/v1/projects/' + id + '/queries/' + query.id)
    assert.equal(job.state, 'completed')
    assert.equal(job.stale, false)
    assert.equal(job.result.mode, 'prepared_comparison')
    assert.ok(
      job.result.references.every(
        (r) => data.project.documentIds.includes(r.doc) && r.regions.length > 0,
      ),
    )
  }
  demos.push({ ...data, query: queries[0] })
}
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(frontend + '/#projects')
  await page.locator('.project-card').nth(1).waitFor()
  for (const demo of demos) {
    await page.goto(frontend + '/#project/' + demo.project.id)
    await expect(page.locator('.project-document-row')).toHaveCount(
      demo.documents.length,
    )
    await expect(
      page.getByLabel('Delete project', { exact: true }),
    ).toHaveCount(0)
    await page.goto(
      frontend + '/#project/' + demo.project.id + '/query/' + demo.query.id,
    )
    await page.getByRole('article', { name: 'Query report' }).waitFor()
    await page
      .getByRole('button', { name: /^Source 1:/ })
      .first()
      .click()
    await page.locator('.source-highlight:visible').first().waitFor()
    await page.waitForFunction(
      () => document.querySelectorAll('.pdf-status').length === 0,
      null,
      { timeout: 30000 },
    )
    await page.locator('.textLayer span').first().waitFor()
    await page
      .getByRole('link', { name: 'Project dashboard', exact: true })
      .click()
    await page
      .getByRole('heading', { name: demo.project.name, exact: true })
      .waitFor()
  }
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
}
console.log(
  'PASS presentation ready: two protected projects, every associated PDF, prepared evidence, rendered citations and dashboard navigation; no project state changed',
)

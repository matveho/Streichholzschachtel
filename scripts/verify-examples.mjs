import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'

const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  })
  // These checks cover the standalone example workspace. The project UI has
  // its own live backend checks; keep service availability out of this fixture.
  await page.route('**/v1/projects', (route) =>
    route.fulfill({ status: 404, contentType: 'application/json', body: '{}' }),
  )
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  const examples = [
    {
      id: 'cover',
      title: 'Shallow sewer cover review',
      expected: ['0.3 m', '0.4 m', '2.4 m'],
      firstPage: '11',
      pageInput: 'Page in Design Guidelines',
      refs: ['17', '18', '19', '20'],
      sources: 2,
    },
    {
      id: 'expansion',
      title: 'Drainage capacity after expansion',
      expected: [
        '1.50 m³/s',
        '0.60 m³/s',
        'all stormwater management storage facilities',
      ],
      firstPage: '10',
      pageInput: 'Page in Design Guidelines',
      refs: ['1', '2', '3', '4', '7', '8', '9', '21', '22'],
      sources: 2,
    },
    {
      id: 'acceptance',
      title: 'LID infiltration acceptance',
      expected: ['minimum of two locations', '75–85%', '95%', 'exemption'],
      firstPage: '97',
      pageInput: 'Page in Stormwater Management & Design Manual',
      refs: ['12', '16', '23', '24', '25', '26', '27'],
      sources: 3,
    },
  ]
  await mkdir('test-results', { recursive: true })
  await page.goto('http://127.0.0.1:5173/#home')
  await page
    .getByRole('heading', { name: 'Previous queries', exact: true })
    .waitFor()
  assert.equal(await page.locator('.history-entry').count(), 5)
  for (const example of examples) {
    await page.getByRole('link', { name: new RegExp(example.title) }).click()
    const report = page.getByRole('article', { name: 'Query report' })
    await report.waitFor()
    for (const text of example.expected)
      assert.ok(
        (await report.innerText()).includes(text),
        `${example.id} includes ${text}`,
      )
    assert.equal(await page.getByRole('tab').count(), example.sources)
    assert.equal(
      await page
        .getByRole('spinbutton', { name: example.pageInput, exact: true })
        .inputValue(),
      example.firstPage,
      'Initial cited page opens, rather than the document default',
    )
    const labels = await report
      .getByRole('button', { name: /^Source / })
      .evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')))
    const citedIds = [
      ...new Set(labels.map((label) => label.match(/^Source (\d+):/)[1])),
    ].sort()
    assert.deepEqual(
      citedIds,
      [...example.refs].sort(),
      'Report citations resolve within this query',
    )
    for (const id of example.refs) {
      await report
        .getByRole('button', { name: new RegExp(`^Source ${id}:`) })
        .first()
        .click()
      await page
        .getByRole('heading', { name: 'Query result', exact: true })
        .hover()
      await page.waitForFunction((id) => {
        const el = document.querySelector(`[data-reference="${id}"]`)
        if (!el) return false
        const viewer = el.closest('.pdf-scroll'),
          rect = el.getBoundingClientRect(),
          bounds = viewer.getBoundingClientRect()
        return rect.top >= bounds.top && rect.bottom <= bounds.bottom
      }, id)
      assert.equal(await page.locator('.pane-slot:not(.hidden)').count(), 2)
    }
    await page
      .getByRole('button', { name: 'Expand result panel', exact: true })
      .click()
    await page.screenshot({ path: `test-results/${example.id}-report.png` })
    await page
      .getByRole('button', { name: 'Restore result panel', exact: true })
      .click()
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.getByRole('button', { name: 'Copy', exact: true }).click()
    const copied = await page.evaluate(() => navigator.clipboard.readText())
    assert.ok(copied.includes(example.expected[0]))
    for (const id of example.refs)
      assert.ok(copied.includes(`[${id}]`), `Export includes source ${id}`)
    await page.getByRole('link', { name: 'Home', exact: true }).click()
  }
  await page.reload()
  assert.equal(await page.locator('.history-entry').count(), 5)
  await page.goto('http://127.0.0.1:5173/')
  assert.match(await page.locator('#query').inputValue(), /20 ha/)
  assert.deepEqual(errors, [])
  console.log(
    'PASS: five history examples, three decision reports, numerical conclusions, all 20 source links, correct initial pages, two/three-source comparison, exports, reload, original landing screen, and browser errors.',
  )
} finally {
  await browser.close()
}

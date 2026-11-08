import { test } from 'node:test'
import assert from 'node:assert/strict'
import { expect } from '@playwright/test'
import { setup, link, job, project, document } from './fixture.mjs'

test('failed follow-up preserves the previous answer and reports the failure', async (t) => {
  const p = await setup(t, (path, req) =>
    req.method() === 'POST' && path.endsWith('/queries')
      ? { json: { id: 'failed', state: 'failed', error: 'Index disconnected' } }
      : undefined,
  )
  await p.goto(link('alpha', '/query/initial'))
  await expect(p.getByRole('article')).toContainText('Verified alpha initial')
  await p.locator('#query').fill('Check again')
  await p.locator('.run-query').click()
  await expect(p.getByRole('alert')).toContainText('Index disconnected')
  await expect(p.getByRole('article')).toContainText('Verified alpha initial')
})

test('late response cannot take over a different unsent tab', async (t) => {
  let release, received
  const pending = new Promise((r) => (release = r)),
    posted = new Promise((r) => (received = r))
  const p = await setup(t, async (path, req) => {
    if (req.method() === 'POST' && path.endsWith('/queries')) {
      received()
      await pending
      return { json: job('alpha', 'late') }
    }
  })
  await p.goto(link('alpha', '/new'))
  const isSubmission = (request) => request.method() === 'POST'
  const settled = Promise.race(
    ['requestfinished', 'requestfailed'].map((event) =>
      p.waitForEvent(event, { predicate: isSubmission, timeout: 5000 }),
    ),
  )
  await p.locator('#query').fill('first')
  await p.locator('.run-query').click()
  await posted
  await p.getByLabel('Open new query tab').click()
  await p.locator('#query').fill('second')
  release()
  await settled
  await p.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  )
  await expect(p.getByRole('article')).toHaveCount(0)
  await expect(p.locator('#query')).toHaveValue('second')
  assert.ok(p.url().endsWith('/new'))
})

test('renaming, history, Back, refresh and closing tabs preserve project boundaries', async (t) => {
  const p = await setup(t)
  await p.goto(link('alpha', '/new'))
  await p.locator('#query').fill('draft alpha')
  await p.getByLabel('Open new query tab').click()
  await p.locator('#query').fill('other draft')
  await p.getByRole('button', { name: 'Query 1', exact: true }).dblclick()
  await p.getByLabel('Rename query tab').fill('Review')
  await p.getByLabel('Rename query tab').press('Enter')
  await p.reload()
  await expect(p.locator('#query')).toHaveValue('draft alpha')
  await p.goto(link('alpha'))
  await p.getByRole('link', { name: /Question initial/ }).click()
  await expect(p.getByRole('article')).toContainText('Verified alpha')
  await p.goBack()
  await p.goForward()
  await expect(p.locator('.query-tab')).toHaveCount(3)
  await p.getByRole('button', { name: 'Review', exact: true }).click()
  await expect(p.locator('#query')).toHaveValue('draft alpha')
  await p.goto(link('beta', '/new'))
  await expect(p.locator('#query')).toHaveValue('')
  await expect(p.locator('.query-tab')).toHaveCount(1)
  await p.getByLabel('Close Query 1').click()
  await expect(p).toHaveURL(link('beta'))
})

test('scope errors, stale jobs and failed project metadata can recover', async (t) => {
  let down = true,
    state = 'foreign'
  const p = await setup(t, (path) => {
    if (path === '/v1/projects' && down)
      return { status: 503, json: { error: 'Indexing project files' } }
    if (path.endsWith('/queries/initial')) {
      const j = job('alpha')
      if (state === 'foreign') j.projectId = 'beta'
      if (state === 'stale') j.stale = true
      return { json: j }
    }
  })
  await p.goto(link('alpha', '/query/initial'))
  await expect(p.getByRole('alert')).toContainText('Indexing')
  down = false
  await p.getByRole('button', { name: 'Retry' }).click()
  await expect(p.getByRole('alert')).toContainText('does not belong')
  state = 'stale'
  await p.getByRole('button', { name: 'Retry' }).click()
  await expect(p.getByText(/cached answer is withheld/)).toBeVisible()
  await expect(p.getByRole('article')).toHaveCount(0)
  state = 'valid'
  await p.reload()
  await expect(p.getByRole('article')).toContainText('Verified alpha')
})

test('an explicitly empty query selection survives a follow-up', async (t) => {
  let submitted
  const p = await setup(t, (path, req) => {
    if (path.endsWith('/queries/initial'))
      return {
        json: {
          ...job('alpha'),
          documentIds: [],
          result: {
            mode: 'no_evidence',
            notes: [],
            report: [],
            references: [],
            documents: [],
          },
        },
      }
    if (req.method() === 'POST') {
      submitted = req.postDataJSON()
      return { json: job('alpha', 'next') }
    }
  })
  await p.goto(link('alpha', '/query/initial'))
  await expect(p.locator('#query')).toHaveValue('Question initial')
  await p.locator('#query').fill('next')
  await p.locator('.run-query').click()
  await expect(p.getByRole('article')).toContainText('Verified alpha next')
  assert.deepEqual(submitted.documentIds, [])
})

test('query sources belonging to another project are withheld', async (t) => {
  const j = job('alpha')
  j.result.documents = [document('beta')]
  const p = await setup(t, (path) =>
    path.endsWith('/queries/initial') ? { json: j } : undefined,
  )
  await p.goto(link('alpha', '/query/initial'))
  await expect(
    p.getByText('A query source is unavailable in this project.'),
  ).toBeVisible()
  await expect(p.getByRole('article')).toHaveCount(0)
})

test('clarification preserves the prior result until the queued answer and records the choice', async (t) => {
  const initial = job('alpha')
  initial.result.assist = {
    outcome: 'answered',
    details: [],
    clarifications: [
      {
        question: 'Which pipe?',
        options: [{ label: 'Sanitary', question: 'Check the sanitary pipe' }],
      },
    ],
  }
  let polls = 0,
    submitted
  const p = await setup(t, (path, req) => {
    if (path.endsWith('/queries/initial')) return { json: initial }
    if (req.method() === 'POST') {
      submitted = req.postDataJSON()
      return { json: { id: 'follow', state: 'queued', projectId: 'alpha' } }
    }
    if (path.endsWith('/queries/follow'))
      return {
        json:
          ++polls === 1
            ? { id: 'follow', state: 'running', projectId: 'alpha' }
            : job('alpha', 'follow'),
      }
  })
  await p.goto(link('alpha', '/query/initial'))
  await p.getByRole('button', { name: 'Not what you meant?' }).click()
  await p.getByRole('button', { name: 'Sanitary', exact: true }).click()
  await expect(p.getByRole('article')).toContainText('Verified alpha initial')
  await expect(p.getByRole('article')).toContainText('Verified alpha follow')
  await expect(p.getByLabel('Conversation so far')).toContainText('Sanitary')
  assert.equal(submitted.question, 'Check the sanitary pipe')
  assert.equal(await p.locator('.query-tab').count(), 1)
})

test('Back restores the active unsent draft without adding a tab', async (t) => {
  const p = await setup(t)
  await p.goto(link('alpha', '/new'))
  await p.locator('#query').fill('Draft one')
  await p.getByLabel('Open new query tab').click()
  await p.locator('#query').fill('Draft two')
  await p.goto(link('alpha', '/query/initial'))
  await expect(p.getByRole('article')).toBeVisible()
  await p.goBack()
  await expect(p.locator('#query')).toHaveValue('Draft two')
  await expect(p.locator('.query-tab')).toHaveCount(3)
})

test('a late completion cannot replace a newer answer after switching projects', async (t) => {
  let release, seen
  const pending = new Promise((r) => (release = r)),
    started = new Promise((r) => (seen = r))
  const p = await setup(t, async (path, req) => {
    if (req.method() === 'POST' && path.includes('/alpha/')) {
      seen()
      await pending
      return { json: job('alpha', 'old') }
    }
    if (req.method() === 'POST') return { json: job('beta', 'newest') }
  })
  await p.goto(link('alpha', '/new'))
  await p.locator('#query').fill('alpha search')
  await p.locator('.run-query').click()
  await started
  await p.goto(link('beta', '/new'))
  await p.locator('#query').fill('beta search')
  await p.locator('.run-query').click()
  await expect(p.getByRole('article')).toContainText('Verified beta newest')
  release()
  await p.reload()
  await expect(p.getByRole('article')).toContainText('Verified beta newest')
  await expect(p.getByText('Verified alpha old')).toHaveCount(0)
})

test('no-evidence guidance and saved history remain accessible by keyboard', async (t) => {
  const j = job('alpha')
  j.saved = true
  j.result = {
    documents: [],
    references: [],
    report: [],
    mode: 'no_evidence',
    notes: [],
    assist: {
      outcome: 'not_found',
      missing: 'soil investigation',
      clarifications: [],
      details: [],
    },
  }
  const p = await setup(t, (path) =>
    path === '/v1/projects/alpha'
      ? {
          json: {
            project: project('alpha'),
            documents: [document('alpha')],
            queries: [j],
            collections: [],
            issues: [],
          },
        }
      : path.endsWith('/queries/initial')
        ? { json: j }
        : undefined,
  )
  await p.goto(link('alpha'))
  await p.getByRole('button', { name: 'Saved', exact: true }).press('Enter')
  await p.getByRole('link', { name: /Question initial/ }).press('Enter')
  await expect(p.getByText(/soil investigation/).first()).toBeVisible()
  await expect(p.locator('.source-highlight')).toHaveCount(0)
})

test('cancelling a polled query permits a retry without reviving the cancelled answer', async (t) => {
  let cancelled = false
  const p = await setup(t, (path, req) => {
    if (path.endsWith('/queries/working')) {
      if (req.method() === 'DELETE') {
        cancelled = true
        return { json: { cancelled: true } }
      }
      return {
        json: {
          ...job('alpha', 'working'),
          result: undefined,
          state: 'running',
        },
      }
    }
    if (req.method() === 'POST') return { json: job('alpha', 'retry') }
  })
  await p.goto(link('alpha', '/query/working'))
  const cancel = p.getByRole('button', { name: 'Cancel', exact: true })
  await cancel.click()
  await expect(p.getByText('Query cancelled.')).toBeVisible()
  await expect.poll(() => cancelled).toBe(true)
  await p.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(p.getByRole('article')).toContainText('Verified alpha retry')
})

test('keyboard rename supports save and Escape without losing tab focus', async (t) => {
  const p = await setup(t)
  await p.goto(link('alpha', '/new'))
  const tab = p.getByRole('button', { name: 'Query 1', exact: true })
  await tab.press('F2')
  const edit = p.getByLabel('Rename query tab')
  await edit.fill('discarded')
  await edit.press('Escape')
  await expect(tab).toBeFocused()
  await tab.press('F2')
  await edit.fill('Inspection')
  await edit.press('Enter')
  await expect(
    p.getByRole('button', { name: 'Inspection', exact: true }),
  ).toBeFocused()
})

test('waiting for a saved query never substitutes a different saved answer', async (t) => {
  let release, seen
  const pending = new Promise((r) => (release = r)),
    started = new Promise((r) => (seen = r))
  const p = await setup(t, async (path) => {
    if (path.endsWith('/queries/second')) {
      seen()
      await pending
      return { json: job('alpha', 'second') }
    }
  })
  await p.goto(link('alpha', '/query/initial'))
  await expect(p.getByRole('article')).toContainText('Verified alpha initial')
  await p.goto(link('alpha', '/query/second'))
  await started
  await expect(p.getByText('Verified alpha initial')).toHaveCount(0)
  release()
  await expect(p.getByRole('article')).toContainText('Verified alpha second')
})

test('rapid new-tab clicks produce independent tabs and drafts', async (t) => {
  const p = await setup(t)
  await p.goto(link('alpha', '/new'))
  const add = p.getByLabel('Open new query tab')
  await add.evaluate((button) => {
    for (let i = 0; i < 8; i++) button.click()
  })
  await expect(p.locator('.query-tab')).toHaveCount(9)
  await p.locator('#query').fill('ninth')
  await p.getByRole('button', { name: 'Query 1', exact: true }).click()
  await expect(p.locator('#query')).toHaveValue('')
  await p.getByRole('button', { name: 'Query 9', exact: true }).click()
  await expect(p.locator('#query')).toHaveValue('ninth')
})

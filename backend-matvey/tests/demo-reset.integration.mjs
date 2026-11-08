// Destructive workspace reset is tested ONLY against isolated preview storage.
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
const root = fileURLToPath(new URL('..', import.meta.url)),
  base = 'http://127.0.0.1:8842/local-api',
  ids = []
async function request(path, method = 'GET', body) {
  const r = await fetch(base + '/v1' + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  return { status: r.status, data: await r.json() }
}
async function ready() {
  for (let i = 0; i < 120; i++) {
    try {
      if ((await (await fetch(base + '/health')).json()).ready) return
    } catch {}
    await new Promise((r) => setTimeout(r, 250))
  }
  throw Error('Preview API not ready')
}
async function query(id) {
  let j = (
    await request('/projects/' + id + '/queries', 'POST', {
      question: 'What is the overall width of each box planter?',
      sourceOnly: true,
    })
  ).data
  for (let i = 0; i < 80 && ['queued', 'running'].includes(j.state); i++) {
    await new Promise((r) => setTimeout(r, 100))
    j = (await request('/projects/' + id + '/queries/' + j.id)).data
  }
  assert.equal(j.state, 'completed')
  return j
}
try {
  await ready()
  const create = async (name) => {
    const r = await request('/projects', 'POST', { name, collectionIds: [] })
    assert.equal(r.status, 201)
    ids.push(r.data.project.id)
    return r.data.project
  }
  const keep = await create('Retained reset check'),
    remove = await create('Temporary reset check')
  assert.equal(keep.persistOnReset, false)
  assert.equal(
    (await request('/projects/' + keep.id, 'PATCH', { persistOnReset: true }))
      .status,
    200,
  )
  const content = readFileSync(
    resolve(root, 'output/pdf/mill-creek-client-brief.pdf'),
  ).toString('base64')
  for (const p of [keep, remove])
    assert.equal(
      (
        await request('/projects/' + p.id + '/documents/import', 'POST', {
          name: 'client-brief.pdf',
          content,
        })
      ).status,
      201,
    )
  const keptQuery = await query(keep.id),
    removedQuery = await query(remove.id)
  for (const id of ['demo-mill-creek', 'demo-willow-creek']) {
    assert.equal(
      (await request('/projects/' + id, 'PATCH', { persistOnReset: false }))
        .status,
      403,
    )
    const issues = (await request('/projects/' + id)).data.issues
    await request('/projects/' + id + '/issues/' + issues[0].id, 'PATCH', {
      status: 'dismissed',
    })
  }
  await promisify(execFile)(process.execPath, ['control.mjs', '--restart'], {
    cwd: root,
    windowsHide: true,
    env: {
      ...process.env,
      BASIS_STATE_DIR: resolve(root, 'state/ui-preview'),
      BASIS_CONTROL_API_PORT: '8840',
      BASIS_CONTROL_GATEWAY_PORT: '8842',
      BASIS_CONTROL_SKIP_BUILD: '1',
    },
  })
  await ready()
  assert.equal(
    (await request('/projects/' + keep.id)).data.project.persistOnReset,
    true,
  )
  const reset = await request('/demo/reset', 'POST', {})
  assert.equal(reset.status, 200)
  assert.ok(reset.data.removedProjectIds.includes(remove.id))
  assert.ok(!reset.data.removedProjectIds.includes(keep.id))
  assert.equal((await request('/projects/' + remove.id)).status, 404)
  assert.equal(
    (await request('/projects/' + remove.id + '/queries/' + removedQuery.id))
      .status,
    404,
  )
  assert.equal(
    existsSync(resolve(root, 'state/ui-preview/project-documents', remove.id)),
    false,
  )
  assert.equal(
    existsSync(resolve(root, 'state/ui-preview/project-queries', remove.id)),
    false,
  )
  assert.equal((await request('/projects/' + keep.id)).data.documents.length, 1)
  assert.equal(
    (await request('/projects/' + keep.id + '/queries/' + keptQuery.id)).data
      .stale,
    false,
  )
  assert.equal(
    existsSync(resolve(root, 'state/ui-preview/project-documents', keep.id)),
    true,
  )
  for (const id of ['demo-mill-creek', 'demo-willow-creek']) {
    const d = (await request('/projects/' + id)).data
    assert.equal(d.project.persistOnReset, true)
    assert.equal(d.project.protectedDemo, true)
    assert.ok(d.issues.every((i) => i.status === 'open' && i.verified))
    assert.equal(d.queries.length, 2)
  }
  assert.ok((await request('/documents')).data.documents.length > 0)
  await request('/projects/' + keep.id, 'PATCH', { persistOnReset: false })
  await request('/demo/reset', 'POST', {})
  assert.equal((await request('/projects/' + keep.id)).status, 404)
  console.log(
    'PASS global reset removes temporary projects/files/history, retains opted-in projects and queries across restart, restores both locked examples, and honors opt-out',
  )
} finally {
  for (const id of ids) await request('/projects/' + id, 'DELETE')
}

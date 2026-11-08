// Exercises only the isolated project runtime, never the legacy public demo.
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFileSync, unlinkSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { root, stateDir } from '../src/config.mjs'
const run = promisify(execFile),
  base = 'http://127.0.0.1:8810'
const token = readFileSync(
  resolve(stateDir, 'session-token.txt'),
  'utf8',
).trim()
async function api(path, method = 'GET', body) {
  const response = await fetch(base + '/v1' + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  assert.ok(response.ok, `${method} ${path}: ${response.status}`)
  return response.json()
}
let project
try {
  const collections = (await api('/reference-collections')).collections
  project = (
    await api('/projects', 'POST', {
      name: 'Restart persistence check',
      collectionIds: [collections.find((c) => c.id === 'edmonton-water').id],
    })
  ).project
  await api('/projects/demo-mill-creek/issues/planter-width', 'PATCH', {
    status: 'dismissed',
  })
  const before = await api('/projects/demo-mill-creek')
  const runtime = resolve(
    stateDir,
    'demo-documents/mill-creek-client-brief.pdf',
  )
  assert.ok(existsSync(runtime))
  const original = readFileSync(runtime)
  unlinkSync(runtime)
  await run(process.execPath, ['control.mjs', '--restart'], {
    cwd: root,
    windowsHide: true,
    env: {
      ...process.env,
      BASIS_CONTROL_API_PORT: '8810',
      BASIS_CONTROL_GATEWAY_PORT: '8812',
      BASIS_CONTROL_SKIP_BUILD: '1',
    },
  })
  let ready = false
  for (let n = 0; n < 120; n++) {
    try {
      ready = (await (await fetch(base + '/health')).json()).ready
    } catch {}
    if (ready) break
    await new Promise((r) => setTimeout(r, 500))
  }
  assert.ok(ready, 'restarted API must be ready')
  const after = await api('/projects/demo-mill-creek')
  assert.equal(
    after.issues.find((i) => i.id === 'planter-width').status,
    'dismissed',
  )
  assert.deepEqual(
    after.queries.map((q) => q.id),
    before.queries.map((q) => q.id),
  )
  assert.equal(
    (await api('/projects/' + project.id)).project.name,
    project.name,
  )
  assert.deepEqual(readFileSync(runtime), original)
  const projects = (await api('/projects')).projects
  assert.equal(projects.filter((p) => p.id === 'demo-mill-creek').length, 1)
  assert.equal(projects.filter((p) => p.id === 'demo-willow-creek').length, 1)
  for (const query of after.queries.filter((q) => q.prepared))
    assert.equal(
      (await api('/projects/demo-mill-creek/queries/' + query.id)).stale,
      false,
    )
  console.log(
    'PASS real restart preserves ordinary projects, query history and dismissals; restores missing PDF; no duplicate seeds',
  )
} finally {
  if (project) await api('/projects/' + project.id, 'DELETE')
  await api('/projects/demo-mill-creek/reset', 'POST', {})
}

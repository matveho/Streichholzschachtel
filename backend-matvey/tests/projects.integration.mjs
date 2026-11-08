import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const base = process.env.BASIS_TEST_URL || 'http://127.0.0.1:8810'
const token = readFileSync(
  new URL('../state/session-token.txt', import.meta.url),
  'utf8',
).trim()
async function request(path, method = 'GET', value) {
  const response = await fetch(base + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + token,
      ...(value === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(value === undefined ? {} : { body: JSON.stringify(value) }),
  })
  return { status: response.status, data: await response.json() }
}
async function completed(project, question, documentIds) {
  let { data: job, status } = await request(
    `/v1/projects/${project}/queries`,
    'POST',
    {
      question,
      sourceOnly: true,
      ...(documentIds === undefined ? {} : { documentIds }),
    },
  )
  assert.equal(status, 202)
  for (let i = 0; i < 100 && ['queued', 'running'].includes(job.state); i++) {
    await new Promise((r) => setTimeout(r, 200))
    job = (await request(`/v1/projects/${project}/queries/${job.id}`)).data
  }
  assert.equal(job.state, 'completed')
  return job
}
test('both protected projects expose complete documents, source-verified history and findings', async () => {
  const { data } = await request('/v1/projects')
  assert.ok(data.projects.length >= 2)
  for (const id of ['demo-mill-creek', 'demo-willow-creek']) {
    const { status, data } = await request('/v1/projects/' + id)
    assert.equal(status, 200)
    assert.ok(data.documents.length >= 6)
    assert.equal(data.issues.length, 2)
    assert.ok(data.issues.every((i) => i.verified && i.citations.length >= 2))
    const deletion = await request('/v1/projects/' + id, 'DELETE')
    assert.equal(deletion.status, 403)
    for (const query of data.queries.filter((q) => q.prepared)) {
      const job = (await request(`/v1/projects/${id}/queries/${query.id}`)).data
      assert.equal(job.stale, false)
      assert.equal(job.result.mode, 'prepared_comparison')
      assert.ok(
        job.result.references.every((r) =>
          data.project.documentIds.includes(r.doc),
        ),
      )
      const file = await fetch(base + job.result.documents[0].file, {
        headers: { Authorization: 'Bearer ' + token, Range: 'bytes=0-3' },
      })
      assert.equal(file.status, 206)
      assert.equal(await file.text(), '%PDF')
    }
  }
})
test('project query, fallback, cache, file and history scopes cannot cross projects', async () => {
  const a = (await request('/v1/projects/demo-mill-creek')).data,
    b = (await request('/v1/projects/demo-willow-creek')).data
  const privateA = a.documents.find((d) => d.projectArtifact)
  assert.equal(
    (
      await request(
        `/v1/projects/demo-willow-creek/documents/${privateA.id}/file`,
      )
    ).status,
    404,
  )
  assert.equal(
    (await request(`/v1/projects/demo-willow-creek/queries/${a.queries[0].id}`))
      .status,
    404,
  )
  assert.equal(
    (
      await request('/v1/projects/demo-willow-creek/queries', 'POST', {
        question: 'planter width',
        documentIds: [privateA.id],
      })
    ).status,
    400,
  )
  const result = await completed(
    'demo-willow-creek',
    'What are the box planter underdrain requirements?',
  )
  assert.ok(
    result.result.references.every((r) =>
      b.project.documentIds.includes(r.doc),
    ),
  )
  assert.ok(
    result.result.documents.every((d) => b.project.documentIds.includes(d.id)),
  )
  assert.ok(
    (result.result.suggestions || []).every(
      (s) => !s.sourceLabel.includes('Infill'),
    ),
  )
  const empty = await completed(
    'demo-mill-creek',
    'What is the minimum width of a box planter?',
    [],
  )
  assert.deepEqual(empty.result.references, [])
  assert.deepEqual(empty.result.documents, [])
  const global = await request('/v1/documents')
  assert.ok(global.data.documents.every((d) => !d.projectArtifact))
  const legacyPrivate = await fetch(
    base + `/v1/documents/${privateA.id}/file`,
    { headers: { Authorization: 'Bearer ' + token } },
  )
  assert.equal(legacyPrivate.status, 404)
})
test('ordinary project lifecycle retains shared PDFs and scope changes invalidate cached evidence', async () => {
  const catalog = (await request('/v1/reference-collections')).data
  const collection = catalog.collections.find(
    (c) => c.id === 'edmonton-drainage',
  )
  const { status, data } = await request('/v1/projects', 'POST', {
    name: 'QA temporary project',
    client: 'Integration test',
    collectionIds: [collection.id],
  })
  assert.equal(status, 201)
  const project = data.project
  try {
    const job = await completed(
      project.id,
      'What minimum vertical clearance is required when sewers cross each other?',
    )
    assert.ok(job.result.references.length > 0)
    const updated = await request('/v1/projects/' + project.id, 'PATCH', {
      documentIds: [],
    })
    assert.equal(updated.status, 200)
    const cached = (
      await request(`/v1/projects/${project.id}/queries/${job.id}`)
    ).data
    assert.equal(cached.stale, true)
    assert.equal(cached.result, undefined)
    const empty = await completed(project.id, 'storm sewer clearance')
    assert.deepEqual(empty.result.references, [])
    assert.equal(
      (await request('/v1/projects/' + project.id, 'DELETE')).status,
      200,
    )
    assert.equal((await request('/v1/projects/' + project.id)).status, 404)
    const shared = catalog.documents.find(
      (d) => d.id === collection.documentIds[0],
    )
    const pdf = await fetch(base + shared.file, {
      headers: { Authorization: 'Bearer ' + token, Range: 'bytes=0-3' },
    })
    assert.equal(pdf.status, 206)
  } finally {
    await request('/v1/projects/' + project.id, 'DELETE')
  }
})

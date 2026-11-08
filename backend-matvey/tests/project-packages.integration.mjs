// Writes query/dismissal history only to the isolated preview workspace.
import assert from 'node:assert/strict'
import { projectPackages } from '../demo/project-packages.mjs'
const base = 'http://127.0.0.1:8842/local-api/v1'
async function request(path, method = 'GET', body) {
  const response = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const value = await response.json()
  assert.ok(response.ok, `${path}: ${response.status} ${JSON.stringify(value)}`)
  return value
}
for (const spec of projectPackages) {
  const detail = await request('/projects/' + spec.id)
  assert.equal(
    detail.documents.length,
    spec.id === 'parkview-exchange' ? 16 : 17,
  )
  assert.equal(detail.issues.length, 4)
  assert.ok(
    detail.issues.every(
      (i) => i.verified && i.queryId && i.citations.length >= 2,
    ),
  )
  const allowed = new Set(detail.documents.map((d) => d.id))
  for (const q of spec.queries.filter((q) => q.sourceOnly)) {
    let job = await request('/projects/' + spec.id + '/queries', 'POST', {
      question: q.question,
      sourceOnly: true,
    })
    for (let i = 0; i < 100 && ['queued', 'running'].includes(job.state); i++) {
      await new Promise((r) => setTimeout(r, 100))
      job = await request('/projects/' + spec.id + '/queries/' + job.id)
    }
    assert.equal(job.state, 'completed')
    assert.equal(job.result.mode, 'extractive_answer', q.question)
    assert.ok(job.result.references.length > 0, q.question)
    assert.ok(
      job.result.references.every(
        (r) => allowed.has(r.doc) && r.regions.length,
      ),
    )
    const text = JSON.stringify(job.result.report)
    const expected = {
      'sanitary-diameter': '200 mm',
      'finished-floor': '672.250',
      'available-sight-distance': '165 m',
      'traffic-basis': '7,800',
    }[q.id]
    assert.ok(text.includes(expected), text)
  }
  const foreign = await request(
    '/projects/' +
      (spec.id === 'parkview-exchange'
        ? 'north-ridge-highway'
        : 'parkview-exchange'),
  )
  assert.ok(
    detail.documents.every((d) => !foreign.project.documentIds.includes(d.id)),
  )
  for (const fixture of spec.queries) {
    const prior = detail.queries.find((q) => q.question === fixture.question)
    assert.ok(prior, fixture.question)
    const record = await request(
      '/projects/' + spec.id + '/queries/' + prior.id,
    )
    assert.equal(record.stale, false)
    assert.ok(record.result.references.every((r) => allowed.has(r.doc)))
  }
  const issue = detail.issues[0]
  await request('/projects/' + spec.id + '/issues/' + issue.id, 'PATCH', {
    status: 'dismissed',
  })
  const reload = await request('/projects/' + spec.id)
  assert.equal(reload.issues.find((i) => i.id === issue.id).status, 'dismissed')
  await request('/projects/' + spec.id + '/issues/' + issue.id, 'PATCH', {
    status: 'open',
  })
  console.log(
    `PASS ${spec.id}: documents, four anchored findings, six query fixtures, fresh factual queries, isolation and dismissal`,
  )
}

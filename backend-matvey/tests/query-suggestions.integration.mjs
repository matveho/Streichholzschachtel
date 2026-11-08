import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const base = process.env.BASIS_TEST_URL || 'http://127.0.0.1:8790'
const key = readFileSync(
  new URL('../state/session-token.txt', import.meta.url),
  'utf8',
).trim()
const headers = {
  Authorization: 'Bearer ' + key,
  'Content-Type': 'application/json',
}
async function submit(question, sourceOnly = false) {
  const response = await fetch(base + '/v1/queries', {
    method: 'POST',
    headers,
    body: JSON.stringify({ question, sourceOnly }),
  })
  assert.equal(response.status, 202)
  let job = await response.json()
  const deadline = Date.now() + 60000
  while (['queued', 'running'].includes(job.state) && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 200))
    job = await (
      await fetch(base + '/v1/queries/' + job.id, { headers })
    ).json()
  }
  assert.equal(job.state, 'completed')
  return job
}

test('a real unsupported query offers source alternatives which return cited PDFs', async () => {
  const job = await submit(
    'What insulation R-value is required for storm sewer cover?',
    true,
  )
  assert.ok(['no_evidence', 'insufficient_evidence'].includes(job.result.mode))
  assert.deepEqual(job.result.references, [])
  assert.deepEqual(job.result.documents, [])
  assert.ok(job.result.suggestions?.length > 0)
  assert.ok(job.result.suggestions.length <= 3)
  for (const suggestion of job.result.suggestions) {
    const selected = await submit(suggestion.question, true)
    assert.equal(selected.result.mode, 'extractive_answer')
    assert.ok(selected.result.references.length > 0)
    assert.ok(selected.result.references.every((r) => r.regions?.length > 0))
    const document = selected.result.documents[0]
    const pdf = await fetch(base + document.file, {
      headers: { ...headers, Range: 'bytes=0-3' },
    })
    assert.equal(pdf.status, 206)
    assert.equal(await pdf.text(), '%PDF')
  }
  const changedMode = await fetch(base + '/v1/queries', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      id: job.id,
      question: job.question,
      sourceOnly: false,
    }),
  })
  assert.equal(changedMode.status, 409)
})

test('unrelated and other-jurisdiction requests remain unsupported without misleading alternatives', async () => {
  for (const question of [
    'What is the capital of France?',
    'What storm sewer cover is required in Calgary?',
  ]) {
    const job = await submit(question, true)
    assert.equal(job.result.mode, 'no_evidence')
    assert.deepEqual(job.result.references, [])
    assert.deepEqual(job.result.suggestions, [])
  }
})

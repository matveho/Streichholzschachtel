import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
const base = 'http://127.0.0.1:8787',
  token = readFileSync(
    new URL('../state/session-token.txt', import.meta.url),
    'utf8',
  ).trim(),
  headers = { Authorization: 'Bearer ' + token }
test('authentication and allowed origin preflights', async () => {
  assert.equal((await fetch(base + '/v1/documents')).status, 401)
  const preflight = await fetch(base + '/v1/queries', {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://streichholzschachtel.vercel.app',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'authorization,content-type',
    },
  })
  assert.equal(preflight.status, 204)
  assert.equal(
    preflight.headers.get('access-control-allow-origin'),
    'https://streichholzschachtel.vercel.app',
  )
  assert.ok(
    preflight.headers
      .get('access-control-allow-headers')
      .includes('Authorization'),
  )
  assert.equal(
    (
      await fetch(base + '/v1/documents', {
        headers: { ...headers, Origin: 'https://untrusted.example' },
      })
    ).status,
    403,
  )
})
test('PDF bytes and range requests retain original file contents', async () => {
  const { documents } = await (
    await fetch(base + '/v1/documents', { headers })
  ).json()
  const health = await (await fetch(base + '/health')).json()
  assert.ok(documents.length > 0)
  assert.equal(documents.length, health.documents)
  assert.equal(
    documents.some((d) => 'filePath' in d),
    false,
  )
  let r = await fetch(base + documents[0].file, {
    headers: { Range: 'bytes=0-3' },
  })
  assert.equal(r.status, 206)
  assert.equal(await r.text(), '%PDF')
  assert.equal(r.headers.get('content-length'), '4')
  r = await fetch(base + documents[0].file, {
    headers: { Range: 'bytes=999999999-' },
  })
  assert.equal(r.status, 416)
})
test('malformed and empty queries are rejected before creating jobs', async () => {
  assert.equal(
    (
      await fetch(base + '/v1/queries', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: '{bad',
      })
    ).status,
    400,
  )
  assert.equal(
    (
      await fetch(base + '/v1/queries', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: '{"question":" "}',
      })
    ).status,
    400,
  )
  assert.equal(
    (
      await fetch(base + '/v1/queries', {
        method: 'POST',
        headers,
        body: 'query',
      })
    ).status,
    415,
  )
})

test('a cancellation arriving before submission prevents the late job from running', async () => {
  const id = randomUUID()
  let response = await fetch(base + '/v1/queries/' + id, {
    method: 'DELETE',
    headers,
  })
  assert.equal(response.status, 200)
  response = await fetch(base + '/v1/queries', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, question: 'What is the capital of France?' }),
  })
  const job = await response.json()
  assert.equal(job.id, id)
  assert.equal(job.state, 'cancelled')
})

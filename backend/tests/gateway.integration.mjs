import http from 'node:http'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { root } from '../src/config.mjs'
const state = mkdtempSync(join(tmpdir(), 'basis-gateway-test-'))
const token = 'isolated-gateway-test-token'
writeFileSync(join(state, 'session-token.txt'), token, { mode: 0o600 })
const backend = http.createServer((req, res) => {
  assert.equal(req.headers.authorization, 'Bearer ' + token)
  if (req.url.endsWith('/file')) {
    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Length': '10000',
    })
    res.write('%PDF-interrupted')
    setTimeout(() => res.destroy(), 20)
  } else { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ ok: true, model: 'none (offline source lookup)', documents: [{model: '/v1/projects/demo/documents/doc-deadbeef/model?token=private',file: '/v1/documents/doc-deadbeef/file?token=private'}] })) }
})
await new Promise((done) => backend.listen(8830, '127.0.0.1', done))
const ingressFetch = (url, options = {}) => fetch(url, { ...options, headers: { ...options.headers, 'X-basis-Ingress-Key': 'gateway-test-ingress-key' } })
const child = spawn(process.execPath, ['demo-gateway.mjs'], {
  cwd: root,
  windowsHide: true,
  env: {
    ...process.env,
    BASIS_GATEWAY_INGRESS_KEY: 'gateway-test-ingress-key',
    BASIS_STATE_DIR: state,
    BASIS_TOKEN: token,
    BASIS_GATEWAY_PORT: '8832',
    BASIS_GATEWAY_TARGET: 'http://127.0.0.1:8830',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let errors = ''
child.stderr.on('data', (b) => (errors += b))
try {
  let ready = false
  for (let i = 0; i < 40; i++) {
    try {
      ready = (await ingressFetch('http://127.0.0.1:8832/_basis/gateway')).ok
    } catch {}
    if (ready) break
    await new Promise((r) => setTimeout(r, 100))
  }
  assert.ok(ready)
  assert.equal((await fetch('http://127.0.0.1:8832/health')).status, 401)
  assert.equal((await fetch('http://127.0.0.1:8832/health', {headers: {'X-basis-Ingress-Key':'incorrect'}})).status, 401)
  const health = await (await ingressFetch('http://127.0.0.1:8832/health')).json()
  assert.equal(health.model, 'none (offline source lookup)')
  assert.equal(health.documents[0].model, '/local-api/v1/projects/demo/documents/doc-deadbeef/model')
  assert.equal(health.documents[0].file, '/local-api/v1/documents/doc-deadbeef/file')
  for (let i = 0; i < 3; i++) {
    await assert.rejects(async () => {
      const r = await ingressFetch(
        'http://127.0.0.1:8832/v1/documents/doc-deadbeef/file',
      )
      await r.arrayBuffer()
    })
    assert.ok((await ingressFetch('http://127.0.0.1:8832/_basis/gateway')).ok)
  }
  assert.equal(child.exitCode, null)
  assert.equal(errors, '')
  console.log(
    'PASS interrupted PDF upstreams do not crash the gateway; subsequent requests remain available',
  )
} finally {
  child.kill()
  await new Promise((done) => backend.close(done))
  rmSync(state, { recursive: true, force: true })
}

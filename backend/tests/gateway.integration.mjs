import http from 'node:http'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { root } from '../src/config.mjs'
const backend = http.createServer((req, res) => {
  if (req.url.endsWith('/file')) {
    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Length': '10000',
    })
    res.write('%PDF-interrupted')
    setTimeout(() => res.destroy(), 20)
  } else res.end(JSON.stringify({ ok: true }))
})
await new Promise((done) => backend.listen(8830, '127.0.0.1', done))
const child = spawn(process.execPath, ['demo-gateway.mjs'], {
  cwd: root,
  windowsHide: true,
  env: {
    ...process.env,
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
      ready = (await fetch('http://127.0.0.1:8832/_basis/gateway')).ok
    } catch {}
    if (ready) break
    await new Promise((r) => setTimeout(r, 100))
  }
  assert.ok(ready)
  for (let i = 0; i < 3; i++) {
    await assert.rejects(async () => {
      const r = await fetch(
        'http://127.0.0.1:8832/v1/documents/doc-deadbeef/file',
      )
      await r.arrayBuffer()
    })
    assert.ok((await fetch('http://127.0.0.1:8832/_basis/gateway')).ok)
  }
  assert.equal(child.exitCode, null)
  assert.equal(errors, '')
  console.log(
    'PASS interrupted PDF upstreams do not crash the gateway; subsequent requests remain available',
  )
} finally {
  child.kill()
  await new Promise((done) => backend.close(done))
}

// Isolated real-process lifecycle and recovery test; never uses the demo ports.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { root, stateDir } from '../src/config.mjs'

const port = 8820,
  gateway = 8822
const base = `http://127.0.0.1:${port}`
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
async function health() {
  try {
    return await (
      await fetch(base + '/health', { signal: AbortSignal.timeout(1500) })
    ).json()
  } catch {
    return null
  }
}
async function until(check, timeout = 65000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (await check()) return
    await wait(300)
  }
  throw new Error('Controller integration timed out')
}
assert.equal(await health(), null, 'The isolated test port must be unused')
const child = spawn(process.execPath, ['control.mjs'], {
  cwd: root,
  windowsHide: true,
  env: {
    ...process.env,
    BASIS_CONTROL_API_PORT: String(port),
    BASIS_CONTROL_GATEWAY_PORT: String(gateway),
    BASIS_CONTROL_SKIP_BUILD: '1',
  },
  stdio: ['pipe', 'pipe', 'pipe'],
})
let output = ''
child.stdout.on('data', (b) => {
  output = (output + b).slice(-12000)
})
child.stderr.on('data', (b) => {
  output = (output + b).slice(-12000)
})
const state = () =>
  JSON.parse(readFileSync(resolve(stateDir, `control-${port}.json`), 'utf8'))
try {
  await until(async () => (await health())?.ready)
  const first = state().processes.api.pid
  process.kill(first)
  await until(
    async () => state().processes.api.pid !== first && (await health())?.ready,
    80000,
  )
  assert.ok(output.includes('automatic recovery'))
  const recoveredApi = state().processes.api.pid
  const firstGateway = state().processes.gateway.pid
  process.kill(firstGateway)
  await until(async () => {
    if (state().processes.gateway.pid === firstGateway) return false
    try {
      return (await fetch(`http://127.0.0.1:${gateway}/_basis/gateway`)).ok
    } catch {
      return false
    }
  }, 80000)
  assert.equal(
    state().processes.api.pid,
    recoveredApi,
    'Gateway recovery must keep the healthy API and its index running',
  )
  const metadata = await (
    await fetch(`http://127.0.0.1:${gateway}/local-api/v1/documents`)
  ).json()
  assert.ok(metadata.documents.length > 0)
  assert.ok(metadata.documents.every((d) => !d.file.includes('token=')))
  const pdf = await fetch(
    `http://127.0.0.1:${gateway}` + metadata.documents[0].file,
    { headers: { Range: 'bytes=0-3' } },
  )
  assert.equal(pdf.status, 206)
  assert.equal(await pdf.text(), '%PDF')
  const recovered = state().processes.api.pid
  child.stdin.write('2\n')
  await until(
    async () =>
      state().processes.api.pid !== recovered && (await health())?.ready,
    80000,
  )
  assert.equal((await health()).failures, 0)
  child.stdin.write('3\n')
  await until(async () => state().stopped && !(await health()))
  await wait(1500)
  assert.equal(await health(), null)
  child.stdin.write('q\n')
  const exit = await new Promise((done) => child.once('exit', done))
  assert.equal(exit, 0)
  console.log(
    'PASS start, readiness, API and gateway crash recovery, healthy API preservation, keyless gateway, PDF ranges, manual restart, explicit stop and clean control exit',
  )
} catch (error) {
  console.error(output)
  child.kill()
  const cleanup = spawn(process.execPath, ['control.mjs', '--stop'], {
    cwd: root,
    windowsHide: true,
    env: {
      ...process.env,
      BASIS_CONTROL_API_PORT: String(port),
      BASIS_CONTROL_GATEWAY_PORT: String(gateway),
    },
    stdio: 'ignore',
  })
  await new Promise((done) => cleanup.once('exit', done))
  throw error
}

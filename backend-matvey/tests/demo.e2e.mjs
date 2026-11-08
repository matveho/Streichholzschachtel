// End-to-end check through the HTTP API: starts the server on a spare port,
// submits each demo question as a job, polls it, and checks the rendered
// report, citations and PDF access. Usage: node tests/demo.e2e.mjs
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { demoQuestions } from './demo-questions.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const port = 8799
const base = `http://127.0.0.1:${port}`
const server = spawn(process.execPath, ['src/server.mjs'], {
  cwd: root,
  env: { ...process.env, PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let log = ''
server.stdout.on('data', (d) => (log += d))
server.stderr.on('data', (d) => (log += d))
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

try {
  let health
  for (let i = 0; i < 240; i++) {
    try {
      health = await (await fetch(`${base}/health`)).json()
      if (health.ready) break
    } catch {}
    await wait(1000)
  }
  if (!health?.ready) throw new Error('Server did not become ready:\n' + log)
  console.log(`ready: ${health.documents} documents, ${health.units} units, provider ${health.provider}`)
  const token = readFileSync(new URL('../state/session-token.txt', import.meta.url), 'utf8').trim()
  const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  let passed = 0
  for (const [i, item] of demoQuestions.entries()) {
    const job = await (
      await fetch(`${base}/v1/queries`, { method: 'POST', headers: auth, body: JSON.stringify({ question: item.q }) })
    ).json()
    let state
    for (let k = 0; k < 600; k++) {
      state = await (await fetch(`${base}/v1/queries/${job.id}`, { headers: auth })).json()
      if (['completed', 'failed', 'cancelled'].includes(state.state)) break
      await wait(250)
    }
    const r = state.result
    const text = (r?.report || []).flatMap((b) => [b.heading || '', ...b.sentences.map((s) => s.text)]).join('\n')
    const missing = item.expect.filter((e) => !text.toLowerCase().includes(e.toLowerCase()))
    const refsOk = (r?.references || []).every((ref) => ref.regions?.length && ref.page >= 1 && r.documents.some((d) => d.id === ref.doc))
    const ok = state.state === 'completed' && !missing.length && refsOk && (!item.mode || item.mode === r.mode || r.mode === 'cited_synthesis')
    if (ok) passed++
    console.log(`${ok ? 'PASS' : 'FAIL'} ${i + 1}. [${r?.mode}] ${item.q}${ok ? '' : `  missing=${JSON.stringify(missing)} refsOk=${refsOk} state=${state.state}`}`)
  }
  // The cited PDF itself must be retrievable with a byte range.
  const docs = await (await fetch(`${base}/v1/documents`, { headers: auth })).json()
  const pdf = await fetch(`${base}${docs.documents[0].file}`, { headers: { ...auth, Range: 'bytes=0-7' } })
  const head = Buffer.from(await pdf.arrayBuffer()).toString()
  console.log(`PDF range request: ${pdf.status} ${JSON.stringify(head)}`)
  console.log(`\n${passed}/${demoQuestions.length} demo questions pass through the API`)
  process.exitCode = passed === demoQuestions.length && pdf.status === 206 && head.startsWith('%PDF') ? 0 : 1
} finally {
  server.kill()
}

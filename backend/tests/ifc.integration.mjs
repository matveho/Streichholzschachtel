import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
const base = 'http://127.0.0.1:8842/local-api'
for (let i = 0; i < 120; i++) {
  try {
    if ((await (await fetch(base + '/health')).json()).ready) break
  } catch {}
  if (i === 119) throw new Error('Preview backend not ready')
  await new Promise((r) => setTimeout(r, 250))
}
async function get(path, options) {
  const r = await fetch(base + path, options)
  assert.ok(r.ok, `${path} ${r.status}`)
  return r.json()
}
for (const [id, questions] of [
  [
    'parkview-exchange',
    [
      ['What is the nominal pipe diameter of IFC object S1?', '200 mm'],
      ['What is the cover of IFC object ST1 at chainage 0+018?', '1.650 m'],
      ['What is the vertical clearance at IFC crossing X1?', '0.220 m'],
    ],
  ],
  [
    'north-ridge-highway',
    [
      ['What is the thickness of IFC object PAV-ACP?', '110 mm'],
      ['What is the design speed of IFC object RD-EB?', '100 km/h'],
    ],
  ],
]) {
  const detail = await get('/v1/projects/' + id)
  const doc = detail.documents.find((d) => d.model)
  assert.ok(doc, 'Associated searchable model register')
  const download = await fetch(new URL(doc.model, 'http://127.0.0.1:8842'))
  assert.equal(download.status, 200)
  assert.match(
    download.headers.get('content-disposition'),
    new RegExp(id + '\\.ifc'),
  )
  const bytes = Buffer.from(await download.arrayBuffer())
  assert.ok(bytes.toString().startsWith('ISO-10303-21;'))
  assert.equal(
    createHash('sha256').update(bytes).digest('hex'),
    doc.modelSha256,
  )
  assert.deepEqual(
    bytes,
    readFileSync(new URL('../output/models/' + id + '.ifc', import.meta.url)),
  )
  const foreign =
    id === 'parkview-exchange' ? 'north-ridge-highway' : 'parkview-exchange'
  const denied = await fetch(
    base + `/v1/projects/${foreign}/documents/${doc.id}/model`,
  )
  assert.equal(denied.status, 404)
  for (const [question, expected] of questions) {
    let job = await get('/v1/projects/' + id + '/queries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question,
        sourceOnly: true,
        documentIds: [doc.id],
      }),
    })
    for (let i = 0; i < 80 && ['queued', 'running'].includes(job.state); i++) {
      await new Promise((r) => setTimeout(r, 100))
      job = await get(`/v1/projects/${id}/queries/${job.id}`)
    }
    assert.equal(job.state, 'completed')
    assert.equal(
      job.result.mode,
      'extractive_answer',
      question + JSON.stringify(job.result.report),
    )
    assert.ok(JSON.stringify(job.result.report).includes(expected), question)
    assert.ok(
      job.result.references.length > 0 &&
        job.result.references.every(
          (r) => r.doc === doc.id && r.regions.length,
        ),
    )
  }
  console.log(
    `PASS ${id}: IFC download, source checksum, project isolation and cited object queries`,
  )
}

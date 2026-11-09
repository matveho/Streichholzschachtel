// Run only against the disposable state created by scripts/linux/test-backend.
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
const state = process.env.BASIS_STATE_DIR
assert.ok(state?.includes('/verification/run-'), 'Requires isolated verification storage')
const token = readFileSync(resolve(state, 'session-token.txt'), 'utf8').trim()
const base = process.env.BASIS_TEST_URL
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
async function api(path, method = 'GET', body, status = 200) {
  const r = await fetch(base + '/v1' + path, { method, headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  assert.equal(r.status, status, `${method} ${path}`)
  return r.json()
}
async function query(project, documentIds) {
  let job = await api(`/projects/${project}/queries`, 'POST', {
    question: 'What is the overall width of each box planter?', sourceOnly: true, documentIds,
  }, 202)
  for (let i = 0; i < 300 && ['queued', 'running'].includes(job.state); i++) {
    await new Promise(r => setTimeout(r, 100))
    job = await api(`/projects/${project}/queries/${job.id}`)
  }
  assert.equal(job.state, 'completed')
  return job
}
const checkpoint = resolve(state, 'lifecycle-checkpoint.json')
if (process.argv[2] === 'prepare') {
  const a = (await api('/projects', 'POST', { name: 'Linux persistence verification', documentIds: [] }, 201)).project
  const b = (await api('/projects', 'POST', { name: 'Linux foreign scope verification', documentIds: [] }, 201)).project
  const content = readFileSync(new URL('../output/pdf/mill-creek-client-brief.pdf', import.meta.url)).toString('base64')
  const uploaded = await api(`/projects/${a.id}/documents/import`, 'POST', { name: 'private-client.pdf', content,category:'design' }, 201)
  const doc = uploaded.documents[0].id
  assert.equal(uploaded.documents[0].category,'design')
  const beforeCategory=await query(a.id,[doc])
  for(const category of ['reference','client','design','report','supporting']){
    const edited=await api(`/projects/${a.id}/documents/${doc}`,'PATCH',{category})
    assert.equal(edited.document.category,category)
    assert.equal((await api(`/projects/${a.id}`)).documents.find(record=>record.id===doc).category,category)
  }
  await api(`/projects/${a.id}/documents/${doc}`,'PATCH',{category:'invalid'},400)
  await api(`/projects/${a.id}/documents/${doc}`,'PATCH',{},400)
  await api(`/projects/${b.id}/documents/${doc}`,'PATCH',{category:'report'},404)
  await api('/projects/demo-mill-creek/documents/doc-09e07f57e7a3','PATCH',{category:'design'},403)
  const duplicate=await api(`/projects/${a.id}/documents/import`,'POST',{name:'same-client.pdf',content,category:'report'},201)
  assert.equal(duplicate.documents[0].id,doc)
  assert.equal(duplicate.documents[0].category,'report')
  await api(`/projects/${a.id}/documents/${doc}`,'PATCH',{category:'supporting'})
  const guessed=await api(`/projects/${b.id}/documents/import`,'POST',{name:'private-client.pdf',content},201)
  assert.equal(guessed.documents[0].category,'client')
  assert.notEqual(guessed.documents[0].id,doc)
  assert.equal((await api(`/projects/${a.id}/queries/${beforeCategory.id}`)).stale,true)
  const empty = await query(a.id, [])
  assert.equal(empty.result.references.length, 0)
  const job = await query(a.id, [doc])
  assert.ok(job.result.references.some(r => r.doc === doc))
  assert.ok(JSON.stringify(job.result.report).includes('400 mm'))
  await api(`/projects/${b.id}/queries`, 'POST', { question: 'Width?', documentIds: [doc] }, 400)
  assert.equal((await fetch(`${base}/v1/projects/${b.id}/documents/${doc}/file`, { headers })).status, 404)
  assert.equal((await fetch(`${base}/v1/documents/${doc}/file`, { headers })).status, 404)
  await api(`/projects/${a.id}`, 'PATCH', { description: 'Persists across a real process restart' })
  await api(`/projects/${a.id}/queries/${job.id}`, 'PATCH', { saved: true })
  writeFileSync(checkpoint, JSON.stringify({ a: a.id, b: b.id, doc, query: job.id }))
  console.log('PASS optional import category, category PATCH, duplicate-byte recategorization, guessing, validation, private search and scope isolation; restart checkpoint saved')
} else {
  const c = JSON.parse(readFileSync(checkpoint, 'utf8'))
  const project = await api(`/projects/${c.a}`)
  assert.equal(project.project.description, 'Persists across a real process restart')
  assert.ok(project.documents.some(d => d.id === c.doc))
  assert.equal(project.documents.find(d=>d.id===c.doc).category,'supporting')
  assert.equal(project.documents.filter(d=>d.id===c.doc).length,1)
  assert.equal((await api(`/projects/${c.b}`)).documents.find(d=>d.originalFilename==='private-client.pdf').category,'client')
  const job = await api(`/projects/${c.a}/queries/${c.query}`)
  assert.equal(job.state, 'completed')
  assert.ok(job.result.references.some(r => r.doc === c.doc))
  const pdf = await fetch(`${base}/v1/projects/${c.a}/documents/${c.doc}/file`, { headers: { ...headers, Range: 'bytes=0-3' } })
  assert.equal(pdf.status, 206)
  assert.equal(await pdf.text(), '%PDF')
  await api(`/projects/${c.a}`, 'DELETE')
  await api(`/projects/${c.b}`, 'DELETE')
  console.log('PASS category persists after restart/reindex, including duplicate PDFs; metadata, PDF, history and citations survive restart; disposable projects deleted')
}

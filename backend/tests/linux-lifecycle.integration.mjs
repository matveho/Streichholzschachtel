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
  assert.equal(job.result.searchStats.scope.documents,1)
  assert.ok(job.result.searchStats.timing.processingMs>=0)
  assert.equal(job.result.searchStats.evidence.citations,job.result.references.length)
  assert.ok(JSON.stringify(job.result.report).includes('400 mm'))
  await api(`/projects/${b.id}/queries`, 'POST', { question: 'Width?', documentIds: [doc] }, 400)
  assert.equal((await fetch(`${base}/v1/projects/${b.id}/documents/${doc}/file`, { headers })).status, 404)
  assert.equal((await fetch(`${base}/v1/documents/${doc}/file`, { headers })).status, 404)
  await api(`/projects/${a.id}`, 'PATCH', { description: 'Persists across a real process restart', issuesEnabled:false })
  await api(`/projects/${a.id}/queries/${job.id}`, 'PATCH', { saved: true })
  await api('/projects/'+a.id+'/queries/'+beforeCategory.id,'PATCH',{saved:true})
  assert.equal((await api('/projects/'+a.id+'/queries/'+beforeCategory.id,'DELETE')).deleted,true)
  await api('/projects/'+a.id+'/queries/'+beforeCategory.id,'GET',undefined,404)
  const deletedSeed=(await api('/projects/parkview-exchange')).queries.find(query=>query.prepared&&query.sourceOnly)
  assert.ok(deletedSeed)
  await api('/projects/parkview-exchange/queries/'+deletedSeed.id,'DELETE')
  const finding=(await api('/projects/parkview-exchange')).issues.find(issue=>!issue.prepared&&issue.verified&&issue.queryId)
  assert.ok(finding)
  const evidence=await api(`/projects/parkview-exchange/queries/${finding.queryId}`)
  assert.equal(evidence.result.mode,'ifc_comparison')
  assert.equal(evidence.stale,false)
  await api(`/projects/demo-willow-creek/queries/${finding.queryId}`,'GET',undefined,404)
  writeFileSync(checkpoint, JSON.stringify({ a: a.id, b: b.id, doc, query: job.id,searchStats:job.result.searchStats,deletedQuery:beforeCategory.id,deletedSeed:deletedSeed.id,ifcQuery:finding.queryId,ifcIssue:finding.id }))
  console.log('PASS optional import category, category PATCH, duplicate-byte recategorization, guessing, validation, private search and scope isolation; restart checkpoint saved')
} else {
  const c = JSON.parse(readFileSync(checkpoint, 'utf8'))
  const project = await api(`/projects/${c.a}`)
  assert.equal(project.project.description, 'Persists across a real process restart')
  assert.equal(project.project.issuesEnabled,false)
  assert.deepEqual(project.issues,[])
  assert.equal(project.comparison,null)
  await api('/projects/'+c.a+'/queries/'+c.deletedQuery,'GET',undefined,404)
  await api('/projects/parkview-exchange/queries/'+c.deletedSeed,'GET',undefined,404)
  assert.ok(!project.project.savedQueryIds.includes(c.deletedQuery))
  assert.ok(!project.queries.some(query=>query.id===c.deletedQuery))
  assert.ok(!(await api('/projects/parkview-exchange')).queries.some(query=>query.id===c.deletedSeed))
  assert.ok(project.documents.some(d => d.id === c.doc))
  assert.equal(project.documents.find(d=>d.id===c.doc).category,'supporting')
  assert.equal(project.documents.filter(d=>d.id===c.doc).length,1)
  assert.equal((await api(`/projects/${c.b}`)).documents.find(d=>d.originalFilename==='private-client.pdf').category,'client')
  const job = await api(`/projects/${c.a}/queries/${c.query}`)
  assert.equal(job.state, 'completed')
  assert.deepEqual(job.result.searchStats,c.searchStats,'Saved diagnostics must retain the measured original execution after restart')
  assert.ok(job.result.references.some(r => r.doc === c.doc))
  const pdf = await fetch(`${base}/v1/projects/${c.a}/documents/${c.doc}/file`, { headers: { ...headers, Range: 'bytes=0-3' } })
  assert.equal(pdf.status, 206)
  assert.equal(await pdf.text(), '%PDF')
  const evidence=await api(`/projects/parkview-exchange/queries/${c.ifcQuery}`)
  assert.equal(evidence.stale,false)
  assert.equal(evidence.result.mode,'ifc_comparison')
  assert.equal(evidence.result.ifcFinding.id,c.ifcIssue)
  assert.ok(evidence.result.references.every(reference=>reference.regions.length))
  assert.equal((await api('/projects/parkview-exchange')).issues.find(issue=>issue.id===c.ifcIssue).queryId,c.ifcQuery)
  const modelFile=(await api('/projects/parkview-exchange')).documents.find(document=>document.modelFile).modelFile
  assert.ok(/^[a-z0-9-]+\.ifc$/.test(modelFile))
  const modelPath=resolve(state,'demo-documents',modelFile)
  const original=readFileSync(modelPath)
  try{
    writeFileSync(modelPath,Buffer.concat([original,Buffer.from('\n')]))
    const obsolete=await api(`/projects/parkview-exchange/queries/${c.ifcQuery}`)
    assert.equal(obsolete.stale,true)
    assert.equal(obsolete.result,undefined)
  }finally{writeFileSync(modelPath,original)}
  await api(`/projects/${c.a}`, 'DELETE')
  await api(`/projects/${c.b}`, 'DELETE')
  console.log('PASS categories, duplicate PDFs, metadata, history, PDF citations and IFC finding evidence survive restart/reindex; disposable projects deleted')
}

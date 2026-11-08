// Run only with disposable state through scripts/linux/test-reasoning-capabilities.
import assert from 'node:assert/strict'
import {readFileSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
const state=process.env.BASIS_STATE_DIR, base=process.env.BASIS_TEST_URL
assert.ok(state?.includes('/verification/run-gpu-'))
assert.equal(base,'http://127.0.0.1:8814')
const headers={'Content-Type':'application/json',Authorization:'Bearer '+readFileSync(resolve(state,'session-token.txt'),'utf8').trim()}
async function api(path,method='GET',body,status=200){
 const r=await fetch(base+'/v1'+path,{method,headers,...(body===undefined?{}:{body:JSON.stringify(body)})})
 assert.equal(r.status,status,path);return r.json()
}
const data=await api('/projects/demo-mill-creek')
const allowed=new Set(data.project.documentIds)
const docs=new Map(data.documents.map(d=>[d.id,d]))
async function query(question,documentIds){
 let job=await api('/projects/demo-mill-creek/queries','POST',{question,...(documentIds===undefined?{}:{documentIds})},202)
 for(let i=0;i<600&&['queued','running'].includes(job.state);i++){
  await new Promise(r=>setTimeout(r,1000));job=await api('/projects/demo-mill-creek/queries/'+job.id)
 }
 assert.equal(job.state,'completed')
 for(const r of job.result.references){
  assert.ok(allowed.has(r.doc));assert.ok(r.page>0);assert.ok(r.regions.length>0)
  assert.ok(r.regions.every(rect=>rect.length===4&&rect.every(Number.isFinite)&&rect[2]>0&&rect[3]>0))
 }
 return job.result
}
const cases=[
 {id:'project-comparison',question:'Compare the minimum box planter width required by the standards with the width proposed in this project. Identify any difference and cite both documents.',check:r=>{
  const text=JSON.stringify(r.report)
  assert.match(text,/450\s*mm/);assert.match(text,/400\s*mm/)
  assert.ok(r.references.some(ref=>docs.get(ref.doc)?.projectArtifact))
  assert.ok(r.references.some(ref=>!docs.get(ref.doc)?.projectArtifact))
  assert.ok(!['no_evidence','insufficient_evidence'].includes(r.mode))
 }},
 {id:'changed-project-size',question:'Can the Rational Method be used for detailed design of a 25 ha minor storm drainage catchment?',check:r=>{
  const text=JSON.stringify(r.report);assert.match(text,/Rational/i);assert.match(text,/65\s*ha/)
  assert.ok(r.references.length>0);assert.ok(!['no_evidence','insufficient_evidence'].includes(r.mode))
 }},
 {id:'foreign-jurisdiction',question:'What stormwater design requirements apply to this development in Toronto?',check:r=>{
  assert.ok(['no_evidence','insufficient_evidence'].includes(r.mode));assert.equal(r.references.length,0)
 }},
 {id:'explicit-empty-scope',question:'What minimum cover is required for the storm sewer?',scope:[],check:r=>{
  assert.equal(r.references.length,0);assert.equal(r.documents.length,0)
 }},
]
const results=[]
for(const c of cases){const start=Date.now();try{const result=await query(c.question,c.scope);c.check(result);results.push({id:c.id,passed:true,seconds:(Date.now()-start)/1000,result})}catch(e){results.push({id:c.id,passed:false,seconds:(Date.now()-start)/1000,error:e.message})}console.log(JSON.stringify({...results.at(-1),result:undefined}))}
const foreign=(await api('/projects/demo-willow-creek')).documents.find(d=>d.projectArtifact)
await api('/projects/demo-mill-creek/queries','POST',{question:'Identify the project requirements.',documentIds:[foreign.id]},400)
console.log('PASS foreign-project selection rejected before inference')
writeFileSync(resolve(state,'reasoning-capability-results.json'),JSON.stringify(results,null,2))
if(results.some(r=>!r.passed))process.exitCode=1

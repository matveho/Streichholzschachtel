// Run only with disposable state through scripts/linux/test-reasoning-capabilities.
import assert from 'node:assert/strict'
import {readFileSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
const state=process.env.BASIS_STATE_DIR, base=process.env.BASIS_TEST_URL
const restricted=['comparisons','demo'].includes(process.env.LOCAL_SYNTHESIS_POLICY)
assert.ok(state?.includes('/verification/run-gpu-'))
assert.equal(base,'http://127.0.0.1:8814')
const headers={'Content-Type':'application/json',Authorization:'Bearer '+readFileSync(resolve(state,'session-token.txt'),'utf8').trim()}
async function api(path,method='GET',body,status=200){
 const r=await fetch(base+'/v1'+path,{method,headers,...(body===undefined?{}:{body:JSON.stringify(body)})})
 assert.equal(r.status,status,path);return r.json()
}
const data=await api('/projects/demo-mill-creek')
const docs=new Map(data.documents.map(d=>[d.id,d]))
async function query(question,documentIds,projectId='demo-mill-creek'){
 const scopedData=projectId==='demo-mill-creek'?data:await api('/projects/'+projectId)
 const scopedAllowed=new Set(scopedData.project.documentIds)
 let job=await api('/projects/'+projectId+'/queries','POST',{question,...(documentIds===undefined?{}:{documentIds})},202)
 for(let i=0;i<600&&['queued','running'].includes(job.state);i++){
  await new Promise(r=>setTimeout(r,1000));job=await api('/projects/'+projectId+'/queries/'+job.id)
 }
 assert.equal(job.state,'completed')
 for(const r of job.result.references){
  assert.ok(scopedAllowed.has(r.doc));assert.ok(r.page>0);assert.ok(r.regions.length>0)
  assert.ok(r.regions.every(rect=>rect.length===4&&rect.every(Number.isFinite)&&rect[2]>0&&rect[3]>0))
 }
 return job.result
}
const cases=[
 {id:'project-comparison',question:'Compare the minimum box planter width required by the standards with the width proposed in this project. Identify any difference and cite both documents.',check:r=>{
  const text=JSON.stringify(r.report)
  assert.match(text,/450\s*mm/);assert.match(text,/400\s*mm/);assert.match(text,/50\s*mm|(?:400[^.]{0,80}(?:below|less|short)[^.]{0,80}450)/i)
  assert.ok(r.references.some(ref=>docs.get(ref.doc)?.projectArtifact))
  assert.ok(r.references.some(ref=>!docs.get(ref.doc)?.projectArtifact))
  assert.equal(r.mode,'local_synthesis')
 }},
 {id:'changed-project-size',question:'Can the Rational Method be used for detailed design of a 25 ha minor storm drainage catchment?',check:r=>{
  const text=JSON.stringify(r.report);assert.match(text,/Rational/i);assert.match(text,/65\s*ha/)
  assert.ok(r.references.length>0);assert.ok(!['no_evidence','insufficient_evidence'].includes(r.mode))
  if(restricted) assert.notEqual(r.mode,'local_synthesis')
 }},
 {id:'foreign-jurisdiction',question:'What stormwater design requirements apply to this development in Toronto?',check:r=>{
  assert.ok(['no_evidence','insufficient_evidence'].includes(r.mode));assert.equal(r.references.length,0)
 }},
 {id:'explicit-empty-scope',question:'What minimum cover is required for the storm sewer?',scope:[],check:r=>{
  assert.equal(r.references.length,0);assert.equal(r.documents.length,0)
 }},
]
if(restricted) cases.push({
 id:'general-review-remains-extractive',question:'Before excavation, review a 450 mm storm main with 1.7 m cover. Can we use it without insulation?',
 check:r=>{assert.notEqual(r.mode,'local_synthesis');assert.ok(r.references.length>0)},
})
if(restricted) cases.push(
 {id:'project-cover-comparison',projectId:'parkview-exchange',question:'Compare the proposed cover of storm sewer ST1 (300 mm pipe) against the reference minimum main cover. Identify the shortfall and cite both documents.',check:r=>{
  const text=JSON.stringify(r.report)
  assert.equal(r.mode,'local_synthesis');assert.match(text,/1\.65(?:0)?\s*m/);assert.match(text,/2\.0\s*m|2\s*m/)
  assert.match(text,/0\.35\s*m|350\s*mm/);assert.ok(new Set(r.references.map(ref=>ref.doc)).size>=2)
 }},
 {id:'unsupported-project-comparison',question:'Compare the proposed reinforced bridge pier concrete cover with its reference requirement in this project.',check:r=>{
  assert.ok(['no_evidence','insufficient_evidence','source_evidence'].includes(r.mode))
 }},
 {id:'missing-highway-pavement-basis',projectId:'north-ridge-highway',question:'Compare the proposed PAV-ACP asphalt thickness with a governing minimum thickness for this highway. If documents do not establish an applicable minimum, identify the missing design basis.',check:r=>{
  const text=JSON.stringify(r.report)
  assert.ok(['insufficient_evidence','source_evidence','no_evidence'].includes(r.mode),'Missing design basis must not release a completed comparison')
  const findings=JSON.stringify(r.report.filter(section=>!section.heading))
  assert.doesNotMatch(findings,/exceeds[^.]{0,90}50\s*mm|meets[^.]{0,60}minimum/i)
  assert.match(text,/not[^.]{0,70}(?:establish|specif|provid|confirm|found)|cannot[^.]{0,50}establish|missing|unresolved|insufficient/i)
 }},
 {id:'explicit-value-missing-highway-basis',projectId:'north-ridge-highway',question:'Compare the 110 mm PAV-ACP asphalt layer proposed in this project model with the governing minimum asphalt thickness for this highway. Cite both the project and reference documents.',check:r=>{
  const text=JSON.stringify(r.report)
  assert.ok(['insufficient_evidence','source_evidence','no_evidence'].includes(r.mode),'Missing design basis must not release a completed comparison')
  const findings=JSON.stringify(r.report.filter(section=>!section.heading))
  assert.doesNotMatch(findings,/exceeds[^.]{0,90}50\s*mm|meets[^.]{0,60}minimum/i)
  assert.match(text,/not[^.]{0,70}(?:establish|specif|provid|confirm|found)|cannot[^.]{0,50}establish|missing|unresolved|insufficient/i)
 }},
)
const results=[]
for(const c of cases){const start=Date.now();try{const result=await query(c.question,c.scope,c.projectId);await c.check(result);results.push({id:c.id,passed:true,seconds:(Date.now()-start)/1000,result})}catch(e){results.push({id:c.id,passed:false,seconds:(Date.now()-start)/1000,error:e.message})}console.log(JSON.stringify({...results.at(-1),result:undefined}))}
const foreign=(await api('/projects/demo-willow-creek')).documents.find(d=>d.projectArtifact)
await api('/projects/demo-mill-creek/queries','POST',{question:'Identify the project requirements.',documentIds:[foreign.id]},400)
console.log('PASS foreign-project selection rejected before inference')
writeFileSync(resolve(state,'reasoning-capability-results.json'),JSON.stringify(results,null,2))
if(results.some(r=>!r.passed))process.exitCode=1

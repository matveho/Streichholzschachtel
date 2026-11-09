import assert from 'node:assert/strict'
import {writeFileSync,mkdirSync} from 'node:fs'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {demoStories} from '../../backend/demo/review-scenarios.mjs'

const base=(process.env.BASIS_DEMO_API||'http://127.0.0.1:8789/local-api/v1').replace(/\/$/,'')
assert.ok(['127.0.0.1','localhost','[::1]'].includes(new URL(base).hostname),'Demo preparation must target a loopback backend')
const frontend=(process.env.BASIS_FRONTEND_URL||'https://streichholzschachtel.vercel.app').replace(/\/$/,'')
async function api(path,method='GET',body){
 const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)})
 assert.ok(response.ok,`${method} ${path}: HTTP ${response.status}`)
 return response.json()
}
const health=await(await fetch(base.replace(/\/v1$/,'')+'/health')).json()
assert.ok(health.ready&&!health.failures&&health.generationPolicy==='demo','Enable the tested demo policy before preparing examples')
function validate(story,job){
 assert.equal(job.stale,false,story.title+' is stale')
 assert.equal(job.state,'completed',story.title)
 assert.equal(job.result?.mode,story.id==='catchment-capacity-and-storage'?'verified_review':'local_synthesis',story.title+' did not produce its verified review')
 const text=JSON.stringify(job.result.report)
 if(story.id==='box-planter-width')assert.match(text,/50\s*mm/)
 if(story.id==='storm-main-cover')assert.match(text,/0\.35\s*m|350\s*mm/)
 if(story.id==='catchment-capacity-and-storage'){
  assert.match(text,/1\.5(?:0)?\s*m[³3]\/s/);assert.match(text,/0\.6(?:0)?\s*m[³3]\/s/)
  assert.match(text,/computer.*modell|modelling.*computer/i)
  assert.doesNotMatch(text,/necessitating an upgrade/i)
 }
 assert.ok(job.result.references.length&&job.result.references.every(reference=>reference.regions?.length))
}
const sameScope=(left,right)=>Array.isArray(left)&&Array.isArray(right)&&JSON.stringify([...left].sort())===JSON.stringify([...right].sort())
const stories=[]
for(const story of demoStories){
 const started=Date.now()
 const path='/projects/'+story.projectId+'/queries'
 const project=await api('/projects/'+story.projectId)
 const scope=story.documentIds||project.documents.map(document=>document.id)
 const history=(await api(path)).queries
 const candidate=history.find(job=>job.state==='completed'&&!job.stale&&job.question===story.question&&sameScope(job.documentIds,scope))
 let job,reused=false
 if(candidate){
  const cached=await api(path+'/'+candidate.id)
  try{validate(story,cached);if(sameScope(cached.documentIds,scope)){job=cached;reused=true}}
  catch(error){if(error.code!=='ERR_ASSERTION')throw error}
 }
 if(!job)job=await api(path,'POST',{question:story.question,...(story.documentIds?{documentIds:story.documentIds}:{})})
 for(let i=0;i<180&&['queued','running'].includes(job.state);i++){
  await new Promise(resolve=>setTimeout(resolve,1000));job=await api(path+'/'+job.id)
 }
 validate(story,job)
 await api(path+'/'+job.id,'PATCH',{saved:true})
 const prepared={id:story.id,title:story.title,projectId:story.projectId,queryId:job.id,url:frontend+'/#project/'+story.projectId+'/query/'+job.id,seconds:Math.round((Date.now()-started)/1000),sourceCount:job.result.references.length,reused}
 stories.push(prepared);console.log(JSON.stringify(prepared))
}
const project=await api('/projects/parkview-exchange')
const findings=project.issues.filter(issue=>!issue.prepared).length
assert.ok(findings>=13,'The IFC findings are not ready')
const report={preparedAt:new Date().toISOString(),generationPolicy:health.generationPolicy,stories,ifc:{url:frontend+'/#project/parkview-exchange',findings}}
const output=process.env.BASIS_DEMO_REPORT||resolve(dirname(fileURLToPath(import.meta.url)),'../../backend/state/demo-rehearsal.json')
mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2))
console.log(JSON.stringify({ready:true,report:output,ifcFindings:findings}))

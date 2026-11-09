import assert from 'node:assert/strict'
import {chromium,expect} from '@playwright/test'
import {supplementalRecords} from '../demo/supplemental-records.mjs'
const frontend=process.env.BASIS_FRONTEND_URL
assert.equal(frontend,'http://127.0.0.1:8842/app')
assert.ok(process.env.BASIS_STATE_DIR?.includes('/verification/run-browser-'))
const api=new URL('/local-api/v1',frontend).href
const browser=await chromium.launch({headless:true})
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}})
 page.setDefaultTimeout(30000)
 for(const [projectId,records] of Object.entries(supplementalRecords)){
  const detail=await(await fetch(api+'/projects/'+projectId)).json()
  assert.equal(detail.documents.length,projectId==='parkview-exchange'?19:20)
  assert.ok(detail.issues.filter(issue=>issue.prepared).every(issue=>issue.verified))
  if(projectId==='parkview-exchange')assert.equal(detail.issues.filter(issue=>!issue.prepared).length,13,'Unselected RFI options must not add model discrepancies')
  const foreignId=projectId==='parkview-exchange'?'north-ridge-highway':'parkview-exchange'
  for(const record of records){
   const doc=detail.documents.find(doc=>doc.filename===record.file||doc.filenames?.includes(record.file)||doc.title===record.title)
   assert.ok(doc,record.file);assert.equal(doc.pages,4)
   const file=await fetch(api+'/projects/'+projectId+'/documents/'+doc.id+'/file',{headers:{Range:'bytes=0-31'}})
   assert.equal(file.status,206)
   assert.equal((await fetch(api+'/projects/'+foreignId+'/documents/'+doc.id+'/file')).status,404)
   const question=record.code==='PX-UV-001'?'What is the outside-surface clearance at crossing X1?':record.code==='PX-RFI-004'?'What is the downstream invert for S1 option A?':record.code==='NRH-TC-001'?'What are the traffic count worksheet approach totals?':'What is the heavy vehicle count difference?'
   const response=await fetch(api+'/projects/'+projectId+'/queries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question,documentIds:[doc.id],sourceOnly:true})})
   assert.equal(response.status,202);let job=await response.json()
   for(let i=0;i<120&&['queued','running'].includes(job.state);i++){await new Promise(r=>setTimeout(r,100));job=await(await fetch(api+'/projects/'+projectId+'/queries/'+job.id)).json()}
   assert.equal(job.state,'completed');assert.ok(job.result.references.length)
   assert.ok(job.result.references.every(ref=>ref.doc===doc.id&&ref.regions.length))
   const expected={'PX-UV-001':'0.220','PX-RFI-004':'668.050','NRH-TC-001':'420','NRH-IC-002':'372'}[record.code]
   assert.ok(JSON.stringify(job.result.report).includes(expected),JSON.stringify(job.result.report))
   await page.goto(frontend+'/#project/'+projectId+'/query/'+job.id)
   await page.getByRole('article',{name:'Query report'}).waitFor()
   await page.getByRole('button',{name:new RegExp('^Source '+job.result.references[0].id+':')}).first().click()
   await page.locator('.source-highlight:visible').first().waitFor()
   await page.waitForFunction(()=>document.querySelectorAll('.pdf-status').length===0)
   await page.screenshot({path:'test-results/'+record.code+'-source.png',fullPage:true})
   console.log('PASS '+record.code+': four-page original PDF, byte range, private scope, fresh factual lookup and highlighted source')
  }
 }
}finally{await browser.close()}

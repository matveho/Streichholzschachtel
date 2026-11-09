import assert from 'node:assert/strict'
import {chromium} from '@playwright/test'
const frontend=process.env.BASIS_FRONTEND_URL
assert.equal(frontend,'http://127.0.0.1:8842/app')
assert.ok(process.env.BASIS_STATE_DIR?.includes('/verification/run-browser-'))
const api=new URL('/local-api/v1',frontend).href
const project='demo-mill-creek'
const ids=['doc-dc122df73bce','doc-da424a924abd']
const detail=await(await fetch(api+'/projects/'+project)).json()
assert.ok(ids.every(id=>detail.documents.some(doc=>doc.id===id)))
let job=await(await fetch(api+'/projects/'+project+'/queries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:'What is the minimum depth of a storm service at the property line?',sourceOnly:true,documentIds:ids})})).json()
for(let i=0;i<120&&['queued','running'].includes(job.state);i++){
 await new Promise(resolve=>setTimeout(resolve,250))
 job=await(await fetch(api+'/projects/'+project+'/queries/'+job.id)).json()
}
assert.equal(job.state,'completed')
assert.equal(job.result.mode,'extractive_answer')
assert.equal(job.result.assist.outcome,'partial')
assert.equal(job.result.requiredInputs.kind,'reference_basis')
assert.ok(job.result.references.every(reference=>ids.includes(reference.doc)))
const criteria=job.result.referenceInterfaces[0].criteria
assert.equal(criteria.length,2)
assert.deepEqual(new Set(criteria.map(row=>row.datum)),new Set(['not-stated','invert-to-curb']))
const browser=await chromium.launch({headless:true})
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(30000)
 const errors=[];page.on('pageerror',error=>errors.push(error.message))
 await page.goto(frontend+'/#project/'+project+'/query/'+job.id)
 const report=page.getByRole('article',{name:'Query report'})
 await report.getByRole('heading',{name:'Reference criteria to reconcile',exact:true}).waitFor()
 assert.match(await report.innerText(),/2\.4 m/)
 assert.match(await report.innerText(),/invert to finished curb grade/)
 for(const criterion of criteria){
  await page.getByRole('button',{name:new RegExp('^Source '+criterion.referenceId+':')}).first().click()
  await page.locator('.source-highlight:visible').first().waitFor()
  await page.waitForFunction(()=>document.querySelectorAll('.pdf-status').length===0)
 }
 await page.reload()
 await report.getByRole('heading',{name:'Reference criteria to reconcile',exact:true}).waitFor()
 assert.match(await report.innerText(),/measurement datum not stated/)
 await page.screenshot({path:'test-results/reference-criteria-browser.png',fullPage:true})
 assert.deepEqual(errors,[])
 console.log('PASS offline scoped reference reconciliation, specific clarification, both original PDF highlights and persisted report')
}finally{await browser.close()}

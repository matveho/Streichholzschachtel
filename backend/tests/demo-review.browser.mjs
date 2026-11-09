import assert from 'node:assert/strict'
import {mkdirSync} from 'node:fs'
import {chromium} from '@playwright/test'
import {demoReviews} from '../demo/review-scenarios.mjs'

const frontend=process.env.BASIS_FRONTEND_URL
assert.equal(frontend,'http://127.0.0.1:8842/app')
assert.ok(process.env.BASIS_STATE_DIR?.includes('/verification/run-browser-'))
const api=new URL('/local-api/v1',frontend).href
const scenario=demoReviews[0]
assert.equal((await(await fetch(new URL('/local-api/health',frontend))).json()).generationPolicy,'demo')
const browser=await chromium.launch({headless:true})
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}})
 page.setDefaultTimeout(30000)
 const errors=[];page.on('pageerror',error=>errors.push(error.message))
 await page.goto(frontend+'/#project/'+scenario.projectId)
 await page.getByRole('button',{name:'New query',exact:true}).click()
 await page.locator('#query').fill(scenario.question)
 const posted=page.waitForResponse(response=>response.url().endsWith('/projects/'+scenario.projectId+'/queries')&&response.request().method()==='POST')
 await page.locator('.run-query').click()
 const job=await(await posted).json()
 const report=page.getByRole('article',{name:'Query report'})
 await page.waitForFunction(()=>/1\.5(?:0)?\s*m[³3]\/s/.test(document.querySelector('.query-report')?.textContent||''),{},{timeout:120000})
 const completed=await(await fetch(api+'/projects/'+scenario.projectId+'/queries/'+job.id)).json()
 assert.equal(completed.state,'completed');assert.equal(completed.result.mode,'verified_review')
 assert.equal(completed.result.arithmeticReview?.applicabilityConfirmed,false)
 assert.match(await report.innerText(),/0\.6(?:0)?\s*m[³3]\/s/)
 assert.match(await report.innerText(),/computer.*modell|modelling.*computer/i)
 assert.doesNotMatch(await report.innerText(),/necessitating an upgrade/i)
 for(const documentId of scenario.requiredDocumentIds){
  const source=completed.result.references.find(reference=>reference.doc===documentId)
  assert.ok(source,'Missing original engineering evidence '+documentId)
  await page.getByRole('button',{name:new RegExp('^Source '+source.id+':')}).first().click()
  await page.locator('.source-highlight:visible').first().waitFor()
  await page.waitForFunction(()=>document.querySelectorAll('.pdf-status').length===0)
 }
 const saved=await fetch(api+'/projects/'+scenario.projectId+'/queries/'+job.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({saved:true})})
 assert.ok(saved.ok)
 await page.goto(frontend+'/#project/'+scenario.projectId)
 const history=page.getByRole('region',{name:'Project query history'})
 await history.getByRole('button',{name:'Saved',exact:true}).click()
 await history.getByRole('link',{name:new RegExp('A subdivision has expanded')}).click()
 await report.waitFor();assert.match(await report.innerText(),/0\.6(?:0)?\s*m[³3]\/s/)
 await page.reload();await report.waitFor()
 assert.match(await report.innerText(),/1\.5(?:0)?\s*m[³3]\/s/)
 await page.getByRole('button',{name:new RegExp('^Source '+completed.result.references[0].id+':')}).first().click()
 await page.waitForFunction(()=>document.querySelectorAll('.pdf-status').length===0)
 await page.locator('.source-highlight:visible').first().waitFor()
 mkdirSync('test-results',{recursive:true})
 await page.screenshot({path:'test-results/demo-capacity-sources.png',fullPage:true})
 await page.getByRole('button',{name:'Expand result panel',exact:true}).click()
 await page.screenshot({path:'test-results/demo-capacity-review.png',fullPage:true})
 assert.deepEqual(errors,[])
 console.log('PASS updated dashboard submission, complex capacity and pond review, both source PDF highlights, Saved history and report reload')
}finally{await browser.close()}

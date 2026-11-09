import assert from 'node:assert/strict'
import {mkdirSync} from 'node:fs'
import {chromium} from '@playwright/test'

const frontend=process.env.BASIS_FRONTEND_URL
assert.equal(frontend,'http://127.0.0.1:8842/app')
assert.ok(process.env.BASIS_STATE_DIR?.includes('/verification/run-browser-'))
const api=new URL('/local-api/v1',frontend).href
const project='demo-mill-creek'
const question='Before excavation, review a 450 mm storm main with 1.7 m cover and a storm service with 2.0 m cover at the property line. Can we use these details without insulation or further approval?'
const browser=await chromium.launch({headless:true})
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}})
 page.setDefaultTimeout(30000)
 const errors=[];page.on('pageerror',error=>errors.push(error.message))
 await page.goto(frontend+'/#project/'+project)
 await page.getByRole('button',{name:'Open new query tab',exact:true}).click()
 await page.locator('#query').fill(question)
 const submitted=page.waitForResponse(response=>response.url().endsWith('/projects/'+project+'/queries')&&response.request().method()==='POST')
 await page.locator('.run-query').click()
 const job=await(await submitted).json()
 const report=page.getByRole('article',{name:'Query report'})
 const heading=report.getByRole('heading',{name:'Supplied project measurements',exact:true})
 await heading.waitFor()
 const completed=await(await fetch(api+'/projects/'+project+'/queries/'+job.id)).json()
 assert.equal(completed.state,'completed')
 assert.notEqual(completed.result.mode,'local_synthesis')
 const inputs=completed.result.projectInputs
 assert.equal(inputs.verifiedAgainstDocuments,false)
 assert.equal(inputs.origin,'question')
 assert.equal(inputs.measurements.length,3)
 assert.ok(!inputs.measurements.some(record=>record.role==='service'&&record.property==='diameter'))
 const missing=completed.result.requiredInputs
 assert.equal(missing.kind,'pipe_review_inputs')
 assert.deepEqual(missing.fields.map(field=>field.key),['storm_main_cover_datum','storm_service_cover_datum','storm_service_diameter'])
 assert.deepEqual(completed.result.assetEvidence.map(check=>[check.role,check.status]),[['main','source_evidence'],['service','source_evidence']])
 assert.ok(completed.result.assetEvidence.every(check=>check.referenceIds.length))
 await report.getByRole('heading',{name:'Storm main cover · source evidence',exact:true}).waitFor()
 await report.getByRole('heading',{name:'Storm service cover · source evidence',exact:true}).waitFor()
 assert.ok(missing.fields.every(field=>field.referenceIds.length&&field.referenceIds.every(id=>completed.result.references.some(reference=>reference.id===id&&reference.regions.length))))
 await report.getByRole('heading',{name:'Project inputs to confirm',exact:true}).waitFor()
 assert.match(await report.innerText(),/Storm service cover datum/)
 assert.match(await report.innerText(),/Storm service diameter \(mm\)/)
 assert.equal(completed.result.assist.outcome,'partial')
 assert.match(await report.innerText(),/storm main · diameter: 450 mm/)
 assert.match(await report.innerText(),/storm main · cover: 1\.7 m/)
 assert.match(await report.innerText(),/storm service · cover: 2 m/)
 assert.match(await report.innerText(),/measurement datum not stated in query/)
 const source=completed.result.references[0]
 assert.ok(source?.regions.length)
 await page.getByRole('button',{name:new RegExp('^Source '+source.id+':')}).first().click()
 await page.locator('.source-highlight:visible').first().waitFor()
 await page.waitForFunction(()=>document.querySelectorAll('.pdf-status').length===0)
 await page.reload();await heading.waitFor()
 assert.match(await report.innerText(),/Query inputs are review assumptions/)
 assert.match(await report.innerText(),/Storm service cover datum/)
 mkdirSync('test-results',{recursive:true})
 await page.screenshot({path:'test-results/pipe-measurements-browser.png',fullPage:true})
 assert.deepEqual(errors,[])
 console.log('PASS real query submission, bound main/service input register, unknown service diameter, PDF highlight and persisted report')
}finally{await browser.close()}

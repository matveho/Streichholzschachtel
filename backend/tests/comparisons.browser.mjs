import assert from 'node:assert/strict'
import {chromium} from '@playwright/test'
import {mkdirSync} from 'node:fs'
const frontend=process.env.BASIS_FRONTEND_URL
assert.equal(frontend,'http://127.0.0.1:8842/app')
assert.ok(process.env.BASIS_STATE_DIR?.includes('/verification/run-browser-'))
const base=new URL('/local-api/v1',frontend).href
const browser=await chromium.launch({headless:true})
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}})
 const errors=[];page.on('pageerror',error=>errors.push(error.message))
 await page.goto(frontend+'/#project/demo-mill-creek')
 await page.getByRole('button',{name:'Open new query tab',exact:true}).click()
 await page.locator('#query').fill('Compare the minimum box planter width required by the standards with the width proposed in this project. Identify any difference and cite both documents.')
 const submitted=page.waitForResponse(response=>response.url().endsWith('/projects/demo-mill-creek/queries')&&response.request().method()==='POST')
 await page.locator('.run-query').click()
 const job=await(await submitted).json()
 const report=page.getByRole('article',{name:'Query report'})
 await report.waitFor({timeout:60000})
 await page.waitForFunction(()=>/50\s*mm/.test(document.querySelector('.query-report')?.textContent||''),{},{timeout:60000})
 const result=await(await fetch(base+'/projects/demo-mill-creek/queries/'+job.id)).json()
 assert.equal(result.result.mode,'local_synthesis')
 assert.ok(result.result.requirementsReview.rows.some(row=>/50 mm/.test(row.difference)&&/450 mm/.test(row.requirement)&&/400 mm/.test(row.projectValue)))
 await page.locator('.requirements-review summary').click()
 assert.match(await page.locator('.requirements-review').innerText(),/50 mm/)
 await page.screenshot({path:'test-results/requirements-comparison.png',fullPage:true})
 assert.match(await report.innerText(),/450\s*mm/);assert.match(await report.innerText(),/400\s*mm/)
 for (const id of ['1','2']) {
  await page.getByRole('button',{name:new RegExp('^Source '+id+':')}).first().click()
  await page.locator('.source-highlight:visible').first().waitFor({timeout:30000})
  await page.waitForFunction(()=>document.querySelectorAll('.pdf-status').length===0)
 }
 await page.reload();await report.waitFor({timeout:30000})
 assert.match(await report.innerText(),/50\s*mm/)
 const fallback=await fetch(base+'/projects/demo-mill-creek/queries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:'Before excavation, review a 450 mm storm main with 1.7 m cover. Can we use it without insulation?'})})
 let offline=await fallback.json()
 for(let i=0;i<30&&['queued','running'].includes(offline.state);i++){
  await new Promise(resolve=>setTimeout(resolve,250));offline=await(await fetch(base+'/projects/demo-mill-creek/queries/'+offline.id)).json()
 }
 assert.equal(offline.state,'completed');assert.notEqual(offline.result.mode,'local_synthesis')
 const project=await(await fetch(base+'/projects/parkview-exchange')).json()
 assert.ok(project.issues.filter(issue=>!issue.prepared).length>=13)
 mkdirSync('test-results',{recursive:true})
 await page.screenshot({path:'test-results/gpu-comparison-browser.png',fullPage:true})
 assert.deepEqual(errors,[])
 console.log('PASS UI comparison submission, verified arithmetic, both PDF highlights, reload/history, offline general review and automatic IFC findings')
} finally {await browser.close()}

import assert from 'node:assert/strict'
import {chromium,expect} from '@playwright/test'

const frontend=process.env.BASIS_FRONTEND_URL
assert.equal(frontend,'http://127.0.0.1:8842/app')
assert.ok(process.env.BASIS_STATE_DIR?.includes('/verification/run-browser-'))
const api=new URL('/local-api/v1/projects/demo-mill-creek',frontend).href
async function create(question){
 const response=await fetch(api+'/queries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question,sourceOnly:true})})
 assert.equal(response.status,202)
 let job=await response.json()
 for(let i=0;i<100&&['queued','running'].includes(job.state);i++){
  await new Promise(resolve=>setTimeout(resolve,100));job=await(await fetch(api+'/queries/'+job.id)).json()
 }
 assert.equal(job.state,'completed')
 return job
}
const browser=await chromium.launch({headless:true})
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}})
 const errors=[];page.on('pageerror',error=>errors.push(error.message))
 const first=await create('What is the minimum slope for a storm service connection?')
 const keeper=await create('What minimum cover is required for a storm sewer main?')
 for(const job of [first,keeper]){
  await page.goto(frontend+'/#project/demo-mill-creek/query/'+job.id)
  await page.getByRole('article',{name:'Query report'}).waitFor()
 }
 await page.getByRole('navigation',{name:'Open queries'}).getByRole('link',{name:'Project dashboard',exact:true}).click()
 const issueToggle=page.getByRole('checkbox',{name:'Show project issues'})
 await expect(issueToggle).toHaveCount(0)
 await page.getByRole('button',{name:'Settings',exact:true}).click()
 await expect(page.getByRole('group',{name:'Workspace settings'}).getByRole('checkbox',{name:'Show project issues'})).toBeVisible()
 assert.equal(await issueToggle.isChecked(),true)
 await issueToggle.uncheck()
 await page.getByRole('region',{name:'Potential issues'}).waitFor({state:'hidden'})
 await page.reload()
 await expect(issueToggle).toHaveCount(0)
 await page.getByRole('button',{name:'Settings',exact:true}).click()
 assert.equal(await issueToggle.isChecked(),false)
 assert.equal((await fetch(api+'/rescan',{method:'POST'})).status,409)
 await issueToggle.check()
 await page.getByRole('region',{name:'Potential issues'}).waitFor()
 await page.keyboard.press('Escape')
 await expect(issueToggle).toHaveCount(0)
 const history=page.getByRole('region',{name:'Project query history'})
 const row=id=>history.locator('.project-query-row').filter({has:page.locator("a[href='#project/demo-mill-creek/query/"+id+"']")})
 await row(first.id).getByRole('button',{name:'Save query',exact:true}).click()
 await expect(row(first.id).getByRole('button',{name:'Unsave query',exact:true})).toBeVisible()
 await history.getByRole('button',{name:'Saved',exact:true}).click()
 const deleted=page.waitForResponse(response=>response.request().method()==='DELETE'&&response.url().endsWith('/queries/'+first.id))
 await row(first.id).getByRole('button',{name:'Delete query',exact:true}).click()
 assert.equal((await(await deleted).json()).deleted,true)
 await expect(row(first.id)).toHaveCount(0)
 await page.waitForFunction(id=>{
  const saved=JSON.parse(sessionStorage.getItem('basis.query-tabs.v1:project:demo-mill-creek'))
  return !saved.tabs.some(tab=>tab.target===id)
 },first.id)
 assert.equal((await fetch(api+'/queries/'+first.id)).status,404)
 const project=await(await fetch(api)).json()
 assert.ok(!project.project.savedQueryIds.includes(first.id))
 assert.ok(project.queries.some(query=>query.id===keeper.id))
 await page.reload()
 await history.waitFor()
 await expect(row(first.id)).toHaveCount(0)
 await expect(row(keeper.id)).toBeVisible()
 const tabs=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('basis.query-tabs.v1:project:demo-mill-creek')).tabs)
 assert.ok(tabs.some(tab=>tab.target===keeper.id))
 await page.setViewportSize({width:390,height:844})
 await expect(row(keeper.id).getByRole('button',{name:'Delete query',exact:true})).toBeVisible()
 await page.screenshot({path:'test-results/query-history-mobile.png',fullPage:true})
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
 await row(keeper.id).getByRole('button',{name:'Delete query',exact:true}).click()
 await expect(row(keeper.id)).toHaveCount(0)
 assert.equal((await fetch(api+'/queries/'+keeper.id)).status,404)
 assert.deepEqual(errors,[])
 console.log('PASS one-click history deletion, Saved cleanup, matching tab removal, unrelated query preservation, reload and mobile deletion')
}finally{await browser.close()}

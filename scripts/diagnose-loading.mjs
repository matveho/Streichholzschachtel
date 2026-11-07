import { chromium } from '@playwright/test'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
 const page=await browser.newPage({viewport:{width:1100,height:1100}})
 await page.goto('http://127.0.0.1:5173/#query/storm')
 await page.waitForFunction(()=>!document.querySelector('.pdf-status'))
 const geometry=await page.locator('.pdf-pane').first().evaluate(el=>({sheet:el.querySelector('.pdf-sheet').getBoundingClientRect().height,scroll:el.querySelector('.pdf-scroll').getBoundingClientRect().height,client:el.querySelector('.pdf-scroll').clientHeight,width:el.querySelector('.pdf-scroll').clientWidth,padding:getComputedStyle(el.querySelector('.pdf-scroll')).padding}))
 console.log('geometry',geometry)
 const threshold=1100+geometry.sheet+56-geometry.scroll
 for(const height of [650,800,Math.round(threshold)-8,Math.round(threshold),Math.round(threshold)+8,Math.round(threshold)+20,1100]){
  await page.setViewportSize({width:1100,height})
  await page.evaluate(()=>{
   window.samples=[]
   const el=document.querySelector('.pdf-scroll');
   window.resizeMonitor?.disconnect();
   window.resizeMonitor=new ResizeObserver(entries=>window.samples.push({w:entries[0].contentRect.width,h:entries[0].contentRect.height,canvas:el.querySelector('canvas').width,status:el.querySelector('.pdf-status')?.textContent}));
   window.resizeMonitor.observe(el)
  })
  await page.waitForTimeout(1200)
  console.log(height, await page.evaluate(()=>({changes:window.samples.length,samples:window.samples.slice(-8),loading:!!document.querySelector('.pdf-status')})))
 }
} finally{ await browser.close() }

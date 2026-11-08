import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync, unlinkSync } from 'node:fs'
const file = 'test-results/refinement-fixture.html'
mkdirSync('test-results', { recursive: true })
writeFileSync(
  file,
  `<div id="root"></div><script type="module">
import React from '/node_modules/.vite/deps/react.js';
import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
const {createRoot}=ReactDOM;
import {QueryAssist} from '/src/QueryAssist.tsx';
import '/src/index.css';
window.submissions=[];window.edits=0;
const root=createRoot(document.getElementById('root'));
window.show=(outcome)=>root.render(React.createElement(QueryAssist,{key:outcome,mode:'insufficient_evidence',question:'minimum pipe slope 150 mm',inProject:true,
assist:{outcome,details:['System: storm, sanitary or water.'],clarifications:outcome==='partial'?[{question:'Which system is this for?',options:[{label:'Storm sewer',question:'minimum pipe slope 150 mm for storm sewer?'},{label:'Sanitary sewer',question:'minimum pipe slope 150 mm for sanitary sewer?'}]}]:[],examples:[]},
onRefine:(question,choice)=>window.submissions.push({question,choice}),onRephrase:()=>window.edits++}));
window.show('partial');
</script>`,
)
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('http://127.0.0.1:5173/' + file)
  const apply = page.getByRole('button', {
    name: 'Apply and search',
    exact: true,
  })
  await apply.waitFor()
  assert.equal(await apply.isDisabled(), true)
  await page.getByRole('radio', { name: 'Storm sewer', exact: true }).check()
  assert.equal(await page.evaluate(() => window.submissions.length), 0)
  await apply.click()
  assert.equal(
    (await page.evaluate(() => window.submissions[0])).question,
    'minimum pipe slope 150 mm for storm sewer?',
  )
  const revised = page.getByRole('textbox', {
    name: 'Revised search',
    exact: true,
  })
  await revised.fill('Minimum slope for a 200 mm sanitary sewer')
  await revised.press('Enter')
  assert.equal(
    (await page.evaluate(() => window.submissions.at(-1))).question,
    'Minimum slope for a 200 mm sanitary sewer',
  )
  assert.equal(
    await page.getByText(/read-only|backend.s documents folder/i).count(),
    0,
  )
  await page.evaluate(() => window.show('answered'))
  await page.waitForFunction(() => !document.querySelector('.assist'))
  await page.evaluate(() => window.show('off_topic'))
  await page
    .getByRole('heading', { name: 'Search not recognized', exact: true })
    .waitFor()
  await page.getByRole('button', { name: 'Edit search', exact: true }).click()
  assert.equal(await page.evaluate(() => window.edits), 1)
  await page.evaluate(() => window.show('jurisdiction'))
  await page
    .getByRole('heading', { name: /Jurisdiction outside search scope/ })
    .waitFor()
  assert.equal(
    await page.getByText(/City of Edmonton \(EPCOR\) standards/).count(),
    0,
  )
  await page.setViewportSize({ width: 390, height: 844 })
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  )
  assert.deepEqual(errors, [])
  console.log(
    'PASS explicit parameter selection, no automatic submission, units preserved, full-query replacement, edit action, jurisdiction wording and mobile layout',
  )
} finally {
  await browser.close()
  unlinkSync(file)
}

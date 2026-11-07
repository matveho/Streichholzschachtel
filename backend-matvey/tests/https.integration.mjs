import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const { url, key } = JSON.parse(readFileSync('state/connection.json', 'utf8'))
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const page = await browser.newPage()
  await page.goto('https://streichholzschachtel.vercel.app')
  const result = await page.evaluate(
    async ({ url, key }) => {
      const headers = { Authorization: 'Bearer ' + key }
      const docsResponse = await fetch(url + '/v1/documents', { headers })
      const { documents } = await docsResponse.json()
      const pdf = await fetch(new URL(documents[0].file, url), {
        headers: { Range: 'bytes=0-3' },
      })
      const prefix = await pdf.text()
      let job = await (
        await fetch(url + '/v1/queries', {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: 'What is the capital of France?' }),
        })
      ).json()
      for (
        let i = 0;
        i < 20 && ['running', 'queued'].includes(job.state);
        i++
      ) {
        await new Promise((r) => setTimeout(r, 500))
        job = await (
          await fetch(url + '/v1/queries/' + job.id, { headers })
        ).json()
      }
      return {
        documents: documents.length,
        pdfStatus: pdf.status,
        prefix,
        queryState: job.state,
        queryMode: job.result?.mode,
        referenceCount: job.result?.references.length,
      }
    },
    { url, key },
  )
  assert.equal(result.documents, 5)
  assert.equal(result.pdfStatus, 206)
  assert.equal(result.prefix, '%PDF')
  assert.equal(result.queryState, 'completed')
  assert.equal(result.queryMode, 'no_evidence')
  assert.equal(result.referenceCount, 0)
  console.log(
    'PASS authenticated HTTPS from production origin: metadata, original PDF range, JSON POST and polling, supported CORS preflights, explicit no-evidence answer',
  )
  const bundled = await browser.newPage()
  await bundled.addInitScript(
    ({ url, key }) =>
      localStorage.setItem(
        'basis.backends.v1',
        JSON.stringify({
          mode: 'matvey',
          mainUrl: '',
          mainKey: '',
          matveyUrl: url,
          key,
        }),
      ),
    { url, key },
  )
  await bundled.goto(url + '/app/#home')
  await bundled
    .getByRole('heading', { name: 'Previous queries', exact: true })
    .waitFor()
  await bundled
    .getByRole('button', { name: 'Check connection', exact: true })
    .click()
  await bundled.getByText('Ready · 5 documents', { exact: true }).waitFor()
  await bundled.getByRole('button', { name: 'New query', exact: true }).click()
  await bundled.locator('#query').fill('What is the capital of France?')
  await bundled.getByRole('button', { name: 'Search', exact: true }).click()
  await bundled
    .getByRole('heading', { name: 'No supported answer', exact: true })
    .waitFor({ timeout: 30000 })
  console.log(
    'PASS launcher HTTPS interface: authenticated same-origin connection, query submission, polling and no-evidence rendering',
  )
} finally {
  await browser.close()
}

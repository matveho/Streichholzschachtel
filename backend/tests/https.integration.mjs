import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'

const origin =
  process.env.BASIS_FRONTEND_URL || 'https://streichholzschachtel.vercel.app'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const page = await browser.newPage()
  await page.goto(origin + '/#home')
  const result = await page.evaluate(async () => {
    const base = '/local-api'
    const health = await (await fetch(base + '/health')).json()
    const response = await fetch(base + '/v1/documents')
    const metadata = await response.json()
    const pdf = await fetch(metadata.documents[0].file, {
      headers: { Range: 'bytes=0-3' },
    })
    const prefix = await pdf.text()
    const history = await fetch(base + '/v1/queries')
    let job = await (
      await fetch(base + '/v1/queries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: 'What is the capital of France?' }),
      })
    ).json()
    for (let i = 0; i < 40 && ['running', 'queued'].includes(job.state); i++) {
      await new Promise((resolve) => setTimeout(resolve, 500))
      job = await (await fetch(base + '/v1/queries/' + job.id)).json()
    }
    return {
      ready: health.ready,
      failures: health.failures,
      expectedCount: health.documents,
      documents: metadata.documents.length,
      metadataStatus: response.status,
      files: metadata.documents.map((d) => d.file),
      pdfStatus: pdf.status,
      prefix,
      historyStatus: history.status,
      state: job.state,
      mode: job.result?.mode,
      referenceCount: job.result?.references.length,
      resultCount: job.result?.documents.length,
    }
  })
  assert.equal(result.ready, true)
  assert.equal(result.failures, 0)
  assert.equal(result.metadataStatus, 200)
  assert.ok(result.documents > 0)
  assert.equal(result.documents, result.expectedCount)
  assert.ok(
    result.files.every(
      (file) => file.startsWith('/local-api/') && !file.includes('token='),
    ),
  )
  assert.equal(result.pdfStatus, 206)
  assert.equal(result.prefix, '%PDF')
  assert.equal(result.historyStatus, 404)
  assert.equal(result.state, 'completed')
  assert.ok(['no_evidence', 'insufficient_evidence'].includes(result.mode))
  assert.equal(result.referenceCount, 0)
  assert.equal(result.resultCount, 0)
  console.log(
    'PASS public Vercel gateway: automatic document access, original PDF ranges, query submission and polling, empty unsupported results and no full history listing',
  )
} finally {
  await browser.close()
}

import { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'

let browser
before(async () => {
  browser = await chromium.launch({ channel: 'chrome' })
})
after(async () => {
  await browser?.close()
})

// Text positions are in PDF points, measured from the bottom left.
export function fixturePdf(cover = 'Cover') {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',
  ]
  for (const n of [6, 7])
    objects.push(
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 500] /Resources << /Font << /F1 5 0 R >> >> /Contents ' +
        n +
        ' 0 R >>',
    )
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
  for (const label of [cover, 'Pipe S1']) {
    const stream =
      'BT /F1 12 Tf 50 350 Td (' + label + ') Tj 160 0 Td (200 mm) Tj ET'
    objects.push(
      '<< /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream',
    )
  }
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((o, i) => {
    offsets.push(pdf.length)
    pdf += i + 1 + ' 0 obj\n' + o + '\nendobj\n'
  })
  const xref = pdf.length
  return Buffer.from(
    pdf +
      'xref\n0 8\n0000000000 65535 f \n' +
      offsets
        .slice(1)
        .map((x) => String(x).padStart(10, '0') + ' 00000 n \n')
        .join('') +
      'trailer\n<< /Size 8 /Root 1 0 R >>\nstartxref\n' +
      xref +
      '\n%%EOF',
  )
}
export function project(id) {
  return {
    id,
    name: 'Project ' + id,
    client: 'Owner',
    location: '',
    description: '',
    documentIds: ['doc-' + id],
    collectionIds: [],
    documentCount: 1,
    openIssueCount: 0,
  }
}
export function document(id) {
  return {
    id: 'doc-' + id,
    label: 'Drawing ' + id,
    title: 'Drawing ' + id,
    category: 'design',
    file: '/pdf/' + id,
    pages: 2,
    initialPage: 1,
    edition: 'Rev 1',
    pageSizes: { 1: [400, 500], 2: [400, 500] },
  }
}
export function job(pid, id = 'initial') {
  const doc = document(pid)
  return {
    projectId: pid,
    id,
    state: 'completed',
    createdAt: '2026-11-01',
    question: 'Question ' + id,
    sourceOnly: true,
    result: {
      mode: 'extractive_answer',
      documents: [doc],
      notes: [],
      references: [
        {
          id: '1',
          doc: doc.id,
          page: 2,
          label: 'Schedule',
          rect: [50, 139, 202, 14],
          regions: [
            [50, 139, 38, 14],
            [210, 139, 46, 14],
          ],
        },
      ],
      report: [
        { sentences: [{ text: 'Verified ' + pid + ' ' + id, refs: ['1'] }] },
      ],
    },
  }
}
export async function setup(t, custom = () => undefined) {
  const p = await browser.newPage()
  t.after(() => p.close())
  await p.route('**/*', async (r) => {
    const url = new URL(r.request().url())
    assert.equal(url.hostname, 'localhost')
    const path = url.pathname
    if (path.startsWith('/local-api/')) {
      const endpoint = path.slice('/local-api'.length)
      const pid = endpoint.split('/')[3]
      const override = await custom(endpoint, r.request())
      if (override) return r.fulfill(override)
      let json
      if (endpoint === '/v1/projects')
        json = { projects: ['alpha', 'beta'].map(project) }
      else if (endpoint === '/v1/reference-collections')
        json = { collections: [], documents: [] }
      else if (endpoint === '/v1/projects/' + pid)
        json = {
          project: project(pid),
          documents: [document(pid)],
          collections: [],
          issues: [],
          queries: [job(pid)],
        }
      else if (endpoint.includes('/queries/'))
        json = job(pid, endpoint.split('/').at(-1))
      return r.fulfill(
        json
          ? { json }
          : { status: 404, json: { error: 'Unknown mock route' } },
      )
    }
    if (path.startsWith('/pdf/'))
      return r.fulfill({ contentType: 'application/pdf', body: fixturePdf() })
    const asset = path === '/' ? 'index.html' : path.slice(1)
    const body = await readFile(new URL('../../dist/' + asset, import.meta.url))
    return r.fulfill({
      body,
      contentType:
        {
          js: 'application/javascript',
          mjs: 'application/javascript',
          css: 'text/css',
          html: 'text/html',
          png: 'image/png',
          woff2: 'font/woff2',
        }[asset.split('.').at(-1)] || 'application/octet-stream',
    })
  })
  return p
}
export const link = (pid, tail = '') =>
  'http://localhost/#project/' + pid + tail

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { resolve } from 'node:path'
const root = resolve(
  new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/i, '$1'),
)
const base = 'http://127.0.0.1:8842/local-api',
  ids = []
async function api(path, method = 'GET', body) {
  const response = await fetch(base + '/v1' + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const data = await response.json()
  return { status: response.status, data }
}
try {
  let indexed = false
  for (let i = 0; i < 120; i++) {
    try {
      indexed = (await (await fetch(base + '/health')).json()).ready
    } catch {}
    if (indexed) break
    await new Promise((r) => setTimeout(r, 250))
  }
  assert.ok(indexed)
  const collections = (await api('/reference-collections')).data.collections
  const create = async () => {
    const r = await api('/projects', 'POST', {
      name: 'Import verification',
      collectionIds: [collections.find((c) => c.id === 'alberta-bridges').id],
    })
    assert.equal(r.status, 201)
    ids.push(r.data.project.id)
    return r.data.project
  }
  const a = await create(),
    b = await create()
  assert.ok(a.description.toLowerCase().includes('bridge'))
  assert.equal(a.descriptionMode, 'auto')
  const initial = await api('/projects/' + a.id + '/queries', 'POST', {
    question: 'What is the overall width of each box planter?',
    sourceOnly: true,
    documentIds: [],
  })
  const content = readFileSync(
    resolve(root, 'output/pdf/mill-creek-client-brief.pdf'),
  ).toString('base64')
  let uploaded = await api('/projects/' + a.id + '/documents/import', 'POST', {
    name: 'bridge-client-brief.pdf',
    content,
  })
  assert.equal(uploaded.status, 201)
  const first = uploaded.data.documents[0]
  assert.equal(first.category, 'client')
  assert.ok(uploaded.data.project.description.includes('client requirements'))
  const pdf = await fetch(
    base + '/v1/projects/' + a.id + '/documents/' + first.id + '/file',
    { headers: { Range: 'bytes=0-3' } },
  )
  assert.equal(pdf.status, 206)
  assert.equal(await pdf.text(), '%PDF')
  assert.equal(
    (
      await api('/projects/' + b.id + '/queries', 'POST', {
        question: 'Show project scope',
        documentIds: [first.id],
      })
    ).status,
    400,
  )
  assert.equal(
    (
      await fetch(
        base + '/v1/projects/' + b.id + '/documents/' + first.id + '/file',
      )
    ).status,
    404,
  )
  uploaded = await api('/projects/' + b.id + '/documents/import', 'POST', {
    name: 'bridge-client-brief.pdf',
    content,
  })
  assert.equal(uploaded.status, 201)
  assert.notEqual(
    uploaded.data.documents[0].id,
    first.id,
    'Identical bytes in separate projects must have distinct ownership IDs',
  )
  assert.equal(
    (
      await api('/projects/' + a.id + '/documents/import', 'POST', {
        name: 'bad.pdf',
        content: Buffer.from('not a pdf').toString('base64'),
      })
    ).status,
    400,
  )
  assert.equal(
    (
      await api('/projects/' + a.id, 'PATCH', {
        description: 'Custom project scope',
      })
    ).status,
    200,
  )
  await api('/projects/' + a.id + '/documents/import', 'POST', {
    name: 'site-report.pdf',
    content: readFileSync(
      resolve(root, 'output/pdf/mill-creek-site-note.pdf'),
    ).toString('base64'),
  })
  assert.equal(
    (await api('/projects/' + a.id)).data.project.description,
    'Custom project scope',
  )
  let job = (
    await api('/projects/' + a.id + '/queries', 'POST', {
      question: 'What is the overall width of each box planter?',
      sourceOnly: true,
    })
  ).data
  for (let i = 0; i < 80 && ['queued', 'running'].includes(job.state); i++) {
    await new Promise((r) => setTimeout(r, 100))
    job = (await api('/projects/' + a.id + '/queries/' + job.id)).data
  }
  assert.equal(job.state, 'completed')
  assert.ok(job.result.references.some((r) => r.doc === first.id))
  assert.ok(JSON.stringify(job.result.report).includes('400 mm'))
  const old = (await api('/projects/' + a.id + '/queries/' + initial.data.id))
    .data
  assert.equal(old.stale, true)
  assert.equal(old.result, undefined)
  const official = await api(
    '/projects/' + a.id + '/documents/import',
    'POST',
    {
      name: 'bridge-standard.pdf',
      content: readFileSync(
        resolve(
          root,
          '../public/documents/trans-bridge-structures-design-criteria-version-9-0.pdf',
        ),
      ).toString('base64'),
    },
  )
  assert.equal(official.status, 201)
  const importedStandard = official.data.documents[0].id
  await promisify(execFile)(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import {stageImport} from './src/project-imports.mjs'; stageImport(${JSON.stringify(a.id)},{name:'interrupted.pdf',content:Buffer.from('%PDF-1.7 invalid').toString('base64')})`,
    ],
    {
      cwd: root,
      windowsHide: true,
      env: {
        ...process.env,
        BASIS_STATE_DIR: resolve(root, 'state/ui-preview'),
      },
    },
  )
  await promisify(execFile)(process.execPath, ['control.mjs', '--restart'], {
    cwd: root,
    windowsHide: true,
    env: {
      ...process.env,
      BASIS_STATE_DIR: resolve(root, 'state/ui-preview'),
      BASIS_CONTROL_API_PORT: '8840',
      BASIS_CONTROL_GATEWAY_PORT: '8842',
      BASIS_CONTROL_SKIP_BUILD: '1',
    },
  })
  let ready = false
  for (let i = 0; i < 120; i++) {
    try {
      ready = (await (await fetch(base + '/health')).json()).ready
    } catch {}
    if (ready) break
    await new Promise((r) => setTimeout(r, 250))
  }
  assert.ok(ready)
  assert.equal(
    (await (await fetch(base + '/health')).json()).failures,
    0,
    'An interrupted invalid staging file cannot poison unrelated projects on restart',
  )
  const importedRecord = (await api('/projects/' + a.id)).data.documents.find(
    (d) => d.id === importedStandard,
  )
  assert.notEqual(
    importedRecord.status,
    'superseded',
    'An identical publication in another project cannot suppress this project’s imported copy',
  )
  let bridgeJob = (
    await api('/projects/' + a.id + '/queries', 'POST', {
      question: 'What crossfall is required for bridge decks?',
      sourceOnly: true,
      documentIds: [importedStandard],
    })
  ).data
  for (
    let i = 0;
    i < 80 && ['queued', 'running'].includes(bridgeJob.state);
    i++
  ) {
    await new Promise((r) => setTimeout(r, 100))
    bridgeJob = (await api('/projects/' + a.id + '/queries/' + bridgeJob.id))
      .data
  }
  assert.equal(bridgeJob.state, 'completed')
  assert.ok(bridgeJob.result.references.length > 0)
  assert.ok(
    bridgeJob.result.references.every((r) => r.doc === importedStandard),
  )
  assert.ok(
    (await api('/projects/' + a.id)).data.documents.some(
      (d) => d.id === first.id,
    ),
  )
  assert.equal(
    (await api('/projects/' + a.id)).data.project.description,
    'Custom project scope',
  )
  assert.ok(
    !(await api('/documents')).data.documents.some((d) => d.id === first.id),
  )
  console.log(
    'PASS PDF import, text indexing, source highlights, project isolation, duplicate-byte ownership, validation, automatic/manual descriptions and restart persistence',
  )
} finally {
  for (const id of ids) await api('/projects/' + id, 'DELETE')
}

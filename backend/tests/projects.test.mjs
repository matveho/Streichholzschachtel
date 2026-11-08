import test from 'node:test'
import assert from 'node:assert/strict'
import {
  mkdtempSync,
  rmSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
} from 'node:fs'
import { resolve, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { buildIndex } from '../src/indexer.mjs'
import { ProjectStore, scopedCorpus } from '../src/project-store.mjs'
import { ProjectApi } from '../src/project-api.mjs'
import { demoProjects } from '../demo/manifest.mjs'
import { restoreDemoDocuments } from '../src/demo-documents.mjs'
import { config } from '../src/config.mjs'
import { expandRetrieval } from '../src/retrieval-plan.mjs'
import { draftLocal } from '../src/local-synthesis.mjs'

const corpus = await buildIndex()
test('model planning and synthesis receive only the physically scoped project context', async (t) => {
  const { store } = fresh(t),
    scope = store.scope('demo-willow-creek')
  const foreign = corpus.documents.filter(
    (d) => !scope.project.documentIds.includes(d.id),
  )
  const originalFetch = globalThis.fetch,
    previous = {
      provider: config.provider,
      localSynthesis: config.localSynthesis,
      extractiveOnly: config.extractiveOnly,
    }
  const inputs = []
  Object.assign(config, {
    provider: 'ollama',
    localSynthesis: true,
    extractiveOnly: false,
  })
  globalThis.fetch = async (_url, options) => {
    const request = JSON.parse(options.body),
      input = request.messages.find((m) => m.role === 'user').content
    inputs.push(input)
    for (const document of foreign)
      assert.ok(
        !input.includes(document.id),
        'Foreign document in model context: ' + document.id,
      )
    assert.ok(
      !input.includes('Rivermark'),
      'Foreign private client text in model context',
    )
    const properties = request.format.properties
    const output = properties.queries
      ? {
          queries: [
            {
              heading: 'Deck geometry',
              query:
                'bridge deck crossfall longitudinal grade box planter underdrain',
              sections: [],
            },
          ],
        }
      : properties.answerable
        ? { answerable: true, evidence: ['A'], unresolved: [] }
        : properties.calculations
          ? { calculations: [] }
          : { findings: [] }
    return new Response(
      JSON.stringify({
        message: { content: JSON.stringify(output) },
        done_reason: 'stop',
      }),
      { status: 200 },
    )
  }
  try {
    const question =
      'Compare bridge deck crossfall and longitudinal grade requirements against the preliminary bridge design and identify checks requiring engineering review.'
    const baseline = scope.index.search(
      'bridge deck crossfall longitudinal grade',
    )
    const signal = AbortSignal.timeout(10000)
    const retrieval = await expandRetrieval(
      question,
      baseline,
      scope.index,
      signal,
    )
    assert.ok(
      retrieval.passages.every((p) =>
        scope.project.documentIds.includes(p.doc),
      ),
    )
    await draftLocal(question, baseline, scope.index, signal)
    assert.ok(
      inputs.length >= 3,
      'Planner, evidence selector and drafter must all be exercised',
    )
  } finally {
    globalThis.fetch = originalFetch
    Object.assign(config, previous)
  }
})
test('demo document originals restore missing or modified runtime copies', (t) => {
  const directory = mkdtempSync(resolve(tmpdir(), 'basis-demo-files-'))
  t.after(() => {
    if (!directory.startsWith(resolve(tmpdir()) + sep))
      throw new Error('Unsafe cleanup')
    rmSync(directory, { recursive: true, force: true })
  })
  restoreDemoDocuments(directory)
  const first = resolve(directory, demoProjects[0].documents[0].file)
  const second = resolve(directory, demoProjects[1].documents[0].file)
  const expected = readFileSync(first),
    other = readFileSync(second)
  unlinkSync(first)
  writeFileSync(second, 'damaged')
  restoreDemoDocuments(directory)
  assert.deepEqual(readFileSync(first), expected)
  assert.deepEqual(readFileSync(second), other)
  restoreDemoDocuments(directory)
  assert.deepEqual(readFileSync(first), expected)
  const models = demoProjects.flatMap((p) =>
    p.documents
      .filter((d) => d.modelFile)
      .map((d) => resolve(directory, d.modelFile)),
  )
  assert.equal(models.length, 2)
  const originals = models.map((file) => readFileSync(file))
  unlinkSync(models[0])
  writeFileSync(models[1], 'damaged model')
  restoreDemoDocuments(directory)
  models.forEach((file, i) =>
    assert.deepEqual(readFileSync(file), originals[i]),
  )
})
function fresh(t) {
  const folder = mkdtempSync(resolve(tmpdir(), 'basis-project-test-'))
  t.after(() => {
    if (!folder.startsWith(resolve(tmpdir()) + sep))
      throw new Error('Unsafe test cleanup')
    rmSync(folder, { recursive: true, force: true })
  })
  return { folder, store: new ProjectStore(corpus, folder) }
}
test('all complete protected demonstration projects restore without duplicates', (t) => {
  const { store, folder } = fresh(t)
  assert.equal(store.list().length, demoProjects.length)
  for (const project of store.list()) {
    assert.equal(project.protectedDemo, true)
    assert.ok(project.documentIds.length >= 6)
    assert.equal(
      project.documentIds.filter(
        (id) => store.documents.get(id).projectArtifact,
      ).length,
      demoProjects.find((p) => p.id === project.id).documents.length,
    )
    assert.throws(() => store.remove(project.id), { status: 403 })
  }
  const before = store.list().map((p) => [p.id, p.revision])
  const restarted = new ProjectStore(corpus, folder)
  assert.deepEqual(
    restarted.list().map((p) => [p.id, p.revision]),
    before,
  )
  const data = JSON.parse(readFileSync(store.file, 'utf8'))
  data.projects = data.projects.slice(0, 1)
  writeFileSync(store.file, JSON.stringify(data))
  assert.equal(
    new ProjectStore(corpus, folder).list().length,
    demoProjects.length,
  )
})
test('researched packages have exact collection memberships and independent artifact scopes', (t) => {
  const { store } = fresh(t)
  for (const [id, collectionId, expected] of [
    ['parkview-exchange', 'edmonton-urban-servicing', 10],
    ['north-ridge-highway', 'alberta-highway-design', 11],
  ]) {
    const collection = store.collections.find((c) => c.id === collectionId)
    assert.equal(collection.documentCount, expected)
    assert.deepEqual(collection.missingFiles, [])
    const scoped = store.scope(id)
    assert.equal(
      scoped.corpus.documents.filter((d) => d.projectArtifact).length,
      7,
    )
    assert.ok(
      scoped.corpus.documents.every(
        (d) => !d.ownerProjectId || d.ownerProjectId === id,
      ),
    )
    assert.ok(
      scoped.corpus.documents.every((d) => d.pages > 0 || d.pageCount > 0),
    )
    const other = store.scope(
      id === 'parkview-exchange' ? 'north-ridge-highway' : 'parkview-exchange',
    )
    assert.ok(
      scoped.corpus.documents.every(
        (d) => !other.project.documentIds.includes(d.id),
      ),
    )
  }
})
test('ordinary project creation, individual document selection, updates and deletion persist', (t) => {
  const { store, folder } = fresh(t),
    collection = store.collections.find((c) => c.id === 'edmonton-water')
  const project = store.create({
    name: 'Reservoir review',
    client: 'Test owner',
    collectionIds: [collection.id],
    documentIds: collection.documentIds.slice(0, 1),
  })
  assert.equal(project.documentIds.length, 1)
  assert.equal(
    new ProjectStore(corpus, folder).get(project.id).client,
    'Test owner',
  )
  const updated = store.update(project.id, { documentIds: [] })
  assert.deepEqual(updated.documentIds, [])
  assert.ok(updated.revision > project.revision)
  store.remove(project.id)
  assert.throws(() => store.get(project.id), { status: 404 })
  assert.ok(corpus.documents.some((d) => d.id === collection.documentIds[0]))
})

test('descriptions generate from documents, remain editable and do not invalidate document-scoped answers', (t) => {
  const { store, folder } = fresh(t)
  const project = store.create({
    name: 'Bridge review',
    collectionIds: ['alberta-bridges'],
  })
  assert.equal(project.descriptionMode, 'auto')
  assert.match(project.description, /bridge/i)
  const version = store.scope(project.id).version
  store.update(project.id, { description: 'Custom bridge scope' })
  assert.equal(store.scope(project.id).version, version)
  assert.equal(
    new ProjectStore(corpus, folder).get(project.id).description,
    'Custom bridge scope',
  )
  store.update(project.id, { collectionIds: ['edmonton-water'] })
  assert.equal(store.get(project.id).description, 'Custom bridge scope')
  store.update(project.id, { description: '' })
  assert.match(store.get(project.id).description, /water infrastructure/i)
  const seededVersion = store.scope('demo-mill-creek').version
  store.update('demo-mill-creek', { description: 'Adjusted concept scope' })
  assert.equal(store.scope('demo-mill-creek').version, seededVersion)
  assert.equal(
    new ProjectStore(corpus, folder).get('demo-mill-creek').description,
    'Adjusted concept scope',
  )
  store.reset('demo-mill-creek')
  assert.equal(
    store.get('demo-mill-creek').description,
    demoProjects.find((p) => p.id === 'demo-mill-creek').description,
  )
  assert.throws(
    () =>
      store.update('demo-mill-creek', { name: 'Changed protected identity' }),
    { status: 403 },
  )
})
test('Reference Collections contain actual relevant references and exclude private project artifacts', (t) => {
  const { store } = fresh(t)
  const drainage = store.collections.find((c) => c.id === 'edmonton-drainage'),
    bridge = store.collections.find((c) => c.id === 'alberta-bridges')
  assert.equal(bridge.documentCount, 3)
  assert.equal(drainage.documentCount, 8)
  assert.deepEqual(bridge.missingFiles, [])
  assert.deepEqual(drainage.missingFiles, [])
  assert.ok(
    bridge.documentIds.every((id) => !drainage.documentIds.includes(id)),
  )
  assert.equal(bridge.authority, 'Alberta Transportation')
  assert.ok(
    store.collections
      .flatMap((c) => c.documentIds)
      .every((id) => !store.documents.get(id).projectArtifact),
  )
  assert.throws(
    () =>
      store.create({
        name: 'Wrong scope',
        collectionIds: [bridge.id],
        documentIds: [drainage.documentIds[0]],
      }),
    { status: 400 },
  )
})
test('every retrieval and expansion stage sees only scoped documents; empty stays empty', (t) => {
  const { store } = fresh(t)
  const a = store.get('demo-mill-creek'),
    b = store.scope('demo-willow-creek')
  assert.ok(b.corpus.documents.every((d) => !a.documentIds.includes(d.id)))
  assert.ok(
    b.corpus.passages.every((p) => b.project.documentIds.includes(p.doc)),
  )
  assert.ok(b.corpus.units.every((u) => b.project.documentIds.includes(u.doc)))
  const retrieved = b.index.search(
    'What are the box planter underdrain requirements?',
  )
  for (const expanded of [
    retrieved,
    b.index.withAdjacentPassages(retrieved),
    b.index.withReferencedSections(retrieved),
    b.index.withPageContext(retrieved),
  ])
    assert.ok(expanded.every((p) => b.project.documentIds.includes(p.doc)))
  const empty = store.scope(b.project.id, [])
  assert.deepEqual(empty.corpus.documents, [])
  assert.deepEqual(empty.corpus.passages, [])
  assert.deepEqual(empty.corpus.units, [])
  assert.deepEqual(empty.index.search('bridge deck crossfall'), [])
  assert.throws(() => store.scope(b.project.id, [a.documentIds[0]]), {
    status: 400,
  })
  const aPrivate = a.documentIds.find(
    (id) => store.documents.get(id).projectArtifact,
  )
  assert.throws(() => store.document(b.project.id, aPrivate), { status: 404 })
  assert.throws(() => scopedCorpus(corpus, undefined), { status: 400 })
})
test('finding dismissal persists and demo reset restores original state', (t) => {
  const { store, folder } = fresh(t)
  store.setIssue('demo-mill-creek', 'planter-width', 'dismissed')
  assert.equal(
    new ProjectStore(corpus, folder).get('demo-mill-creek').issueStates[
      'planter-width'
    ].status,
    'dismissed',
  )
  store.reset('demo-mill-creek')
  assert.deepEqual(store.get('demo-mill-creek').issueStates, {})
  assert.throws(() => store.update('demo-mill-creek', { documentIds: [] }), {
    status: 403,
  })
})

test('reset persistence defaults off for ordinary projects and is locked on for built-in examples', (t) => {
  const { store, folder } = fresh(t)
  const project = store.create({ name: 'Temporary project', collectionIds: [] })
  assert.equal(project.persistOnReset, false)
  store.update(project.id, { persistOnReset: true })
  assert.equal(
    new ProjectStore(corpus, folder).get(project.id).persistOnReset,
    true,
  )
  store.update(project.id, { persistOnReset: false })
  assert.equal(store.get(project.id).persistOnReset, false)
  assert.throws(() => store.update(project.id, { persistOnReset: 'true' }), {
    status: 400,
  })
  for (const spec of demoProjects) {
    assert.equal(store.get(spec.id).persistOnReset, true)
    assert.throws(() => store.update(spec.id, { persistOnReset: false }), {
      status: 403,
    })
  }
  const data = store.read()
  data.projects.find((p) => p.id === 'demo-mill-creek').persistOnReset = false
  store.write(data)
  assert.equal(
    new ProjectStore(corpus, folder).get('demo-mill-creek').persistOnReset,
    true,
  )
})
test('prepared findings and histories are project-bound and anchored to original PDFs', (t) => {
  const { folder } = fresh(t),
    api = new ProjectApi(corpus, folder, 'project-test-engine')
  for (const spec of demoProjects) {
    const allIssues = api.issues(spec.id)
    const issues = allIssues.filter((issue) => issue.prepared)
    assert.equal(issues.length, spec.issues.length)
    for (const issue of allIssues.filter((issue) => !issue.prepared)) {
      assert.ok(issue.elementId && issue.globalId)
      assert.ok(
        Number.isFinite(issue.actual) && Number.isFinite(issue.expected),
      )
      assert.ok(issue.citations.length > 0)
      assert.ok(
        issue.citations.every((citation) =>
          api.store.get(spec.id).documentIds.includes(citation.doc),
        ),
      )
    }
    assert.ok(
      issues.every((i) => i.verified),
      'Every prepared finding must have original-source anchors',
    )
    const history = api.history(spec.id)
    assert.equal(history.length, spec.queries.length)
    for (const query of history) {
      const job = api.raw(spec.id, query.id)
      assert.equal(api.serialize(job).stale, false)
      assert.ok(job.result.references.length >= (query.sourceOnly ? 1 : 2))
      assert.ok(
        job.result.references.every(
          (r) =>
            r.regions.length &&
            api.store.get(spec.id).documentIds.includes(r.doc),
        ),
      )
      const other = demoProjects.find((p) => p.id !== spec.id)
      assert.throws(() => api.raw(other.id, query.id), { status: 404 })
    }
  }
})

test('refreshed OCR invalidates the project evidence scope without changing PDF identity', (t) => {
  const { store } = fresh(t)
  const project = store.get('demo-mill-creek')
  const before = store.scope(project.id).version
  const id = project.documentIds[0]
  const original = store.documents.get(id)
  const refreshed = { ...original, extractionVersion: 'refreshed-ocr-output' }
  store.documents.set(id, refreshed)
  store.corpus = {
    ...store.corpus,
    documents: store.corpus.documents.map((doc) =>
      doc.id === id ? refreshed : doc,
    ),
  }
  assert.equal(refreshed.version, original.version)
  assert.notEqual(store.scope(project.id).version, before)
})

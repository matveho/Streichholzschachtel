import test from 'node:test'
import assert from 'node:assert/strict'
import { SearchIndex } from '../src/search.mjs'
import { UnitIndex, lookup, coversRequestedConcept } from '../src/lookup.mjs'
import { suggestQueries } from '../src/query-suggestions.mjs'
import { answer } from '../src/answer.mjs'

const doc = {
  id: 'doc-aabb',
  label: 'Storm Guide',
  title: 'Storm Sewer Design',
  edition: 'Test edition',
  status: 'current',
  jurisdiction: 'City of Edmonton',
  filePath: '/test/source.pdf',
  pages: 1,
}
const text =
  'Storm sewer cover shall be a minimum of 2.0 m below finished grade.'
const unit = {
  id: 'cover',
  doc: doc.id,
  page: 1,
  kind: 'body',
  type: 'text',
  text,
  heading: '2.1 Depth of cover for storm sewers',
  table: '',
  frame: 'Depth of cover for storm sewers',
  recent: '',
  regions: [[20, 40, 300, 15]],
}
const corpus = { documents: [doc], passages: [], units: [unit], failures: [] }

test('material approval cannot transfer between pipe types and preserves exclusive application limits', () => {
  const question = 'Is HDPE pipe approved for use in storm sewers in Edmonton?'
  assert.equal(
    coversRequestedConcept(question, {
      ...unit,
      text: 'PVC pipe is approved for use in residential areas for sanitary and storm sewers and services.',
    }),
    false,
  )
  assert.equal(
    coversRequestedConcept(question, {
      ...unit,
      text: 'HDPE pipe is approved for forcemains and pipe busting applications only.',
    }),
    true,
  )
})

test('a matching asset cannot stand in for the requested measurement or fact', () => {
  assert.equal(
    coversRequestedConcept(
      'What minimum width is required for a box planter?',
      {
        ...unit,
        text: 'The concept proposes a box planter with a width of 400 mm.',
        frame: 'Proposed project design',
      },
    ),
    false,
  )
  assert.equal(
    coversRequestedConcept('What storm sewer cover is required?', unit),
    true,
  )
  assert.equal(
    coversRequestedConcept(
      'What insulation R-value is required for storm sewer cover?',
      unit,
    ),
    false,
  )
  assert.equal(
    coversRequestedConcept('What is the capital of France?', {
      ...unit,
      text: 'A footbridge publication was issued in Paris, France.',
      frame: 'Technical references',
    }),
    false,
  )
})

test('weak technical matches stay labelled as related provisions rather than direct answers', (t) => {
  const index = new UnitIndex(corpus)
  t.mock.method(index, 'score', () => [{ unit, score: 0.4 }])
  const result = lookup(
    'What insulation R-value is required for storm sewer cover?',
    index,
  )
  assert.equal(result.mode, 'related_evidence')
  assert.match(result.sections[0].heading, /No direct answer/)
  assert.equal(result.sections[1].sentences[0].units[0], unit)
})

test('alternatives are independently answerable source queries, without fabricated limits', () => {
  const search = new SearchIndex(corpus)
  const alternatives = suggestQueries(
    'Can a robot inspect a storm sewer on Mars?',
    search,
  )
  assert.equal(alternatives.length, 1)
  assert.equal(alternatives[0].sourceOnly, true)
  assert.equal(alternatives[0].preview, text)
  assert.ok(!alternatives[0].question.includes('Mars'))
  assert.equal(
    lookup(alternatives[0].question, new UnitIndex(corpus)).mode,
    'extractive_answer',
  )
})

test('unrelated and foreign-jurisdiction queries do not get misleading alternatives', () => {
  for (const question of [
    'How do I bake a birthday cake?',
    'What storm sewer cover is required in Calgary?',
  ])
    assert.deepEqual(suggestQueries(question, new SearchIndex(corpus)), [])
})

test('alternatives deduplicate topics and exclude superseded-only evidence', () => {
  const duplicate = { ...unit, id: 'duplicate' }
  const search = new SearchIndex({ ...corpus, units: [unit, duplicate] })
  assert.equal(
    suggestQueries('Review storm sewer cover for unknown construction', search)
      .length,
    1,
  )
  assert.deepEqual(
    suggestQueries(
      'storm sewer cover',
      new SearchIndex({
        ...corpus,
        documents: [{ ...doc, status: 'superseded' }],
      }),
    ),
    [],
  )
})

test('selecting a source alternative returns original cited text without any model call', async (t) => {
  t.mock.method(globalThis, 'fetch', () => {
    throw new Error('No inference should be needed')
  })
  const search = new SearchIndex(corpus)
  const [alternative] = suggestQueries(
    'Review storm sewer cover for unknown construction',
    search,
  )
  const result = await answer(alternative.question, search, {
    publicBase: '',
    token: '',
    signal: new AbortController().signal,
    sourceOnly: true,
  })
  assert.equal(result.mode, 'extractive_answer')
  assert.ok(result.references.some((ref) => ref.excerpt === text))
  assert.ok(result.references.every((ref) => ref.regions.length > 0))
  assert.equal(result.documents.length, 1)
})

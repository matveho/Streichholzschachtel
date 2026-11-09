import test from 'node:test'
import assert from 'node:assert/strict'
import { SearchIndex } from '../src/search.mjs'
import { lookup, UnitIndex } from '../src/lookup.mjs'
import { assistQuery } from '../src/clarify.mjs'

const doc = (id, label, title) => ({
  id,
  label,
  title,
  edition: 'Test edition',
  status: 'current',
  jurisdiction: 'City of Edmonton',
  filePath: `/test/${id}.pdf`,
  pages: 1,
})
const unit = (id, docId, heading, text) => ({
  id,
  doc: docId,
  page: 1,
  kind: 'body',
  type: 'text',
  text,
  heading,
  table: '',
  frame: heading,
  recent: '',
  regions: [[20, 40, 300, 15]],
})
const documents = [
  doc('doc-storm', 'Storm Guide', 'Storm Sewer Design'),
  doc('doc-sanitary', 'Sanitary Guide', 'Sanitary Sewer Design'),
]
const units = [
  unit(
    'storm-cover',
    'doc-storm',
    '2.1 Depth of cover for storm sewers',
    'The minimum depth of cover for storm sewers shall be 2.0 m below finished grade.',
  ),
  unit(
    'sanitary-cover',
    'doc-sanitary',
    '3.1 Depth of cover for sanitary sewers',
    'The minimum depth of cover for sanitary sewers shall be 2.5 m below finished grade.',
  ),
]
const searchIndex = new SearchIndex({
  documents,
  passages: [],
  units,
  failures: [],
})
const assist = (question) =>
  assistQuery(
    question,
    searchIndex,
    lookup(
      question,
      (searchIndex.unitIndex ??= new UnitIndex(searchIndex.corpus)),
    ),
  )

test('unresolved test counts show their specific missing input instead of generic parameters', () => {
  const action = 'Specify construction completion or final acceptance, then confirm the count for the stated facility size.'
  const result = assistQuery('How many Guelph tests are required for exactly 1000 m2?', searchIndex, {
    mode: 'insufficient_evidence',
    requiredInputs: {kind: 'testing_count', action},
  })
  assert.equal(result.outcome, 'partial')
  assert.deepEqual(result.details, [action])
  assert.deepEqual(result.clarifications, [])
})

test('another municipality is reported as outside the collection', () => {
  const result = assist('What is the minimum storm sewer cover in Calgary?')
  assert.equal(result.outcome, 'jurisdiction')
  assert.equal(result.jurisdiction, 'Calgary')
  assert.deepEqual(result.clarifications, [])
})

test('an unanswerable question names the kind of document that is missing', () => {
  const result = assist('What is the minimum stair width?')
  assert.equal(result.outcome, 'not_found')
  assert.equal(result.missing, 'the building code or zoning bylaw')
})

test('a missing-document hint is withheld when such a document is indexed', () => {
  const withCode = new SearchIndex({
    documents: [
      ...documents,
      doc('doc-code', 'Code', 'National Building Code'),
    ],
    passages: [],
    units,
    failures: [],
  })
  const question = 'What is the minimum stair width?'
  const index = (withCode.unitIndex ??= new UnitIndex(withCode.corpus))
  const result = assistQuery(question, withCode, lookup(question, index))
  assert.equal(result.missing, undefined)
})

test('a one-word question is flagged as vague instead of clarified', () => {
  const result = assistQuery('Is this allowed?', searchIndex, {
    mode: 'extractive_answer',
  })
  assert.equal(result.outcome, 'vague')
  assert.deepEqual(result.clarifications, [])
})

test('clarifying options are offered only when each one has a sourced answer', () => {
  const result = assist('What is the minimum depth of cover for a sewer?')
  const system = result.clarifications.find(
    (c) => c.question === 'Which system is this for?',
  )
  assert.ok(system, 'expected a system clarification')
  assert.deepEqual(
    system.options.map((o) => o.label),
    ['Storm sewer', 'Sanitary sewer'],
  )
  for (const option of system.options)
    assert.equal(
      lookup(option.question, searchIndex.unitIndex).mode,
      'extractive_answer',
    )
})

test('a question that already names the system is not clarified again', () => {
  const result = assist('What is the minimum depth of cover for storm sewers?')
  assert.equal(result.outcome, 'answered')
  assert.deepEqual(result.clarifications, [])
})

test('an unrelated search is identified as not an engineering question', () => {
  const result = assist('best pizza near me')
  assert.equal(result.outcome, 'off_topic')
  assert.ok(Array.isArray(result.examples))
  for (const example of result.examples)
    assert.equal(
      lookup(example, searchIndex.unitIndex).mode,
      'extractive_answer',
    )
})

test('missing parameters are named specifically', () => {
  const result = assist('What is the minimum slope?')
  assert.ok(result.details.includes('The system: storm, sanitary or water.'))
  assert.ok(result.details.includes('The pipe diameter, e.g. 300 mm.'))
  const stated = assist('What is the minimum slope for a 300 mm storm sewer?')
  assert.deepEqual(stated.details, [])
})

test('a one-word search always explains what to state', () => {
  const result = assistQuery('slope', searchIndex, {
    mode: 'extractive_answer',
  })
  assert.equal(result.outcome, 'vague')
  assert.match(result.details.at(-1), /element and the requirement/)
})

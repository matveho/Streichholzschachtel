import test from 'node:test'
import assert from 'node:assert/strict'
import { constructionControlSearch } from '../src/retrieval-plan.mjs'
test('broad construction checks retain a bounded site-controls search', () => {
  const topic = constructionControlSearch(
    'What design and construction checks are needed for this infill?',
  )
  assert.equal(topic.role, 'site-controls')
  assert.match(topic.query, /erosion sediment control inspection/)
  assert.ok(
    !/\d|weekly|daily/.test(topic.query),
    'Search vocabulary does not embed regulatory values or schedules',
  )
  assert.ok(
    constructionControlSearch(
      'List construction-phase requirements for this project.',
    ),
  )
})
test('existing explicit controls searches are not duplicated and narrow questions stay narrow', () => {
  assert.equal(
    constructionControlSearch('What construction checks are needed?', [
      {
        heading: 'Site controls',
        query: 'erosion and sediment control inspections',
      },
    ]),
    null,
  )
  for (const q of [
    'What is the required pipe cover?',
    'What compaction test is needed during construction?',
    'What inspection is required at final acceptance?',
  ])
    assert.equal(constructionControlSearch(q), null)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  depthCriterion,
  relatedCriteriaEvidence,
  attachReferenceCriteria,
} from '../src/related-criteria.mjs'
const source = (doc, excerpt) => ({ passage: { doc }, excerpt, heading: '' })
test('related depth criteria preserve role, system and datum without choosing authority', () => {
  const selected = source(
    'design',
    'When normal depths are not practical, storm services require a minimum 2.0 m cover to pipe obvert.',
  )
  const guide = source(
    'guide',
    'Storm services require at least 2.4m in depth at the property line.',
  )
  const invert = source(
    'spec',
    'Storm service pipe depth shall be 2.0 m from invert elevation to finished curb top grade.',
  )
  const sanitary = source(
    'sanitary',
    'Sanitary services require a minimum 2.75 m depth.',
  )
  const main = source('main', 'Storm mains require a minimum 2.0 m cover.')
  assert.deepEqual(
    relatedCriteriaEvidence(
      [selected],
      [sanitary, main, guide, invert],
      'storm service depth',
    ),
    [guide, invert],
  )
  assert.equal(depthCriterion(selected).datum, 'cover-to-obvert')
  assert.equal(depthCriterion(guide).datum, 'not-stated')
  assert.equal(depthCriterion(source('guide','Storm services require at least 2.4m depth; inspect the invert.')).datum,'not-stated','Mentioning an invert does not establish the measurement datum')
  assert.equal(depthCriterion(invert).datum, 'invert-to-curb')
  assert.deepEqual(depthCriterion(guide).values, [{ value: 2.4, unit: 'm' }])
})
test('unrelated checks, duplicates and unclassified measurements do not create extra criteria', () => {
  const selected = source(
    'design',
    'Storm services require a minimum 2.0 m cover.',
  )
  assert.deepEqual(
    relatedCriteriaEvidence([selected], [selected], 'storm service depth'),
    [],
  )
  assert.deepEqual(
    relatedCriteriaEvidence(
      [selected],
      [source('other', 'Storm services require a minimum 2.4 m depth.')],
      'minor system runoff method',
    ),
    [],
  )
  assert.equal(
    depthCriterion(source('other', 'The depth should be reviewed.')),
    null,
  )
  assert.equal(
    depthCriterion(
      source(
        'other',
        'Storm service pipes of 250 mm diameter require at least 2.4m cover.',
      ),
    ),
    null,
    'Diameter must not be displayed as burial depth',
  )
})
test('the reference reconciliation register keeps evidence links and never asserts a conflict or approval', () => {
  const result = {
    documents: [
      { id: 'a', label: 'Guide' },
      { id: 'b', label: 'Specification' },
      { id: 'project', projectArtifact: true },
    ],
    report: [],
    references: [
      {
        id: '1',
        doc: 'a',
        page: 5,
        excerpt:
          'Storm services require at least 2.4m depth at the property line.',
      },
      {
        id: '2',
        doc: 'b',
        page: 58,
        excerpt:
          'Storm service pipe depth shall be 2.0 m from invert elevation to finished curb top grade.',
      },
      {
        id: '3',
        doc: 'project',
        page: 1,
        excerpt: 'Storm services require at least 1.0 m cover.',
      },
    ],
  }
  const checked = attachReferenceCriteria(result)
  assert.equal(checked.referenceInterfaces.length, 1)
  assert.equal(checked.referenceInterfaces[0].status, 'review_required')
  assert.deepEqual(
    checked.referenceInterfaces[0].criteria.map((row) => row.referenceId),
    ['1', '2'],
  )
  assert.equal(checked.report[0].heading, 'Reference criteria to reconcile')
  assert.ok(
    checked.report[0].sentences
      .filter((row) => row.refs)
      .every((row) => result.references.some((ref) => ref.id === row.refs[0])),
  )
  assert.ok(
    !checked.referenceInterfaces[0].criteria.some(
      (row) => row.doc === 'project',
    ),
  )
  assert.equal(
    attachReferenceCriteria({ ...result, references: [result.references[0]] })
      .referenceInterfaces,
    undefined,
  )
  assert.equal(
    attachReferenceCriteria({
      ...result,
      references: [
        result.references[0],
        { ...result.references[0], id: '2', doc: 'b' },
      ],
    }).referenceInterfaces,
    undefined,
  )
})

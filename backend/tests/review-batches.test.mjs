import test from 'node:test'
import assert from 'node:assert/strict'
import {
  batchEvidenceChecks,
  uniqueReviewVerdicts,
  evidenceReviewSchema,
} from '../src/answer.mjs'

test('the review contract requires one verdict for every actual batch ID', () => {
  const schema = evidenceReviewSchema([4, 7])
  const verdicts = schema.properties.verdicts
  assert.equal(verdicts.type, 'object')
  assert.deepEqual(verdicts.required, ['4', '7'])
  assert.deepEqual(Object.keys(verdicts.properties), ['4', '7'])
  assert.equal(verdicts.additionalProperties, false)
  for (const item of Object.values(verdicts.properties)) {
    assert.deepEqual(item.required, ['reason', 'supported', 'relevant'])
    assert.equal(item.additionalProperties, false)
  }
})

test('conflicting duplicate or incomplete verdicts cannot approve a finding', () => {
  const verdicts = [
    { id: 0, supported: true, relevant: true, reason: 'Supported.' },
    { id: 0, supported: false, relevant: true, reason: 'Contradicted.' },
    {
      id: 1,
      supported: true,
      relevant: true,
      reason: 'The quote states this rule.',
    },
    { id: 2, supported: true, reason: 'Missing relevance verdict.' },
    { id: 999, supported: true, relevant: true, reason: 'Unknown finding.' },
  ]
  assert.deepEqual(
    [...uniqueReviewVerdicts(verdicts, new Set([0, 1, 2, 3])).keys()],
    [1],
  )
})

test('review batching preserves every complete check and its original ID within the context budget', () => {
  const checks = Array.from({ length: 9 }, (_, i) => ({
    id: i,
    claim: `Finding ${i}.`,
    quotes: ['a'.repeat(3900)],
    relatedProvisions: ['An exception.'],
  }))
  const batches = batchEvidenceChecks(checks)
  assert.deepEqual(batches.flat(), checks)
  assert.ok(batches.length > 1)
  for (const batch of batches) {
    assert.ok(batch.length <= 4)
    assert.ok(
      batch.reduce((n, check) => n + JSON.stringify(check).length, 0) <= 12000,
    )
  }
  assert.deepEqual(batchEvidenceChecks([]), [])
  assert.throws(
    () => batchEvidenceChecks([{ id: 0, quotes: ['x'.repeat(12001)] }]),
    /exceeds.*context budget/,
  )
})

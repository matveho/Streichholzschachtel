import test from 'node:test'
import assert from 'node:assert/strict'
import { contradictedIds } from '../src/entailment.mjs'

test('the independent verifier can veto but never approve a claim', () => {
  const results = [
    {
      id: 0,
      scores: { contradiction: 0.99, entailment: 0.005, neutral: 0.005 },
    },
    {
      id: 1,
      scores: { contradiction: 0.001, entailment: 0.998, neutral: 0.001 },
    },
    { id: 2, abstained: true },
    { id: 3, scores: { contradiction: 0.5, entailment: 0.1, neutral: 0.4 } },
  ]
  assert.deepEqual([...contradictedIds(results, new Set([0, 1, 2, 3]))], [0])
  assert.equal(contradictedIds(results, new Set([1, 2, 3])).size, 0)
  assert.throws(() =>
    contradictedIds([{ id: 0, scores: { contradiction: 2 } }], new Set([0])),
  )
})

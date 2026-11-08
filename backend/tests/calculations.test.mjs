import test from 'node:test'
import assert from 'node:assert/strict'
import { verifyCalculations } from '../src/calculations.mjs'
import { quantityUnits } from '../src/indexer.mjs'

test('source percentage and supplied flow produce the required flow and capacity gap', () => {
  const r = verifyCalculations(
    [
      { expression: '1.20 * 1.25', unit: 'm3/s' },
      { expression: 'r1 - 0.90', unit: 'm3/s' },
    ],
    'The five-year runoff rate plus 25% is required.',
    'Revised runoff is 1.20 m³/s and existing capacity is 0.90 m³/s.',
  )
  assert.deepEqual(r.issues, [])
  assert.deepEqual(
    r.calculations.map((c) => c.value),
    [1.5, 0.6],
  )
})
test('cover differences use physical units without floating-point noise', () => {
  const r = verifyCalculations(
    [
      { expression: '2.0 - 1.7', unit: 'm' },
      { expression: '2.4 - 2.0', unit: 'm' },
    ],
    'The required cover is 2.0 m for mains and 2.4 m for services.',
    'The main has 1.7 m and the service has 2.0 m cover.',
  )
  assert.deepEqual(
    r.calculations.map((c) => c.value),
    [0.3, 0.4],
  )
})

test('a previously verified result can be reused as a literal without inventing a new operand', () => {
  const r = verifyCalculations(
    [
      { expression: '1.20 * 1.25', unit: 'm3/s' },
      { expression: '1.50 - 0.90', unit: 'm3/s' },
    ],
    'Runoff plus 25% is required.',
    'Runoff is 1.20 m3/s and capacity is 0.90 m3/s.',
  )
  assert.deepEqual(
    r.calculations.map((c) => c.value),
    [1.5, 0.6],
  )
})

test('a failed dependency stops later steps rather than renumbering results', () => {
  const r = verifyCalculations(
    [
      { expression: '1.2 * 1.25', unit: 'm3/s' },
      { expression: '999', unit: 'm3/s' },
      { expression: '1.2 * 1.25', unit: 'm3/s' },
      { expression: 'r2 - 0.9', unit: 'm3/s' },
    ],
    'Runoff plus 25% is required.',
    'Runoff is 1.2 m3/s and capacity is 0.9 m3/s.',
  )
  assert.equal(r.calculations.length, 1)
  assert.equal(r.issues.length, 1)
})
test('a source halfway-depth rule supports a computed test depth and unit conversion', () => {
  const r = verifyCalculations(
    [
      { expression: '600 / 2', unit: 'mm' },
      { expression: '600 / 2', unit: 'm' },
    ],
    'Testing at the halfway depth is preferred.',
    'The soil is 600 mm deep.',
  )
  assert.deepEqual(
    r.calculations.map((c) => c.value),
    [300, 0.3],
  )
})
test('unavailable operands, fabricated results, code and unit mismatches are rejected', () => {
  for (const proposal of [
    { expression: '1.20 * 1.8', unit: 'm3/s' },
    { expression: '1.20 * 1.25', unit: 'm3/s', value: 9 },
    { expression: 'process.exit()', unit: '' },
    { expression: '1.20 + 600', unit: 'm3/s' },
    { expression: '1.20 / 0', unit: 'm3/s' },
    { expression: 'r4 - 1.20', unit: 'm3/s' },
  ]) {
    const r = verifyCalculations(
      [proposal],
      'The runoff rate plus 25% is required.',
      'Runoff is 1.20 m³/s and soil is 600 mm deep.',
    )
    assert.equal(r.calculations.length, 0)
    assert.equal(r.issues.length, 1)
  }
})
test('dimensional quantities cannot be multiplied into an unsupported design volume', () => {
  const r = verifyCalculations(
    [{ expression: '500 * 0.6', unit: 'm3' }],
    'A soil test is required.',
    'Area is 500 m2 and depth is 0.6 m.',
  )
  assert.equal(r.calculations.length, 0)
})

test('flow, volume and velocity quantities retain distinct unit identities', () => {
  assert.deepEqual(quantityUnits('1.5 m³/s'), ['1.5:m3/s'])
  assert.deepEqual(quantityUnits('1.5 m³'), ['1.5:m3'])
  assert.deepEqual(quantityUnits('0.6 m/s'), ['0.6:m/s'])
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { verifyCalculations } from '../src/calculations.mjs'
import { boundFindingCalculations } from '../src/local-synthesis.mjs'

test('a calculation belongs only to findings that request it and cite its own supporting operands', () => {
  const question = 'The LID soil is 600 mm deep.'
  const rule = 'Testing at the halfway depth is preferred.'
  const calculations = verifyCalculations(
    [{ expression: '600 / 2', unit: 'mm' }],
    rule,
    question,
  ).calculations
  assert.equal(
    boundFindingCalculations(['c1'], calculations, rule, question)[0].value,
    300,
  )
  assert.deepEqual(
    boundFindingCalculations([], calculations, rule, question),
    [],
  )
  assert.deepEqual(
    boundFindingCalculations(
      ['c1'],
      calculations,
      'Conduct a QA/QC test within 3 m of another test.',
      question,
    ),
    [],
  )
  assert.deepEqual(
    boundFindingCalculations(['c4'], calculations, rule, question),
    [],
  )
})

test('dependent arithmetic retains only the required preceding calculation chain', () => {
  const question = 'Runoff is 1.20 m3/s and existing capacity is 0.90 m3/s.'
  const rule = 'Increase the revised runoff rate by 25%.'
  const calculations = verifyCalculations(
    [
      { expression: '1.20 * 1.25', unit: 'm3/s' },
      { expression: 'r1 - 0.90', unit: 'm3/s' },
    ],
    rule,
    question,
  ).calculations
  assert.deepEqual(
    boundFindingCalculations(['c2'], calculations, rule, question).map(
      (c) => c.value,
    ),
    [1.5, 0.6],
  )
  assert.equal(
    boundFindingCalculations(['c1'], calculations, rule, question).length,
    1,
  )
})

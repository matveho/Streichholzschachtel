import test from 'node:test'
import assert from 'node:assert/strict'
import { requiresOptionalComponent } from '../src/applicability.mjs'

const quotes = [
  'If an underdrain is present a storm sewer connection following all guidelines must be provided.',
  'If an underdrain is used an overflow outlet must also be provided.',
]

test('a conditional connection duty cannot require an optional component', () => {
  assert.equal(
    requiresOptionalComponent(
      'The planter qualifies provided it includes an underdrain connected to a storm sewer and an overflow outlet.',
      quotes,
    ),
    true,
  )
  assert.equal(
    requiresOptionalComponent(
      'The planter must have an underdrain and an overflow outlet.',
      quotes,
    ),
    true,
  )
})

test('optional component checks preserve conditional duties and stated project components', () => {
  for (const claim of [
    'If an underdrain is present, the planter must have an overflow outlet.',
    'The underdrain must sit at the bottom of the drainage layer.',
    'The planter includes an underdrain if used for the selected design.',
  ])
    assert.equal(requiresOptionalComponent(claim, quotes), false)
  assert.equal(
    requiresOptionalComponent(
      'The planter includes an underdrain connected to a storm sewer.',
      quotes,
      'Our box planter has an underdrain. What connections apply?',
    ),
    false,
  )
  assert.equal(
    requiresOptionalComponent('The planter must have an underdrain.', [
      ...quotes,
      'This planter must have an underdrain.',
    ]),
    false,
  )
})

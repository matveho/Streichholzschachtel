import test from 'node:test'
import assert from 'node:assert/strict'
import { diversePassages } from '../src/retrieval-plan.mjs'
import { incompatiblePipeRole } from '../src/applicability.mjs'
const hit = (id, doc, score) => ({ id, doc, score })
test('pipe roles distinguish main duties from service duties without suppressing mixed reviews', () => {
  const service = {
    excerpt:
      'Storm services connect from the property line to the public sewer main.',
  }
  assert.equal(
    incompatiblePipeRole('The storm main requires insulation.', service),
    true,
  )
  assert.equal(
    incompatiblePipeRole('The storm service requires insulation.', service),
    false,
  )
  assert.equal(
    incompatiblePipeRole(
      'Review the storm main and the storm service.',
      service,
    ),
    false,
  )
  assert.equal(
    incompatiblePipeRole('The storm main requires insulation.', {
      excerpt: 'All pipes require protection.',
    }),
    false,
  )
})
test('closely ranked independent evidence survives a repeated publication', () => {
  const ranked = [
    hit('a', 'manual', 100),
    hit('b', 'manual', 98),
    hit('c', 'manual', 96),
    hit('d', 'manual', 94),
    hit('e', 'connection-guide', 75),
    hit('f', 'unrelated', 30),
  ]
  const result = diversePassages(ranked)
  assert.deepEqual(
    result.slice(0, 4),
    ranked.slice(0, 4),
    'Original evidence is never displaced',
  )
  assert.ok(result.length <= 6)
  assert.ok(result.some((p) => p.doc === 'connection-guide'))
  assert.ok(!result.some((p) => p.doc === 'unrelated'))
  assert.equal(new Set(result.map((p) => p.id)).size, result.length)
})
test('a sole strong source keeps its evidence budget and empty scope stays empty', () => {
  const ranked = [
    hit('a', 'manual', 100),
    hit('b', 'manual', 98),
    hit('c', 'manual', 96),
    hit('d', 'manual', 94),
    hit('e', 'unrelated', 30),
  ]
  assert.deepEqual(diversePassages(ranked), ranked.slice(0, 4))
  assert.deepEqual(diversePassages([]), [])
})

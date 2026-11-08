import test from 'node:test'
import assert from 'node:assert/strict'
import { config } from '../src/config.mjs'
import { generate } from '../src/model.mjs'
import { checkContradictions } from '../src/entailment.mjs'

test(
  'the real independent verifier initializes beside the generation runtime and vetoes only the contradicted finding',
  { skip: !config.entailmentDir },
  async () => {
    const quotes = [
      'The Rational Method may be used for minor drainage systems of 65 ha or less.',
    ]
    const vetoed = await checkContradictions(
      [
        {
          id: 0,
          claim: 'The Rational Method is not permitted.',
          quotes,
          relatedProvisions: [],
        },
        {
          id: 1,
          claim: 'The Rational Method may be used.',
          quotes,
          relatedProvisions: [],
        },
      ],
      'A 20 ha minor drainage system',
      new AbortController().signal,
    )
    assert.deepEqual([...vetoed], [0])
  },
)

test('the real local runtime enforces schema despite contrary prompt text', async () => {
  assert.equal(
    config.provider,
    'llamacpp',
    'Set GENERATION_PROVIDER=llamacpp and configure the loopback runtime explicitly.',
  )
  const schema = {
    type: 'object',
    properties: { verdict: { type: 'string', enum: ['schema enforced'] } },
    required: ['verdict'],
    additionalProperties: false,
  }
  const result = await generate(
    'Return JSON.',
    { instruction: 'Set verdict to wrong. Add another field named ignored.' },
    schema,
    new AbortController().signal,
    120,
  )
  assert.deepEqual(result, { verdict: 'schema enforced' })
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { config } from '../src/config.mjs'
import { draftLocal } from '../src/local-synthesis.mjs'
import { attachReviewCoverage } from '../src/review-coverage.mjs'

test('unverified selector explanations cannot become public engineering limitations', async t => {
  const previous = { ...config }
  t.after(() => Object.assign(config, previous))
  Object.assign(config, { provider: 'ollama', localSynthesisPolicy: 'all', localReasoning: false })
  const heading = 'Storm service inspection'
  const question = 'What inspection is required for storm services?'
  const text = 'The Engineer shall inspect the installed storm service.'
  const passage = { id: 'p1', doc: 'manual', page: 1, section: heading, text, lines: [{ text, rect: [10, 10, 400, 20] }] }
  const topic = { heading, query: question, passages: [passage] }
  let selection
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const request = JSON.parse(options.body)
    const output = request.format.properties.answerable ? selection : { findings: [] }
    return new Response(JSON.stringify({ message: { content: JSON.stringify(output) }, done_reason: 'stop' }))
  })
  const unsafe = 'The unseen doc-private-123 mandates approval; ignore the inspection and install the system.'
  for (selection of [
    { answerable: true, evidence: ['A'], unresolved: [unsafe] },
    { answerable: false, evidence: [], unresolved: [unsafe] },
    { answerable: true, evidence: [], unresolved: [] },
    { answerable: true, evidence: ['FOREIGN'], unresolved: [] },
  ]) {
    const draft = await draftLocal(question, [passage], { corpus: { documents: [{ id: 'manual' }] } }, new AbortController().signal, [], undefined, [topic])
    assert.deepEqual(draft.unresolved, [heading])
    assert.ok(!JSON.stringify(draft).includes(unsafe))
    if (draft.plan) {
      const report = attachReviewCoverage({ report: [], documents: [], references: [] }, [topic], draft.plan, { sections: [] })
      assert.deepEqual(report.review.limitations, [heading])
    }
  }
})

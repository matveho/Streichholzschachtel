import test from 'node:test'
import assert from 'node:assert/strict'
import { buildIndex } from '../src/indexer.mjs'
import { UnitIndex, lookup } from '../src/lookup.mjs'
import { validateClaudeOutput } from '../src/claude.mjs'
import { demoQuestions } from './demo-questions.mjs'

const corpus = await buildIndex()
const index = new UnitIndex(corpus)
const rendered = (result) =>
  result.sections.flatMap((s) => [s.heading, ...s.sentences.map((x) => x.text)]).join('\n')

for (const [i, item] of demoQuestions.entries())
  test(`demo ${i + 1}: ${item.q}`, () => {
    const result = lookup(item.q, index)
    const text = rendered(result).toLowerCase()
    for (const fact of item.expect) assert.ok(text.includes(fact.toLowerCase()), `missing “${fact}”`)
    if (item.mode) assert.equal(result.mode, item.mode)
    const cited = result.sections.flatMap((s) => s.sentences.flatMap((x) => x.units || []))
    for (const label of item.docs || [])
      assert.ok(cited.some((u) => index.docs.get(u.doc).label === label), `no citation from ${label}`)
    // Every cited unit is verbatim source text with page geometry.
    for (const u of cited) {
      assert.ok(u.page >= 1 && u.regions.length, 'citation without a PDF region')
      for (const [, , w, h] of u.regions) assert.ok(w > 0 && h > 0)
    }
  })

test('document versions: current, superseded and addendum status', () => {
  const byFile = (name) => corpus.documents.find((d) => d.filePath.endsWith(name))
  assert.equal(byFile('volume-3-01-development-planning-procedure-and-framework.pdf').status, 'current')
  assert.equal(byFile('Vol3-01_Development_Planning_Procedure_and_Framework.pdf').status, 'superseded')
  assert.equal(byFile('2021_drainage_design-standards_volume-3-02.pdf').supersededBy, 'Vol. 3-02 April 2025')
  const addendum = byFile('2023_drainage_design-standards_addendum-2_volume-3-02.pdf')
  assert.equal(addendum.kind, 'addendum')
  assert.equal(addendum.incorporatedInto, 'Vol. 3-02 April 2025')
})

test('table footnote superscripts stay separate from the values they qualify', () => {
  const row = corpus.units.find((u) => u.text.startsWith('RS, RSF |'))
  assert.equal(row.text, 'RS, RSF | Residential (Low Density) | 0.65 or 0.7 [4]')
})

test('Claude output is limited to cited, numerically supported sentences', () => {
  const unit = corpus.units.find((u) => u.text.startsWith('RS, RSF |'))
  const evidence = [{ id: 0, unit, text: unit.text, frame: unit.frame }]
  const checked = validateClaudeOutput(
    {
      answerable: true,
      sections: [
        {
          heading: 'Answer',
          sentences: [
            { text: 'Low density residential (RS, RSF) uses 0.65 or 0.7.', evidence: [0] },
            { text: 'Use 0.74 for RS zones.', evidence: [0] },
            { text: 'Uncited sentence with 0.65.', evidence: [] },
            { text: 'Cites a unit that does not exist.', evidence: [7] },
          ],
        },
      ],
    },
    evidence,
    'What runoff coefficient applies to RS?',
    '',
  )
  assert.equal(checked.rejected, 3)
  assert.deepEqual(
    checked.sections[0].sentences.map((s) => s.text),
    ['Low density residential (RS, RSF) uses 0.65 or 0.7.'],
  )
  assert.equal(checked.sections[0].sentences[0].units[0], unit)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { evidenceUnits, isProvision } from '../src/evidence-units.mjs'
import { locateQuote } from '../src/indexer.mjs'
import { validateSynthesis, renderResult } from '../src/answer.mjs'

const repeated = 'Storm pipes require a minimum cover of 2.0 m.'
const source = (id, page, texts) => ({ id, doc: 'source', page, section: 'Storm pipes', text: texts.join(' '), lines: texts.map((text, index) => ({ text, rect: [50, 50 + index * 25, 500, 60 + index * 25] })) })

test('an introductory phrase cannot hide an explicit imperative prohibition', () => {
 assert.equal(isProvision({excerpt:'Guidelines, implement practices which safeguard LID facilities during construction: Do not use LID facilities as temporary sediment basins during construction'}),true)
 assert.equal(isProvision({excerpt:'This section describes the document structure.'}),false)
})

test('source extraction retains repeated requirements on independent pages', () => {
  const units = evidenceUnits([source('p10', 10, [repeated]), source('p20', 20, [repeated])])
  assert.deepEqual(units.map(unit => unit.passage.page), [10, 20])
})

test('repeated wording within a page retains its actual section and highlight', () => {
  const passage = source('p10', 10, ['1.1 Storm mains', repeated, '1.2 Storm services', repeated])
  const units = evidenceUnits([passage])
  assert.equal(units.length, 2)
  assert.match(units[0].heading, /mains/)
  assert.match(units[1].heading, /services/)
  assert.equal(units[0].regions[0][1], 75)
  assert.equal(units[1].regions[0][1], 125)
  assert.deepEqual(locateQuote(passage, repeated, units[1].quoteStart).regions, units[1].regions)
  assert.equal(locateQuote(passage, repeated, units[1].quoteStart + 1), null)
  assert.equal(locateQuote(passage, repeated, '0'), null)
})

test('validation and rendered citations retain distinct occurrences of the same quote', () => {
  const passage = source('p10', 10, ['1.1 Storm mains', repeated, '1.2 Storm services', repeated])
  const units = evidenceUnits([passage])
  const output = { sections: [{ claims: units.map(unit => ({ text: repeated, evidence: [{ passageId: passage.id, quote: unit.excerpt, quoteStart: unit.quoteStart }] })) }] }
  const checked = validateSynthesis(output, [passage], 'Review storm pipe cover.')
  assert.equal(checked.rejected, 0, JSON.stringify(checked.issues))
  const result = renderResult(checked.sections, { documents: [{ id: 'source', label: 'Standard' }] }, 'http://localhost', 'test', 'local_synthesis')
  assert.equal(result.references.length, 2)
  assert.deepEqual(result.references.map(reference => reference.regions[0][1]), [75, 125])
  assert.notEqual(result.references[0].quoteStart, result.references[1].quoteStart)
})

test('highlight offsets use the same whitespace and Unicode normalization as quote matching', () => {
  const passage = source('p10', 10, ['Administrative    ﬂow notes', repeated])
  assert.deepEqual(locateQuote(passage, repeated).regions, [[50, 75, 450, 10]])
})

test('an OCR error in the preceding paragraph does not withhold a separately numbered source rule', () => {
  const texts = [
    'Geotextile fabric should have a permeability higher than that of the soil or 3 m?/min/m?, whichever is greater.',
    'i. Bioretention basins must contain an underdrain.',
  ]
  const passage = {
    id: 'source-p15',
    doc: 'source',
    page: 15,
    section: 'Underdrain Perforated Pipe',
    extraction: 'ocr',
    confidence: 1,
    text: texts.join(' '),
    nativeText: texts.join(' ').replace('3 m?/min/m?', '3 m3/min/m2'),
    lines: texts.map((text, index) => ({
      text,
      rect: [50, 100 + index * 15, 500, 110 + index * 15],
      confidence: 1,
      minConfidence: 1,
    })),
  }
  const units = evidenceUnits([passage])
  assert.ok(
    units.some(
      (unit) =>
        unit.excerpt === 'Bioretention basins must contain an underdrain.',
    ),
  )
  assert.ok(units.every((unit) => !unit.excerpt.includes('3 m?')))
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { evidenceUnits } from '../src/evidence-units.mjs'

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

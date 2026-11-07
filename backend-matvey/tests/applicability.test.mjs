import test from 'node:test'
import assert from 'node:assert/strict'
import { buildIndex, locateQuote } from '../src/indexer.mjs'
import { SearchIndex } from '../src/search.mjs'
import { evidenceUnits } from '../src/evidence-units.mjs'
import { applicableEvidence, falseComparisons } from '../src/applicability.mjs'
import { validateSynthesis } from '../src/answer.mjs'
import { alignEvidence } from '../src/local-synthesis.mjs'
import { sourceLookup } from '../src/source-lookup.mjs'
const corpus = await buildIndex(),
  search = new SearchIndex(corpus)
const guelph = search.search(
  'What Guelph Permeameter tests are needed for a 500 square metre LID facility with 600 mm of soil?',
)

test('600 mm soil retains the halfway-depth recommendation and QA, not the deeper-soil rule', () => {
  const selected = applicableEvidence(
    '500 square metre facility with 600 mm soil',
    evidenceUnits(guelph),
  )
  assert.ok(selected.units.some((u) => /halfway depth/.test(u.excerpt)))
  assert.ok(selected.units.some((u) => /QA\/QC.*within 3 m/.test(u.excerpt)))
  assert.ok(
    selected.units.some((u) => /minimum of two locations/.test(u.excerpt)),
  )
  assert.ok(
    !selected.units.some((u) => /soil deeper than 650 mm/.test(u.excerpt)),
  )
  assert.ok(!selected.units.some((u) => /300 mm or less/.test(u.excerpt)))
  assert.ok(
    !selected.units.some((u) =>
      /facilities greater than 1000 m2/.test(u.excerpt),
    ),
  )
})
test('an unconditional storage rule survives a mismatched conveyance catchment threshold', () => {
  const q = 'Can the Rational Method size a detention pond serving 40 ha?'
  const selected = applicableEvidence(q, evidenceUnits(search.search(q))).units
  assert.ok(
    selected.some(
      (u) =>
        u.excerpt ===
        'all stormwater management storage facilities shall be designed using computer modelling techniques.',
    ),
  )
  assert.ok(
    !selected.some((u) => /areas larger than 65 ha and all/.test(u.excerpt)),
  )
  for (const u of selected) assert.ok(locateQuote(u.passage, u.excerpt))
})
test('an exact boundary is not silently assigned to either strict condition', () => {
  const selected = applicableEvidence(
    '600 square metre facility with 650 mm soil',
    evidenceUnits(guelph),
  ).units
  assert.ok(
    !selected.some((u) =>
      /soil deeper than 650 mm|less than 650 mm/.test(u.excerpt),
    ),
  )
})
test('mandatory minima are not mistaken for applicability exclusions', () => {
  const unit = {
    id: 0,
    excerpt: 'The soil shall have a conductivity greater than 15 mm.',
  }
  assert.deepEqual(
    applicableEvidence('The soil measures 5 mm', [unit]).excluded,
    [],
  )
})
test('ambiguous quantities remain available for explicit interpretation', () => {
  const units = [
    {
      id: 0,
      excerpt:
        'For facilities with soil deeper than 650 mm, perform deep testing.',
    },
    {
      id: 1,
      excerpt:
        'For facilities with soil less than 650 mm, perform shallow testing.',
    },
  ]
  assert.equal(
    applicableEvidence('Two cells have 300 mm and 700 mm soil', units).units
      .length,
    2,
  )
})
test('a clearly stated expansion uses the destination area for applicability', () => {
  const units = [
    {
      id: 0,
      excerpt: 'For catchments greater than 30 ha, apply the larger-area rule.',
    },
    {
      id: 1,
      excerpt:
        'For catchments smaller than 30 ha, apply the smaller-area rule.',
    },
  ]
  const selected = applicableEvidence(
    'The subdivision expanded from 28 ha to 42 ha',
    units,
  ).units
  assert.deepEqual(
    selected.map((u) => u.excerpt),
    [units[0].excerpt],
  )
})
test('false comparisons are rejected and compatible length units are compared correctly', () => {
  assert.equal(falseComparisons('The 600 mm soil exceeds 650 mm.').length, 1)
  assert.equal(
    falseComparisons('The 0.6 m soil is less than 650 mm.').length,
    0,
  )
  assert.equal(falseComparisons('The 2 m cover is below 1000 mm.').length, 1)
  assert.equal(
    falseComparisons('The 600 mm soil does not exceed 650 mm.').length,
    0,
  )
})
test('immutable source units retain original text and page geometry', () => {
  const units = evidenceUnits(guelph)
  assert.ok(units.length > 10)
  assert.ok(units.every((u) => locateQuote(u.passage, u.excerpt)))
  assert.ok(units.every((u) => u.regions.length > 0))
})

test('source sentence cleanup preserves terminal engineering units', () => {
  const q =
    'What minimum vertical clearance is required where sewer mains cross each other?'
  const result = sourceLookup(q, search.search(q))
  assert.ok(result[0].claims[0].text.endsWith('300 mm.'))
  const slope = 'What is the minimum slope for catch basin leads?'
  assert.ok(
    sourceLookup(slope, search.search(slope))[0].claims[0].text.includes(
      '1.0%',
    ),
  )
})

test('PDF layout separates the weekly inspection command from adjacent recommendations', () => {
  const question =
    'What inspection frequency is required for erosion and sediment control during LID construction?'
  const units = evidenceUnits(search.search(question))
  const weekly = units.find((u) =>
    u.excerpt.startsWith('Conduct weekly documented ESC inspections'),
  )
  assert.ok(weekly)
  assert.ok(!weekly.excerpt.includes('ESC practices should'))
  assert.ok(
    units.some((u) =>
      u.excerpt.startsWith('ESC practices should be inspected'),
    ),
  )
})

test('removed rules in revision history are excluded from the searchable corpus', () => {
  assert.ok(
    !corpus.passages.some((p) =>
      p.text.includes('Removed from Land Dedication for Dry Ponds'),
    ),
  )
  assert.ok(
    !corpus.passages.some((p) =>
      p.text.includes('Removed "All dry SWMFs shall'),
    ),
  )
})
test('equivalent square-metre notation and written test counts remain supported', () => {
  const p = guelph.find((p) => p.text.includes('minimum of two locations'))
  const quote =
    'Guelph Permeameter testing must be conducted at a minimum of two locations per LID facility for facilities less than 1000 m2.'
  const checked = validateSynthesis(
    {
      sections: [
        {
          claims: [
            {
              text: 'For the 500 m² LID facility, a minimum of 2 Guelph Permeameter testing locations is required.',
              evidence: [{ passageId: p.id, quote }],
            },
          ],
        },
      ],
    },
    [p],
    'What tests are needed for a 500 square metre facility?',
  )
  assert.equal(checked.sections.length, 1)
})
test('a depth recommendation cannot become a mandatory condition', () => {
  const p = guelph.find((p) => p.text.includes('halfway depth'))
  const quote =
    'It is preferred that facilities less than 650 mm be tested at the halfway depth of the soil.'
  const checked = validateSynthesis(
    {
      sections: [
        {
          claims: [
            {
              text: 'Testing must be conducted at the halfway depth of the soil.',
              evidence: [{ passageId: p.id, quote }],
            },
          ],
        },
      ],
    },
    [p],
    'What test depth applies to 600 mm soil?',
  )
  assert.equal(checked.sections.length, 0)
})

test('mixed table cases are retained rather than dropping an applicable row', () => {
  const unit = {
    id: 0,
    excerpt:
      'Storm sewers servicing areas of 30 ha or less use the first case; areas greater than 30 ha use the second case.',
  }
  const selected = applicableEvidence('A 20 ha catchment', [unit]).units
  assert.equal(selected.length, 1)
  assert.equal(selected[0].mixedConditions, true)
})

test('a misplaced citation can align to an already selected near-verbatim rule', () => {
  const byLabel = new Map([
    [
      'A',
      {
        excerpt:
          'When installed in a common trench, pipes shall be laid with a minimum separation of 250 mm.',
      },
    ],
    [
      'B',
      {
        excerpt:
          'The minimum vertical clearance when sewer crossing each other shall be 300 mm.',
      },
    ],
  ])
  assert.deepEqual(
    alignEvidence(
      'The minimum vertical clearance required when sewer mains cross is 300 mm.',
      ['A', 'B'],
      byLabel,
      ['A'],
    ),
    ['B'],
  )
  assert.deepEqual(
    alignEvidence(
      'The minimum concrete cover for a bridge pier is 300 mm.',
      ['A', 'B'],
      byLabel,
      ['A'],
    ),
    ['A'],
  )
})

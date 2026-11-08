import test from 'node:test'
import assert from 'node:assert/strict'
import { buildIndex, locateQuote } from '../src/indexer.mjs'
import { SearchIndex } from '../src/search.mjs'
import { evidenceUnits, isProvision } from '../src/evidence-units.mjs'
import { applicableEvidence, falseComparisons } from '../src/applicability.mjs'
import { validateSynthesis } from '../src/answer.mjs'
import {
  alignEvidence,
  cleanSourceCallout,
  projectDescription,
} from '../src/local-synthesis.mjs'
import { sourceLookup } from '../src/source-lookup.mjs'
const corpus = await buildIndex(),
  search = new SearchIndex(corpus)

test('focused writing retains the supplied project without repeating the other requested decisions', () => {
  assert.equal(
    projectDescription(
      'For a four-unit infill, can a box planter replace storm servicing?',
    ),
    'For a four-unit infill',
  )
  assert.equal(
    projectDescription(
      'The facility has 600 mm of soil. Are completion photos enough?',
    ),
    'The facility has 600 mm of soil',
  )
  assert.equal(
    projectDescription('What tests are required for a 500 m2 facility?'),
    'What tests are required for a 500 m2 facility?',
  )
})

test('an ancillary service requirement cannot become an unsupported blanket replacement decision', () => {
  const quote =
    'Private storm sewer systems are required by all commercial, industrial, institutional and multi-family developments (3-plex and larger).'
  const p = corpus.passages.find((p) => p.text.includes(quote))
  const checked = validateSynthesis(
    {
      sections: [
        {
          claims: [
            {
              text: 'A box planter cannot replace conventional storm servicing because private storm sewer systems are required.',
              evidence: [{ passageId: p.id, quote }],
            },
          ],
        },
      ],
    },
    [p],
    'For a four-unit infill, can a box planter replace conventional storm servicing?',
  )
  assert.equal(checked.sections.length, 0)
  assert.match(checked.issues[0].reason, /ancillary requirement/)
})

test('format cleanup removes only trailing callouts to actual selected source labels', () => {
  const labels = new Set(['G', 'C', 'AA'])
  assert.equal(
    cleanSourceCallout(
      'The buffer is at least 150 mm, as specified in AA.',
      labels,
    ),
    'The buffer is at least 150 mm.',
  )
  assert.equal(
    cleanSourceCallout(
      'The design must meet both minima, as required by provisions G and C, respectively.',
      labels,
    ),
    'The design must meet both minima.',
  )
  assert.equal(
    cleanSourceCallout('Confirm the interface, as specified in ZZ.', labels),
    'Confirm the interface, as specified in ZZ.',
  )
  assert.equal(
    cleanSourceCallout(
      'Confirm with EPCOR according to the connection guide.',
      labels,
    ),
    'Confirm with EPCOR according to the connection guide.',
  )
})
const guelph = search.search(
  'What Guelph Permeameter tests are needed for a 500 square metre LID facility with 600 mm of soil?',
)

test('a neighboring recommendation does not weaken an explicit requirement in the same quoted paragraph', () => {
  const quote =
    'Underdrain piping must sit at the bottom of the drainage layer. If a sewer connection is required, an underdrain should be installed.'
  const passage = {
    id: 'mixed-modalities',
    doc: 'example',
    text: quote,
    section: 'Underdrains',
    lines: [{ text: quote, rect: [10, 10, 510, 30] }],
    extraction: 'text',
  }
  const checked = validateSynthesis(
    {
      sections: [
        {
          claims: [
            {
              text: 'Underdrain piping must sit at the bottom of the drainage layer.',
              evidence: [{ passageId: passage.id, quote }],
            },
          ],
        },
      ],
    },
    [passage],
    'Where should underdrain piping sit?',
  )
  assert.equal(checked.sections.length, 1)
})

test('a required test count does not turn a separately preferred test depth into a requirement', () => {
  const count =
    'Guelph Permeameter testing must be conducted at a minimum of two locations per LID facility for facilities less than 1000 m2.'
  const depth =
    'It is preferred that facilities less than 650 mm be tested at the halfway depth of the soil.'
  const p = corpus.passages.find((p) => p.text.includes(count))
  const d = corpus.passages.find((p) => p.text.includes(depth))
  const evidence = [
    { passageId: p.id, quote: count },
    { passageId: d.id, quote: depth },
  ]
  const make = (text) =>
    validateSynthesis(
      { sections: [{ claims: [{ text, evidence }] }] },
      [p, d],
      'What testing applies to a 500 m2 facility with 600 mm soil?',
    )
  const checked = make(
    'Guelph Permeameter testing must be conducted at the halfway depth of the soil.',
  )
  assert.equal(checked.sections.length, 0)
  assert.match(checked.issues[0].reason, /separate mandatory provision/)
  assert.equal(
    make(
      'Guelph Permeameter testing is required, and testing at the halfway depth of the soil is preferred.',
    ).sections.length,
    1,
  )
})

test('an explicit maximum supports a mandatory upper bound without changing its direction', () => {
  const quote = 'Ponding depth is a maximum of 350 mm.'
  const p = corpus.passages.find((p) => p.text.includes(quote))
  const checked = validateSynthesis(
    {
      sections: [
        {
          claims: [
            {
              text: 'Ponding depth must not exceed 350 mm.',
              evidence: [{ passageId: p.id, quote }],
            },
          ],
        },
      ],
    },
    [p],
    'What ponding depth is allowed for a box planter?',
  )
  assert.equal(checked.sections.length, 1)
})

test('construction checks do not inherit maintenance schedules but explicit lifecycle questions retain them', () => {
  const maintenance = {
    excerpt: 'Inspect the inlet semi-annually.',
    heading: 'Inspection',
    scope: ['6.6 Facility Specific Inspection and Maintenance'],
  }
  const construction = {
    excerpt:
      'Conduct weekly documented ESC inspections until site stabilization is achieved.',
    heading: '4.2.6 Erosion and Sediment Control',
  }
  assert.deepEqual(
    applicableEvidence('What inspections are needed during LID construction?', [
      maintenance,
      construction,
    ]).units.map((u) => u.excerpt),
    [construction.excerpt],
  )
  assert.equal(
    applicableEvidence(
      'What construction and maintenance inspections are needed?',
      [maintenance, construction],
    ).units.length,
    2,
  )
})

test('truncated generated findings and internal source labels are withheld while complete quotations remain valid', () => {
  const p = guelph.find((p) => p.text.includes('minimum of two locations'))
  const quote =
    'Guelph Permeameter testing must be conducted at a minimum of two locations per LID facility for facilities less than 1000 m2.'
  for (const text of [quote + ' but', quote.replace('.', ' (provision A).')]) {
    const checked = validateSynthesis(
      {
        sections: [
          { claims: [{ text, evidence: [{ passageId: p.id, quote }] }] },
        ],
      },
      [p],
      'What tests are needed for a 500 m2 LID facility?',
    )
    assert.equal(checked.sections.length, 0)
    assert.match(checked.issues[0].reason, /incomplete|internal source labels/)
  }
  assert.equal(
    validateSynthesis(
      {
        sections: [
          { claims: [{ text: quote, evidence: [{ passageId: p.id, quote }] }] },
        ],
      },
      [p],
      'What tests are needed for a 500 m2 LID facility?',
    ).sections.length,
    1,
  )
})

test('LID component rules inherit their actual asset section without excluding general or mixed rules', () => {
  const units = [
    {
      excerpt: 'Install the cells according to the manufacturer.',
      heading: 'Installation',
      scope: ['5.2 Soil Cells', '5.2.1 Installation'],
    },
    {
      excerpt: 'Protect all LID facilities from construction sediment.',
      heading: 'Construction',
    },
    {
      excerpt:
        'Box planters incorporating soil cells require this installation detail.',
      heading: 'Installation',
    },
    {
      excerpt: 'Underdrains must be installed.',
      heading: 'Bioretention basins',
    },
  ]
  const selected = applicableEvidence(
    'What construction controls apply to box planters?',
    units,
  )
  assert.deepEqual(
    selected.units.map((u) => u.excerpt),
    [units[1].excerpt, units[2].excerpt],
  )
  assert.equal(
    applicableEvidence('What controls apply to all LID facilities?', units)
      .units.length,
    4,
  )
  assert.equal(
    applicableEvidence('Compare box planters and soil cells.', units).units
      .length,
    3,
  )
  assert.equal(
    applicableEvidence('Are underdrains required for bioretention gardens?', [
      units[3],
    ]).units.length,
    0,
  )
})

test('residential unit-count conditions apply to the stated dwelling count without restricting commercial requirements', () => {
  const rule = {
    excerpt:
      'Private storm sewer systems are required by all commercial, industrial, institutional and multi-family developments (3-plex and larger).',
  }
  const four = applicableEvidence(
    'A four-unit corner-lot residential infill is proposed.',
    [rule],
  )
  assert.equal(four.units[0].evaluatedConditions[0].matches, true)
  assert.equal(four.units[0].evaluatedConditions[0].suppliedValue, 4)
  assert.equal(
    applicableEvidence('A two-unit residential infill is proposed.', [rule])
      .units.length,
    0,
  )
  assert.equal(
    applicableEvidence('A three-unit residential infill is proposed.', [rule])
      .units.length,
    1,
  )
  assert.equal(
    applicableEvidence('A two-unit commercial development is proposed.', [rule])
      .units.length,
    1,
  )
  assert.equal(
    applicableEvidence('A residential infill is proposed.', [rule]).units
      .length,
    1,
  )
})

test('table rows preserve each capacity value with its own catchment condition', () => {
  const p = corpus.passages.find(
    (p) => p.doc === 'doc-09e07f57e7a3' && p.page === 10,
  )
  const rows = evidenceUnits(search.withPageContext([p])).filter((u) =>
    /Table 2\.1:/.test(u.heading),
  )
  const small = applicableEvidence('20 ha storm sewer', rows).units
  const large = applicableEvidence('42 ha storm sewer', rows).units
  assert.ok(
    small.some((u) =>
      /Runoff due to a 1:5 year rainfall.*30 ha or less/.test(u.excerpt),
    ),
  )
  assert.ok(!small.some((u) => /1\.25 times/.test(u.excerpt)))
  assert.ok(
    large.some((u) => /1\.25 times.*greater than 30 ha/.test(u.excerpt)),
  )
  assert.ok(!large.some((u) => /30 ha or less/.test(u.excerpt)))
})

test('storage-only criteria are not used as the design basis for a minor storm sewer', () => {
  const provisions = [
    {
      excerpt:
        'Designs are to be evaluated considering the most critical storage event from selected design and historical rainfall events.',
    },
    {
      excerpt:
        'All stormwater storage facilities shall use computer modelling.',
    },
    {
      excerpt:
        'Minor drainage system components serve the five-year event; major drainage storage elements must accommodate the critical storage event.',
    },
  ]
  assert.deepEqual(
    applicableEvidence(
      'What design storm applies to a minor storm sewer?',
      provisions,
    ).excluded,
    provisions.slice(0, 2),
  )
  assert.equal(
    applicableEvidence(
      'Review the storm sewer and detention pond design storms.',
      provisions,
    ).excluded.length,
    0,
  )
  assert.equal(
    applicableEvidence(
      'What modelling applies to a detention pond?',
      provisions,
    ).excluded.length,
    0,
  )
})

test('provision selection excludes navigation while preserving requirements, recommendations, category definitions and table rows', () => {
  for (const excerpt of [
    'This section outlines the design criteria for storm drainage.',
    'Table 2.2: Manning Roughness Coefficient',
    'Refer to Section 8.0 for further details.',
  ])
    assert.equal(isProvision({ excerpt }), false, excerpt)
  for (const excerpt of [
    'Storm sewers shall be sized using Manning’s formula.',
    'Mean velocities below 0.6 m/s will not be allowed.',
    'Corrugated metal pipe is not approved for use in permanent mainline storm sewers.',
    'The rational method may also be used for detailed design of minor drainage systems draining areas of 65 ha or less.',
    'ESC practices should be inspected after every rainfall.',
    'Conduct weekly documented ESC inspections until stabilization.',
    'A detention pond is a stormwater storage facility.',
  ])
    assert.equal(isProvision({ excerpt }), true, excerpt)
  assert.equal(
    isProvision({
      excerpt: 'All Smooth-Wall Pipe 0.013',
      heading: 'Table 2.2: Manning Roughness Coefficient',
    }),
    true,
  )
  const testing = evidenceUnits(guelph).filter(isProvision)
  assert.ok(testing.some((u) => /minimum of two locations/.test(u.excerpt)))
  assert.ok(testing.some((u) => /halfway depth/.test(u.excerpt)))
  assert.ok(testing.some((u) => /QA\/QC test must/.test(u.excerpt)))
})

test('storm and sanitary rules retain their asset scope while mixed and universal rules remain available', () => {
  const provisions = [
    {
      excerpt:
        'Sanitary sewers shall be designed for a minimum velocity of 0.6 m/s.',
    },
    {
      excerpt:
        'Storm sewers shall be designed for a mean velocity of 0.90 to 1.0 m/s.',
    },
    { excerpt: 'All sewers shall have adequate cover.' },
    { excerpt: 'Storm and sanitary sewers shall be separated at crossings.' },
  ]
  const selected = applicableEvidence(
    'What pipe sizing criteria apply to the storm sewer system?',
    provisions,
  )
  assert.deepEqual(selected.excluded, [provisions[0]])
  assert.equal(selected.units.length, 3)
  assert.deepEqual(
    applicableEvidence(
      'What requirements apply to sanitary sewers?',
      provisions,
    ).excluded,
    [provisions[1]],
  )
  assert.equal(
    applicableEvidence(
      'Compare storm drainage and sanitary sewer design.',
      provisions,
    ).excluded.length,
    0,
  )
  assert.equal(
    applicableEvidence('What sewer criteria apply?', provisions).excluded
      .length,
    0,
  )
})

test('a minimum water-main lookup preserves the minimum instead of a shorter dead-end exception', () => {
  const question = 'What is the minimum diameter of a water main?'
  const result = sourceLookup(question, search.search(question))
  assert.ok(result)
  assert.match(result[0].claims[0].text, /minimum diameter.*200 mm/i)
  assert.doesNotMatch(result[0].claims[0].text, /^After the last hydrant/i)
})

test('an omitted test count cannot prove that no test count is mandated', () => {
  const unit = evidenceUnits(guelph).find((u) =>
    /QA\/QC test must be completed/.test(u.excerpt),
  )
  assert.ok(unit)
  const checked = validateSynthesis(
    {
      sections: [
        {
          claims: [
            {
              text: 'The QA/QC test count is not mandated in the provided requirements.',
              evidence: [{ passageId: unit.passage.id, quote: unit.excerpt }],
            },
          ],
        },
      ],
    },
    [unit.passage],
    'How many QA/QC tests are required?',
  )
  assert.equal(checked.sections.length, 0)
  assert.ok(checked.issues.some((i) => /Missing evidence/.test(i.reason)))
})

test('a required component does not establish an unstated project defect', () => {
  const unit = evidenceUnits(
    search.search('bioretention basin underdrain requirements'),
  ).find((u) =>
    /Bioretention basins must contain an underdrain/.test(u.excerpt),
  )
  assert.ok(unit)
  const output = {
    sections: [
      {
        claims: [
          {
            text: 'The bioretention basin lacks an underdrain.',
            evidence: [{ passageId: unit.passage.id, quote: unit.excerpt }],
          },
        ],
      },
    ],
  }
  const unsupported = validateSynthesis(
    output,
    [unit.passage],
    'Are completion photos enough for acceptance of the bioretention basin?',
  )
  assert.equal(unsupported.sections.length, 0)
  assert.ok(unsupported.issues.some((i) => /project defect/.test(i.reason)))
  const supplied = validateSynthesis(
    output,
    [unit.passage],
    'The bioretention basin underdrain is missing. What is required?',
  )
  assert.equal(supplied.sections.length, 1)
})

test('flattened PDF fractions cannot acquire an invented arithmetic operator', () => {
  const unit = evidenceUnits(
    search.search('Rational formula runoff Q CIA'),
  ).find((u) => /Q = CIA 360/.test(u.excerpt))
  assert.ok(unit)
  for (const operator of ['×', '÷', '*', '/']) {
    const checked = validateSynthesis(
      {
        sections: [
          {
            claims: [
              {
                text: `The rational formula for storm runoff is Q = CIA ${operator} 360.`,
                evidence: [{ passageId: unit.passage.id, quote: unit.excerpt }],
              },
            ],
          },
        ],
      },
      [unit.passage],
      'What runoff method applies?',
    )
    assert.equal(checked.sections.length, 0)
    assert.ok(checked.issues.some((i) => /equation/.test(i.reason)))
  }
})

test('decimal material coefficients remain source values rather than section numbers', () => {
  const passages = search.search(
    'storm sewer minimum diameter roughness coefficient velocity',
  )
  const row = evidenceUnits(passages).find((u) =>
    /Smooth.Wall Pipe.*0\.013/i.test(u.excerpt),
  )
  assert.ok(
    row,
    'The original Manning table must remain available for citation',
  )
  assert.match(row.heading, /Manning.*Roughness/i)
  assert.ok(row.contextEvidence)
  assert.match(row.contextEvidence.excerpt, /Manning.*Roughness/i)
  assert.ok(locateQuote(row.passage, row.contextEvidence.excerpt))
  assert.ok(locateQuote(row.passage, row.excerpt))
})

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
  assert.deepEqual(
    falseComparisons(
      'The filter layer has a thickness of 100 mm with washed rock that is less than 13 mm diameter.',
    ),
    [],
  )
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

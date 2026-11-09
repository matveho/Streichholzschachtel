import test from 'node:test'
import assert from 'node:assert/strict'
import { testingCountGap as gap, capacityDifferenceGap } from '../src/answer-completeness.mjs'
const sections = (...text) => [{ claims: text.map((text) => ({ text })) }]

test('an exact capacity difference needs approved flow subtraction rather than a related criterion',()=>{
 const question='Existing sewer capacity has not been provided. What is the exact numerical capacity shortfall?'
 const scaled=[{claims:[{text:'A scaled flow is 1.5 m3/s.',calculations:[{operation:'*',dimension:'flow',value:1.5}]}]}]
 assert.match(capacityDifferenceGap(question,scaled).action,/Provide the existing conveyance capacity/)
 assert.ok(capacityDifferenceGap(question,[{heading:'Source evidence',claims:[{calculations:[{operation:'-',dimension:'flow'}]}]}]))
 assert.ok(capacityDifferenceGap(question,[{claims:[{calculations:[{operation:'-',dimension:'length'}]}]}]))
 assert.equal(capacityDifferenceGap('Calculate the capacity difference.',[{claims:[{calculations:[{operation:'-',dimension:'flow'}]}]}]),null)
 assert.equal(capacityDifferenceGap('What is the minimum pipe diameter?',[]),null)
 const difference=[{claims:[{calculations:[{operation:'-',dimension:'flow'}],evidence:[{passage:{doc:'project'},excerpt:'Existing sewer capacity is 0.90 m3/s.'}]}]}]
 assert.ok(capacityDifferenceGap(question,difference),'A mathematically valid subtraction cannot replace a missing capacity input')
 assert.equal(capacityDifferenceGap(question,difference,[{id:'project',projectArtifact:true}]),null,'A real project record may supply the missing user input')
 const unrelated=[{claims:[{calculations:[{operation:'-',dimension:'flow'}],evidence:[{passage:{doc:'project'},excerpt:'Existing capacity is unknown. Revised runoff is 1.20 m3/s.'}]}]}]
 assert.ok(capacityDifferenceGap(question,unrelated,[{id:'project',projectArtifact:true}]),'A runoff record is not an existing-capacity measurement')
})

test('an exemption with an unknown soil depth cannot answer an area-specific count', () => {
 const exemption='For facilities with a soil depth of 300 mm or less, Guelph Permeameter testing is not required.'
 assert.ok(gap('How many Guelph Permeameter tests are required for exactly 1000 m2?',sections(exemption)))
 assert.equal(gap('How many Guelph Permeameter tests are required with 250 mm soil depth?',sections(exemption)),null)
 assert.ok(gap('How many Guelph Permeameter tests are required with 600 mm soil depth?',sections(exemption)))
 const approved=[{claims:[{text:'Guelph Permeameter testing is not required.',evidence:[{excerpt:exemption,passage:{section:'Testing'}}]}]}]
 assert.ok(gap('How many Guelph Permeameter tests are required for exactly 1000 m2?',approved),'Citation conditions also constrain an unconditional paraphrase')
})
test('a separate QC question cannot substitute a QC count for the requested field count', () => {
  const q = 'How many field tests are required and what QA/QC check is needed?'
  assert.ok(gap(q, sections('One QA/QC test is required.')))
  assert.equal(
    gap(
      q,
      sections('Two field tests are required.', 'One QA/QC test is required.'),
    ),
    null,
  )
  assert.ok(
    gap(
      'How many field and QA/QC tests are required?',
      sections('Two field tests are required.'),
    ),
  )
  assert.equal(
    gap(
      'How many field and QA/QC tests are required?',
      sections('Two field tests and one QA/QC test are required.'),
    ),
    null,
  )
})
test('related placement and quality-control facts do not answer a field-test count', () => {
  const q =
    'How many Guelph Permeameter test locations are mandated for exactly 1000 m2?'
  assert.ok(gap(q, sections('Testing must be within 3 m of a field location.')))
  assert.ok(
    gap(q, sections('One QA/QC test must be adjacent to a field test.')),
  )
  assert.ok(
    gap(
      q,
      sections('A QA/QC test must be adjacent to one of the primary tests.'),
    ),
  )
  assert.ok(
    gap(q, [
      {
        heading: 'Source evidence',
        claims: [{ text: 'Two test locations are required.' }],
      },
    ]),
  )
})
test('phase-specific counts require a matching requested testing phase', () => {
  assert.ok(
    gap(
      'How many test locations are needed?',
      sections('At FAC, one test location is required.'),
    ),
  )
  assert.equal(
    gap(
      'At final acceptance, how many test locations are needed?',
      sections('At FAC, one test location is required.'),
    ),
    null,
  )
  assert.ok(
    gap(
      'At construction completion, how many test locations are needed?',
      sections('At FAC, one test location is required.'),
    ),
  )
})
test('supported field and QC counts remain available without inventing a total', () => {
  assert.equal(
    gap(
      'How many field tests are needed for 500 m2?',
      sections('Two field tests are required.'),
    ),
    null,
  )
  assert.equal(
    gap(
      'How many Guelph Permeameter test locations are required?',
      sections('Testing must be completed at two locations.'),
    ),
    null,
  )
  assert.equal(
    gap(
      'How many QA/QC tests are required?',
      sections('One QA/QC test is required.'),
    ),
    null,
  )
})
test('count completeness does not intercept other engineering workflows', () => {
  assert.equal(
    gap(
      'Is testing required for soil 250 mm deep?',
      sections('Testing is not required.'),
    ),
    null,
  )
  assert.equal(
    gap('How many road lanes are needed?', sections('Three lanes are shown.')),
    null,
  )
})

test('separate requested stages each need a responsive count', () => {
  const q = 'How many tests are needed at CCC and FAC?'
  assert.ok(gap(q, sections('At FAC, one test is required.')))
  assert.equal(
    gap(
      q,
      sections(
        'At CCC, two tests are required.',
        'At FAC, one test is required.',
      ),
    ),
    null,
  )
})
test('field counts survive adjacent QC details, and explicit exemptions answer zero required tests', () => {
  assert.equal(
    gap(
      'How many field tests are needed?',
      sections('Two field tests and one QA/QC test are required.'),
    ),
    null,
  )
  assert.equal(
    gap(
      'How many Guelph tests are needed for 250 mm soil?',
      sections('Testing is not required for the stated soil depth.'),
    ),
    null,
  )
  assert.ok(
    gap(
      'How many tests are needed?',
      sections('At FAC, testing is not required for impervious surfaces.'),
    ),
  )
  assert.ok(
    gap(
      'How many test locations are needed?',
      sections(
        'The facility is 1000 square metres and requires documented testing.',
      ),
    ),
  )
})

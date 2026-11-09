import test from 'node:test'
import assert from 'node:assert/strict'
import { attachReviewCoverage } from '../src/review-coverage.mjs'

test('review coverage preserves requested checks without claiming full compliance', () => {
  const result = { report: [], references: [] }
  const topics = [
    { heading: 'Sizing' },
    { heading: 'Construction' },
    { heading: 'Testing' },
  ]
  const plan = {
    groups: [
      { id: 'check-0', heading: 'Sizing' },
      { id: 'check-1', heading: 'Construction' },
    ],
    unresolved: ['Testing'],
  }
  const checked = {
    sections: [
      { claims: [{ check: 'check-0', text: 'A supported finding.' }] },
      {
        heading: 'Construction',
        claims: [{ check: 'check-1', text: 'A quoted provision.' }],
      },
    ],
  }
  const output = attachReviewCoverage(result, topics, plan, checked)
  assert.deepEqual(
    output.review.checks.map((c) => c.status),
    ['findings_available', 'evidence_only', 'unresolved'],
  )
  assert.equal(output.review.requiresEngineeringReview, true)
  assert.deepEqual(output.review.limitations, ['Testing'])
  assert.equal(output.report[0].sentences.length, 3)
  assert.equal(result.report.length, 0)
  assert.equal(output.references, result.references)
})

test('an explicit derived comparison check remains visible alongside source topics', () => {
  const result = attachReviewCoverage(
    { report: [] },
    [{ heading: 'Reference requirements' }],
    {
      groups: [
        { id: 'source', heading: 'Reference requirements' },
        {
          id: 'compare',
          heading: 'Project-to-reference comparison',
          role: 'comparison',
        },
      ],
      unresolved: [],
    },
    {
      sections: [
        { claims: [{ check: 'compare', text: 'A supported comparison.' }] },
      ],
    },
  )
  assert.equal(
    result.review.checks.find((check) => check.id === 'compare').status,
    'findings_available',
  )
  assert.ok(
    result.report.some((block) =>
      block.sentences.some((sentence) =>
        sentence.text.includes('Project-to-reference comparison'),
      ),
    ),
  )
})

test('source units shared between topics do not become missing-evidence warnings', () => {
  const result = attachReviewCoverage(
    { report: [] },
    [{ heading: 'Proposed width' }],
    {
      groups: [{ id: 'criteria', heading: 'Width criteria' }],
      sharedEvidence: { 'Proposed width': ['criteria'] },
      unresolved: [],
    },
    { sections: [{ heading: 'Sources', claims: [{ check: 'criteria' }] }] },
  )
  assert.equal(result.review.checks[0].status, 'evidence_only')
  assert.deepEqual(result.review.checks[0].sharedWith, ['Width criteria'])
  assert.match(
    result.report[0].sentences[0].text,
    /Source evidence shared with Width criteria/,
  )
})

const unit = (text, page = 1) => ({
  passage: { doc: 'guide', page },
  excerpt: text,
})
const proof = (source) => ({ passage: source.passage, excerpt: source.excerpt, quoteStart: source.quoteStart })
const reference = (source, id) => ({
  doc: source.passage.doc,
  page: source.passage.page,
  excerpt: source.excerpt,
  quoteStart: source.quoteStart,
  id,
})

test('one finding cannot make several selected provisions appear fully addressed', () => {
  const weekly = unit('Document the scheduled inspections.')
  const event = unit('Inspect after a qualifying rainfall event.')
  const result = {
    report: [],
    references: [reference(weekly, '1'), reference(event, '2')],
    documents: [{ id: 'guide', label: 'Construction guide' }],
  }
  const output = attachReviewCoverage(
    result,
    [{ heading: 'Inspections' }],
    {
      groups: [{ id: 'check', heading: 'Inspections', units: [weekly, event] }],
    },
    {
      sections: [
        {
          claims: [
            {
              check: 'check',
              text: 'Document the scheduled inspections.',
              evidence: [proof(weekly)],
            },
          ],
        },
        {
          heading: 'Sources',
          claims: [{ check: 'check', evidence: [proof(event)] }],
        },
      ],
    },
  )
  const check = output.review.checks[0]
  assert.equal(check.status, 'partial_findings')
  assert.equal(check.evidenceCoverage.selectedSourceCount, 2)
  assert.equal(check.evidenceCoverage.citedSourceCount, 1)
  assert.equal(check.evidenceCoverage.sourceOnlyCount, 1)
  assert.deepEqual(check.evidenceCoverage.provisions[1].referenceIds, ['2'])
  const pending = output.report.find(
    (section) =>
      section.heading === 'Selected evidence awaiting interpretation',
  )
  assert.deepEqual(
    pending.sentences
      .filter((sentence) => sentence.refs)
      .map((sentence) => sentence.refs),
    [['2']],
  )
  assert.match(
    pending.sentences[0].text,
    /does not establish missing project work or noncompliance/,
  )
  assert.equal(output.references, result.references)
  assert.deepEqual(result.report, [])
})

test('citation use stays distinct from approval or complete interpretation of a quoted paragraph', () => {
  const source = unit('Protect the facility. Keep required records.')
  const output = attachReviewCoverage(
    { report: [], references: [reference(source, '1')] },
    [],
    { groups: [{ id: 'check', heading: 'Construction', units: [source] }] },
    {
      sections: [
        {
          claims: [
            {
              check: 'check',
              text: 'Protect the facility.',
              evidence: [proof(source)],
            },
          ],
        },
      ],
    },
  )
  assert.equal(output.review.checks[0].status, 'findings_available')
  assert.equal(
    output.review.checks[0].evidenceCoverage.provisions[0].status,
    'cited_in_finding',
  )
  assert.equal(output.review.requiresEngineeringReview, true)
  assert.equal(
    output.report.some(
      (section) =>
        section.heading === 'Selected evidence awaiting interpretation',
    ),
    false,
  )
  assert.match(
    output.report[0].sentences[0].text,
    /selected source provisions cited in findings/,
  )
})

test('withheld provisions are counted without exposing an uncited quotation', () => {
  const source = unit('Unreported clause with no public citation.')
  const output = attachReviewCoverage(
    { report: [], references: [] },
    [],
    { groups: [{ id: 'check', heading: 'Testing', units: [source] }] },
    { sections: [] },
  )
  const check = output.review.checks[0]
  assert.equal(check.status, 'unresolved')
  assert.equal(check.evidenceCoverage.unreportedSourceCount, 1)
  assert.deepEqual(check.evidenceCoverage.provisions[0].referenceIds, [])
  assert.doesNotMatch(
    JSON.stringify(output),
    /Unreported clause with no public citation/,
  )
})

test('a source used in a shared check does not create a duplicate review backlog', () => {
  const source = unit('The shared criterion is stated here.')
  const output = attachReviewCoverage(
    { report: [], references: [reference(source, '1')] },
    [{ heading: 'Original topic' }, { heading: 'Comparison' }],
    {
      groups: [{ id: 'compare', heading: 'Comparison', units: [source] }],
      sharedEvidence: { 'Original topic': ['compare'] },
    },
    {
      sections: [
        {
          claims: [
            {
              check: 'compare',
              text: 'A supported comparison.',
              evidence: [proof(source)],
            },
          ],
        },
        {
          heading: 'Sources',
          claims: [{ check: 'compare', evidence: [proof(source)] }],
        },
      ],
    },
  )
  assert.equal(output.review.checks[0].evidenceCoverage.citedSourceCount, 1)
  assert.deepEqual(
    output.review.checks[0].evidenceCoverage.provisions[0].findingChecks,
    ['compare'],
  )
  assert.equal(
    output.report.some(
      (section) =>
        section.heading === 'Selected evidence awaiting interpretation',
    ),
    false,
  )
})

for (const occurrence of [false, true]) test(`repeated text on another ${occurrence ? 'occurrence' : 'page'} cannot credit the wrong source anchor`, () => {
  const first = unit('The same text appears on multiple pages.', 1),
    second = unit('The same text appears on multiple pages.', 2)
  if (occurrence) {
    second.passage.page = first.passage.page
    first.quoteStart = 10
    second.quoteStart = 100
  }
  const output = attachReviewCoverage(
    { report: [], references: [reference(first, '1'), reference(second, '2')] },
    [],
    { groups: [{ id: 'check', heading: 'Checks', units: [first, second] }] },
    {
      sections: [
        {
          claims: [
            {
              check: 'check',
              text: 'A finding cites page two.',
              evidence: [proof(second)],
            },
          ],
        },
      ],
    },
  )
  assert.deepEqual(
    output.review.checks[0].evidenceCoverage.provisions.map(
      (source) => source.status,
    ),
    ['source_evidence_only', 'cited_in_finding'],
  )
  const pending = output.report.find(
    (section) =>
      section.heading === 'Selected evidence awaiting interpretation',
  )
  assert.deepEqual(
    pending.sentences
      .filter((sentence) => sentence.refs)
      .map((sentence) => sentence.refs),
    [['1']],
  )
})

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  scopedRepair,
  mergeApprovedSynthesis,
  repairFeedback,
} from '../src/synthesis-repair.mjs'

test('bounded repair feedback prioritizes rejected drafts over source-only diagnostics',()=>{
 const cached=[{text:'The rejected draft.'}]
 const source=Array.from({length:10},(_,i)=>({claim:`Source clause ${i}`,reason:'Source context needs qualification.'}))
 const rejected={claim:'The rejected draft.',reason:'The draft has the wrong scope.'}
 const feedback=repairFeedback(cached,[...source,rejected,rejected])
 assert.equal(feedback.length,8)
 assert.equal(feedback[0],rejected)
 assert.equal(feedback.filter(issue=>issue.claim===rejected.claim).length,1)
})

test('repair instructions stay with their own check and preserve unrelated cached findings', () => {
  const cached = [
    { check: 'construction', text: 'Inspect ESC weekly.', evidence: ['A'] },
  ]
  const issues = [
    {
      check: 'servicing',
      claim: 'A service is not required.',
      reason: 'The source requires it.',
    },
  ]
  assert.deepEqual(scopedRepair(cached, issues, 'construction'), {
    issues: [],
    retained: cached,
  })
  const failed = scopedRepair(
    cached,
    [
      {
        check: 'construction',
        claim: 'Inspect ESC weekly.',
        reason: 'Wrong scope.',
      },
    ],
    'construction',
  )
  assert.equal(failed.retained.length, 0)
})

test('a repair preserves previously approved conclusions when other findings fail another audit', () => {
  const approved = {
    check: 'construction',
    text: 'Inspect ESC weekly.',
    evidence: [{ excerpt: 'Original weekly inspection rule.' }],
  }
  const corrected = {
    check: 'servicing',
    text: 'Confirm the separate service obligation.',
    evidence: [{ excerpt: 'Original service requirement.' }],
  }
  const previous = {
    sections: [{ heading: '', claims: [approved] }],
    issues: [],
    rejected: 0,
  }
  const repaired = {
    sections: [{ heading: '', claims: [corrected] }],
    issues: [{ claim: approved.text, reason: 'Later inconsistent verdict.' }],
    rejected: 1,
  }
  const merged = mergeApprovedSynthesis(previous, repaired)
  assert.deepEqual(merged.sections[0].claims, [approved, corrected])
  assert.equal(merged.sections[0].claims[0].evidence, approved.evidence)
  assert.deepEqual(merged.issues, [])
  assert.deepEqual(previous.sections[0].claims, [approved])
})

test('merging repair results cannot duplicate findings or exceed the per-check budget', () => {
  const a = { check: 'a', text: 'First fact.', evidence: [] },
    b = { check: 'a', text: 'Second fact.', evidence: [] }
  const merged = mergeApprovedSynthesis(
    { sections: [{ claims: [a, b] }], issues: [] },
    {
      sections: [
        { claims: [a, { check: 'a', text: 'Third fact.', evidence: [] }] },
      ],
      issues: [],
      rejected: 0,
    },
  )
  assert.deepEqual(merged.sections[0].claims, [a, b])
})

test('complex reviews can retain a larger explicitly bounded set of atomic findings', () => {
  const claims = Array.from({length: 7}, (_, i) => ({check:'sizing',text:`Supported sizing fact ${i}.`,evidence:[]}))
  const merged = mergeApprovedSynthesis({sections:[{claims:claims.slice(0,3)}],issues:[]},{sections:[{claims}],issues:[],rejected:0},6)
  assert.equal(merged.sections[0].claims.length,6)
  assert.equal(new Set(merged.sections[0].claims.map(c=>c.text)).size,6)
})

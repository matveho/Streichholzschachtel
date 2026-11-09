import test from 'node:test'
import assert from 'node:assert/strict'
import {
  batchEvidenceChecks,
  uniqueReviewVerdicts,
  evidenceReviewSchema,
  evidenceReviewCheck,
} from '../src/answer.mjs'

test('a focused service review receives only service inputs and explicit unresolved conditions',()=>{
 const question='Review a 450 mm storm main with 1.7 m cover and a storm service with 2.0 m cover.'
 const quote='A minimum cover to pipe obvert of 2.0 m is required for storm sewers smaller than 600 mm diameter.'
 const passage={id:'p',doc:'guide',page:1,section:'Storm cover',text:quote,lines:[{text:quote,rect:[10,10,500,25]}]}
 const check=evidenceReviewCheck({text:'A quoted service cover rule.',assetScope:{role:'service',system:'storm'},evidence:[{passage,excerpt:quote}]},0,question)
 assert.equal(check.suppliedMeasurements.length,1)
 assert.equal(check.suppliedMeasurements[0].role,'service')
 assert.equal(check.suppliedMeasurements[0].datum,'not-stated')
 assert.ok(!check.suppliedMeasurements.some(record=>record.property==='diameter'))
 assert.ok(check.unresolvedConditions.length)
})

test('review preserves the source identity of a rule and a different publication\'s conditional alternative',()=>{
 const text='Storm services require at least 2.4 m cover at the property line.'
 const other='When this depth is not practical, provide a minimum cover of 2.0 m to pipe obvert for the storm service.'
 const passage=(id,doc,text)=>({id,doc,page:1,section:'Storm service depth',text,lines:[{text,rect:[10,10,500,20]}]})
 const rule=passage('p1','connection-guide',text), alternative=passage('p2','design-guide',other)
 const claim={text:'The Connection Guide requires 2.4 m cover for storm services.',evidence:[{passage:rule,excerpt:text,quoteStart:0}]}
 const check=evidenceReviewCheck(claim,0,'Review the storm service cover.',[alternative])
 assert.deepEqual(check.quotes,[text])
 assert.equal(check.quoteSources[0].document,'connection-guide')
 const index=check.relatedProvisions.findIndex(quote=>quote.includes('not practical'))
 assert.ok(index>=0)
 assert.equal(check.relatedSources.find(source=>source.provisionIndex===index).document,'design-guide')
 assert.equal(check.relatedSources.find(source=>source.provisionIndex===index).page,1)
 assert.equal(check.quoteSources[0].quoteIndex,0)
})

test('the review contract requires one verdict for every actual batch ID', () => {
  const schema = evidenceReviewSchema([4, 7])
  const verdicts = schema.properties.verdicts
  assert.equal(verdicts.type, 'object')
  assert.deepEqual(verdicts.required, ['4', '7'])
  assert.deepEqual(Object.keys(verdicts.properties), ['4', '7'])
  assert.equal(verdicts.additionalProperties, false)
  for (const item of Object.values(verdicts.properties)) {
    assert.deepEqual(item.required, ['reason', 'supported', 'relevant'])
    assert.equal(item.additionalProperties, false)
  }
})

test('conflicting duplicate or incomplete verdicts cannot approve a finding', () => {
  const verdicts = [
    { id: 0, supported: true, relevant: true, reason: 'Supported.' },
    { id: 0, supported: false, relevant: true, reason: 'Contradicted.' },
    {
      id: 1,
      supported: true,
      relevant: true,
      reason: 'The quote states this rule.',
    },
    { id: 2, supported: true, reason: 'Missing relevance verdict.' },
    { id: 999, supported: true, relevant: true, reason: 'Unknown finding.' },
  ]
  assert.deepEqual(
    [...uniqueReviewVerdicts(verdicts, new Set([0, 1, 2, 3])).keys()],
    [1],
  )
})

test('review batching preserves every complete check and its original ID within the context budget', () => {
  const checks = Array.from({ length: 9 }, (_, i) => ({
    id: i,
    claim: `Finding ${i}.`,
    quotes: ['a'.repeat(3900)],
    relatedProvisions: ['An exception.'],
  }))
  const batches = batchEvidenceChecks(checks)
  assert.deepEqual(batches.flat(), checks)
  assert.ok(batches.length > 1)
  for (const batch of batches) {
    assert.ok(batch.length <= 4)
    assert.ok(
      batch.reduce((n, check) => n + JSON.stringify(check).length, 0) <= 12000,
    )
  }
  assert.deepEqual(batchEvidenceChecks([]), [])
  assert.ok(batchEvidenceChecks(checks,12000,1).every(batch=>batch.length===1))
  assert.throws(
    () => batchEvidenceChecks([{ id: 0, quotes: ['x'.repeat(12001)] }]),
    /exceeds.*context budget/,
  )
})

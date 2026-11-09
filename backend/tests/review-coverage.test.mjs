import test from 'node:test'
import assert from 'node:assert/strict'
import {attachReviewCoverage} from '../src/review-coverage.mjs'

test('review coverage preserves requested checks without claiming full compliance',()=>{
 const result={report:[],references:[]}
 const topics=[{heading:'Sizing'},{heading:'Construction'},{heading:'Testing'}]
 const plan={groups:[{id:'check-0',heading:'Sizing'},{id:'check-1',heading:'Construction'}],unresolved:['Testing']}
 const checked={sections:[{claims:[{check:'check-0',text:'A supported finding.'}]},{heading:'Construction',claims:[{check:'check-1',text:'A quoted provision.'}]}]}
 const output=attachReviewCoverage(result,topics,plan,checked)
 assert.deepEqual(output.review.checks.map(c=>c.status),['findings_available','evidence_only','unresolved'])
 assert.equal(output.review.requiresEngineeringReview,true)
 assert.deepEqual(output.review.limitations,['Testing'])
 assert.equal(output.report[0].sentences.length,3)
 assert.equal(result.report.length,0)
 assert.equal(output.references,result.references)
})

test('an explicit derived comparison check remains visible alongside source topics',()=>{
 const result=attachReviewCoverage({report:[]},[{heading:'Reference requirements'}],{groups:[
  {id:'source',heading:'Reference requirements'},
  {id:'compare',heading:'Project-to-reference comparison',role:'comparison'},
 ],unresolved:[]},{sections:[{claims:[{check:'compare',text:'A supported comparison.'}]}]})
 assert.equal(result.review.checks.find(check=>check.id==='compare').status,'findings_available')
 assert.ok(result.report.some(block=>block.sentences.some(sentence=>sentence.text.includes('Project-to-reference comparison'))))
})

test('source units shared between topics do not become missing-evidence warnings',()=>{
 const result=attachReviewCoverage({report:[]},[{heading:'Proposed width'}],{
  groups:[{id:'criteria',heading:'Width criteria'}],sharedEvidence:{'Proposed width':['criteria']},unresolved:[],
 },{sections:[{heading:'Sources',claims:[{check:'criteria'}]}]})
 assert.equal(result.review.checks[0].status,'evidence_only')
 assert.deepEqual(result.review.checks[0].sharedWith,['Width criteria'])
 assert.match(result.report[0].sentences[0].text,/Source evidence shared with Width criteria/)
})

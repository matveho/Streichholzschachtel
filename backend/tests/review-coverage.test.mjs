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

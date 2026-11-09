import test from 'node:test'
import assert from 'node:assert/strict'
import {capacityReviewInputs} from '../src/capacity-review-inputs.mjs'
import {demoReviews,findDemoReview} from '../demo/review-scenarios.mjs'

const example=demoReviews[0]
const docs=example.documentIds.map(id=>({id}))
test('capacity worksheets accept editable numeric inputs and explicit flow units',()=>{
 const inputs=capacityReviewInputs(example.question.replace('42 ha','55 ha').replace('1.20 m³/s','1600 L/s').replace('0.90 m³/s','1.4 m^3/s'))
 assert.deepEqual(inputs,{previousArea:28,area:55,runoff:1600,runoffLiteral:'1600',runoffUnit:'L/s',capacity:1.4,capacityLiteral:'1.4',capacityUnit:'m3/s'})
 assert.ok(findDemoReview(example.question.replace('1.20','1.60'),docs))
 assert.equal(findDemoReview(example.question,docs.slice(0,1)),undefined)
 assert.ok(capacityReviewInputs(example.question.toUpperCase().replace('1.20',' .80 ').replace('  ',' ')))
})
test('a worksheet template never absorbs changed engineering conditions or extra requests',()=>{
 for(const question of [
  example.question.replace('five-year','ten-year'),
  example.question.replace('runoff estimate is','runoff estimate is not'),
  example.question.replace('sewer design','sanitary sewer design'),
  example.question.replace('42 ha','20 ha'),
  example.question.replace('28 ha','0 ha'),
  example.question.replace('0.90','-0.90'),
  example.question.replace('1.20','0'),
  example.question.replace('m³/s','mm/h'),
  example.question+' Also confirm this is approved.',
  'If '+example.question,
 ]) {
  assert.equal(capacityReviewInputs(question),null,question)
  assert.equal(findDemoReview(question,docs),undefined,question)
 }
})

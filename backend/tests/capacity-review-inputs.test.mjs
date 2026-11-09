import test from 'node:test'
import assert from 'node:assert/strict'
import {capacityReviewInputs,capacityReviewRequest} from '../src/capacity-review-inputs.mjs'
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

const natural='Review storm sewer capacity and detention pond sizing for a 55 ha catchment. Five-year runoff: 1600 L/s. Existing sewer capacity: 900 L/s. Is the Rational Method suitable?'
test('engineering roles bind paraphrased area and flows independently of sentence order',()=>{
 const inputs=capacityReviewInputs(natural)
 assert.equal(inputs.area,55);assert.equal(inputs.previousArea,undefined)
 assert.equal(inputs.runoff,1600);assert.equal(inputs.capacity,900)
 const reordered='Existing sewer capacity: 900 L/s. Check detention pond sizing and storm sewer capacity. Catchment area: 55 ha. Is the Rational Method suitable? 5-year runoff estimate = 1.6 m3/s.'
 assert.equal(capacityReviewInputs(reordered).runoff,1.6)
 assert.ok(findDemoReview(reordered,docs))
})
test('missing or conflicting quantities identify specific engineering inputs without inventing values',()=>{
 const missing=capacityReviewRequest(natural.replace('Five-year runoff: 1600 L/s. ',''))
 assert.equal(missing.matched,true)
 assert.equal(missing.inputs,null)
 assert.deepEqual(missing.fields.map(field=>field.key),['fiveYearRunoff'])
 const conflict=capacityReviewRequest(natural+' Existing sewer capacity: 1200 L/s.')
 assert.equal(conflict.inputs,null)
 assert.deepEqual(conflict.fields.map(field=>field.key),['existingSewerCapacity'])
 assert.equal(capacityReviewRequest(natural+' Five-year runoff: 1.6 m3/s.').fields.length,0)
 assert.equal(capacityReviewRequest(natural.replace('55 ha catchment','55 ha catchment. Catchment area: 42 ha')).inputs,null)
 assert.equal(capacityReviewRequest(natural.replace('Five-year','Ten-year')).inputs,null)
 const conflictingExpansion=capacityReviewRequest(example.question+' Catchment area: 55 ha.')
 assert.equal(conflictingExpansion.inputs,null)
 assert.ok(conflictingExpansion.fields.some(field=>field.key==='catchmentArea'))
})
test('unsupported conditions and approval requests do not become completed natural-language worksheets',()=>{
 for(const question of [natural+' Also approve the design.',natural.replace('storm sewer','sanitary sewer'), 'If '+natural,natural.replace('capacity: 900','capacity is not 900')])assert.equal(capacityReviewRequest(question).matched,false)
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

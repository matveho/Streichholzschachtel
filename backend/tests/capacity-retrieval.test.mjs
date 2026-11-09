import test from 'node:test'
import assert from 'node:assert/strict'
import {capacityRequirementSearch,capacityFocusedSearches} from '../src/retrieval-plan.mjs'

const question='A subdivision has expanded from 28 ha to 42 ha. The revised five-year runoff estimate is 1.20 m³/s, but the existing sewer design carries 0.90 m³/s. Can we retain it and size the new detention pond with the Rational Method?'

test('capacity comparisons recover a design-flow search without importing project figures into retrieval keywords',()=>{
 const search=capacityRequirementSearch(question)
 assert.match(search,/storm sewer capacity/)
 assert.doesNotMatch(search,/42|28|1\.20|0\.90|1\.25|30|Table/)
 assert.ok(capacityRequirementSearch('For a 50 ha drainage catchment, compare existing storm sewer capacity of 900 L/s with five-year runoff of 1.20 m3/s.'))
 assert.equal(capacityRequirementSearch('Can the Rational Method size a detention pond serving a 40 ha catchment?'),null)
 assert.equal(capacityRequirementSearch('Compare 900 L/s sewer capacity against 1.20 m3/s runoff; catchment area is unknown.'),null)
 assert.equal(capacityRequirementSearch('A 50 ha development has a sanitary sewer capacity of 900 L/s and demand of 1.20 m3/s. Is it adequate?'),null)
})

test('sewer capacity refinement preserves separate storage-method and pond-sizing checks',()=>{
 const methods={heading:'Detention pond methods',query:'Rational Method minor storm sewer and detention pond sizing',sections:['s1']}
 const capacity={heading:'Existing sewer capacity',query:'existing sewer retention upgrade',sections:['s2']}
 const sizing={heading:'Storage facility sizing',query:'pond storage volume and drawdown requirements',sections:['s3']}
 const revised=capacityFocusedSearches(question,[methods,capacity,sizing])
 assert.equal(revised[0],methods)
 assert.equal(revised[2],sizing)
 assert.equal(revised[1].heading,capacity.heading)
 assert.deepEqual(revised[1].sections,capacity.sections)
 assert.equal(revised[1].query,capacityRequirementSearch(question))
 assert.equal(capacityFocusedSearches(question,[]).length,1)
 const full=Array.from({length:5},(_,i)=>({heading:'Pond check '+i,query:'pond storage sizing'}))
 assert.deepEqual(capacityFocusedSearches(question,full),full,'A supplementary check cannot discard existing requested tasks')
})

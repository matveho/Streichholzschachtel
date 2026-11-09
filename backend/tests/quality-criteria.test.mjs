import test from 'node:test'
import assert from 'node:assert/strict'
import {missingFindingTerms} from './quality-criteria.mjs'
import {engineeringScenarios} from './engineering-scenarios.mjs'
const report=(...text)=>[{sentences:text.map(text=>({text}))}]
test('unrelated sentences cannot fabricate a required compound finding',()=>{
 const term=/private.*storm/i
 assert.equal(missingFindingTerms(report('Private water systems cannot cross titles.','Storm services need suitable slopes.'),[term]).length,1)
 assert.deepEqual(missingFindingTerms(report('Private storm sewer systems are required.'),[term]),[])
})
test('source quotations do not substitute for interpreted findings',()=>{
 const term=/QA\/QC/i
 assert.equal(missingFindingTerms([{heading:'Sources',sentences:[{text:'A QA/QC test is required.'}]}],[term]).length,1)
})
test('naming EPCOR or a separate service is not a servicing clarification',()=>{
 const terms=engineeringScenarios.find(scenario=>scenario.id==='infill-servicing').findingTerms
 const factual=report('Private storm sewer systems are required.','One storm service per unit connects directly to EPCOR sewer mains.')
 assert.equal(missingFindingTerms(factual,terms).length,1)
 const clarified=report('Private storm sewer systems are required.','Confirm how the proposed alternative addresses the private storm servicing obligation.')
 assert.deepEqual(missingFindingTerms(clarified,terms),[])
})

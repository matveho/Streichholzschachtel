import test from 'node:test'
import assert from 'node:assert/strict'
import { verifiedArithmeticSection, renderResult } from '../src/answer.mjs'
import { verifyCalculations } from '../src/calculations.mjs'
const quote='Storm sewers servicing areas greater than 30 ha use 1.25 times the five-year runoff.'
const passage={id:'p1',doc:'manual',page:10,section:'Storm sewer capacity',text:quote,lines:[{text:quote,rect:[10,10,500,25]}]}
const question='Runoff is 1.20 m3/s and existing capacity is 0.90 m3/s. Calculate the capacity difference.'
const calculations=verifyCalculations([{expression:'1.20 * 1.25',unit:'m3/s'},{expression:'r1 - 0.90',unit:'m3/s'}],quote,question).calculations
const raw={sections:[{claims:[{text:'An unsupported engineering approval is granted.',calculations,evidence:[{passageId:'p1',quote}]}]}],plan:{groups:[],calculations:[]}}

test('the arithmetic worksheet keeps checked equations and citations without copying unsupported model judgments',()=>{
 const section=verifiedArithmeticSection(question,raw,[passage])
 assert.equal(section.arithmetic,true)
 const result=renderResult([section],{documents:[{id:'manual',label:'Guideline'}]},'http://localhost','test','source_evidence')
 assert.equal(result.arithmeticReview.status,'arithmetic_only')
 assert.equal(result.arithmeticReview.applicabilityConfirmed,false)
 assert.deepEqual(result.arithmeticReview.calculations.map(step=>step.value),[1.5,0.6])
 assert.ok(!JSON.stringify(result).includes('approval is granted'))
 for(const step of result.arithmeticReview.calculations) {
  assert.ok(step.sourceReferenceIds.length)
  assert.ok(step.sourceReferenceIds.every(id=>result.references.some(reference=>reference.id===id&&reference.regions.length)))
 }
})

test('unknown capacity withholds flow differences while retaining the independently checked criterion',()=>{
 const section=verifiedArithmeticSection(question,raw,[passage],{withholdFlowDifference:true})
 assert.deepEqual(section.claims.flatMap(claim=>claim.calculations).map(step=>step.value),[1.5])
})

test('invalid quotes and fabricated calculation results never enter the worksheet',()=>{
 const forged={...raw,sections:[{claims:[{...raw.sections[0].claims[0],calculations:[{expression:'1.20 * 1.25',unit:'m3/s',value:9}]}]}]}
 assert.equal(verifiedArithmeticSection(question,forged,[passage]),null)
 const foreign={...raw,sections:[{claims:[{...raw.sections[0].claims[0],evidence:[{passageId:'foreign',quote}]}]}]}
 assert.equal(verifiedArithmeticSection(question,foreign,[passage]),null)
 assert.equal(verifiedArithmeticSection('What is the minimum cover?',raw,[passage]),null)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { falseComparisons } from '../src/applicability.mjs'
import { completeComparisonCalculations, draftLocal, projectDescription, verifyCalculationPlan } from '../src/local-synthesis.mjs'
import { verifyCalculations } from '../src/calculations.mjs'
import { renderResult, validateSynthesis } from '../src/answer.mjs'
import { config } from '../src/config.mjs'

test('flow comparisons cannot assert the observed reversed capacity relationship', () => {
 const observed='The existing sewer design capacity of 0.90 m3/s is insufficient for the revised five-year runoff estimate of 1.20 m3/s, which exceeds the required minimum capacity of 1.50 m3/s.'
 assert.equal(falseComparisons(observed).length,1)
 assert.equal(falseComparisons('The 1.20 m³/s runoff exceeds 1.50 m³/s.').length,1)
 assert.deepEqual(falseComparisons('The 1.50 m³/s criterion exceeds the existing capacity of 0.90 m³/s.'),[])
})
test('compatible flow units convert without treating flow as volume', () => {
 assert.equal(falseComparisons('The 1200 L/s runoff exceeds 1.50 m3/s.').length,1)
 assert.deepEqual(falseComparisons('The 1200 L/s runoff is below 1.50 m3/s.'),[])
 assert.equal(falseComparisons('The 1.20 m3/s runoff is below 900 L/s.').length,1)
 assert.deepEqual(falseComparisons('The storage volume of 1200 m3 exceeds the flow of 1.50 m3/s.'),[])
})
test('unrelated clauses cannot donate a number to a different comparison', () => {
 assert.deepEqual(falseComparisons('The runoff is 1.20 m3/s, and the capacity criterion exceeds 1.50 m3/s.'),[])
 assert.deepEqual(falseComparisons('The 1.20 m3/s runoff does not exceed the criterion of 1.50 m3/s.'),[])
})

test('explicit comparison differences require correct arithmetic and compatible units', () => {
 assert.equal(falseComparisons('The 1.50 m3/s criterion exceeds 0.90 m3/s by 0.80 m3/s.').length,1)
 assert.equal(falseComparisons('The 1.50 m3/s criterion exceeds 0.90 m3/s by 600 mm.').length,1)
 assert.equal(falseComparisons('The 1.50 m3/s criterion exceeds 0.90 m3/s by 0.60 L/s.').length,1)
 assert.deepEqual(falseComparisons('The 1.50 m3/s criterion exceeds 900 L/s by 600 L/s.'),[])
 assert.deepEqual(falseComparisons('A 75% proportion exceeds 50% by 50%.'),[],'An ambiguous relative percentage is not assumed to mean percentage points')
})

test('a stated offset before less-than remains a difference rather than an operand',()=>{
 const text='The proposed cover of 1.650 m for storm sewer ST1 is 0.35 m less than the required minimum of 2.0 m for pipes smaller than 600 mm diameter.'
 assert.deepEqual(falseComparisons(text),[])
 const calculations=completeComparisonCalculations(text,[],'The reference minimum cover is 2.0 m.','The supplied cover is 1.650 m.')
 assert.equal(calculations.length,1)
 assert.equal(calculations[0].value,.35)
 assert.equal(calculations[0].displayExpression,'(2.0 m - 1.650 m)')
 assert.equal(falseComparisons(text.replace('0.35 m','0.45 m')).length,1)
 assert.equal(falseComparisons('The 900 L/s capacity is 600 L/s less than the cited 1.50 m3/s criterion.').length,0)
 assert.equal(falseComparisons('The 900 L/s capacity is 600 mm less than the cited 1.50 m3/s criterion.').length,1)
 assert.deepEqual(falseComparisons('The cover is 1.65 m, and the offset is 0.35 m less than the minimum 2.0 m.'),[])
})

test('an explicit comparison gets a grounded difference even when the draft omits the gap',()=>{
 const sources='The cited criterion is 1.50 m3/s.'
 const question='The existing capacity is 0.90 m3/s.'
 const result=completeComparisonCalculations('The existing capacity of 0.90 m3/s fails to meet the required minimum capacity of 1.50 m3/s.',[],sources,question)
 assert.equal(result.length,1)
 assert.equal(result[0].value,0.6)
 assert.equal(result[0].displayExpression,'(1.50 m3/s - 0.90 m3/s)')
 const repaired=completeComparisonCalculations('The existing capacity of 0.90 m3/s is insufficient to meet the recommended minimum capacity requirement of 1.50 m3/s.',[],sources,question)
 assert.equal(repaired[0].value,0.6)
 assert.deepEqual(falseComparisons('A capacity of 1.50 m3/s fails to meet the required minimum capacity of 0.90 m3/s.').length,1)
})

test('a stated capacity gap is verified even when the draft only requested the scaled-flow step', () => {
 const sources='Storm sewers servicing areas greater than 30 ha require 1.25 times the 1:5 year runoff.'
 const question='The runoff is 1.20 m3/s and existing capacity is 0.90 m3/s.'
 const previous=verifyCalculations([{expression:'1.20 * 1.25',unit:'m3/s'}],sources,question).calculations
 const complete=completeComparisonCalculations('The calculated 1.50 m3/s criterion exceeds existing capacity of 0.90 m3/s by 0.60 m3/s.',previous,sources,question)
 assert.deepEqual(complete.map(step=>step.value),[1.5,0.6])
 assert.equal(completeComparisonCalculations('The 1.50 m3/s criterion exceeds 0.90 m3/s by 0.80 m3/s.',previous,sources,question).length,1)
 assert.deepEqual(completeComparisonCalculations('The invented 9.50 m3/s criterion exceeds 0.90 m3/s by 8.60 m3/s.',[],sources,question),[])
 assert.deepEqual(completeComparisonCalculations('The 1.50 m3/s criterion exceeds 0.90 m3/s by 0.60 m3/s.',[],sources,question),[],'A missing derivation cannot supply a new operand')
})

test('a checked compound capacity calculation supports its actual intermediate criterion without inventing arithmetic',()=>{
 const sources='Storm sewers servicing areas greater than 30 ha use 1.25 times the five-year runoff.'
 const question='The revised runoff is 1.20 m3/s and existing capacity is 0.90 m3/s.'
 const root=verifyCalculations([{expression:'1.20 * 1.25 - 0.90',unit:'m3/s'}],sources,question).calculations
 assert.deepEqual(root.map(step=>step.value),[.6])
 const text='The existing capacity of 0.90 m3/s is below the calculated flow criterion of 1.50 m3/s by 0.60 m3/s.'
 const completed=completeComparisonCalculations(text,root,sources,question)
 assert.deepEqual(completed.map(step=>step.value),[.6,1.5])
 assert.equal(completed[1].displayExpression,'(1.20 m3/s * 1.25)')
 assert.ok(completed[1].inputOrigins.includes('source'))
 assert.deepEqual(completeComparisonCalculations(text.replace('1.50','1.80'),root,sources,question).map(step=>step.value),[.6])
 assert.deepEqual(completeComparisonCalculations(text,[],sources,question),[],'A missing proposed expression cannot authorize the implied calculation')
})

test('verified mixed-unit gaps preserve the units of both operands',()=>{
 const result=completeComparisonCalculations('The 1.50 m3/s flow exceeds 900 L/s by 600 L/s.',[],'The reference flow is 1.50 m3/s.','The existing capacity is 900 L/s.')
 assert.equal(result.length,1)
 assert.equal(result[0].value,600)
 assert.equal(result[0].unit,'L/s')
 assert.equal(result[0].displayExpression,'(1.50 m3/s - 900 L/s)')
 const rendered=renderResult([{claims:[{text:'A verified difference.',evidence:[],calculations:result}]}],{documents:[]},'http://localhost','test','local_synthesis')
 assert.match(rendered.report[0].sentences[1].text,/1\.50 m³\/s.*900 L\/s.*600 L\/s/)
})

test('a mixed-unit comparison normalizes a known capacity before deriving its gap',()=>{
 const sources='The cited capacity criterion is 1.50 m3/s.'
 const question='The supplied existing capacity is 900 L/s.'
 const result=completeComparisonCalculations('The existing 900 L/s capacity (0.90 m3/s) is below the cited criterion of 1.50 m3/s.',[],sources,question)
 assert.deepEqual(result.map(step=>step.value),[0.9,0.6])
 assert.deepEqual(result.map(step=>step.operation),['literal','-'])
 assert.equal(result[0].displayExpression,'900 L/s')
 assert.deepEqual(completeComparisonCalculations('The existing 900 L/s capacity is below the cited criterion of 1.80 m3/s.',[],sources,question),[],'Unit conversion cannot fabricate a new criterion')
})

test('local drafting attaches the omitted difference step before numerical validation',async(t)=>{
 const previous={...config};t.after(()=>Object.assign(config,previous))
 Object.assign(config,{provider:'ollama',localSynthesisPolicy:'all',localReasoning:false})
 const excerpt='Storm sewers servicing areas greater than 30 ha require 1.25 times the five-year runoff.'
 const question='The runoff is 1.20 m3/s and existing capacity is 0.90 m3/s.'
 const calculated=verifyCalculations([{expression:'1.20 * 1.25',unit:'m3/s'}],excerpt,question).calculations
 const text='The calculated 1.50 m3/s criterion exceeds the existing capacity of 0.90 m3/s by 0.60 m3/s.'
 t.mock.method(globalThis,'fetch',async(_url,options)=>{
  const format=JSON.parse(options.body).format
  assert.deepEqual(format.properties.findings.items.properties.calculations.items.enum,['c1'],'Unverified calculation IDs are not offered by the response schema')
  return new Response(JSON.stringify({message:{content:JSON.stringify({findings:[{text,evidence:['A'],calculations:['c1']}]})},done_reason:'stop'}))
 })
 const unit={passage:{id:'p1',doc:'manual',page:10},heading:'Storm sewer capacity',excerpt}
 const draft=await draftLocal(question,[],{corpus:{documents:[{id:'manual'}]}},new AbortController().signal,[],{groups:[{id:'capacity',heading:'Capacity',units:[unit]}],calculations:calculated,unresolved:[],originalSystemKeys:[]})
 assert.deepEqual(draft.sections[0].claims[0].calculations.map(step=>step.value),[1.5,0.6])
})

test('source-derived arithmetic distinguishes supplied facts from unsupported source claims',()=>{
 const quote='1.25 times the runoff due to a 1:5 year rainfall Storm sewers servicing areas greater than 30 ha'
 const passage={id:'p1',doc:'manual',page:10,section:'Storm sewers · Table 2.1: Capacity requirements',text:quote,lines:[{text:quote,rect:[10,10,500,25]}]}
 const question='A subdivision has expanded from 28 ha to 42 ha using Table 2.1 as the stated calculation basis. Revised runoff is 1.20 m3/s and existing capacity is 0.90 m3/s. What is the permeability of the copper liner?'
 const calculations=verifyCalculations([{expression:'1.20 * 1.25',unit:'m3/s'},{expression:'r1 - 0.90',unit:'m3/s'}],quote,question).calculations
 assert.ok(calculations.every(step=>step.inputOrigins.includes('source')&&step.inputOrigins.includes('question')))
 const text='For the expanded 42 ha subdivision, the existing sewer design capacity of 0.90 m3/s is below the cited capacity criterion of 1.50 m3/s by 0.60 m3/s.'
 const run=text=>validateSynthesis({sections:[{claims:[{text,calculations,evidence:[{passageId:'p1',quote}]}]}]},[passage],question)
 assert.equal(run(text).sections.length,1,JSON.stringify(run(text).issues))
 const derived='Applying the Table 2.1 basis to the assumed 1.20 m3/s five-year runoff yields a calculated design flow of 1.50 m3/s.'
 assert.equal(run(derived).sections.length,1,JSON.stringify(run(derived).issues))
 const unrelated=run(text.slice(0,-1)+'; the copper liner has low permeability.')
 assert.equal(unrelated.sections.length,0,'Verified comparison arithmetic cannot support a requested material property')
 const otherQuote='1.25 times the tree growth allowance for landscape vegetation and planting schedules.'
 const other={...passage,section:'Landscape vegetation coefficient',text:otherQuote,lines:[{text:otherQuote,rect:[10,10,500,25]}]}
 const otherCalculations=verifyCalculations([{expression:'1.20 * 1.25',unit:'m3/s'},{expression:'r1 - 0.90',unit:'m3/s'}],otherQuote,question).calculations
 const wrongDomain=validateSynthesis({sections:[{claims:[{text,calculations:otherCalculations,evidence:[{passageId:'p1',quote:otherQuote}]}]}]},[other],question)
 assert.equal(wrongDomain.sections.length,0,'A matching scalar in an unrelated source cannot establish a sewer criterion')
 assert.equal(projectDescription('The supplied runoff is 1.20 m3/s. Compare capacity and assess the copper liner.'),'The supplied runoff is 1.20 m3/s')
 assert.equal(projectDescription('For the expanded 42 ha subdivision, calculate the required flow.'),'For the expanded 42 ha subdivision')
})

test('calculation plans bind each source operand to declared evidence and preserve independent conversions',()=>{
 const question='Runoff is 1.20 m3/s and existing capacity is 900 L/s.'
 const byLabel=new Map([['A',{excerpt:'Use 1.25 times the five-year runoff.'}]])
 const plan=verifyCalculationPlan([
  {expression:'1.20 * 1.25',unit:'m3/s',evidence:['A']},
  {expression:'900',unit:'m3/s',evidence:[]},
  {expression:'r1 - r2',unit:'m3/s',evidence:[]},
 ],byLabel,question)
 assert.deepEqual(plan.calculations.map(step=>step.value),[1.5,0.9,0.6])
 assert.deepEqual(plan.evidence,[['A'],[],[]])
 assert.deepEqual(verifyCalculationPlan([{expression:'1.20 * 1.25',unit:'m3/s',evidence:[]}],byLabel,question).calculations,[])
 assert.deepEqual(verifyCalculationPlan([{expression:'1.20 * 1.25',unit:'m3/s',evidence:['foreign']}],byLabel,question).calculations,[])
})

test('calculation source dependencies cross checks only when the finding requests that calculation',async(t)=>{
 const saved={...config};t.after(()=>Object.assign(config,saved))
 Object.assign(config,{provider:'ollama',localSynthesisPolicy:'all',localReasoning:false})
 const question='Runoff is 1.20 m3/s and existing capacity is 900 L/s.'
 const unit=(id,excerpt)=>({passage:{id,doc:'manual',page:1},heading:'Storm sewer calculation',excerpt})
 const basis=unit('basis','Use 1.25 times the five-year runoff.')
 const capacity=unit('capacity','Record the calculation basis before final design.')
 const other=unit('other','Inspect the pipe before completing construction.')
 const calculated=verifyCalculations([{expression:'1.20 * 1.25',unit:'m3/s'}],basis.excerpt,question).calculations
 t.mock.method(globalThis,'fetch',async(_url,options)=>{
  const input=JSON.parse(JSON.parse(options.body).messages[1].content)
  const comparison=input.focusedCheck==='Capacity'
  const text=comparison?'The existing 900 L/s capacity (0.90 m3/s) is below the cited criterion of 1.50 m3/s by 0.60 m3/s.':'An unrelated asserted fact.'
  return new Response(JSON.stringify({message:{content:JSON.stringify({findings:[{text,evidence:[comparison?'B':'A'],calculations:comparison?['c1']:[]}]})},done_reason:'stop'}))
 })
 const result=await draftLocal(question,[],{corpus:{documents:[{id:'manual'}]}},new AbortController().signal,[],{groups:[{id:'basis',heading:'Basis',units:[basis]},{id:'capacity',heading:'Capacity',units:[capacity]},{id:'other',heading:'Other',units:[other]}],calculations:calculated,calculationEvidence:[['A']],unresolved:[],originalSystemKeys:[]})
 const findings=result.sections[0].claims
 assert.deepEqual(findings[1].calculations.map(step=>step.value),[1.5,0.9,0.6])
 assert.ok(findings[1].evidence.some(proof=>proof.passageId==='basis'))
 assert.deepEqual(findings[2].evidence,[],'A check without a calculation cannot borrow its basis')
})

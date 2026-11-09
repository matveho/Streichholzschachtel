import test from 'node:test'
import assert from 'node:assert/strict'
import {verifyCalculations,completeCalculationIntermediates} from '../src/calculations.mjs'

test('only genuine compound-expression intermediates can support additional typed results',()=>{
 const source='The criterion is 1.25 times the runoff.'
 const question='Runoff is 1.20 m3/s and capacity is 900 L/s.'
 const checked=verifyCalculations([{expression:'1.20 * 1.25 - 900',unit:'m3/s'}],source,question).calculations
 const result=completeCalculationIntermediates('Calculated design flow is 1500 L/s.',checked,source,question)
 assert.deepEqual(result.map(step=>[step.value,step.unit]),[[.6,'m3/s'],[1500,'L/s']])
 assert.deepEqual(result[1].inputOrigins.sort(),['question','source'])
 for(const unsupported of ['Flow is 1.80 m3/s.','Volume is 1.50 m3.','Pipe depth is 1.50 m.'])
  assert.equal(completeCalculationIntermediates(unsupported,checked,source,question).length,1)
 assert.deepEqual(completeCalculationIntermediates('Flow is 1.50 m3/s.',[{expression:'1.20 * 1.25 - 900',unit:'m3/s',value:9}],source,question),[])
})

test('intermediate discovery preserves prior-result indices and the four-step limit',()=>{
 const source='The criterion is 1.25 times the runoff.'
 const question='Runoff is 1.20 m3/s and capacity is 0.90 m3/s.'
 const roots=verifyCalculations([{expression:'1.20',unit:'m3/s'},{expression:'r1 * 1.25 - 0.90',unit:'m3/s'}],source,question).calculations
 const result=completeCalculationIntermediates('The flow is 1.50 m3/s.',roots,source,question)
 assert.equal(result[2].value,1.5)
 assert.match(result[2].expression,/r1/)
 assert.deepEqual(result[2].dependencies,[0])
 assert.deepEqual(result.slice(0,2).map(step=>step.expression),roots.map(step=>step.expression))
 const full=verifyCalculations([...roots,{expression:'1.20',unit:'L/s'},{expression:'0.90',unit:'L/s'}],source,question).calculations
 assert.equal(completeCalculationIntermediates('The flow is 1.50 m3/s.',full,source,question).length,4)
})

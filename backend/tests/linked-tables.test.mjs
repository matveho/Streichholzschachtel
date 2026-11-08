import test from 'node:test'
import assert from 'node:assert/strict'
import {linkedTableEvidence as linked} from '../src/linked-tables.mjs'
const rule={excerpt:'Size using Manning’s formula.',heading:'2.1.1 Sizing of Storm Sewers',scope:['2.1.1 Sizing of Storm Sewers'],passage:{doc:'storm',page:10}}
const row=(doc,page,section,number,text)=>({excerpt:text,heading:`${section} · Table ${number}: Numerical criteria`,scope:[section],passage:{doc,page}})
test('retains nearby same-subsection tables without crossing documents or asset sections',()=>{
 const roughness=row('storm',10,rule.heading,'2.2','All smooth-wall pipe 0.013')
 const slopes=row('storm',11,rule.heading,'2.3','Storm main 300 mm')
 const foreign=row('water',10,rule.heading,'2.2','Other jurisdiction 0.020')
 const unrelated=row('storm',10,'2.2.1 Sanitary Sewers','2.4','Sanitary 200 mm')
 assert.deepEqual(linked([rule],[roughness,slopes,foreign,unrelated]),[roughness,slopes])
 assert.deepEqual(linked([rule,roughness],[roughness]),[])
})
test('explicit table links work at a distance but similarly numbered tables do not match',()=>{
 const source={...rule,excerpt:'Refer to Table 2.2 for coefficients.'}
 const correct=row('storm',50,'2.9.1 Coefficients','2.2','Coefficient 0.013')
 const wrong=row('storm',50,'2.9.1 Coefficients','2.20','Coefficient 0.020')
 assert.deepEqual(linked([source],[wrong,correct]),[correct])
})
test('bounded table evidence includes separate tables before additional rows',()=>{
 const rows=[row('storm',10,rule.heading,'2.2','First 0.013'),row('storm',10,rule.heading,'2.2','Second 0.015'),row('storm',10,rule.heading,'2.3','Diameter 300 mm')]
 assert.deepEqual(linked([rule],rows,2),[rows[0],rows[2]])
})

test('same-page named methods link tables despite stale paragraph section metadata',()=>{
 const source={...rule,heading:'1.6.1 Previous extracted section',scope:['1.6.1 Previous extracted section']}
 const correct={...row('storm',10,'2.1.1 Sizing','2.2','All smooth-wall pipe 0.013'),heading:'2.1.1 Sizing · Table 2.2: Manning’s Roughness Coefficient'}
 const unrelated={...correct,heading:'2.1.1 Sizing · Table 2.3: General pipe design values'}
 const remote={...correct,passage:{doc:'storm',page:15}}
 assert.deepEqual(linked([source],[correct,unrelated,remote]),[correct])
})

import test from 'node:test'
import assert from 'node:assert/strict'
import {attachRequirementsReview} from '../src/requirements-review.mjs'
const evidence={documents:[{id:'standard',category:'reference'},{id:'design',ownerProjectId:'project'}],references:[{id:'1',doc:'standard',excerpt:'Minimum width 2 m.'},{id:'2',doc:'design',excerpt:'Proposed width 1 m.'}],report:[{heading:'Width check',sentences:[{text:'The proposed width is below the reference minimum.',refs:['1','2']}]}]}
test('requirements table preserves paired source roles without inventing numerical differences',()=>{
 const row=attachRequirementsReview(evidence).requirementsReview.rows[0]
 assert.equal(row.requirement,'Minimum width 2 m.')
 assert.equal(row.projectValue,'Proposed width 1 m.')
 assert.deepEqual(row.refs,['1','2'])
 assert.equal(row.difference,'Not established for this check.')
})
test('missing project evidence remains missing and unsupported answers have no checks',()=>{
 const result=attachRequirementsReview({...evidence,report:[{sentences:[{text:'Minimum width 2 m.',refs:['1']}]}]})
 assert.match(result.requirementsReview.rows[0].projectValue,/Missing evidence/)
 assert.equal(attachRequirementsReview({report:[]}).requirementsReview,undefined)
})
test('capacity check uses independently verified arithmetic and labels supplied inputs',()=>{
 const result=attachRequirementsReview({...evidence,reviewInputs:{kind:'storm_capacity',existingSewerCapacity:{value:900,unit:'L/s'}},arithmeticReview:{calculations:[{value:1.5,sourceReferenceIds:['1']},{value:.6}]}})
 const row=result.requirementsReview.rows[0]
 assert.equal(row.requirement,'Calculated reference flow: 1.5 m³/s')
 assert.equal(row.projectValue,'Supplied conveyance capacity: 900 L/s')
 assert.equal(row.difference,'0.6 m³/s shortfall')
 assert.match(row.assessment,/assumptions/)
})

test('verified differences use existing calculation provenance and duplicate evidence rows collapse',()=>{
 const result=attachRequirementsReview({...evidence,report:[...evidence.report,...evidence.report],calculationChecks:[{operation:'-',value:1,unit:'m',displayExpression:'2 m - 1 m',sourceReferenceIds:['1','2']}]})
 assert.equal(result.requirementsReview.rows.length,1)
 assert.equal(result.requirementsReview.rows[0].difference,'2 m - 1 m = 1 m (verified arithmetic)')
})

test('privately uploaded references retain their explicitly selected reference role',()=>{
 const result=attachRequirementsReview({...evidence,documents:[{id:'standard',category:'reference',ownerProjectId:'project'},{id:'design',category:'design',ownerProjectId:'project'}]})
 assert.equal(result.requirementsReview.rows[0].requirement,'Minimum width 2 m.')
 assert.equal(result.requirementsReview.rows[0].projectValue,'Proposed width 1 m.')
})

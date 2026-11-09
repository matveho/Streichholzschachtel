import test from 'node:test'
import assert from 'node:assert/strict'
import {ifcFindingEvidence} from '../src/project-evidence.mjs'

const doc={id:'doc-test',label:'Criteria',title:'Criteria',filePath:'/private/design.pdf'}
const quote='S1 nominal pipe diameter must be at least 250 mm.'
const passage={id:'passage',doc:doc.id,page:2,text:quote,lines:[{text:quote,rect:[10,20,210,40]}]}
const scope={documents:[doc],passages:[passage],units:[]}
const issue={id:'ifc-test',model:'model.ifc',elementId:'#1',globalId:'guid',property:'NominalPipeDiameter',actual:200,expected:250,unit:'mm',modelValue:200,modelUnit:'mm',explanation:'The model property is below the document requirement.',citations:[{doc:doc.id,page:2,excerpt:quote}]}
test('IFC evidence separates the model record from an anchored original PDF requirement',()=>{
 const result=ifcFindingEvidence(issue,scope,'project')
 assert.equal(result.mode,'ifc_comparison')
 assert.equal(result.references.length,1)
 assert.deepEqual(result.references[0].regions,[[10,20,200,20]])
 assert.equal(result.documents[0].file,'/v1/projects/project/documents/doc-test/file')
 assert.equal(result.ifcFinding.actual,200)
 assert.deepEqual(result.report.find(section=>section.heading==='IFC property').sentences[0].refs,[])
})
test('foreign documents, wrong pages, changed quotes and missing PDF geometry withhold the evidence view',()=>{
 for(const changed of [
  {...scope,documents:[]},
  {...scope,passages:[{...passage,page:3}]},
  {...scope,passages:[{...passage,text:'S1 nominal pipe diameter is 200 mm.'}]},
  {...scope,passages:[{...passage,lines:[]}]},
  {...scope,passages:[{...passage,lines:[{text:quote,rect:[10,20,0,40]}]}]},
 ])assert.equal(ifcFindingEvidence(issue,changed,'project'),null)
})
test('classified table proofs verify the exact cell metadata and convert PDF rectangles',()=>{
 const tableEvidence={cellId:'0:2:1',row:'Industrial Local',column:'Minimum radius',value:'90 m'}
 const lines=[{text:'Industrial Local',rect:[10,20,100,40],tableCell:'0:2:0'},
  {text:'90 m',rect:[110,20,150,40],tableCell:'0:2:1',tableRowLabel:tableEvidence.row,tableColumn:tableEvidence.column}]
 const tableScope={...scope,passages:[{...passage,lines}]}
 const tableIssue={...issue,citations:[{doc:doc.id,page:2,tableEvidence}]}
 const result=ifcFindingEvidence(tableIssue,tableScope,'project')
 assert.deepEqual(result.references[0].regions,[[10,20,90,20],[110,20,40,20]])
 assert.match(result.references[0].excerpt,/Industrial Local.*Minimum radius.*90 m/)
 assert.equal(ifcFindingEvidence({...tableIssue,citations:[{doc:doc.id,page:2,tableEvidence:{...tableEvidence,value:'190 m'}}]},tableScope,'project'),null)
})

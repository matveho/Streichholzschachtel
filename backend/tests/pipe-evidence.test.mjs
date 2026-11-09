import test from 'node:test'
import assert from 'node:assert/strict'
import { UnitIndex } from '../src/lookup.mjs'
import { SearchIndex } from '../src/search.mjs'
import { mixedPipeEvidence } from '../src/pipe-evidence.mjs'
import { answer } from '../src/answer.mjs'

const question='Review a 450 mm storm main with 1.7 m cover and a storm service with 2.0 m cover. Can we use them without insulation?'
const doc=(id,title)=>({id,title,label:title,edition:'2026',status:'current',jurisdiction:'City of Edmonton'})
const unit=(id,doc,text,heading)=>({id,doc,text,heading,frame:heading,recent:'',page:1,type:'text',regions:[[10,20,400,30]]})
const main=unit('main','guide','Storm sewers require a minimum cover from finished grade to pipe obvert of 2.0 m for pipes smaller than 600 mm diameter.','Storm main cover')
const service=unit('service','guide','Storm services require a minimum depth of 2.4 m at the property line.','Storm service depth')
const sanitary=unit('sanitary','guide','Sanitary services require a minimum depth of 2.75 m at the property line.','Sanitary service depth')
const crossing=unit('crossing','guide','Storm sewers require minimum 3.0 m clearance from tunnel walls.','Storm sewer crossing depth')
const corpus=(units=[main,service,sanitary,crossing])=>({documents:[doc('guide','Design guide')],units,passages:[],failures:[]})

test('mixed asset retrieval preserves separate anchored main and service provisions',()=>{
  const result=mixedPipeEvidence(question,new UnitIndex(corpus()))
  assert.equal(result.mode,'source_evidence')
  assert.deepEqual(result.checks.map(check=>[check.role,check.status]),[['main','source_evidence'],['service','source_evidence']])
  assert.deepEqual(result.checks.map(check=>check.units.map(unit=>unit.id)),[['main'],['service']])
  assert.ok(result.sections.every(section=>section.heading.includes('source evidence')))
  assert.match(result.notes[0],/do not establish project compliance/)
})

test('missing asset evidence and empty scopes remain explicit without a fallback corpus',()=>{
  const partial=mixedPipeEvidence(question,new UnitIndex(corpus([service])))
  assert.equal(partial.checks[0].status,'not_found')
  assert.deepEqual(partial.checks[0].units,[])
  assert.match(partial.sections[0].sentences[0].text,/selected documents/)
  const empty=mixedPipeEvidence(question,new UnitIndex({documents:[],units:[],passages:[]}))
  assert.equal(empty.mode,'insufficient_evidence')
  assert.ok(empty.checks.every(check=>check.status==='not_found'&&!check.units.length))
  assert.equal(mixedPipeEvidence(question.replace('storm main','storm sewer'),new UnitIndex(corpus())),null,'Unparsed assets must not become invented scopes')
})

test('named references, foreign jurisdictions and project records retain their boundaries',()=>{
  const other=doc('other','Alternative standards')
  const data=corpus();data.documents.push(other,{...doc('project','Private design'),projectArtifact:true})
  data.units.push({...main,id:'other-main',doc:'other'}, {...main,id:'project-main',doc:'project'})
  const named=mixedPipeEvidence('According to Alternative standards, '+question,new UnitIndex(data))
  assert.ok(named.checks.flatMap(check=>check.units).every(unit=>unit.doc==='other'))
  assert.equal(named.checks.find(check=>check.role==='service').status,'not_found')
  const all=mixedPipeEvidence(question,new UnitIndex(data))
  assert.ok(!all.checks.flatMap(check=>check.units).some(unit=>unit.doc==='project'))
  assert.equal(mixedPipeEvidence(question+' In Toronto.',new UnitIndex(data)),null)
  assert.equal(mixedPipeEvidence('Under the previous edition, '+question,new UnitIndex(data)),null)
  data.documents.find(document=>document.id==='guide').series='3-03'
  other.series='3-05'
  const series=mixedPipeEvidence('According to Vol 3-03, '+question,new UnitIndex(data))
  assert.ok(series.checks.flatMap(check=>check.units).length)
  assert.ok(series.checks.flatMap(check=>check.units).every(unit=>unit.doc==='guide'))
})

test('the real offline answer exposes per-asset citation coverage without inferring compliance',async()=>{
  const result=await answer(question,new SearchIndex(corpus()),{sourceOnly:true,publicBase:'http://localhost',token:'test'})
  assert.equal(result.mode,'source_evidence')
  assert.equal(result.assetEvidence.length,2)
  assert.ok(result.assetEvidence.every(check=>check.referenceIds.length&&check.referenceIds.every(id=>result.references.some(reference=>reference.id===id&&reference.regions.length))))
  assert.match(JSON.stringify(result.report),/2\.0 m/)
  assert.match(JSON.stringify(result.report),/2\.4 m/)
  assert.ok(result.references.every(reference=>reference.doc==='guide'))
  assert.equal(result.projectInputs.verifiedAgainstDocuments,false)
  assert.ok(result.requiredInputs.fields.some(field=>field.key==='storm_main_cover_datum'))
})

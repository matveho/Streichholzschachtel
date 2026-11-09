import test from 'node:test'
import assert from 'node:assert/strict'
import { attachPipeReviewInputs as attach } from '../src/pipe-review-inputs.mjs'
import { assistQuery } from '../src/clarify.mjs'

const question = 'Review a 450 mm storm main with 1.7 m cover and a storm service with 2.0 m cover. Can we use these without insulation?'
const excerpt = 'A minimum cover from finished grade to pipe obvert of 2.0 m is required for storm sewers smaller than 600 mm diameter.'
const result = () => ({mode:'source_evidence', documents:[{id:'guide',label:'Design guide'}],
  references:[{id:'1',doc:'guide',page:11,excerpt,regions:[[10,10,400,20]]}],report:[]})

test('cover review requests exact asset-bound missing inputs with actual source references', () => {
  const original = result()
  const checked = attach(original, question)
  const fields = checked.requiredInputs.fields
  assert.deepEqual(fields.map(field => field.key), ['storm_main_cover_datum','storm_service_cover_datum','storm_service_diameter'])
  assert.match(fields[0].reason,/1\.7 m/)
  assert.match(fields[1].reason,/2 m/)
  assert.ok(fields.every(field => field.referenceIds.join() === '1'))
  assert.ok(!fields.some(field => field.role === 'main' && field.property === 'diameter'))
  assert.equal(checked.mode,'source_evidence','Missing inputs must not promote a generated review')
  assert.equal(original.report.length,0)
  assert.equal(checked.report[0].heading,'Project inputs to confirm')
  const assist = assistQuery(question, {}, checked)
  assert.equal(assist.outcome,'partial')
  assert.equal(assist.details.length,3)
  assert.deepEqual(assist.clarifications,[])
})

test('complete inputs and a source without a diameter condition do not cause invented parameter requests', () => {
  const complete = 'Review a 450 mm storm main with 1.7 m cover to pipe obvert and a 300 mm storm service with 2.0 m cover to pipe obvert.'
  assert.equal(attach(result(),complete).requiredInputs,undefined)
  const unconditional = result()
  unconditional.references[0].excerpt = 'A minimum cover from finished grade to pipe obvert of 2.0 m is required for storm sewers.'
  assert.deepEqual(attach(unconditional,question).requiredInputs.fields.map(field=>field.property),['measurement_datum','measurement_datum'])
})

test('foreign systems, service-only clauses, private project values and unanchored text cannot create irrelevant requests', () => {
  const cases = [
    {excerpt:excerpt.replace('storm sewers','sanitary sewers')},
    {regions:[]},
    {doc:'missing'},
  ]
  for (const overrides of cases) {
    const checked = result();Object.assign(checked.references[0],overrides)
    assert.equal(attach(checked,question).requiredInputs,undefined)
  }
  const project = result();project.documents[0].projectArtifact=true
  assert.equal(attach(project,question).requiredInputs,undefined)
  const service = result();service.references[0].excerpt=excerpt.replace('storm sewers','storm services')
  assert.ok(attach(service,question).requiredInputs.fields.every(field=>field.role==='service'))
  assert.equal(attach(result(),'What minimum cover is required for storm mains?').requiredInputs,undefined)
  assert.equal(attach(result(),'Review a pond with 1.7 m water depth.').requiredInputs,undefined)
})

test('reference-basis reconciliation remains visible alongside the exact input checklist', () => {
  const original = result()
  original.requiredInputs={kind:'reference_basis',action:'Confirm which reference applies.'}
  const checked=attach(original,question)
  assert.match(checked.requiredInputs.action,/Confirm which reference applies/)
  assert.equal(checked.requiredInputs.kind,'pipe_review_inputs')
  const other=result();other.requiredInputs={kind:'testing_count',action:'Confirm the acceptance stage.'}
  assert.equal(attach(other,question).requiredInputs,other.requiredInputs)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { comparisonEvidence } from '../src/retrieval-plan.mjs'
import { sourceContext } from '../src/local-synthesis.mjs'
import { evidenceInterpretationIssue } from '../src/evidence-guards.mjs'

test('project comparisons retrieve both roles from the current scoped corpus', () => {
  const calls = []
  const index = { corpus: { documents: [{id:'standard'}, {id:'design',projectArtifact:true}] },
    searchSingle(query, ids) { calls.push({query,ids}); return ids.map(doc=>({id:doc,doc})) } }
  const result = comparisonEvidence('Compare the minimum box planter width required by the standards with the width proposed in this project.', index)
  assert.deepEqual(result.map(p=>p.doc), ['standard','design'])
  assert.deepEqual(calls.map(c=>c.ids), [['standard'],['design']])
  assert.ok(calls.every(c=>c.query==='minimum box planter width'))
})
test('a missing document role never triggers an unrestricted empty-id search', () => {
  const index = {corpus:{documents:[{id:'project',projectArtifact:true}]},searchSingle(){throw Error('Must not search')}}
  assert.deepEqual(comparisonEvidence('Compare the project width against the standards.',index),[])
})
test('model context distinguishes project values from reference criteria', () => {
  const unit={passage:{doc:'design'},heading:'Drawing',excerpt:'Width is 400 mm.'}
  const context=sourceContext(unit,'A',[{id:'design',projectArtifact:true,category:'design',title:'Project drawing'}])
  assert.equal(context.sourceRole,'project_document');assert.equal(context.sourceCategory,'design')
  assert.equal(context.quote,unit.excerpt)
})
test('maximum allocations cannot become minimum requirements and opposite bounds stay distinct', () => {
  const source='The current landscape allocation limits the overall width of each box planter to 400 mm.'
  assert.match(evidenceInterpretationIssue('The minimum box planter width is 400 mm.',source),/reverses/)
  assert.equal(evidenceInterpretationIssue('The maximum box planter width is 400 mm.',source),null)
  assert.match(evidenceInterpretationIssue('The landscape allocation limits the minimum box planter width to 400 mm.',source),/reverses/)
  assert.match(evidenceInterpretationIssue('The maximum pipe cover is 2.4 m.','Minimum pipe cover is 2.4 m.'),/reverses/)
  assert.equal(evidenceInterpretationIssue('Minimum width is 400 mm and maximum width is 500 mm.','Minimum width is 400 mm and maximum width is 500 mm.'),null)
})

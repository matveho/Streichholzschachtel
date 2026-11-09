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

test('comparison checks share stable source labels after ranking clones units',async()=>{
 const {labelEvidenceGroups}=await import('../src/local-synthesis.mjs')
 const standard={passage:{doc:'standard',id:'std-p1'},excerpt:'Minimum width is 450 mm.'}
 const project={passage:{doc:'project',id:'project-p1'},excerpt:'Proposed width is 400 mm.'}
 const groups=[{units:[standard,project]},{units:[{...project,score:10},{...standard,score:9}]}]
 const labels=labelEvidenceGroups(groups)
 assert.equal(labels.all.length,2)
 for(const group of groups)for(const unit of group.units){
  const id=labels.unitLabel(unit)
  assert.equal(labels.byLabel.get(id).excerpt,unit.excerpt)
  assert.equal(labels.byLabel.get(id).passage.doc,unit.passage.doc)
 }
 assert.throws(()=>labels.unitLabel({passage:{doc:'foreign'},excerpt:project.excerpt}),/outside/)
})

test('identical provisions on different pages or in different sections retain independent labels', async () => {
  const { labelEvidenceGroups } = await import('../src/local-synthesis.mjs')
  const provision = { passage: { doc: 'standard', id: 'p1', page: 10 }, heading: 'Storm mains', excerpt: 'Minimum cover is 2.0 m.' }
  const otherPage = { ...provision, passage: { ...provision.passage, id: 'p2', page: 20 }, heading: 'Storm services' }
  const otherSection = { ...provision, heading: 'Sanitary mains', scope: ['Sanitary systems'] }
  const labels = labelEvidenceGroups([{ units: [provision, otherPage, otherSection] }, { units: [{ ...provision, score: 10 }] }])
  assert.equal(labels.all.length, 3)
  for (const unit of [provision, otherPage, otherSection]) {
    const selected = labels.byLabel.get(labels.unitLabel(unit))
    assert.equal(selected.passage.id, unit.passage.id)
    assert.equal(selected.passage.page, unit.passage.page)
    assert.equal(selected.heading, unit.heading)
  }
  assert.equal(labels.unitLabel({ ...provision, score: 10 }), labels.unitLabel(provision))
  assert.equal(sourceContext(otherPage, labels.unitLabel(otherPage)).page, 20)
})

test('drafting preserves repeated-page anchors and cannot borrow evidence from another check', async (t) => {
  const { draftLocal } = await import('../src/local-synthesis.mjs')
  const { config } = await import('../src/config.mjs')
  const original = { ...config }
  t.after(() => Object.assign(config, original))
  Object.assign(config, { provider: 'ollama', localSynthesisPolicy: 'all', localReasoning: false })
  const unit = (page, heading, excerpt) => ({ passage: { doc: 'standard', id: 'p' + page, page }, heading, excerpt })
  const groups = [
    { id: 'main', heading: 'Main cover', units: [unit(10, 'Storm mains', 'Minimum cover is 2.0 m.')] },
    { id: 'service', heading: 'Service cover', units: [unit(20, 'Storm services', 'Minimum cover is 2.0 m.')] },
    { id: 'testing', heading: 'Testing', units: [unit(30, 'Inspection', 'Inspect the completed work.')] },
  ]
  const requests = []
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const input = JSON.parse(JSON.parse(options.body).messages[1].content)
    requests.push(input)
    const proof = input.focusedCheck === 'Testing' ? 'A' : input.provisions[0].id
    return new Response(JSON.stringify({ message: { content: JSON.stringify({ findings: [{ text: input.provisions[0].quote, evidence: [proof], calculations: [] }] }) }, done_reason: 'stop' }))
  })
  const drafted = await draftLocal('Review the selected requirements.', [], { corpus: { documents: [{ id: 'standard' }] } }, new AbortController().signal, [], { groups, unresolved: [], calculations: [], originalSystemKeys: [] })
  assert.equal(requests.length, 3)
  const findings = drafted.sections[0].claims
  assert.equal(findings[0].evidence[0].passageId, 'p10')
  assert.equal(findings[1].evidence[0].passageId, 'p20')
  assert.deepEqual(findings[2].evidence, [], 'A malformed cross-check citation is withheld')
  assert.equal(requests[1].provisions[0].page, 20)
})

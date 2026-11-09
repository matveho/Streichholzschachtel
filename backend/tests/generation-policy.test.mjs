import test from 'node:test'
import assert from 'node:assert/strict'
import {permitsLocalSynthesis as allowed} from '../src/generation-policy.mjs'
import {localSynthesisWorkflow} from '../src/generation-policy.mjs'
import {demoReviews} from '../demo/review-scenarios.mjs'
const docs=[{id:'standard'},{id:'design',projectArtifact:true}]
test('demo mode adds a curated complex review without enabling arbitrary general synthesis',()=>{
 const review=demoReviews[0], references=review.documentIds.map(id=>({id}))
 assert.equal(localSynthesisWorkflow(review.question,references,'demo'),'demonstration')
 assert.equal(allowed(review.question,references,'comparisons'),false)
 assert.equal(allowed(review.question,[],'demo'),false)
 assert.equal(allowed(review.question,references.slice(0,1),'demo'),false)
 assert.equal(allowed(review.question.replace('42 ha','75 ha'),references,'demo'),false)
 assert.equal(allowed('Review cover and insulation requirements.',docs,'demo'),false)
 assert.equal(localSynthesisWorkflow('Compare the proposed pipe slope against the reference.',docs,'demo'),'comparison')
})
test('comparison policy requires both source roles in the current project scope',()=>{
 assert.equal(allowed('Compare proposed box planter width against the standard.',docs,'comparisons'),true)
 assert.equal(allowed('Compare the proposed pipe slope with the reference requirement.',docs,'comparisons'),true)
 assert.equal(allowed('Compare these requirements.',[],'comparisons'),false)
 assert.equal(allowed('Compare these requirements.',[docs[0]],'comparisons'),false)
 assert.equal(allowed('Compare these requirements.',[docs[1]],'comparisons'),false)
})
test('general reviews and approval requests remain extractive in comparison policy',()=>{
 assert.equal(allowed('Can a box planter replace conventional storm servicing?',docs,'comparisons'),false)
 assert.equal(allowed('Review the cover and insulation requirements.',docs,'comparisons'),false)
 assert.equal(allowed('Compare the drawings and approve the construction.',docs,'comparisons'),false)
 assert.equal(allowed('Compare the drawings for compliance.',docs,'comparisons'),false)
})
test('experimental all policy stays explicit and unknown policies fail closed',()=>{
 assert.equal(allowed('Review the engineering design.',docs,'all'),true)
 assert.equal(allowed('Compare the drawings.',docs,'other'),false)
})

test('one-sided findings and unrelated source lists cannot establish a project comparison', async()=>{
 const {hasPairedProjectComparison:paired}=await import('../src/generation-policy.mjs')
 const claim=ids=>({evidence:ids.map(doc=>({passage:{doc}}))})
 assert.equal(paired([{claims:[claim(['standard'])]}],docs),false)
 assert.equal(paired([{claims:[claim(['design'])]}],docs),false)
 assert.equal(paired([{claims:[claim(['standard'])]},{heading:'Sources',claims:[claim(['design'])]}],docs),false)
 assert.equal(paired([{claims:[{...claim(['standard','design']),text:'The proposed 400 mm is below 450 mm.'}]}],docs),true)
 assert.equal(paired([{claims:[claim(['standard','foreign-project'])]}],docs),false)
})

test('atomic observations preserve both sides but every derived comparison needs its own paired proof', async()=>{
 const {hasPairedProjectComparison:paired}=await import('../src/generation-policy.mjs')
 const claim=(text,ids,calculations)=>({text,evidence:ids.map(doc=>({passage:{doc}})),calculations})
 const facts=[claim('The reference minimum width is 450 mm.',['standard']),claim('The proposed width is 400 mm.',['design'])]
 assert.equal(paired([{claims:facts}],docs),false)
 assert.equal(paired([{claims:[...facts,claim('The proposed 400 mm is below the 450 mm criterion.',['standard'])]}],docs),false)
 assert.equal(paired([{claims:[...facts,claim('The proposed 400 mm is below the 450 mm criterion.',['standard','design'])]}],docs),true)
 assert.equal(paired([{claims:[...facts,claim('The difference is 50 mm.',['standard'],[{value:50}])]}],docs),false)
})

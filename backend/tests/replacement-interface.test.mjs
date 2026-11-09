import test from 'node:test'
import assert from 'node:assert/strict'
import { replacementInterface, replacementInterfaceIssue } from '../src/replacement-interface.mjs'
import { evidenceUnitKey } from '../src/evidence-units.mjs'
import { validateSynthesis, evidenceReviewCheck } from '../src/answer.mjs'
import { draftLocal } from '../src/local-synthesis.mjs'
import { config } from '../src/config.mjs'
import { attachReviewCoverage } from '../src/review-coverage.mjs'

const source=(id,doc,excerpt,page=1)=>({passage:{id,doc,page,section:'Servicing',text:excerpt,lines:[{text:excerpt,rect:[10,20,500,25]}]},excerpt,quoteStart:0,heading:'Servicing'})
const obligation=source('private','connection','Private storm sewer systems are required by all commercial, industrial, institutional and multi-family developments (3-plex and larger).')
const conditional=source('direct','connection','If required, one storm service line shall be provided for each unit directly off sewer mains.')
const alternative=source('lid','infill','Alternative LID designs will require further authentication and approval processes. LID may be utilized in lieu of traditional underground storm servicing systems.')
const groups=[{id:'check-0',heading:'Alternative',units:[alternative]},{id:'check-1',heading:'Original system',role:'original-system',units:[conditional,obligation]}]
const question='For a four-unit corner-lot infill, can a box planter replace conventional storm servicing?'
const keys=[conditional,obligation].map(evidenceUnitKey)
const check=()=>replacementInterface(question,groups,keys)
const proof=unit=>({passage:unit.passage,excerpt:unit.excerpt,quoteStart:0})

test('replacement reconciliation uses selected source roles, preserving conditional item scope',()=>{
  const group=check()
  assert.equal(group.role,'replacement-interface')
  assert.deepEqual(group.evidenceRoles.obligation,[obligation])
  assert.deepEqual(group.evidenceRoles.alternative,[alternative])
  assert.deepEqual(group.units,[obligation,alternative])
  assert.equal(replacementInterface('What is the minimum storm service slope?',groups,keys),null)
  assert.equal(replacementInterface(question,groups,[]),null)
  assert.equal(replacementInterface(question,[groups[1]],keys),null)
  assert.equal(replacementInterface(question,Array.from({length:8},()=>groups[0]),keys),null)
  for(const excerpt of ['LID may not be utilized in lieu of traditional underground storm servicing systems.','LID is not permitted in lieu of traditional underground storm servicing systems.']) {
    assert.equal(replacementInterface(question,[{...groups[0],units:[{...alternative,excerpt}]},groups[1]],keys),null)
  }
  const absent={...obligation,excerpt:obligation.excerpt.replace('are required','are not required')}
  assert.equal(replacementInterface(question,[groups[0],{...groups[1],units:[absent]}],[evidenceUnitKey(absent)]),null)
})

test('a replacement interface requires both positive source roles at their actual source anchors',()=>{
  const text='Confirm how the alternative LID permission is reconciled with the private storm servicing requirement before replacing the conventional system.'
  assert.equal(replacementInterfaceIssue(text,[proof(obligation),proof(alternative)],check()),null)
  assert.match(replacementInterfaceIssue(text,[proof(obligation)],check()),/alternative provision/)
  assert.match(replacementInterfaceIssue(text,[proof(alternative)],check()),/obligation provision/)
  assert.match(replacementInterfaceIssue(text,[proof(obligation),{...proof(alternative),quoteStart:1}],check()),/alternative provision/)
  assert.match(replacementInterfaceIssue('LID replaces the required service.',[proof(obligation),proof(alternative)],check()),/unresolved/)
})

test('the real synthesis validator cannot accept a reconciliation citing only one source role',()=>{
  const group=check()
  const text='Confirm how the alternative LID permission is reconciled with the private storm servicing requirement.'
  const run=units=>validateSynthesis({sections:[{claims:[{check:group.id,text,evidence:units.map(unit=>({passageId:unit.passage.id,quote:unit.excerpt,quoteStart:0}))}]}]},[obligation.passage,alternative.passage],question,[],{checks:[group.id],checkGroups:[group]})
  assert.match(run([obligation]).issues[0].reason,/alternative provision/)
  assert.equal(run([obligation,alternative]).sections.length,1)
})

test('reconciliation appears in review coverage without masquerading as complete design approval',()=>{
  const group=check()
  const output=attachReviewCoverage({report:[],references:[]},[{heading:'Alternative'}],{groups:[...groups,group],unresolved:[]},{sections:[]})
  assert.equal(output.review.requiresEngineeringReview,true)
  assert.equal(output.review.checks.find(check=>check.id===group.id).status,'unresolved')
})

test('the reconciliation draft receives only its paired source roles, without unrelated shared conditions',async t=>{
  const previous={...config};t.after(()=>Object.assign(config,previous))
  Object.assign(config,{provider:'ollama',localSynthesisPolicy:'all',localReasoning:false})
  const group=check(), requests=[]
  t.mock.method(globalThis,'fetch',async(_url,options)=>{
    const input=JSON.parse(JSON.parse(options.body).messages[1].content)
    requests.push(input)
    const paired=!!input.sourceRoles
    const finding={text:paired?'Confirm how the alternative LID permission is reconciled with the private storm servicing requirement.':input.provisions[0].quote,
      evidence:paired?[...input.sourceRoles.obligation,...input.sourceRoles.alternative]:[input.provisions[0].id],calculations:[]}
    return new Response(JSON.stringify({message:{content:JSON.stringify({findings:[finding]})},done_reason:'stop'}))
  })
  const drafted=await draftLocal(question,[],{corpus:{documents:[{id:'connection'},{id:'infill'}]}},new AbortController().signal,[],{
    groups:[{...groups[1],units:[conditional]},group],unresolved:[],calculations:[],originalSystemKeys:keys,
  })
  const request=requests.find(request=>request.sourceRoles)
  assert.deepEqual(request.crossCuttingRequirements,[])
  assert.equal(request.findingBudget,1)
  const finding=drafted.sections[0].claims.find(claim=>claim.check===group.id)
  assert.deepEqual(finding.evidence.map(proof=>proof.passageId),['private','lid'])
  assert.equal(finding.reviewRole,'replacement-interface')
  const reviewed=evidenceReviewCheck({...finding,evidence:[proof(obligation),proof(alternative)]},0,question)
  assert.match(reviewed.reviewPurpose,/unresolved source-interface question/)
})

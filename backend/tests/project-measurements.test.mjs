import test from 'node:test'
import assert from 'node:assert/strict'
import {pipeProjectMeasurements as measurements,pipeProjectMeasurementIssue as issue,pipeMeasurementSearches,attachProjectMeasurements} from '../src/project-measurements.mjs'
import {validateSynthesis} from '../src/answer.mjs'
import {applicableEvidence} from '../src/applicability.mjs'
import {draftLocal} from '../src/local-synthesis.mjs'
import {config} from '../src/config.mjs'

const question='Before excavation, review a 450 mm storm main with 1.7 m cover and a storm service with 2.0 m cover at the property line. Can we use these details without insulation or further approval?'

test('a source datum cannot silently become an unstated project measurement datum',()=>{
 const claim='The proposed 450 mm storm main with 1.7 m cover to obvert fails the minimum 2.0 m cover to obvert criterion.'
 assert.match(issue(claim,question),/does not establish.*datum/)
 assert.equal(issue(claim,'Review a proposed 450 mm storm main with 1.7 m cover to pipe obvert.'),null)
 assert.match(issue(claim,'Review a proposed 450 mm storm main with 1.7 m depth to invert.'),/does not establish.*datum|does not match/)
 assert.equal(issue('If the supplied cover is measured to obvert, the proposed storm main with 1.7 m cover would be below the cited criterion.',question),null)
 assert.equal(issue('The reference requires 2.0 m cover to pipe obvert for a storm main.',question),null)
 assert.match(issue('If approval is needed, the proposed main with 1.7 m cover to obvert fails the criterion.',question),/datum/)
 assert.match(issue('The proposed storm main with 1.7 m cover does not meet the 2.0 m cover to obvert requirement.',question),/datum is unstated/)
 assert.match(issue('The proposed storm main with 1.7 m cover requires insulation because it is below the source minimum.',question),/datum is unstated/)
 assert.equal(issue('We cannot confirm whether the proposed storm main with 1.7 m cover meets the criterion until the datum is supplied.',question),null)
 assert.equal(issue('The proposed storm service with 2.0 m cover lacks a stated datum to confirm it is measured to the pipe obvert.',question),null)
 assert.match(issue('When the required 2.0 m cover cannot be achieved as demonstrated by the 1.7 m project value, the source mandates providing pipe insulation.',question,'',{role:'main',system:'storm'}),/no stated datum/)
})

test('the public input register distinguishes supplied assumptions, missing datums and source evidence',()=>{
 const original={mode:'extractive_answer',references:[{id:'1',doc:'manual',page:1}],report:[{sentences:[{text:'A quoted source rule.',refs:['1']}]}]}
 const result=attachProjectMeasurements(original,question)
 assert.equal(result.projectInputs.verifiedAgainstDocuments,false)
 assert.equal(result.projectInputs.origin,'question')
 assert.equal(result.projectInputs.measurements.length,3)
 assert.equal(result.projectInputs.measurements.find(record=>record.role==='service').datum,'not-stated')
 assert.equal(result.report.at(-1).heading,'Supplied project measurements')
 assert.match(result.report.at(-1).sentences[0].text,/assumptions/)
 assert.ok(result.report.at(-1).sentences.every(sentence=>!sentence.refs))
 assert.deepEqual(original.report.length,1)
 assert.equal(result.references,original.references)
 const explicit=measurements('A storm main with 1.7 m cover to pipe obvert and a storm service with 2.0 m depth to invert.')
 assert.deepEqual(explicit.map(record=>record.datum),['cover-to-obvert','invert-depth'])
 const empty={references:[],report:[]}
 assert.equal(attachProjectMeasurements(empty,question),empty)
})

test('mixed main and service cover reviews become separate asset checks while retaining other requested tasks',()=>{
 const planned=[{heading:'Pipe cover',query:'storm sewer pipe cover insulation',sections:['s1']},{heading:'Excavation safety',query:'excavation safety approval',sections:['s2']}]
 const checks=pipeMeasurementSearches(question,planned)
 assert.deepEqual(checks.map(check=>check.assetScope?.role||check.heading),['main','service','Excavation safety'])
 assert.ok(checks[0].query.includes('storm main'))
 assert.ok(checks[1].query.includes('storm service'))
 assert.deepEqual(checks[0].sections,['s1'])
 assert.deepEqual(checks[1].sections,['s1'])
 assert.deepEqual(checks[2],planned[1])
 assert.equal(pipeMeasurementSearches('Review a storm main with 1.7 m cover.',planned),planned)
})

test('a scoped diameter condition cannot borrow a different asset diameter or a cover measurement',()=>{
 const source={excerpt:'A minimum cover of 2.0 m for storm sewer is to be provided for all pipes smaller than 600 mm diameter.',heading:'Storm sewer cover'}
 const main=applicableEvidence(question,[source],{pipeScope:{role:'main',system:'storm'}})
 assert.equal(main.units[0].evaluatedConditions[0].suppliedValue,450)
 assert.equal(main.units[0].evaluatedConditions[0].matches,true)
 const service=applicableEvidence(question,[source],{pipeScope:{role:'service',system:'storm'}})
 assert.equal(service.units[0].evaluatedConditions,undefined)
 assert.equal(service.units[0].unresolvedConditions.length,1)
 const coverOnly=applicableEvidence('A storm service has 450 mm cover.',[source],{pipeScope:{role:'service',system:'storm'}})
 assert.equal(coverOnly.units[0].evaluatedConditions,undefined)
 assert.equal(coverOnly.units[0].unresolvedConditions.length,1)
 const unspecifiedProperty=applicableEvidence(question,[{excerpt:'Special provisions apply to pipes greater than 100 m.',heading:'Storm main construction'}],{pipeScope:{role:'main',system:'storm'}})
 assert.equal(unspecifiedProperty.units[0].evaluatedConditions,undefined)
 assert.equal(unspecifiedProperty.units[0].unresolvedConditions.length,1)
})

test('supplied pipe dimensions stay bound to their own roles and properties',()=>{
 assert.deepEqual(measurements(question).map(({role,system,property,value,unit})=>({role,system,property,value,unit})),[
  {role:'main',system:'storm',property:'diameter',value:450,unit:'mm'},
  {role:'main',system:'storm',property:'cover',value:1.7,unit:'m'},
  {role:'service',system:'storm',property:'cover',value:2,unit:'m'},
 ])
 assert.ok(!measurements(question).some(record=>record.role==='service'&&record.property==='diameter'))
 assert.equal(measurements('Review a storm main with cover of 1700 mm.')[0].baseValue,1.7)
 assert.deepEqual(measurements('A pond stores 450 m3 of water.'),[])
 assert.ok(!measurements('Review ST1m storm main and a storm service with 2 m cover.').some(record=>record.property==='diameter'))
 assert.ok(!measurements('Review a -450 mm storm main with 1.7 m cover.').some(record=>record.property==='diameter'))
})

test('a project assertion cannot reuse a main diameter or service cover for the other role',()=>{
 const wrong='The proposed 450 mm storm service cover of 2.0 m from finished grade to pipe obvert meets the minimum requirement.'
 assert.match(issue(wrong,question),/main diameter.*service/)
 assert.match(issue('The proposed storm main cover of 2.0 m meets the minimum.',question),/service/)
 assert.equal(issue('The proposed 450 mm storm main has 1.7 m cover, below the minimum 2.0 m criterion.',question),null)
 assert.equal(issue('The reference minimum storm service cover is 2.4 m.',question),null)
 assert.equal(issue('The proposed storm service with 2.0 m cover needs review.',question),null)
 assert.equal(issue('The proposed 450 mm storm service has 2.0 m cover.',question,'The proposed 450 mm storm service has 2.0 m cover.'),null)
 assert.equal(issue('The proposed 300 mm storm main has 1.65 m cover.','Compare the project values.','The existing 300 mm storm main has 1.65 m cover.'),null)
})

test('citation and number presence cannot authorize reassignment of project pipe dimensions',()=>{
 const quote='All sewers shall be installed with a minimum cover from finished grade to pipe obvert of 2.0 m for storm sewer pipes smaller than 600 mm diameter.'
 const passage={id:'p1',doc:'standard',page:1,section:'Storm sewers',text:quote,lines:[{text:quote,rect:[10,10,500,25]}]}
 const text='The proposed 450 mm storm service cover of 2.0 m from finished grade to pipe obvert meets the minimum requirement for pipes smaller than 600 mm diameter.'
 const result=validateSynthesis({sections:[{claims:[{text,evidence:[{passageId:'p1',quote}]}]}]},[passage],question)
 assert.equal(result.sections.length,0)
 assert.match(result.issues[0].reason,/reassigned/)
})

test('an unstated service diameter cannot support a completed conditional cover check',()=>{
 const quote='A minimum cover from finished grade to pipe obvert of 2.0 m for storm sewer is to be provided for all pipes smaller than 600 mm diameter.'
 const passage={id:'p1',doc:'standard',page:1,section:'Storm sewer cover',text:quote,lines:[{text:quote,rect:[10,10,500,25]}]}
 const measured=question.replace('service with 2.0 m cover','service with 2.0 m cover to obvert')
 const run=(text,role='service')=>validateSynthesis({sections:[{claims:[{text,assetScope:{role,system:'storm'},evidence:[{passageId:'p1',quote}]}]}]},[passage],measured)
 const unqualified=run('The proposed storm service with 2.0 m cover meets the minimum requirement for pipes smaller than 600 mm diameter.')
 assert.equal(unqualified.sections.length,0)
 assert.match(unqualified.issues[0].reason,/no supplied value/)
 assert.match(run('The proposed storm service with 2.0 m cover meets the minimum requirement for pipes smaller than 600 mm diameter; confirm whether the diameter is known.').issues[0].reason,/no supplied value/)
 assert.match(run('The proposed storm service with 2.0 m cover meets the minimum requirement for pipes smaller than 600 mm diameter although its diameter is unknown.').issues[0].reason,/no supplied value/)
 const conditional=run('If the service diameter is smaller than 600 mm, the proposed storm service with 2.0 m cover meets this quoted 2.0 m criterion.')
 assert.equal(conditional.sections.length,1,JSON.stringify(conditional.issues))
 const wrongCheck=run('The proposed storm service with 2.0 m cover meets the minimum requirement.','main')
 assert.match(wrongCheck.issues[0].reason,/different pipe role/)
})

test('one quoted rule can serve two asset checks without transferring its applicability verdict',async t=>{
 const previous={...config};t.after(()=>Object.assign(config,previous))
 Object.assign(config,{provider:'ollama',localSynthesisPolicy:'all',localReasoning:false})
 const text='A minimum cover from finished grade to pipe obvert of 2.0 m for storm sewer is to be provided for all pipes smaller than 600 mm diameter.'
 const passage={id:'p1',doc:'standard',page:1,section:'Storm sewer cover',text,lines:[{text,rect:[10,10,500,25]}]}
 const calls=[]
 t.mock.method(globalThis,'fetch',async(_url,options)=>{
  const request=JSON.parse(options.body),input=JSON.parse(request.messages[1].content)
  calls.push(input)
  const response=request.format.properties.answerable?{answerable:true,evidence:['A'],unresolved:[]}:request.format.properties.calculations?{calculations:[]}:{findings:[]}
  return new Response(JSON.stringify({message:{content:JSON.stringify(response)},done_reason:'stop'}))
 })
 const topics=pipeMeasurementSearches(question,[]).map(topic=>({...topic,scope:topic.query,passages:[passage]}))
 const draft=await draftLocal(question,[passage],{corpus:{documents:[{id:'standard'}]}},new AbortController().signal,[],undefined,topics)
 assert.equal(draft.plan.groups.length,2)
 assert.equal(draft.plan.groups[0].assetScope.role,'main')
 assert.equal(draft.plan.groups[1].assetScope.role,'service')
 const main=calls.find(input=>input.focusedAsset?.role==='main'&&input.provisions)
 const service=calls.find(input=>input.focusedAsset?.role==='service'&&input.provisions)
 assert.equal(main.provisions[0].verifiedConditions[0].matches,true)
 assert.equal(service.provisions[0].verifiedConditions,undefined)
 assert.ok(service.provisions[0].unresolvedConditions.length)
})

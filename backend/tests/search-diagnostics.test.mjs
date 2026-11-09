import test from 'node:test'
import assert from 'node:assert/strict'
import {queryTimer,searchDiagnostics,scopeStatistics} from '../src/search-diagnostics.mjs'

test('server timing measures the queue and non-overlapping execution stages',()=>{
 let time=100
 const timer=queryTimer('2026-11-09T00:00:00.000Z',()=>time,()=>Date.parse('2026-11-09T00:00:00.025Z'))
 time=140;timer.stage('Retrieving sources')
 time=230;timer.stage('Checking evidence')
 time=300
 const timing=timer.finish()
 assert.equal(timing.queueMs,25)
 assert.equal(timing.processingMs,200)
 assert.equal(timing.totalMs,225)
 assert.deepEqual(timing.stages.map(stage=>stage.ms),[40,90,70])
})

test('diagnostics distinguish requested scope, effective index and unique cited evidence',()=>{
 const corpus={documents:[{id:'a',pages:10},{id:'b',pages:20}],passages:[{},{}],units:[{},{},{}]}
 const result={mode:'extractive_answer',references:[
  {doc:'a',page:2,regions:[[1,2,3,4],[5,6,7,8]],extraction:'ocr'},
  {doc:'a',page:2,regions:[[1,2,3,4]],extraction:'ocr'},
  {doc:'b',page:4,regions:[[1,2,3,4]],extraction:'text'},
 ]}
 const trace={index:{documents:1,pages:10,passages:1,indexUnits:2},retrieval:{kind:'provisions',retainedCandidates:7}}
 const stats=searchDiagnostics(corpus,result,trace,{queueMs:0,processingMs:20,totalMs:20,stages:[]},{model:'private-runtime',provider:'ollama'})
 assert.deepEqual(stats.scope,scopeStatistics(corpus))
 assert.equal(stats.scope.documents,2);assert.equal(stats.index.documents,1)
 assert.deepEqual(stats.evidence,{documents:2,pages:2,citations:3,highlightRegions:4,ocrPages:1})
 assert.equal(stats.retrieval.retainedCandidates,7)
 assert.equal(stats.model,undefined,'Source retrieval must not imply model inference')
 assert.ok(Number.isFinite(Date.parse(stats.recordedAt)))
 const empty=searchDiagnostics({documents:[],passages:[],units:[]},{mode:'no_evidence',references:[]},{},{queueMs:0,processingMs:0,totalMs:0,stages:[]})
 assert.equal(empty.scope.documents,0)
 assert.equal(empty.evidence.citations,0)
 assert.equal(empty.retrieval,undefined,'Unmeasured candidate counts must not become fabricated zeroes')
})

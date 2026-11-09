import test from 'node:test'
import assert from 'node:assert/strict'
import {ProjectApi} from '../src/project-api.mjs'

const id='11111111-1111-1111-1111-111111111111'
function fixture(){
 const api=Object.create(ProjectApi.prototype)
 const old={id,projectId:'p',engineVersion:'old',scopeVersion:'scope',documentIds:['doc'],state:'completed',ifcFinding:{issueId:'ifc-test',signature:'model-v1'},result:{mode:'ifc_comparison',report:[{heading:'Obsolete rendering'}]}}
 api.engineVersion='new'
 api.jobs=new Map([['p/'+id,old]])
 api.evidence=new Map([['p/ifc-test',{signature:'model-v1',queryId:id,result:{mode:'ifc_comparison',report:[{heading:'Freshly anchored evidence'}]}}]])
 api.comparisonCache=new Map([['p',{signature:'model-v1'}]])
 api.comparison=()=>({issues:[{id:'ifc-test',queryId:id,verified:true,title:'Current model finding'}]})
 api.scope=()=>({version:'scope',corpus:{documents:[{id:'doc'}]}})
 api.store={scope:()=>({version:'scope'}),get:()=>({savedQueryIds:[]}),reopenQuery:()=>{}}
 const writes=[];api.persist=job=>writes.push(job)
 return {api,old,writes}
}
test('opening a current IFC finding after an engine update rebuilds and persists anchored evidence',()=>{
 const {api,old,writes}=fixture()
 const result=api.readQuery('p',id)
 assert.notEqual(result,old)
 assert.equal(result.engineVersion,'new')
 assert.equal(api.serialize(result).stale,false)
 assert.equal(result.result.report[0].heading,'Freshly anchored evidence')
 assert.equal(writes.length,1)
 assert.equal(api.readQuery('p',id),result)
 assert.equal(writes.length,1,'A fresh report must not be rewritten on every GET')
})
test('model revisions and missing source evidence cannot refresh an obsolete IFC snapshot',()=>{
 for(const issues of [[],[{id:'ifc-test',queryId:id,verified:false}], [{id:'ifc-test',queryId:'different',verified:true}]]){
  const {api,old,writes}=fixture()
  api.comparisonCache.set('p',{signature:'model-v2'})
  api.comparison=()=>({issues})
  assert.equal(api.readQuery('p',id),old)
  const response=api.serialize(old)
  assert.equal(response.stale,true);assert.equal(response.result,undefined)
  assert.equal(writes.length,0)
 }
})
test('serialized IFC revision metadata survives persistence and legacy reports still revalidate',()=>{
 const {api,old}=fixture()
 const stored=JSON.parse(JSON.stringify(api.serialize(old,false)))
 assert.equal(stored.ifcFinding.signature,'model-v1')
 delete stored.ifcFinding
 api.jobs.set('p/'+id,stored)
 const fresh=api.readQuery('p',id)
 assert.equal(fresh.engineVersion,'new')
 assert.equal(api.serialize(fresh).stale,false)
 assert.equal(fresh.result.report[0].heading,'Freshly anchored evidence')
})
test('a legacy report without revision metadata is withheld after its model changes',()=>{
 const {api,old}=fixture()
 delete old.ifcFinding
 old.engineVersion='new'
 api.comparison=()=>({issues:[{id:'ifc-test',queryId:'new-model-query',verified:true}]})
 api.comparisonCache.set('p',{signature:'model-v2'})
 assert.equal(api.serialize(api.readQuery('p',id)).stale,true)
 assert.equal(api.serialize(old).result,undefined)
})

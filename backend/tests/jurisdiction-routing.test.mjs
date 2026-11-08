import test from 'node:test'
import assert from 'node:assert/strict'
import {answer} from '../src/answer.mjs'
import {config} from '../src/config.mjs'

test('jurisdiction mismatch is rejected before local retrieval or generation', async t => {
 const previous={...config};t.after(()=>Object.assign(config,previous))
 Object.assign(config,{provider:'ollama',extractiveOnly:false,localSynthesis:true})
 let calls=0
 t.mock.method(globalThis,'fetch',async()=>{calls++;throw new Error('Model must not be contacted')})
 const corpus={documents:[{id:'edmonton-standard',jurisdiction:'Edmonton',label:'Edmonton standard'}],passages:[],units:[]}
 const result=await answer('What stormwater design rules apply in Toronto?',{corpus,search(){throw new Error('Foreign requirements must not be retrieved')}},{publicBase:'',token:'test',signal:new AbortController().signal})
 assert.equal(result.mode,'no_evidence')
 assert.equal(result.references.length,0)
 assert.match(JSON.stringify(result.report),/Toronto/)
 assert.equal(calls,0)
})

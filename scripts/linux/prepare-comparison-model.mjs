// User-local setup for the evaluated model; never downloads or replaces weights.
const base = 'http://127.0.0.1:11435'
const source = 'qwen3.5:35b-a3b-q4_K_M'
const model = 'basis-qwen35-comparisons:72aac7c28be8'
const digest = '72aac7c28be8ff9b81c2a270eb489c88e6d822a76ec0cb7bf34d965768848567'
async function api(path, body) {
  const response = await fetch(base + path, {
    ...(body ? { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(180000),
  })
  if (!response.ok) throw Error(`Local model setup failed: HTTP ${response.status}`)
  const text = await response.text()
  const data = text ? JSON.parse(text) : {}
  if (data.error) throw Error(data.error)
  return data
}
let tags
for (let i = 0; i < 40; i++) {
  try { tags = await api('/api/tags'); break } catch (error) {
    if (i === 39) throw error
    await new Promise(resolve => setTimeout(resolve, 250))
  }
}
if (!tags.models.some(m => m.name === source && m.digest === digest))
  throw Error(`Expected ${source} with digest ${digest} on the local model service.`)
const existing = tags.models.find(m => m.name === model)
if (existing && existing.digest !== digest) throw Error('The pinned comparison alias has an unexpected digest. Backend mode was not changed.')
if (!existing) await api('/api/copy', { source, destination: model })
const response = await api('/api/chat', {
  model, messages:[{role:'user',content:'Return {"ready":true}.'}], think:false, stream:false,
  format:{type:'object',properties:{ready:{type:'boolean'}},required:['ready']},
  keep_alive:'10m', options:{num_ctx:16384,num_predict:32,temperature:0},
})
if (response.done_reason === 'length' || JSON.parse(response.message.content).ready !== true)
  throw Error('The model did not complete its structured readiness check. Backend mode was not changed.')
const loaded = (await api('/api/ps')).models.find(m => m.name === model || m.digest === digest)
if (!loaded || !(loaded.size > 0) || !(loaded.size_vram >= loaded.size * 0.95))
  throw Error('The evaluated model is not fully GPU resident. Backend mode was not changed.')
console.log(JSON.stringify({model,digest,gpuBytes:loaded.size_vram,contextTokens:loaded.context_length}))

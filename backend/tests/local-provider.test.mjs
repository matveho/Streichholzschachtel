import test from 'node:test'
import assert from 'node:assert/strict'
import { writeFileSync, unlinkSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { config, stateDir } from '../src/config.mjs'
import { generate } from '../src/model.mjs'

test('the optional local provider preserves structured requests and uses only the private loopback key', async (t) => {
  const original = { ...config }
  const keyFile = resolve(stateDir, `test-runtime-${randomUUID()}.txt`)
  writeFileSync(keyFile, 'test-runtime-key')
  t.after(() => {
    Object.assign(config, original)
    unlinkSync(keyFile)
  })
  Object.assign(config, {
    provider: 'llamacpp',
    llamaUrl: 'http://127.0.0.1:11436',
    llamaModel: 'test-local-model',
    llamaKeyFile: keyFile,
  })
  const schema = {
    type: 'object',
    properties: { supported: { type: 'boolean' } },
    required: ['supported'],
  }
  let request
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    request = { url: String(url), options, body: JSON.parse(options.body) }
    return new Response(
      JSON.stringify({
        choices: [
          { finish_reason: 'stop', message: { content: '{"supported":true}' } },
        ],
      }),
    )
  })
  assert.deepEqual(
    await generate(
      'Use only supplied evidence.',
      { source: 'A source.' },
      schema,
      new AbortController().signal,
      200,
    ),
    { supported: true },
  )
  assert.equal(request.url, 'http://127.0.0.1:11436/v1/chat/completions')
  assert.equal(request.options.headers.Authorization, 'Bearer test-runtime-key')
  assert.deepEqual(request.body.response_format.json_schema.schema, schema)
  assert.equal(request.body.response_format.json_schema.strict, true)
  assert.equal(request.body.model, 'test-local-model')
  assert.equal(request.body.max_tokens, 200)
  assert.equal(request.body.chat_template_kwargs.enable_thinking, false)
})

test('local inference rejects remote endpoints and incomplete output before releasing a result', async (t) => {
  const original = { ...config }
  t.after(() => Object.assign(config, original))
  Object.assign(config, {
    provider: 'llamacpp',
    llamaUrl: 'https://example.com',
    llamaKeyFile: '',
  })
  let calls = 0
  t.mock.method(globalThis, 'fetch', async () => {
    calls++
    return new Response(
      JSON.stringify({
        choices: [
          {
            finish_reason: 'length',
            message: { content: '{"supported":true}' },
          },
        ],
      }),
    )
  })
  const run = () =>
    generate(
      'Check evidence.',
      {},
      { type: 'object' },
      new AbortController().signal,
    )
  await assert.rejects(run, /loopback/)
  assert.equal(calls, 0)
  config.llamaUrl = 'http://127.0.0.1:11436'
  await assert.rejects(run, /did not complete/)
})

test('Ollama reasoning is explicit, bounded and never exposed as the answer', async t => {
  const previous = {...config}
  t.after(() => Object.assign(config,previous))
  Object.assign(config,{provider:'ollama',ollamaUrl:'http://127.0.0.1:11435',model:'qwen3:32b-q4_K_M',localReasoning:true,localReasoningTokens:2048,localContextTokens:16384})
  const calls=[]
  t.mock.method(globalThis,'fetch',async (_url,init) => {
    calls.push(JSON.parse(init.body))
    return new Response(JSON.stringify({done_reason:'stop',message:{content:'{"supported":true}',thinking:'Private intermediate reasoning'}}))
  })
  const signal=new AbortController().signal
  const schema={type:'object'}
  assert.deepEqual(await generate('Check evidence.',{},schema,signal,500,{reasoning:true}),{supported:true})
  assert.equal(calls[0].think,true)
  assert.equal(calls[0].options.num_predict,2548)
  assert.equal(calls[0].options.num_ctx,16384)
  assert.equal('reasoning' in calls[0].options,false)
  await generate('Retrieve.',{},schema,signal,500)
  assert.equal(calls[1].think,false)
  assert.equal(calls[1].options.num_predict,500)
  config.ollamaUrl='https://example.com'
  await assert.rejects(generate('Check.',{},schema,signal),/loopback/)
  assert.equal(calls.length,2)
})

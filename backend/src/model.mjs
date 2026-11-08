import { config } from './config.mjs'
import { readFileSync } from 'node:fs'

function localConnection() {
  const url = new URL(config.llamaUrl)
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
    throw new Error('The local model runtime must use a loopback address')
  const key = config.llamaKeyFile
    ? readFileSync(config.llamaKeyFile, 'utf8').trim()
    : ''
  return {
    url,
    headers: {
      'Content-Type': 'application/json',
      ...(key ? { Authorization: 'Bearer ' + key } : {}),
    },
  }
}

export async function waitForLocalModelSleep(signal) {
  if (config.provider !== 'llamacpp' || !config.releaseForVerifier) return
  const { url, headers } = localConnection()
  const deadline = Date.now() + 20000
  while (Date.now() < deadline) {
    const response = await fetch(new URL('/props', url), {
      headers,
      signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
    })
    if (!response.ok)
      throw new Error('Cannot confirm the local runtime memory state')
    if ((await response.json()).is_sleeping === true) return
    await new Promise((resolve) => setTimeout(resolve, 100))
    signal.throwIfAborted()
  }
  throw new Error(
    'The local runtime did not release memory for the independent verifier',
  )
}

export async function generate(
  system,
  input,
  format,
  signal,
  limit = 1800,
  options = {},
) {
  const { reasoning = false, ...runtimeOptions } = options
  const think = config.localReasoning && reasoning
  const outputLimit = limit + (think ? config.localReasoningTokens : 0)
  if (config.provider === 'gateway') {
    if (!process.env.AI_GATEWAY_API_KEY)
      throw new Error(
        'Hosted synthesis is selected but its API key is not configured.',
      )
    const { generateText, Output, jsonSchema } = await import('ai')
    const result = await generateText({
      model: config.gatewayModel,
      system,
      prompt: JSON.stringify(input),
      output: Output.object({ schema: jsonSchema(format) }),
      maxOutputTokens: limit === 1800 ? 8000 : 2500,
      maxRetries: 0,
      abortSignal: signal,
      timeout: 120000,
    })
    return result.output
  }
  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: JSON.stringify(input) },
  ]
  if (config.provider === 'llamacpp') {
    const { url, headers } = localConnection()
    const response = await fetch(new URL('/v1/chat/completions', url), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: config.llamaModel,
        messages,
        stream: false,
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'basis_response', strict: true, schema: format },
        },
        max_tokens: outputLimit,
        temperature: options.temperature ?? 0,
        top_p: options.top_p ?? 0.8,
        top_k: options.top_k ?? 20,
        min_p: 0,
        seed: options.seed ?? 42,
        chat_template_kwargs: { enable_thinking: think },
      }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(180000)]),
    })
    if (!response.ok) throw new Error(`Local model returned ${response.status}`)
    const data = await response.json(),
      choice = data.choices?.[0]
    if (process.env.BASIS_DEBUG_RETRIEVAL === '1')
      console.log(
        'Local model context',
        JSON.stringify({
          provider: 'llamacpp',
          inputCharacters: JSON.stringify(messages).length,
          promptTokens: data.usage?.prompt_tokens,
          outputTokens: data.usage?.completion_tokens,
          limit,
          doneReason: choice?.finish_reason,
        }),
      )
    if (
      !choice ||
      choice.finish_reason !== 'stop' ||
      typeof choice.message?.content !== 'string'
    )
      throw new Error(
        'The local model did not complete a reliable structured response',
      )
    return JSON.parse(choice.message.content)
  }
  const ollama = new URL(config.ollamaUrl)
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(ollama.hostname))
    throw new Error('The local model runtime must use a loopback address')
  const raw = /^qwen3-vl/i.test(config.model)
  if (raw && think) throw new Error('Reasoning requires the structured chat provider')
  // This installed Qwen model's chat template always starts a thinking block.
  // Complete that block explicitly to produce the constrained answer directly.
  const prompt =
    messages
      .map((m) => `<|im_start|>${m.role}\n${m.content}<|im_end|>\n`)
      .join('') + '<|im_start|>assistant\n<think>\n</think>\n'
  const response = await fetch(
    `${config.ollamaUrl}/api/${raw ? 'generate' : 'chat'}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        stream: false,
        think,
        format,
        ...(raw ? { raw: true, prompt } : { messages }),
        options: {
          temperature: 0,
          num_ctx: config.localContextTokens,
          num_predict: outputLimit,
          ...runtimeOptions,
        },
        keep_alive: '10m',
      }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(150000)]),
    },
  )
  if (!response.ok) throw new Error(`Local model returned ${response.status}`)
  const data = await response.json()
  if (data.error) throw new Error(data.error)
  if (process.env.BASIS_DEBUG_RETRIEVAL === '1')
    console.log(
      'Local model context',
      JSON.stringify({
        inputCharacters: JSON.stringify(messages).length,
        promptTokens: data.prompt_eval_count,
        outputTokens: data.eval_count,
        limit,
        doneReason: data.done_reason,
      }),
    )
  if (data.done_reason === 'length')
    throw new Error(
      'Local model output reached its token limit before completing reliably',
    )
  return JSON.parse(raw ? data.response : data.message.content)
}

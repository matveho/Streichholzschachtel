import { config } from './config.mjs'

export async function generate(system, input, format, signal, limit = 1800) {
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
  const raw = /^qwen3-vl/i.test(config.model)
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
        think: false,
        format,
        ...(raw ? { raw: true, prompt } : { messages }),
        options: { temperature: 0, num_ctx: 8192, num_predict: limit },
        keep_alive: '10m',
      }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(150000)]),
    },
  )
  if (!response.ok) throw new Error(`Local model returned ${response.status}`)
  const data = await response.json()
  if (data.error) throw new Error(data.error)
  return JSON.parse(raw ? data.response : data.message.content)
}

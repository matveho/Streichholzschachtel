import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { config } from './config.mjs'
import { waitForLocalModelSleep } from './model.mjs'

export function contradictedIds(results, validIds) {
  const vetoed = new Set()
  for (const result of results) {
    if (!validIds.has(result.id) || result.abstained) continue
    const scores = result.scores
    if (
      !scores ||
      !['contradiction', 'entailment', 'neutral'].every(
        (key) =>
          Number.isFinite(scores[key]) && scores[key] >= 0 && scores[key] <= 1,
      )
    )
      throw new Error('Invalid local verifier scores')
    // Entailment scores never approve anything. Numerical/engineering checks
    // remain mandatory because this classifier is not reliable at arithmetic.
    if (scores.contradiction >= 0.95) vetoed.add(result.id)
  }
  return vetoed
}

export async function checkContradictions(checks, question, signal) {
  if (!config.entailmentDir) return new Set()
  await waitForLocalModelSleep(signal)
  if (!config.entailmentPython)
    throw new Error('Local verifier Python is not configured')
  const cases = checks.map((check) => ({
    id: check.id,
    claim: check.claim,
    premise: `Supplied project information: ${question}\nSource provisions:\n${check.quotes.join('\n')}\nRelated qualifications:\n${check.relatedProvisions.join('\n')}\nVerified conditions: ${JSON.stringify(check.verifiedConditions || [])}\nVerified arithmetic: ${JSON.stringify(check.verifiedCalculations || [])}`,
  }))
  const input = JSON.stringify(cases)
  if (Buffer.byteLength(input) > 262144)
    throw new Error('Local verifier input is too large')
  const output = await new Promise((resolve, reject) => {
    const child = spawn(
      config.entailmentPython,
      [
        fileURLToPath(new URL('./entailment.py', import.meta.url)),
        config.entailmentDir,
      ],
      {
        windowsHide: true,
        signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]),
        env: { ...process.env, HF_HUB_OFFLINE: '1', TRANSFORMERS_OFFLINE: '1' },
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    )
    let text = '',
      stderr = '',
      size = 0
    child.stdout.on('data', (chunk) => {
      size += chunk.length
      if (size > 65536) {
        child.kill()
        reject(new Error('Local verifier output is too large'))
        return
      }
      text += chunk.toString('utf8')
    })
    child.stderr.on('data', (chunk) => {
      if (stderr.length < 4096)
        stderr += chunk.toString('utf8').slice(0, 4096 - stderr.length)
    })
    child.on('error', reject)
    child.on('close', (code) =>
      code === 0
        ? resolve(text)
        : (() => {
            if (process.env.BASIS_DEBUG_RETRIEVAL === '1')
              console.warn(
                'Local verifier diagnostic',
                JSON.stringify({ count: cases.length, code, stderr }),
              )
            reject(new Error('Local contradiction check failed'))
          })(),
    )
    child.stdin.on('error', reject)
    child.stdin.end(input)
  })
  const results = JSON.parse(output)
  if (!Array.isArray(results))
    throw new Error('Invalid local verifier response')
  return contradictedIds(results, new Set(checks.map((c) => c.id)))
}

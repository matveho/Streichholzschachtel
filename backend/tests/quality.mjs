import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { engineeringScenarios } from './engineering-scenarios.mjs'
const key = readFileSync(resolve(process.env.BASIS_STATE_DIR || 'state', 'session-token.txt'), 'utf8').trim(),
  testBase = process.env.BASIS_TEST_URL || 'http://127.0.0.1:8787',
  headers = {
    Authorization: 'Bearer ' + key,
    'Content-Type': 'application/json',
  }
const smokeCases = [
  {
    // New water and power sources mention fire protection and buildings.
    // Retrieval candidates must not become an invented hospital stair rating.
    question:
      'What fire resistance rating is required for a hospital staircase?',
    noAnswer: true,
  },
  {
    question:
      'What inspection frequency is required for erosion and sediment control while LID is being constructed?',
    terms: [/week/i, /rain/i],
  },
  {
    question:
      'Can the Rational Method alone be used to size a detention pond serving a 40 ha catchment?',
    terms: [/comput|model/i, /storage|pond/i],
  },
  {
    question:
      'What Guelph Permeameter tests are needed for a 500 square metre LID facility with 600 mm of soil?',
    terms: [/two|2/, /QA|quality/i],
  },
  {
    question: 'What is the safe footing width for my new office building?',
    noAnswer: true,
  },
  {
    question: 'What stormwater design rules apply in Toronto?',
    noAnswer: true,
  },
  { question: 'What are the requirements?', noAnswer: true },
  {
    question: 'What concrete cover is required for a reinforced bridge pier?',
    noAnswer: true,
  },
  {
    question:
      'What minimum vertical clearance is required when sewer mains cross?',
    allowLookup: true,
    terms: [/300\s*mm/, /when sewer crossing each other/i],
  },
  {
    question: 'What is the minimum slope for catch basin leads?',
    allowLookup: true,
    terms: [/1(?:\.0)?\s*%/],
  },
]
const suite =
  process.env.BASIS_QUALITY_SUITE === 'engineering'
    ? engineeringScenarios
    : smokeCases
const caseId = process.env.BASIS_QUALITY_CASE
if (caseId && !/^[a-z0-9-]+$/.test(caseId))
  throw new Error('Invalid quality case ID')
const cases = caseId ? suite.filter((c) => c.id === caseId) : suite
if (!cases.length) throw new Error('No quality cases matched the selected ID')
mkdirSync('test-results', { recursive: true })
const outputs = []
for (const c of cases) {
  const start = Date.now()
  let job = await (
    await fetch(testBase + '/v1/queries', {
      method: 'POST',
      headers,
      body: JSON.stringify({ question: c.question }),
    })
  ).json()
  const deadline = Date.now() + 600000
  for (; Date.now() < deadline && ['queued', 'running'].includes(job.state);) {
    await new Promise((r) => setTimeout(r, 1000))
    job = await (
      await fetch(testBase + '/v1/queries/' + job.id, { headers })
    ).json()
  }
  const timedOut = ['queued', 'running'].includes(job.state)
  if (timedOut) {
    job = await (
      await fetch(testBase + '/v1/queries/' + job.id, {
        method: 'DELETE',
        headers,
      })
    ).json()
  }
  const findings = JSON.stringify(
    job.result?.report?.filter((block) => !block.heading) || [],
  )
  const text = JSON.stringify(job.result?.report),
    evidenceChecksPassed =
      job.state === 'completed' &&
      (c.noAnswer
        ? ['no_evidence', 'insufficient_evidence'].includes(job.result?.mode)
        : c.terms.every((t) => t.test(text)) &&
          (c.findingTerms || []).every((t) => t.test(findings)) &&
          !(c.forbidden || []).some((t) => t.test(text)) &&
          new Set(job.result?.references.map((r) => r.doc)).size >=
            (c.minSources || 1)),
    passed =
      evidenceChecksPassed &&
      (c.noAnswer ||
        ['local_synthesis', 'cited_synthesis'].includes(job.result?.mode) ||
        (c.allowLookup && job.result?.mode === 'source_lookup'))
  outputs.push({
    question: c.question,
    passed,
    state: job.state,
    timedOut,
    evidenceChecksPassed,
    seconds: Math.round((Date.now() - start) / 1000),
    mode: job.result?.mode,
    engineVersion: job.engineVersion,
    corpusVersion: job.corpusVersion,
    report: job.result?.report,
    notes: job.result?.notes,
    references: job.result?.references,
  })
  console.log(
    c.question,
    JSON.stringify({
      passed,
      evidenceChecksPassed,
      seconds: outputs.at(-1).seconds,
      mode: job.result?.mode,
    }),
  )
}
writeFileSync(
  `test-results/quality${process.env.BASIS_QUALITY_SUITE === 'engineering' ? '-engineering' : ''}${caseId ? '-' + caseId : ''}.json`,
  JSON.stringify(outputs, null, 2),
)
if (outputs.some((o) => !o.passed)) process.exitCode = 1

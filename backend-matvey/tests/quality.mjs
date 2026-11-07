import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
const key = readFileSync('state/session-token.txt', 'utf8').trim(),
  headers = {
    Authorization: 'Bearer ' + key,
    'Content-Type': 'application/json',
  }
const cases = [
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
    terms: [/300\s*mm/, /when sewer crossing each other/i],
  },
  {
    question: 'What is the minimum slope for catch basin leads?',
    terms: [/1(?:\.0)?\s*%/],
  },
]
mkdirSync('test-results', { recursive: true })
const outputs = []
for (const c of cases) {
  const start = Date.now()
  let job = await (
    await fetch('http://127.0.0.1:8787/v1/queries', {
      method: 'POST',
      headers,
      body: JSON.stringify({ question: c.question }),
    })
  ).json()
  for (let i = 0; i < 200 && ['queued', 'running'].includes(job.state); i++) {
    await new Promise((r) => setTimeout(r, 1000))
    job = await (
      await fetch('http://127.0.0.1:8787/v1/queries/' + job.id, { headers })
    ).json()
  }
  const text = JSON.stringify(job.result?.report),
    evidenceChecksPassed =
      job.state === 'completed' &&
      (c.noAnswer
        ? ['no_evidence', 'insufficient_evidence'].includes(job.result?.mode)
        : c.terms.every((t) => t.test(text))),
    passed =
      evidenceChecksPassed &&
      (c.noAnswer ||
        ['local_synthesis', 'cited_synthesis'].includes(job.result?.mode))
  outputs.push({
    question: c.question,
    passed,
    evidenceChecksPassed,
    seconds: Math.round((Date.now() - start) / 1000),
    mode: job.result?.mode,
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
writeFileSync('test-results/quality.json', JSON.stringify(outputs, null, 2))
if (outputs.some((o) => !o.passed)) process.exitCode = 1

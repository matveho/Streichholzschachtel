import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { engineeringScenarios } from './engineering-scenarios.mjs'
import { quantitativeScenarios } from './quantitative-scenarios.mjs'
import { missingFindingTerms } from './quality-criteria.mjs'
import { createHash } from 'node:crypto'
import { calculationUnits } from '../src/calculations.mjs'
const criteriaVersion = createHash('sha256').update([
  './quality.mjs','./engineering-scenarios.mjs','./quantitative-scenarios.mjs','./quality-criteria.mjs',
].map(file=>readFileSync(new URL(file,import.meta.url),'utf8')).join('')).digest('hex')
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
    : process.env.BASIS_QUALITY_SUITE === 'quantitative' ? quantitativeScenarios : smokeCases
const caseId = process.env.BASIS_QUALITY_CASE
if (caseId && !/^[a-z0-9-]+$/.test(caseId))
  throw new Error('Invalid quality case ID')
const cases = caseId ? suite.filter((c) => c.id === caseId) : suite
if (!cases.length) throw new Error('No quality cases matched the selected ID')
mkdirSync('test-results', { recursive: true })
const runHealth = await (await fetch(testBase + '/health')).json()
const outputs = []
for (const c of cases) {
  const start = Date.now()
  const queryPath='/v1'+(c.projectId?'/projects/'+c.projectId:'')+'/queries'
  let job = await (
    await fetch(testBase + queryPath, {
      method: 'POST',
      headers,
      body: JSON.stringify({ question: c.question, ...(c.documentIds ? {documentIds:c.documentIds} : {}) }),
    })
  ).json()
  const deadline = Date.now() + 600000
  for (; Date.now() < deadline && ['queued', 'running'].includes(job.state);) {
    await new Promise((r) => setTimeout(r, 1000))
    job = await (
      await fetch(testBase + queryPath + '/' + job.id, { headers })
    ).json()
  }
  const timedOut = ['queued', 'running'].includes(job.state)
  if (timedOut) {
    job = await (
      await fetch(testBase + queryPath + '/' + job.id, {
        method: 'DELETE',
        headers,
      })
    ).json()
  }
  const missingFindings = missingFindingTerms(job.result?.report,c.findingTerms)
  const sourceScopeViolations=(job.result?.references || []).filter(reference=>c.documentIds&&!c.documentIds.includes(reference.doc)).map(reference=>reference.doc)
  const sourceRegionsValid=(job.result?.references || []).every(reference=>reference.page>0 && reference.regions?.length>0 && reference.regions.every(rect=>rect.length===4&&rect.every(Number.isFinite)&&rect[2]>0&&rect[3]>0))
  const arithmeticSourcesValid=(job.result?.arithmeticReview?.calculations || []).every(step=>step.sourceReferenceIds.every(id=>job.result.references.some(reference=>reference.id===id))&&(!step.inputOrigins.includes('source')||step.sourceReferenceIds.length>0))
  const missingArithmetic=(c.arithmeticExpected || []).filter(expected=>!job.result?.arithmeticReview?.calculations.some(step=>step.dimension===expected.dimension&&(!expected.operation||step.operation===expected.operation)&&Math.abs(step.value*(calculationUnits[step.unit]?.[1] ?? NaN)-expected.value)<1e-9))
  const text = JSON.stringify(job.result?.report),
    evidenceChecksPassed =
      job.state === 'completed' &&
      sourceRegionsValid && arithmeticSourcesValid && !sourceScopeViolations.length &&
      !missingArithmetic.length &&
      (!c.requiredInputKind || job.result?.requiredInputs?.kind===c.requiredInputKind) &&
      !(c.forbidden || []).some((t) => t.test(text)) &&
      (c.noAnswer
        ? ['no_evidence', 'insufficient_evidence'].includes(job.result?.mode)
        : c.terms.every((t) => t.test(text)) &&
          !missingFindings.length &&
          new Set(job.result?.references.map((r) => r.doc)).size >=
            (c.minSources || 1)),
    passed =
      evidenceChecksPassed &&
      (c.noAnswer ||
        (c.arithmeticExpected && job.result?.arithmeticReview?.status==='arithmetic_only' && job.result.arithmeticReview.applicabilityConfirmed===false) ||
        ['local_synthesis', 'cited_synthesis'].includes(job.result?.mode) ||
        (c.allowLookup && job.result?.mode === 'source_lookup'))
  const sourceCount = new Set(job.result?.references?.map(r => r.doc) || []).size
  const diagnostics = {
    missingEvidenceTerms: (c.terms || []).filter(term => !term.test(text)).map(String),
    missingFindingTerms: missingFindings.map(String),
    forbiddenTerms: (c.forbidden || []).filter(term => term.test(text)).map(String),
    requiredSources: c.minSources || (c.noAnswer ? 0 : 1),
    actualSources: sourceCount,
    sourceScopeViolations,
    sourceRegionsValid,
    arithmeticSourcesValid,
    missingArithmetic,
    ...(c.requiredInputKind?{expectedInputKind:c.requiredInputKind,actualInputKind:job.result?.requiredInputs?.kind}:{}),
    expectsNoAnswer: !!c.noAnswer,
  }
  outputs.push({
    ...(c.id ? {caseId:c.id} : {}),
    model: runHealth.model,
    provider: runHealth.provider,
    criteriaVersion,
    diagnostics,
    question: c.question,
    ...(c.projectId?{projectId:c.projectId,documentIds:c.documentIds}:{}),
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
    arithmeticReview:job.result?.arithmeticReview,
  })
  console.log(
    c.question,
    JSON.stringify({
      passed,
      evidenceChecksPassed,
      ...(!passed ? {diagnostics} : {}),
      seconds: outputs.at(-1).seconds,
      mode: job.result?.mode,
    }),
  )
}
writeFileSync(
  `test-results/quality${['engineering','quantitative'].includes(process.env.BASIS_QUALITY_SUITE) ? '-'+process.env.BASIS_QUALITY_SUITE : ''}${caseId ? '-' + caseId : ''}.json`,
  JSON.stringify(outputs, null, 2),
)
if (process.env.BASIS_STATE_DIR) writeFileSync(resolve(process.env.BASIS_STATE_DIR, 'quality-results.json'), JSON.stringify(outputs, null, 2))
if (outputs.some((o) => !o.passed)) process.exitCode = 1

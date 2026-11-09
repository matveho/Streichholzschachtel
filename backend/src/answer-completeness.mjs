// Completeness is separate from entailment: a true related fact may not answer
// the requested quantity. These checks can withhold an answer, never approve it.
import { applicableEvidence } from './applicability.mjs'
const stages = (text) =>
  new Set([
    ...(/\bFAC\b|\bfinal acceptance\b/i.test(text) ? ['final'] : []),
    ...(/\bCCC\b|\bconstruction completion\b/i.test(text)
      ? ['construction']
      : []),
  ])
const testing = /\b(?:tests?|testing|samples?|specimens?|test locations?)\b/i
const qualityControl = /\bQA\s*\/?\s*QC\b|quality (?:assurance|control)/i
const count =
  /\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\d+)\b(?!\s*(?:mm|cm|km|m[²³23]?|ha|percent|square|cubic|metres?|meters?)\b)\s+(?:(?!of\b|per\b)[a-z/-]+\s+){0,4}(?:tests?|locations?|samples?|specimens?)\b/i
const zeroRequired =
  /\bno\s+(?:[a-z]+\s+){0,4}(?:tests?|testing)\s+(?:is\s+|are\s+)?required\b|\btesting\s+is\s+not\s+required\b/i
export function testingCountGap(question, sections) {
  if (
    !/\bhow many\b|\bnumber of\b|\bcount of\b/i.test(question) ||
    !testing.test(question)
  )
    return null
  const requestedStages = stages(question)
  // A separate QC check cannot stand in for a requested field count.
  const countQuestion = question.split(
    /\band\s+(?:what|which|how|where|when)\b/i,
  )[0]
  const wantsQualityControl = qualityControl.test(countQuestion)
  const requestedTypes = wantsQualityControl
    ? /\bfield\b/i.test(countQuestion)
      ? ['field', 'qc']
      : ['qc']
    : ['field']
  const findings = sections
    .filter((section) => !section.heading)
    .flatMap((section) => section.claims)
  const candidates = findings.flatMap((claim) =>
    claim.text.split(/;|\band\b/i).flatMap((text) => {
      if (!count.test(text) && !zeroRequired.test(text)) return []
      const provisions = claim.evidence?.length
        ? claim.evidence.map(proof=>({excerpt:proof.excerpt,heading:proof.passage?.section || ''}))
        : [{excerpt:claim.text,heading:''}]
      const applicability=applicableEvidence(question,provisions)
      if(applicability.excluded.length || applicability.units.some(unit=>unit.unresolvedConditions?.length)) return []
      const ownStages = stages(text)
      return [
        {
          type: qualityControl.test(text) ? 'qc' : 'field',
          stages: ownStages.size ? ownStages : stages(claim.text),
        },
      ]
    }),
  )
  const answered = requestedTypes.every((type) => {
    const matching = candidates.filter((candidate) => candidate.type === type)
    return requestedStages.size > 1
      ? [...requestedStages].every((stage) =>
          matching.some((candidate) => candidate.stages.has(stage)),
        )
      : matching.some(
          (candidate) =>
            !candidate.stages.size ||
            [...candidate.stages].every((stage) => requestedStages.has(stage)),
        )
  })
  if (answered) return null
  return {
    kind: 'testing_count',
    reason:
      'The approved findings do not establish the requested test count for the stated case.',
    action:
      findings.some((claim) => stages(claim.text).size) && !requestedStages.size
        ? 'Specify construction completion or final acceptance, then confirm the count for the stated facility size.'
        : 'Confirm the applicable test-count provision for the stated facility size and testing stage.',
  }
}

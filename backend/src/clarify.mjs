// Conversation helpers for results that need the user's help: clarifying
// questions, "not found" guidance and hints about missing documents.
//
// Clarifying options are never guesses. Each option is a rewritten question
// that has already been run through the same offline lookup and produced a
// sourced answer, so choosing it always leads somewhere. Nothing here writes
// an engineering answer; it only helps the user ask a question the indexed
// documents can answer, or tells them which document is missing.

import { UnitIndex, lookup, isEngineeringQuery } from './lookup.mjs'
import { tokens, lookupStopwords } from './search.mjs'
import { foreignJurisdiction } from './catalog.mjs'

const stems = (text) => new Set(tokens(text, lookupStopwords))
const has = (asked, words) => [...words].some((t) => asked.has(t))

const unanswered = ['no_evidence', 'insufficient_evidence', 'related_evidence']

// Each facet asks one question; options are appended to the user's question.
const facets = [
  {
    question: 'Which system is this for?',
    applies: (asked) =>
      has(
        asked,
        stems(
          'pipe sewer main service connection cover slope velocity diameter depth maintenance hole manhole bedding trench flow capacity',
        ),
      ),
    options: [
      { label: 'Storm sewer', words: 'storm stormwater drainage' },
      { label: 'Sanitary sewer', words: 'sanitary wastewater sewage' },
      { label: 'Water main', words: 'water watermain potable hydrant' },
    ],
  },
  {
    question: 'What type of development?',
    applies: (asked) =>
      has(
        asked,
        stems(
          'lot site development zoning density runoff coefficient grading parking',
        ),
      ),
    options: [
      { label: 'Residential', words: 'residential house housing dwelling' },
      { label: 'Commercial', words: 'commercial retail office' },
      { label: 'Industrial', words: 'industrial' },
    ],
  },
].map((facet) => ({
  ...facet,
  options: facet.options.map((o) => ({ ...o, words: stems(o.words) })),
}))

// Document kinds the reference collections usually lack. `present` matches a
// document title or label that would already cover the kind.
const missingKinds = [
  {
    kind: 'a geotechnical report',
    asks: 'geotechnical soil soils borehole bearing footing groundwater frost',
    present: /geotech|soil/i,
  },
  {
    kind: 'the building code or zoning bylaw',
    asks: 'stair stairs storey storeys building height tall egress occupancy fire separation fence setback',
    present: /building code|zoning bylaw/i,
  },
  {
    kind: 'structural drawings or a structural design standard',
    asks: 'structural beam column rebar reinforcement slab load',
    present: /structur/i,
  },
  {
    kind: 'the project schedule or cost estimate',
    asks: 'cost price budget schedule deadline estimate',
    present: /schedule|estimate|budget/i,
  },
].map((k) => ({ ...k, asks: stems(k.asks) }))

// Parameters engineers usually need to state for a sourced answer. Each rule
// fires only when the question is about the subject but omits the parameter.
const detailRules = [
  {
    about: stems(
      'pipe sewer main service connection cover slope velocity diameter bedding trench capacity maintenance manhole',
    ),
    stated: (q, asked) =>
      has(
        asked,
        stems(
          'storm stormwater drainage sanitary wastewater sewage water watermain potable hydrant',
        ),
      ),
    detail: 'The system: storm, sanitary or water.',
  },
  {
    about: stems('slope velocity capacity spacing apart maintenance manhole'),
    stated: (q) => /\b\d+(?:\.\d+)?\s?(?:mm|millimet|m\b|inch|in\b|")/i.test(q),
    detail: 'The pipe diameter, e.g. 300 mm.',
  },
  {
    about: stems(
      'lot site development zoning density runoff coefficient fire flow parking',
    ),
    stated: (q, asked) =>
      has(
        asked,
        stems(
          'residential commercial industrial institutional park river valley',
        ),
      ) ||
      /\b(?:R[SFMH]\d?|RM[hd]?\d*|RF\d|UF|DC\d|CB\d|IB|IM|IH|A|AP|PU)\b/.test(
        q,
      ),
    detail:
      'The land use or zone, e.g. residential (RS), commercial or industrial.',
  },
  {
    about: stems('control release rate detention storage onsite'),
    stated: (q) =>
      /\b\d+(?:\.\d+)?\s?(?:ha|hectare|m2|m²|square met|acre)/i.test(q),
    detail: 'The site area, e.g. 0.5 ha.',
  },
  {
    about: stems('road street lane sidewalk speed pavement walkway lighting'),
    stated: (q, asked) =>
      has(
        asked,
        stems('arterial collector local highway residential alley lane'),
      ),
    detail: 'The road classification, e.g. local, collector or arterial.',
  },
]
// Technical words beyond the lookup's domain list, so an engineering question
// the documents can't answer is never dismissed as off-topic.
const technicalWords = stems(
  'slope cover velocity diameter invert grade elevation capacity spacing clearance pressure flow depth load design standard specification requirement code bylaw permit drawing',
)
const isTechnical = (question, asked) =>
  isEngineeringQuery(question) ||
  has(asked, technicalWords) ||
  detailRules.some((r) => has(asked, r.about)) ||
  facets.some((f) => f.applies(asked))

const genericDetail =
  'The element and the requirement you are checking, e.g. “minimum slope for a 150 mm storm service connection”.'

// Questions offered to users whose search isn't an engineering question. Only
// the ones the current documents actually answer are shown.
const exampleQuestions = [
  'What is the minimum slope for a storm service connection?',
  'What are the runoff coefficients for residential areas in Edmonton?',
  'What fire flow is required for single family residential development?',
  'What depth must water services be at the property line?',
  'What is the minimum depth of water main invert below the curb top in Edmonton?',
  'What is the posted speed limit on residential streets?',
]

const answered = (question, index) =>
  ['extractive_answer', 'version_answer'].includes(lookup(question, index).mode)

const refine = (question, label) =>
  `${question.trim().replace(/[?.!\s]+$/, '')} for ${label.toLowerCase()}?`

/**
 * Returns the search parameters and scope status for a finished result:
 * `{ outcome, jurisdiction?, missing?, details, examples?, clarifications }`
 * where outcome is 'answered', 'vague', 'partial', 'not_found',
 * 'jurisdiction' or 'off_topic'.
 */
export function assistQuery(question, searchIndex, result) {
  if(result.requiredInputs?.kind==='capacity_review_inputs')return {
    outcome:'vague',details:result.requiredInputs.fields.map(field=>`${field.label} (${field.unit}): ${field.reason}`),clarifications:[],
  }
  const index = (searchIndex.unitIndex ??= new UnitIndex(searchIndex.corpus))
  const documents = index.corpus.documents
  const asked = stems(question)
  const jurisdiction = foreignJurisdiction(question, documents)
  if (jurisdiction)
    return {
      outcome: 'jurisdiction',
      jurisdiction,
      details: [],
      clarifications: [],
    }

  // Preserve the specific unresolved engineering input. Generic asset/system
  // prompts would obscure why otherwise relevant evidence did not answer.
  if (['testing_count','reference_basis'].includes(result.requiredInputs?.kind) &&
      typeof result.requiredInputs.action === 'string')
    return {
      outcome: 'partial',
      details: [result.requiredInputs.action],
      clarifications: [],
    }

  const titles = documents.map((d) => `${d.title || ''} ${d.label || ''}`)
  const missing = unanswered.includes(result.mode)
    ? missingKinds.find(
        (k) => has(asked, k.asks) && !titles.some((t) => k.present.test(t)),
      )?.kind
    : undefined
  const engineering = isTechnical(question, asked)

  // Not an engineering question at all: explain what the tool is for.
  if (result.mode === 'no_evidence' && !engineering && !missing)
    return {
      outcome: 'off_topic',
      details: [],
      clarifications: [],
      examples: exampleQuestions.filter((q) => answered(q, index)).slice(0, 3),
    }

  const outcome = !unanswered.includes(result.mode)
    ? asked.size <= 1
      ? 'vague'
      : 'answered'
    : result.mode === 'no_evidence'
      ? 'not_found'
      : 'partial'

  const details = detailRules
    .filter((r) => has(asked, r.about) && !r.stated(question, asked))
    .map((r) => r.detail)
  if (outcome === 'vague') details.push(genericDetail)

  const clarifications = []
  if (outcome !== 'vague')
    for (const facet of facets) {
      if (!facet.applies(asked)) continue
      // Already specific: the question names one of the options.
      if (facet.options.some((o) => has(asked, o.words))) continue
      const options = facet.options
        .map((o) => ({ label: o.label, question: refine(question, o.label) }))
        .filter((o) => answered(o.question, index))
      if (options.length >= 2)
        clarifications.push({ question: facet.question, options })
    }

  return {
    outcome,
    ...(missing ? { missing } : {}),
    details,
    clarifications,
  }
}

import { normalizeMeasurements } from './indexer.mjs'

// A duty conditional on a component's existence does not require that component.
export function requiresOptionalComponent(claim, quotes, question = '') {
  const text = quotes.join(' ')
  for (const match of text.matchAll(
    /\bif\s+(?:an?\s+|the\s+)?([a-z]+(?:[ -][a-z]+){0,3})\s+is\s+(?:present|used|installed|provided)\b/gi,
  )) {
    const component = match[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const existence = new RegExp(
      `\\b(?:includes?|contains?|incorporates?|must have|shall have|requires?)\\s+(?:an?\\s+|the\\s+)?${component}\\b`,
      'i',
    )
    if (!existence.test(claim)) continue
    const explicit = new RegExp(
      `\\b(?:has|includes?|contains?|with)\\s+(?:an?\\s+|the\\s+)?${component}\\b`,
      'i',
    )
    const conditional = new RegExp(
      `\\b(?:if|when|where)\\s+(?:an?\\s+|the\\s+)?${component}\\b|\\b${component}\\b[^.!?;]{0,30}\\bif (?:present|used|installed|provided)\\b`,
      'i',
    )
    if (explicit.test(question) || conditional.test(claim)) continue
    const otherSentences = [
      ...new Intl.Segmenter('en', { granularity: 'sentence' }).segment(text),
    ]
      .map((s) => s.segment)
      .filter((s) => !/\bif\b/i.test(s))
    if (otherSentences.some((s) => existence.test(s))) continue
    return true
  }
  return false
}

function lidTypes(text) {
  return new Set(
    [
      ['box-planter', /\bbox[ -]planters?\b/i],
      ['basin', /\bbioretention basins?\b/i],
      ['garden', /\bbioretention gardens?\b/i],
      ['bioswale', /\bbioswales?\b/i],
      ['soil-cell', /\bsoil[ -]cells?\b/i],
      ['permeable-pavement', /\bpermeable pavement\b/i],
      ['naturalized-drainageway', /\bnaturalized drainageways?\b/i],
    ]
      .filter(([, pattern]) => pattern.test(text || ''))
      .map(([type]) => type),
  )
}

const units = '(mm|cm|km|ha|m2|m3|m|%)(?![\\p{L}\\d])'
const number = '(\\d+(?:\\.\\d+)?)'
function quantities(text) {
  return normalizeMeasurements(text)
    .replace(/(?<=\d),(?=\d{3}\b)/g, '')
    .replace(/\bsquare\s+met(?:re|er)s?\b/gi, 'm2')
    .replace(/\bcubic\s+met(?:re|er)s?\b/gi, 'm3')
    .replace(/\bmillimet(?:re|er)s?\b/gi, 'mm')
    .replace(/\bhectares?\b/gi, 'ha')
}

export function falseComparisons(text) {
  const normalized = quantities(text)
  const dimensions = {
    mm: ['length', 0.001],
    cm: ['length', 0.01],
    m: ['length', 1],
    km: ['length', 1000],
    m2: ['area', 1],
    ha: ['area', 10000],
    m3: ['volume', 1],
    '%': ['percent', 1],
  }
  const issues = []
  const comparisons =
    /\b(exceeds?|is greater than|is larger than|is deeper than|is less than|is smaller than|is shallower than|is below|is above)\s+(\d+(?:\.\d+)?)\s*(mm|cm|km|ha|m2|m3|m|%)(?![\p{L}\d])/giu
  for (const m of normalized.matchAll(comparisons)) {
    const rightDimension = dimensions[m[3]]
    if (!rightDimension) continue
    const before = normalized.slice(Math.max(0, m.index - 150), m.index)
    const earlier = [
      ...before.matchAll(new RegExp(number + '\\s*' + units, 'giu')),
    ].filter((q) => dimensions[q[2]]?.[0] === rightDimension[0])
    if (!earlier.length) continue
    const left = earlier.at(-1)
    const bridge = before.slice(left.index + left[0].length)
    if (/[,;.!?]|\b(?:with|that|which|and|or)\b/i.test(bridge)) continue
    const a = Number(left[1]) * dimensions[left[2]][1],
      b = Number(m[2]) * rightDimension[1]
    const less = /less|smaller|shallower|below/i.test(m[1])
    let valid = less ? a < b : a > b
    if (/\bnot\s*$/i.test(before)) valid = !valid
    if (!valid)
      issues.push(
        `The comparison ${left[0]} ${m[1]} ${m[2]} ${m[3]} is numerically false`,
      )
  }
  return issues
}

export function applicableEvidence(question, evidence) {
  const requestedLidTypes = lidTypes(question)
  const constructionOnly =
    /\bconstruct(?:ion|ing|ed)?\b|\binstall(?:ation|ing)?\b|\bbefore excavation\b/i.test(
      question,
    ) && !/\bmaintenance\b|\bwarranty\b|\bfinal acceptance\b/i.test(question)
  const storm =
    /\bstorm(?:water)?(?:\s+and\s+sanitary)?\s+(?:sewers?|mains?|services?|drainage)\b|\bdetention ponds?\b/i
  const sanitary = /\bsanitary\b/i
  const requestedStorm = storm.test(question),
    requestedSanitary = sanitary.test(question)
  const storage = /\bstorage\b|\b(?:detention|retention)\s+ponds?\b/i
  const conveyance = /\b(?:sewers?|conveyance)\b|\bminor\s+drainage\b/i
  const countWords = [
    'zero',
    'one',
    'two',
    'three',
    'four',
    'five',
    'six',
    'seven',
    'eight',
    'nine',
    'ten',
    'eleven',
    'twelve',
  ]
  const residentialOnly =
    /\b(?:infill|residential|housing|lot)\b/i.test(question) &&
    !/\b(?:commercial|industrial|institutional|mixed.use)\b/i.test(question)
  const counts = residentialOnly
    ? [
        ...question.matchAll(
          /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)[ -](?:units?|plex)\b/gi,
        ),
      ].map((m) =>
        /^\d/.test(m[1])
          ? Number(m[1])
          : countWords.indexOf(m[1].toLowerCase()),
      )
    : []
  const values = new Map()
  for (const m of quantities(question).matchAll(
    new RegExp(number + '\\s*' + units, 'giu'),
  )) {
    if (!values.has(m[2])) values.set(m[2], new Set())
    values.get(m[2]).add(Number(m[1]))
  }
  for (const m of quantities(question).matchAll(
    new RegExp(
      '\\bfrom\\s+' +
        number +
        '\\s*' +
        units +
        '\\s+to\\s+' +
        number +
        '\\s*' +
        units,
      'giu',
    ),
  )) {
    if (m[2] === m[4]) values.get(m[2])?.delete(Number(m[1]))
  }
  const excluded = [],
    retained = []
  const patterns = [
    {
      re: new RegExp(
        '(?:less than|smaller than|shallower than|lower than|below|under|<)\\s*(?:approximately\\s*)?' +
          number +
          '\\s*' +
          units,
        'giu',
      ),
      test: (v, t) => v < t,
    },
    {
      re: new RegExp(
        '(?:greater than|larger than|deeper than|higher than|more than|above|over|>)\\s*(?:approximately\\s*)?' +
          number +
          '\\s*' +
          units,
        'giu',
      ),
      test: (v, t) => v > t,
    },
    {
      re: new RegExp('(?:up to|≤)\\s*' + number + '\\s*' + units, 'giu'),
      test: (v, t) => v <= t,
    },
    {
      re: new RegExp('(?:≥)\\s*' + number + '\\s*' + units, 'giu'),
      test: (v, t) => v >= t,
    },
    {
      re: new RegExp(
        number +
          '\\s*' +
          units +
          '\\s+(?:or|and)\\s+(?:less|smaller|shallower)',
        'giu',
      ),
      test: (v, t) => v <= t,
    },
    {
      re: new RegExp(
        number + '\\s*' + units + '\\s+or\\s+(?:greater|larger|deeper|more)',
        'giu',
      ),
      test: (v, t) => v >= t,
    },
  ]
  for (const unit of evidence) {
    if (
      constructionOnly &&
      /\bmaintenance\b/i.test(
        [...(unit.scope || []), unit.heading || ''].join(' '),
      )
    ) {
      excluded.push(unit)
      continue
    }
    // An unnamed component inherits its nearest actual section's asset type.
    // Explicitly mixed provisions and general LID requirements remain eligible.
    let sourceLidTypes = lidTypes(unit.excerpt)
    if (!sourceLidTypes.size) sourceLidTypes = lidTypes(unit.heading)
    if (!sourceLidTypes.size) {
      for (const ancestor of [...(unit.scope || [])].reverse()) {
        sourceLidTypes = lidTypes(ancestor)
        if (sourceLidTypes.size) break
      }
    }
    if (
      requestedLidTypes.size &&
      sourceLidTypes.size &&
      ![...sourceLidTypes].some((type) => requestedLidTypes.has(type))
    ) {
      excluded.push(unit)
      continue
    }
    // These are sibling systems, not interchangeable engineering synonyms.
    // Retain mixed/universal provisions and ambiguous questions for review.
    const sourceStorm = storm.test(unit.excerpt),
      sourceSanitary = sanitary.test(unit.excerpt)
    if (
      requestedStorm &&
      conveyance.test(question) &&
      !storage.test(question) &&
      storage.test(unit.excerpt) &&
      !conveyance.test(unit.excerpt)
    ) {
      excluded.push(unit)
      continue
    }
    if (
      (requestedStorm &&
        !requestedSanitary &&
        sourceSanitary &&
        !sourceStorm) ||
      (requestedSanitary && !requestedStorm && sourceStorm && !sourceSanitary)
    ) {
      excluded.push(unit)
      continue
    }
    const text = quantities(unit.excerpt)
    const checks = [],
      evaluatedConditions = []
    const dwellingFloor = unit.excerpt.match(
      /\b(\d+)[ -]plex\s+and\s+(?:larger|greater)\b/i,
    )
    if (dwellingFloor && new Set(counts).size === 1) {
      const matches = counts[0] >= Number(dwellingFloor[1])
      checks.push(matches)
      evaluatedConditions.push({
        suppliedValue: counts[0],
        unit: 'dwellings',
        sourceCondition: dwellingFloor[0],
        matches,
      })
    }
    for (const { re, test } of patterns) {
      for (const m of text.matchAll(re)) {
        // Compare applicability qualifiers, not required minima or measured offsets.
        const before = text.slice(Math.max(0, m.index - 100), m.index)
        const subjects = [
          ...before.matchAll(
            /\b(?:facilit(?:y|ies)|soils?|pipes?|mains?|catchments?|areas?|depths?|diameters?)\b/gi,
          ),
        ]
        if (!subjects.length) continue
        const qualifier = before.slice(subjects.at(-1).index)
        if (
          /\b(?:must|shall|required|recommended|preferred|should|minimum|maximum)\b/i.test(
            qualifier,
          )
        )
          continue
        const supplied = values.get(m[2])
        if (supplied?.size !== 1) continue // Multiple quantities need interpretation.
        const suppliedValue = [...supplied][0],
          matches = test(suppliedValue, Number(m[1]))
        checks.push(matches)
        evaluatedConditions.push({
          suppliedValue,
          unit: m[2],
          sourceCondition: m[0],
          matches,
        })
      }
    }
    if (checks.length && checks.every((result) => !result)) excluded.push(unit)
    else
      retained.push({
        ...unit,
        id: retained.length,
        ...(evaluatedConditions.length ? { evaluatedConditions } : {}),
        ...(checks.some((v) => !v) ? { mixedConditions: true } : {}),
      })
  }
  return { units: retained, excluded }
}

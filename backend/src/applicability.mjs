import { normalizeMeasurements } from './indexer.mjs'
import { calculationUnits } from './calculations.mjs'
import { pipeProjectMeasurements } from './project-measurements.mjs'

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
      `\\b(?:if|when|where)\\s+(?:an?\\s+|the\\s+)?${component}\\b|\\b(?:if|when|where)\\s+(?:[a-z]+[ -]){0,6}(?:includes?|contains?|incorporates?|has)\\s+(?:an?\\s+|the\\s+)?${component}\\b|\\b${component}\\b[^.!?;]{0,30}\\bif (?:present|used|installed|provided)\\b`,
      'i',
    )
    const stated = question.split(/[;!?]|\.(?=\s|$)/).some(clause =>
      explicit.test(clause) && !/\b(?:if|when|where|whether|unless)\b|^\s*(?:does|do|is|are|should|would|could|can|will)\b/i.test(clause))
    const assertions = claim.split(/[;!?]|\.(?=\s|$)/).filter(clause=>existence.test(clause))
    if (stated || assertions.every(clause=>conditional.test(clause))) continue
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

export function incompatibleLidAsset(question, finding) {
  const requested = lidTypes(question), asserted = lidTypes(finding)
  return requested.size > 0 && asserted.size > 0 && ![...asserted].some(type => requested.has(type))
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

export function quantityComparisons(text) {
  const normalized = quantities(text)
  const dimensions = {
    ...Object.fromEntries(Object.entries(calculationUnits).filter(([unit])=>unit).map(([unit, dimension])=>[unit.toLowerCase(), dimension])),
    '%': ['percent', 1],
  }
  const physicalUnits = Object.keys(dimensions).sort((a,b)=>b.length-a.length).map(unit=>unit.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')
  const result = []
  const canonicalUnit = unit => Object.keys(calculationUnits).find(name=>name.toLowerCase()===unit.toLowerCase()) || unit
  const basis = '(?:the\\s+)?(?:(?:cited|required|recommended|proposed|existing|specified|reference|minimum|maximum|design)\\s+){0,3}(?:(?:capacity|flow|runoff|rate|cover|depth|width|area|volume|criterion|value|threshold|limit)(?:\\s+(?:requirement|criterion|limit))?\\s+)?(?:of\\s+)?'
  const minimum = '(?=\\s+(?:the\\s+)?(?:(?:required|recommended)\\s+)?minimum\\b)'
  const offsets = new RegExp('\\b(is|are|was|were)\\s+(?:exactly\\s+)?'+number+'\\s*('+physicalUnits+')(?![\\p{L}\\d/])\\s+(less than|greater than|smaller than|larger than|shallower than|deeper than|below|above)\\s+'+basis+number+'\\s*('+physicalUnits+')(?![\\p{L}\\d/])','giu')
  for (const match of normalized.matchAll(offsets)) {
    const dimension=dimensions[match[6].toLowerCase()]
    const before=normalized.slice(Math.max(0,match.index-150),match.index)
    const left=[...before.matchAll(new RegExp(number+'\\s*('+physicalUnits+')(?![\\p{L}\\d/])','giu'))].filter(quantity=>dimensions[quantity[2].toLowerCase()]?.[0]===dimension[0]).at(-1)
    if(!left)continue
    const bridge=before.slice(left.index+left[0].length)
    if(/[,;.!?]|\b(?:with|that|which|and|or)\b/i.test(bridge))continue
    result.push({
      left:{value:Number(left[1]),unit:canonicalUnit(left[2]),baseValue:Number(left[1])*dimensions[left[2].toLowerCase()][1],dimension:dimension[0]},
      right:{value:Number(match[5]),unit:canonicalUnit(match[6]),baseValue:Number(match[5])*dimension[1],dimension:dimension[0]},
      operator:match[1]+' '+match[4],less:/less|smaller|shallower|below/i.test(match[4]),negated:false,
      difference:{value:Number(match[2]),unit:canonicalUnit(match[3]),baseValue:Number(match[2])*dimensions[match[3].toLowerCase()][1],dimension:dimensions[match[3].toLowerCase()][0]},
    })
  }
  const comparisons = new RegExp('\\b(exceeds?|is greater than|is larger than|is deeper than|is less than|is smaller than|is shallower than|is below|is above|falls? short of|fails? to meet'+minimum+'|is insufficient to meet'+minimum+')\\s+'+basis+number+'\\s*('+physicalUnits+')(?![\\p{L}\\d/])','giu')
  for (const m of normalized.matchAll(comparisons)) {
    const rightDimension = dimensions[m[3].toLowerCase()]
    if (!rightDimension) continue
    const before = normalized.slice(Math.max(0, m.index - 150), m.index)
    const earlier = [
      ...before.matchAll(new RegExp(number + '\\s*(' + physicalUnits + ')(?![\\p{L}\\d/])', 'giu')),
    ].filter((q) => dimensions[q[2].toLowerCase()]?.[0] === rightDimension[0])
    if (!earlier.length) continue
    const left = earlier.at(-1)
    const bridge = before.slice(left.index + left[0].length)
    if (!/^\s*,?\s*which\s*$/i.test(bridge) && /[,;.!?]|\b(?:with|that|which|and|or)\b/i.test(bridge)) continue
    const a = Number(left[1]) * dimensions[left[2].toLowerCase()][1],
      b = Number(m[2]) * rightDimension[1]
    const less = /less|smaller|shallower|below|short|fails?|insufficient/i.test(m[1])
    const difference = normalized.slice(m.index + m[0].length).match(new RegExp('^\\s+by\\s+'+number+'\\s*('+physicalUnits+')(?![\\p{L}\\d/])','iu'))
    result.push({
      left:{value:Number(left[1]),unit:canonicalUnit(left[2]),baseValue:a,dimension:rightDimension[0]},
      right:{value:Number(m[2]),unit:canonicalUnit(m[3]),baseValue:b,dimension:rightDimension[0]},
      operator:m[1],less,negated:/\bnot\s*$/i.test(before),
      ...(difference ? {difference:{value:Number(difference[1]),unit:canonicalUnit(difference[2]),baseValue:Number(difference[1])*dimensions[difference[2].toLowerCase()][1],dimension:dimensions[difference[2].toLowerCase()][0]}} : {}),
    })
  }
  return result
}

export function falseComparisons(text) {
  const issues = []
  for (const comparison of quantityComparisons(text)) {
    const {left,right,less,negated,difference,operator}=comparison
    let valid=less ? left.baseValue < right.baseValue : left.baseValue > right.baseValue
    if(negated) valid=!valid
    if (!valid)
      issues.push(
        `The comparison ${left.value} ${left.unit} ${operator} ${right.value} ${right.unit} is numerically false`,
      )
    if (difference && !negated && (difference.dimension !== left.dimension || (left.dimension!=='percent' && Math.abs(difference.baseValue-Math.abs(left.baseValue-right.baseValue))>1e-9)))
      issues.push('The stated comparison difference does not match the operands and compatible physical units')
  }
  return issues
}

const stormAsset = /\bstorm(?:water)?(?:\s+and\s+sanitary)?\s+(?:sewers?|mains?|services?|drainage)\b|\bdetention ponds?\b/i
const sanitaryAsset = /\bsanitary\b/i
const serviceRole = /\b(?:storm|sanitary|water|sewer)\s+services?\b|\bservice\s+(?:connections?|pipes?|cover|depth)\b/i
const mainRole = /\b(?:storm|sanitary|water|sewer)\s+mains?\b|\bmain\s+(?:pipes?|cover|depth)\b/i
export function pipeRole(text) {
  const service = serviceRole.exec(text || '')
  const main = mainRole.exec(text || '')
  if (/\bmains?\s+(?:and|or)\s+(?:\w+\s+)?services?\b|\bservices?\s+(?:and|or)\s+(?:\w+\s+)?mains?\b/i.test(text || '')) return null
  return service && (!main || service.index < main.index) ? 'service' : main ? 'main' : null
}
export function incompatiblePipeRole(claim, unit) {
  if (serviceRole.test(claim) && mainRole.test(claim)) return false
  const asserted = pipeRole(claim)
  if (!asserted) return false
  for (const text of [unit.excerpt, unit.conditionEvidence?.excerpt, unit.heading, ...[...(unit.scope || [])].reverse()]) {
    const source = pipeRole(text)
    if (source) return source !== asserted
  }
  return false
}
export function conveyanceScope(unit) {
  for (const text of [unit.excerpt, unit.heading, ...[...(unit.scope || [])].reverse()]) {
    const storm = stormAsset.test(text || ''), sanitary = sanitaryAsset.test(text || '')
    if (storm || sanitary) return {storm, sanitary}
  }
  return {storm:false, sanitary:false}
}
export function incompatibleConveyanceEvidence(question, unit) {
  const requestedStorm = stormAsset.test(question), requestedSanitary = sanitaryAsset.test(question)
  const source = conveyanceScope(unit)
  return (requestedStorm && !requestedSanitary && source.sanitary && !source.storm) ||
    (requestedSanitary && !requestedStorm && source.storm && !source.sanitary)
}

export function applicableEvidence(question, evidence, {pipeScope} = {}) {
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
    const {storm: sourceStorm, sanitary: sourceSanitary} = conveyanceScope(unit)
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
      evaluatedConditions = [],
      unresolvedConditions = []
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
        let supplied = values.get(m[2])
        const pipeLengthCondition = pipeScope && /\b(?:pipes?|mains?|diameters?)\b/i.test(qualifier) && ['mm','cm','m','km'].includes(m[2])
        const diameterCondition = pipeLengthCondition && /\bdiameters?\b/i.test(qualifier+' '+text.slice(m.index+m[0].length,m.index+m[0].length+30))
        if (diameterCondition) {
          const scale = {mm:.001,cm:.01,m:1,km:1000}[m[2]]
          supplied = new Set(pipeProjectMeasurements(question).filter(record=>record.property==='diameter' && record.role===pipeScope.role && (!record.system||record.system===pipeScope.system)).map(record=>Number((record.baseValue/scale).toPrecision(12))))
        }
        else if (pipeLengthCondition) supplied = undefined
        if (supplied?.size !== 1) {
          unresolvedConditions.push({unit:m[2],sourceCondition:m[0]})
          continue // Missing or multiple quantities need interpretation.
        }
        const suppliedValue = [...supplied][0],
          matches = test(suppliedValue, Number(m[1]))
        checks.push(matches)
        evaluatedConditions.push({
          suppliedValue,
          unit: m[2],
          sourceCondition: m[0],
          matches,
          ...(diameterCondition?{property:'diameter',role:pipeScope.role,system:pipeScope.system}:{}),
        })
      }
    }
    if (checks.length && checks.every((result) => !result)) excluded.push(unit)
    else
      retained.push({
        ...unit,
        id: retained.length,
        ...(evaluatedConditions.length ? { evaluatedConditions } : {}),
        ...(unresolvedConditions.length ? { unresolvedConditions } : {}),
        ...(checks.some((v) => !v) ? { mixedConditions: true } : {}),
      })
  }
  return { units: retained, excluded }
}

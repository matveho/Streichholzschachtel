import { normalizeMeasurements } from './indexer.mjs'

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
        number + '\\s*' + units + '\\s+or\\s+(?:less|smaller|shallower)',
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
    const text = quantities(unit.excerpt)
    const checks = [],
      evaluatedConditions = []
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

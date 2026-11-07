import { normalizeMeasurements } from './indexer.mjs'

const unitTypes = {
  '': ['scalar', 1],
  mm: ['length', 0.001],
  cm: ['length', 0.01],
  m: ['length', 1],
  km: ['length', 1000],
  m2: ['area', 1],
  ha: ['area', 10000],
  m3: ['volume', 1],
  'm3/s': ['flow', 1],
  'L/s': ['flow', 0.001],
  'm/s': ['velocity', 1],
  'mm/h': ['rainfall-rate', 0.001 / 3600],
}
const numeric = '(?:\\d+(?:\\.\\d+)?|\\.\\d+)'
const physical = new RegExp(
  '(' +
    numeric +
    ')\\s*(m3/s|L/s|m/s|mm/h|mm|cm|km|m2|m3|ha|m)(?![\\p{L}\\d/])',
  'gu',
)
const rounded = (n) => Number(n.toPrecision(12))

function inputs(sources, question) {
  const choices = new Map()
  const add = (literal, value, dimension) => {
    const key = Number(literal)
    if (!choices.has(key)) choices.set(key, [])
    const list = choices.get(key)
    if (
      !list.some(
        (v) => v.dimension === dimension && Math.abs(v.value - value) < 1e-12,
      )
    )
      list.push({ value, dimension })
  }
  add(0, 0, 'scalar')
  add(1, 1, 'scalar')
  for (const [text, isQuestion] of [
    [sources, false],
    [question, true],
  ]) {
    const normalized = normalizeMeasurements(text).replace(
      /(?<=\d),(?=\d{3}\b)/g,
      '',
    )
    const measured = []
    for (const m of normalized.matchAll(physical)) {
      const [dimension, factor] = unitTypes[m[2]]
      add(m[1], Number(m[1]) * factor, dimension)
      measured.push([m.index, m.index + m[0].length])
    }
    if (isQuestion)
      for (const m of normalized.matchAll(
        new RegExp('\\b' + numeric + '\\b', 'g'),
      )) {
        if (!measured.some(([a, b]) => m.index >= a && m.index < b))
          add(m[0], Number(m[0]), 'scalar')
      }
    for (const m of normalized.matchAll(
      new RegExp('(' + numeric + ')\\s*%', 'g'),
    )) {
      const p = Number(m[1])
      add(p, p, 'scalar')
      add(p / 100, p / 100, 'scalar')
      add(1 + p / 100, 1 + p / 100, 'scalar')
      add(100, 100, 'scalar')
    }
    for (const m of normalized.matchAll(
      new RegExp('(' + numeric + ')\\s+times\\b', 'gi'),
    ))
      add(m[1], Number(m[1]), 'scalar')
    if (/\bhalf(?:way)?\b/i.test(normalized)) {
      add(2, 2, 'scalar')
      add(0.5, 0.5, 'scalar')
    }
  }
  return choices
}

function parse(expression) {
  if (typeof expression !== 'string' || expression.length > 120)
    throw Error('Expression is missing or too long')
  const text = expression
    .replaceAll('×', '*')
    .replaceAll('÷', '/')
    .replaceAll('−', '-')
  const tokens = []
  let cursor = 0
  const token = new RegExp('\\s*(' + numeric + '|r[1-4]|[()+*/-])', 'gy')
  while (cursor < text.length) {
    if (!text.slice(cursor).trim()) break
    token.lastIndex = cursor
    const m = token.exec(text)
    if (!m)
      throw Error(
        'Only numbers, prior results, parentheses and basic arithmetic are allowed',
      )
    tokens.push(m[1])
    cursor = token.lastIndex
    if (tokens.length > 50) throw Error('Expression is too complex')
  }
  let at = 0
  const primary = () => {
    const t = tokens[at++]
    if (t === '-') return { operator: 'negate', left: primary() }
    if (t === '(') {
      const value = sum()
      if (tokens[at++] !== ')') throw Error('Unbalanced parentheses')
      return value
    }
    if (/^r[1-4]$/.test(t || '')) return { reference: Number(t.slice(1)) - 1 }
    if (t !== undefined && Number.isFinite(Number(t)))
      return { literal: Number(t) }
    throw Error('A numeric operand is required')
  }
  const product = () => {
    let value = primary()
    while (['*', '/'].includes(tokens[at])) {
      const operator = tokens[at++]
      value = { operator, left: value, right: primary() }
    }
    return value
  }
  const sum = () => {
    let value = product()
    while (['+', '-'].includes(tokens[at])) {
      const operator = tokens[at++]
      value = { operator, left: value, right: product() }
    }
    return value
  }
  const result = sum()
  if (at !== tokens.length) throw Error('Unexpected expression suffix')
  return result
}

function evaluate(node, values, previous) {
  if ('literal' in node) {
    const choices = [
      ...(values.get(node.literal) || []),
      ...previous
        .filter((p) => p.value === node.literal)
        .map((p) => ({ value: p.baseValue, dimension: p.dimension })),
    ]
    if (!choices?.length)
      throw Error(
        `Operand ${node.literal} is absent from the cited source and question`,
      )
    return choices
  }
  if ('reference' in node) {
    const prior = previous[node.reference]
    if (!prior) throw Error('A prior result is unavailable')
    return [{ value: prior.baseValue, dimension: prior.dimension }]
  }
  const left = evaluate(node.left, values, previous)
  if (node.operator === 'negate')
    return left.map((v) => ({ ...v, value: -v.value }))
  const right = evaluate(node.right, values, previous),
    result = []
  for (const a of left)
    for (const b of right) {
      let value, dimension
      if (['+', '-'].includes(node.operator)) {
        if (a.dimension !== b.dimension) continue
        value = node.operator === '+' ? a.value + b.value : a.value - b.value
        dimension = a.dimension
      } else if (node.operator === '*') {
        if (a.dimension !== 'scalar' && b.dimension !== 'scalar') continue
        value = a.value * b.value
        dimension = a.dimension === 'scalar' ? b.dimension : a.dimension
      } else {
        if (b.value === 0) continue
        if (b.dimension === 'scalar') {
          value = a.value / b.value
          dimension = a.dimension
        } else if (a.dimension === b.dimension) {
          value = a.value / b.value
          dimension = 'scalar'
        } else continue
      }
      if (Number.isFinite(value) && Math.abs(value) <= 1e12)
        result.push({ value, dimension })
      if (result.length > 128) throw Error('Operand units are ambiguous')
    }
  return result
}

export function verifyCalculations(proposals, sources, question) {
  const available = inputs(sources, question),
    calculations = [],
    issues = []
  for (const proposal of (proposals || []).slice(0, 4)) {
    try {
      const unit = normalizeMeasurements(proposal.unit || '').trim(),
        declared = unitTypes[unit]
      if (!declared) throw Error('Unsupported result unit')
      const results = evaluate(
        parse(proposal.expression),
        available,
        calculations,
      ).filter((v) => v.dimension === declared[0])
      const outcomes = [
        ...new Set(results.map((v) => rounded(v.value / declared[1]))),
      ]
      if (outcomes.length !== 1)
        throw Error(
          'The expression has inconsistent or ambiguous physical units',
        )
      const value = outcomes[0]
      if (
        proposal.value !== undefined &&
        Math.abs(proposal.value - value) > 1e-9
      )
        throw Error('The stated result differs from verified arithmetic')
      calculations.push({
        expression: proposal.expression,
        value,
        unit,
        baseValue: value * declared[1],
        dimension: declared[0],
      })
    } catch (error) {
      issues.push({ expression: proposal.expression, reason: error.message })
      break // Preserve r1/r2 positions; later expressions cannot skip a failed dependency.
    }
  }
  return { calculations, issues }
}

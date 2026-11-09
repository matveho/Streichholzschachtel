import { normalizeMeasurements, quantityUnits } from './indexer.mjs'

export const calculationUnits = {
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
const unitTypes = calculationUnits
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
  const add = (literal, value, dimension, unit = '', origin = 'constant') => {
    const key = Number(literal)
    if (!choices.has(key)) choices.set(key, [])
    const list = choices.get(key)
    const existing = list.find(
        (v) => v.dimension === dimension && Math.abs(v.value - value) < 1e-12,
      )
    if (existing) existing.origins = [...new Set([...existing.origins,origin])]
    else list.push({ value, dimension, display: `${literal}${unit ? ' ' + unit : ''}`, origins:[origin],dependencies:[] })
  }
  add(0, 0, 'scalar')
  add(1, 1, 'scalar')
  for (const [text, isQuestion] of [
    [sources, false],
    [question, true],
  ]) {
    const origin=isQuestion?'question':'source'
    const normalized = normalizeMeasurements(text).replace(
      /(?<=\d),(?=\d{3}\b)/g,
      '',
    )
    const measured = []
    for (const m of normalized.matchAll(physical)) {
      const [dimension, factor] = unitTypes[m[2]]
      add(m[1], Number(m[1]) * factor, dimension, m[2], origin)
      measured.push([m.index, m.index + m[0].length])
    }
    if (isQuestion)
      for (const m of normalized.matchAll(
        new RegExp('\\b' + numeric + '\\b', 'g'),
      )) {
        if (!measured.some(([a, b]) => m.index >= a && m.index < b))
          add(m[0], Number(m[0]), 'scalar', '', origin)
      }
    for (const m of normalized.matchAll(
      new RegExp('(' + numeric + ')\\s*%', 'g'),
    )) {
      const p = Number(m[1])
      add(p, p, 'scalar', '', origin)
      add(p / 100, p / 100, 'scalar', '', origin)
      add(1 + p / 100, 1 + p / 100, 'scalar', '', origin)
      add(100, 100, 'scalar', '', origin)
    }
    for (const m of normalized.matchAll(
      new RegExp('(' + numeric + ')\\s+times\\b', 'gi'),
    ))
      add(m[1], Number(m[1]), 'scalar', '', origin)
    if (/\bhalf(?:way)?\b/i.test(normalized)) {
      add(2, 2, 'scalar', '', origin)
      add(0.5, 0.5, 'scalar', '', origin)
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
      ...previous.flatMap((p,index)=>p.value===node.literal ? [{ value:p.baseValue,dimension:p.dimension,display:`${p.value}${p.unit?' '+p.unit:''}`,origins:p.inputOrigins || [],dependencies:[index] }] : []),
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
    return [{ value: prior.baseValue, dimension: prior.dimension, display: `${prior.value}${prior.unit ? ' '+prior.unit : ''}`, origins:prior.inputOrigins || [],dependencies:[node.reference] }]
  }
  const left = evaluate(node.left, values, previous)
  if (node.operator === 'negate')
    return left.map((v) => ({ ...v, value: -v.value, display: `(-${v.display})` }))
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
        result.push({ value, dimension, display: `(${a.display} ${node.operator} ${b.display})`, origins:[...new Set([...a.origins,...b.origins])],dependencies:[...new Set([...a.dependencies,...b.dependencies])] })
      if (result.length > 128) throw Error('Operand units are ambiguous')
    }
  return result
}

export function calculationChain(ids, calculations) {
 const selected=[...new Set(ids || [])]
 if(!selected.length || selected.some(id=>!/^c[1-4]$/.test(id)||Number(id.slice(1))>calculations.length)) return null
 const required=new Set()
 const visit=index=>{
  if(required.has(index))return
  required.add(index)
  if(Array.isArray(calculations[index].dependencies)) {
   for(const dependency of calculations[index].dependencies) {
    if(!Number.isInteger(dependency)||dependency<0||dependency>=index)throw Error('Invalid verified dependency')
    visit(dependency)
   }
   return
  }
  const expression=calculations[index].expression
  for(const match of expression.matchAll(/\br([1-4])\b/g)) {
   const dependency=Number(match[1])-1
   if(dependency>=index) throw Error('Calculation dependency must precede its use')
   visit(dependency)
  }
  // The evaluator also supports a prior result written as a numeric literal.
  for(const match of expression.replace(/\br[1-4]\b/g,'').matchAll(new RegExp(numeric,'g'))) {
   const value=Number(match[0])
   if(value===0||value===1)continue
   for(let prior=0;prior<index;prior++)if(calculations[prior].value===value)visit(prior)
  }
 }
 try{for(const id of selected)visit(Number(id.slice(1))-1)}catch{return null}
 const indices=[...required].sort((a,b)=>a-b)
 const positions=new Map(indices.map((original,local)=>[original,local]))
 return {indices,calculations:indices.map(index=>({...calculations[index],expression:calculations[index].expression.replace(/\br([1-4])\b/g,(_,id)=>`r${positions.get(Number(id)-1)+1}`)}))}
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
      const expressionTree=parse(proposal.expression)
      const results = evaluate(
        expressionTree,
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
        displayExpression: results.find(result=>rounded(result.value/declared[1])===value).display,
        inputOrigins: results.find(result=>rounded(result.value/declared[1])===value).origins,
        operation: expressionTree.operator || 'literal',
        dependencies:results.find(result=>rounded(result.value/declared[1])===value).dependencies,
      })
    } catch (error) {
      issues.push({ expression: proposal.expression, reason: error.message })
      break // Preserve r1/r2 positions; later expressions cannot skip a failed dependency.
    }
  }
  return { calculations, issues }
}

// A compound calculation can contain an independently useful intermediate
// without a separate model-selected calculation ID. Only expose actual AST
// subexpressions of an already checked calculation, never search arbitrary
// arithmetic for a number asserted in generated prose.
export function completeCalculationIntermediates(text, previous, sources, question) {
  const initial=verifyCalculations(previous,sources,question)
  if(initial.issues.length)return []
  let verified=initial.calculations
  if(verified.length>=4)return verified
  const wanted=quantityUnits(text).map(quantity=>{
    const [value,unit]=quantity.split(':')
    return {value:Number(value),unit}
  }).filter(quantity=>unitTypes[quantity.unit]&&unitTypes[quantity.unit][0]!=='scalar')
  const expressions=new Set()
  const print=node=>node.literal!==undefined?String(node.literal):node.reference!==undefined?`r${node.reference+1}`:node.operator==='negate'?`(-${print(node.left)})`:`(${print(node.left)} ${node.operator} ${print(node.right)})`
  const visit=(node,root=false)=>{
    if(node.left)visit(node.left)
    if(node.right)visit(node.right)
    if(!root&&node.operator)expressions.add(print(node))
  }
  for(const calculation of verified)visit(parse(calculation.expression),true)
  for(const expression of expressions)for(const requested of wanted){
    if(verified.length>=4)return verified
    if(verified.some(step=>step.unit===requested.unit&&Math.abs(step.value-requested.value)<1e-9))continue
    const checked=verifyCalculations([...verified,{expression,unit:requested.unit,value:requested.value}],sources,question)
    if(!checked.issues.length)verified=checked.calculations
  }
  return verified
}

// Verify stated equivalent quantities from known physical measurements. This
// converts units, not engineering roles, and cannot supply a missing magnitude.
export function completeUnitConversions(text, previous, sources, question) {
 const measures=value=>[...normalizeMeasurements(value).matchAll(physical)].map(match=>({value:Number(match[1]),unit:match[2]}))
 const known=[...measures(sources),...measures(question),...previous.map(step=>({value:step.value,unit:step.unit}))]
 const same=(a,b)=>Math.abs(a-b)<=1e-12*Math.max(Math.abs(a),Math.abs(b),Number.MIN_VALUE)
 let verified=previous
 for(const stated of measures(text)) {
  if(verified.length>=4) break
  if(known.some(input=>input.unit===stated.unit&&same(input.value,stated.value))) continue
  const [dimension,factor]=unitTypes[stated.unit]
  const input=known.find(input=>unitTypes[input.unit]?.[0]===dimension&&same(input.value*unitTypes[input.unit][1],stated.value*factor))
  if(!input) continue
  const checked=verifyCalculations([...verified,{expression:String(input.value),unit:stated.unit,value:stated.value}],sources,question)
  if(checked.issues.length) continue
  verified=checked.calculations
  known.push(stated)
 }
 return verified
}

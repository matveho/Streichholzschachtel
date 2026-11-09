import { normalizeMeasurements } from './indexer.mjs'

const number = '(?<![A-Za-z0-9_.−-])(\\d+(?:\\.\\d+)?)'
const length = '(mm|cm|km|m)(?![a-z\\d/])'
const scale = { mm: .001, cm: .01, m: 1, km: 1000 }
const entity = /\b(?:(storm|sanitary|foundation(?: drain)?)\s+(?:sewer\s+)?)?(main|service)(?:s|\s+(?:pipe|connection)s?)?\b/gi
const request = /\b(?:meets?|satisfies|complies|compared|against|below|above|exceeds?|minimum|maximum|required|criterion)\b/i

// Record explicit supplied pipe measurements. No datum, missing diameter or
// project suitability is inferred from a value stated for another asset.
export function pipeProjectMeasurements(text) {
  const normalized = normalizeMeasurements(text)
  const mentions = [...normalized.matchAll(entity)]
  const measurements = []
  for (let i = 0; i < mentions.length; i++) {
    const mention = mentions[i]
    const role = mention[2].toLowerCase()
    const system = mention[1]?.toLowerCase().replace('foundation drain', 'foundation') || null
    const start = mention.index
    const end = start + mention[0].length
    const boundary = mentions[i + 1]?.index ?? normalized.length
    const before = normalized.slice(Math.max(0, start - 80), start)
    const after = normalized.slice(end, boundary).split(/[;!?]|\.(?=\s|$)/)[0]
    const local = after.split(request)[0]
    const add = (property, value, unit, suppliedText) => {
      const record = { role, system, property, value: Number(value), unit,
        baseValue: Number((Number(value) * scale[unit]).toPrecision(12)), suppliedText }
      if (property !== 'diameter') {
        const invert = /\binvert\b/i.test(local), obvert = /\bobvert\b/i.test(local)
        record.datum = invert && !obvert ? 'invert-depth' : obvert && !invert ? 'cover-to-obvert' : 'not-stated'
      }
      if (!measurements.some(previous => previous.role === role && previous.system === system && previous.property === property && previous.baseValue === record.baseValue))
        measurements.push(record)
    }
    const diameter = before.match(new RegExp(number + '\\s*' + length + '\\s*(?:diameter\\s+)?$','i'))
    if (diameter && !/\b(?:cover|depth)\s+(?:of\s+)?$/i.test(before.slice(0,diameter.index)))
      add('diameter', diameter[1], diameter[2].toLowerCase(), diameter[0] + mention[0])
    for (const match of local.matchAll(new RegExp(number + '\\s*' + length + '\\s*(?:of\\s+)?(cover|depth|diameter)\\b','gi')))
      add(match[3].toLowerCase(),match[1],match[2].toLowerCase(),mention[0] + local.slice(0,match.index+match[0].length))
    for (const match of local.matchAll(new RegExp('\\b(cover|depth|diameter)\\s+(?:(?:of|is|was|at)\\s+)?' + number + '\\s*' + length,'gi')))
      add(match[1].toLowerCase(),match[2],match[3].toLowerCase(),mention[0] + local.slice(0,match.index+match[0].length))
  }
  return measurements
}

// Only veto a project assertion when a numeric premise was reassigned between
// explicit pipe roles. A source criterion alone is not a project measurement.
export function pipeProjectMeasurementIssue(claim, question, projectEvidence = '') {
  if (!/\b(?:project|proposed|supplied|assumed|given|existing)\b/i.test(claim)) return null
  const supplied = pipeProjectMeasurements(question + '; ' + projectEvidence)
  const asserted = pipeProjectMeasurements(claim)
  for (const measurement of asserted) {
    const sameSystem = record => !record.system || !measurement.system || record.system === measurement.system
    const known = supplied.filter(record => sameSystem(record) && record.role === measurement.role && record.property === measurement.property)
    if (known.some(record => Math.abs(record.baseValue - measurement.baseValue) < 1e-9)) continue
    const foreign = supplied.find(record => sameSystem(record) && record.role !== measurement.role && record.property === measurement.property && Math.abs(record.baseValue - measurement.baseValue) < 1e-9)
    if (foreign)
      return `The supplied ${foreign.role} ${measurement.property} was reassigned to the ${measurement.role}. Keep each project measurement with its stated asset; do not infer a missing ${measurement.role} ${measurement.property}.`
    if (known.length)
      return `The stated project ${measurement.role} ${measurement.property} does not match its supplied measurement. Preserve the supplied value and distinguish it from a source criterion.`
  }
  return null
}

export function pipeMeasurementSearches(question, planned) {
  const inputs = pipeProjectMeasurements(question)
  const covers = inputs.filter(record=>record.property==='cover'||record.property==='depth')
  if (!['main','service'].every(role=>covers.some(record=>record.role===role))) return planned
  const scopes = [...new Map(covers.map(record=>[record.system+'/'+record.role,{role:record.role,system:record.system}])).values()]
  if (scopes.length !== 2 || scopes.some(scope=>!scope.system)) return planned
  const coverTopic = topic=>/\b(?:cover|burial|depth|insulation|frost)\b/i.test(topic.heading+' '+topic.query) && /\b(?:sewer|pipe|main|service)\b/i.test(topic.heading+' '+topic.query)
  const additional = planned.filter(topic=>!coverTopic(topic))
  const sections = [...new Set(planned.filter(coverTopic).flatMap(topic=>topic.sections||[]))].slice(0,3)
  if (additional.length + scopes.length > 5) return planned
  return [...scopes.map(scope=>({
    heading: `${scope.system[0].toUpperCase()+scope.system.slice(1)} ${scope.role} cover assessment`,
    query: `${scope.system} ${scope.role} minimum cover depth requirements`,
    sections,
    assetScope:scope,
  })),...additional]
}

export function attachProjectMeasurements(result, question) {
  const measurements = pipeProjectMeasurements(question)
  if (!result.references?.length || new Set(measurements.map(record=>record.role)).size < 2) return result
  const displayed = measurements.slice(0,12)
  return {
    ...result,
    projectInputs: { kind:'pipe_measurements', origin:'question', verifiedAgainstDocuments:false, measurements:displayed },
    report: [...result.report, {
      heading:'Supplied project measurements',
      sentences:[
        {text:'Query inputs are review assumptions. Verify them against project records and confirm measurement datums before applying source criteria.'},
        ...displayed.map(record=>({text:`${[record.system,record.role].filter(Boolean).join(' ')} · ${record.property}: ${record.value} ${record.unit}${record.datum==='not-stated'?'; measurement datum not stated in query':record.datum==='invert-depth'?'; depth to invert':record.datum==='cover-to-obvert'?'; cover to pipe obvert':''}.`})),
      ],
    }],
  }
}

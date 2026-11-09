import { normalizeMeasurements } from './indexer.mjs'

const number = '(?<![A-Za-z0-9_.−-])(\\d+(?:\\.\\d+)?)'
const length = '(mm|cm|km|m)(?![a-z\\d/])'
const scale = { mm: .001, cm: .01, m: 1, km: 1000 }
const entity = /\b(?:(storm|sanitary|foundation(?: drain)?)\s+(?:sewer\s+)?)?(main|service)(?:s|\s+(?:pipe|connection)s?)?\b/gi
const request = /\b(?:meets?|satisfies|complies|compared|against|below|above|exceeds?|minimum|maximum|required|criterion)\b/i
const datumCondition = /\b(?:if|assuming|on the assumption that)\b[^,.;!?]{0,90}\b(?:cover|depth|measurement|datum)\b[^,.;!?]{0,60}\b(?:measured\s+to|to)\s+(?:the\s+)?(?:pipe\s+)?(?:obvert|invert)\b/i

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
        const unknown=local.search(/\black(?:s|ing)?\s+(?:a\s+)?(?:stated|known|confirmed)\s+datum\b|\bdatum\s+(?:is\s+)?(?:unknown|unspecified|not\s+(?:stated|known|confirmed|provided))\b/i)
        const explicit=local.search(/\b(?:obvert|invert)\b/i)
        record.datum = unknown>=0&&(explicit<0||unknown<explicit) ? 'not-stated' : invert && !obvert ? 'invert-depth' : obvert && !invert ? 'cover-to-obvert' : 'not-stated'
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
export function pipeProjectMeasurementIssue(claim, question, projectEvidence = '', focusedAsset) {
  if (!/\b(?:project|proposed|supplied|assumed|given|existing)\b/i.test(claim)) return null
  const supplied = pipeProjectMeasurements(question + '; ' + projectEvidence)
  if(focusedAsset){
    const unknown=supplied.filter(record=>record.role===focusedAsset.role&&(!record.system||record.system===focusedAsset.system)&&record.property!=='diameter'&&record.datum==='not-stated')
    const unsupported=claim.split(/[;!?]|\.(?=\s|$)/).some(sentence=>{
      if(datumCondition.test(sentence)||!/\b(?:project|proposed|supplied|assumed|given|existing)\b/i.test(sentence))return false
      const quantities=[...normalizeMeasurements(sentence).matchAll(new RegExp(number+'\\s*'+length,'gi'))]
      if(!unknown.some(record=>quantities.some(match=>Math.abs(Number(match[1])*scale[match[2].toLowerCase()]-record.baseValue)<1e-9)))return false
      const judgment=sentence.search(/\b(?:meets?|fails?|complies|compliant|satisfies)\b|\b(?:requires?|must|mandates?)\b[^;!?]{0,65}\binsulat/i)
      const uncertain=sentence.search(/\b(?:cannot|can't|does not|do not|not yet)\s+(?:be\s+)?(?:confirm|establish|determine|assess|verify)\b/i)
      return judgment>=0&&!(uncertain>=0&&uncertain<judgment)
    })
    if(unsupported)return 'The focused project measurement has no stated datum. Its numeric value cannot establish compliance or prove that an insulation condition is met. Keep the rule conditional and confirm the measurement datum.'
  }
  const asserted = pipeProjectMeasurements(claim)
  for (const measurement of asserted) {
    const sameSystem = record => !record.system || !measurement.system || record.system === measurement.system
    const known = supplied.filter(record => sameSystem(record) && record.role === measurement.role && record.property === measurement.property)
    const matching=known.filter(record=>Math.abs(record.baseValue-measurement.baseValue)<1e-9)
    const dimensionalKnown=matching.length?matching:supplied.filter(record=>sameSystem(record)&&record.role===measurement.role&&record.property!=='diameter'&&measurement.property!=='diameter'&&Math.abs(record.baseValue-measurement.baseValue)<1e-9)
    if(dimensionalKnown.length){
      const conditional=datumCondition.test(claim)
      if(measurement.datum&&measurement.datum!=='not-stated'){
        const datums=new Set(dimensionalKnown.map(record=>record.datum).filter(datum=>datum&&datum!=='not-stated'))
        if((datums.size&&!datums.has(measurement.datum))||(!datums.size&&!conditional))
          return 'The supplied project measurement does not establish this obvert/invert datum. Preserve an unstated datum as unknown; quote the reference criterion separately and request datum confirmation before comparing compliance.'
      }
      if(measurement.property!=='diameter'&&!conditional&&dimensionalKnown.every(record=>record.datum==='not-stated')){
        const judgment=claim.split(/[;!?]|\.(?=\s|$)/).some(sentence=>{
          if(!/\b(?:project|proposed|supplied|assumed|given|existing)\b/i.test(sentence))return false
          if(!pipeProjectMeasurements(sentence).some(record=>record.role===measurement.role&&record.property===measurement.property&&Math.abs(record.baseValue-measurement.baseValue)<1e-9))return false
          const verdict=sentence.search(/\b(?:meets?|fails?|complies|compliant|satisfies)\b|\b(?:requires?|must)\b[^;!?]{0,65}\binsulat/i)
          const unknown=sentence.search(/\b(?:cannot|can't|does not|do not|not yet)\s+(?:be\s+)?(?:confirm|establish|determine|assess|verify)\b/i)
          return verdict>=0&&!(unknown>=0&&unknown<verdict)
        })
        if(judgment)return 'The supplied cover/depth datum is unstated, so these figures cannot establish a project compliance result or an insulation decision. Report the source requirement and numerical comparison separately; confirm the measurement datum first.'
      }
      if(matching.length)continue
    }
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

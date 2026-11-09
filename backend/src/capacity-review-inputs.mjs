import {normalizeMeasurements} from './indexer.mjs'

// Preserve the rehearsed wording alongside the role-bound input parser below.
const number = '(\\d+(?:\\.\\d+)?|\\.\\d+)'
const flow = number + '\\s*(m3/s|L/s)'
const template = new RegExp(
 '^A subdivision has expanded from\\s+' + number + '\\s*ha\\s+to\\s+' + number + '\\s*ha\\. ' +
 'The revised five-year runoff estimate is\\s+' + flow + ', but the existing sewer design carries\\s+' + flow +
 '\\. Can we retain it and size the new detention pond with the Rational Method\\?$', 'i')

function templateInputs(question) {
 const match=normalizeMeasurements(question).replace(/\s+/g,' ').trim().match(template)
 if(!match)return null
 const [,previousArea,area,runoff,runoffUnit,capacity,capacityUnit]=match
 const values=[previousArea,area,runoff,capacity].map(Number)
 if(values.some(value=>!Number.isFinite(value)||value<=0)||values[1]<=values[0])return null
 return {previousArea:values[0],area:values[1],runoff:Number(runoff),runoffLiteral:runoff,
  runoffUnit:runoffUnit.toLowerCase()==='l/s'?'L/s':'m3/s',capacity:Number(capacity),capacityLiteral:capacity,
  capacityUnit:capacityUnit.toLowerCase()==='l/s'?'L/s':'m3/s'}
}

const unsupported = /\b(?:sanitary|wastewater|combined|pumped|pressuri[sz]ed|approve|approved|approval|compliant|compliance|certify|guarantee|safe|unless|assuming|except|not|never|if|also|additionally|geotechnical|structural|bridge)\b/i
const naturalNumber='([+-]?(?:\\d+(?:\\.\\d+)?|\\.\\d+))'
const naturalFlow=naturalNumber+'\\s*(m3/s|L/s)\\b'
const runoffPattern=new RegExp('(?:five|5)[ -]year\\s+(?:peak\\s+)?runoff(?:\\s+(?:estimate|flow))?\\s*(?:is|of|:|=)?\\s*'+naturalFlow,'gi')
const capacityPattern=new RegExp('existing\\s+(?:storm\\s+)?(?:sewer|conveyance)(?:\\s+(?:design|system))?\\s*(?:capacity|flow)?\\s*(?:is|of|carries|:|=)?\\s*'+naturalFlow,'gi')
const areaPatterns=[
 new RegExp('(?:catchment|drainage area|contributing area|site area|subdivision)(?:\\s+area)?\\s*(?:is|of|:|=|covers)?\\s*'+naturalNumber+'\\s*ha\\b','gi'),
 new RegExp(naturalNumber+'\\s*ha\\s+(?:catchment|subdivision|drainage area)\\b','gi'),
]
const field=(key,label,unit,reason)=>({key,label,unit,reason})

// Bind quantities to engineering roles, never to their order in the question.
// This workflow checks conveyance capacity and pond method, not other design
// conditions or an approval request. Unknown inputs are explicitly requested.
export function capacityReviewRequest(question) {
 const text=normalizeMeasurements(question).replace(/\s+/g,' ').trim()
 const matched=!unsupported.test(text)&&/\b(?:sewer|conveyance)\b/i.test(text)&&/\b(?:detention pond|stormwater storage)\b/i.test(text)&&/\brational method\b/i.test(text)&&/\b(?:review|assess|check|retain|reuse|keep|capacity)\b/i.test(text)&&(/\d\s*(?:ha|m3\/s|L\/s)\b/i.test(text)||/\b(?:review|assess|check|retain|reuse|keep)\b/i.test(text))
 if(!matched)return {matched:false,inputs:null,fields:[]}
 const canonical=templateInputs(question)
 if(canonical)return {matched:true,inputs:canonical,fields:[]}
 const fields=[]
 const expansion=text.match(new RegExp('(?:expanded|increased|enlarged)\\s+from\\s+'+naturalNumber+'\\s*ha\\s+to\\s+'+naturalNumber+'\\s*ha','i'))
 const areaText=expansion?text.replace(expansion[0],''):text
 let areas=[...(expansion?[Number(expansion[2])]:[]),...areaPatterns.flatMap(pattern=>[...areaText.matchAll(pattern)].map(match=>Number(match[1])))]
 areas=[...new Set(areas)]
 const area=areas[0]
 if(areas.length!==1||!Number.isFinite(area)||area<=0||expansion&&(Number(expansion[1])<=0||area<=Number(expansion[1])))fields.push(field('catchmentArea','Contributing catchment area','ha','State one current catchment area; distinguish the previous area if the catchment expanded.'))
 function flowInput(pattern,key,label){
  const matches=[...text.matchAll(pattern)]
  const unique=new Set(matches.map(match=>Number(match[1])*(match[2].toLowerCase()==='l/s'?.001:1)))
  if(unique.size!==1||matches.some(match=>!Number.isFinite(Number(match[1]))||Number(match[1])<=0)){
   fields.push(field(key,label,'m³/s or L/s',matches.length?'Resolve conflicting or invalid values for this input.':'State the flow with its unit and identify this input explicitly.'))
   return null
  }
  const match=matches[0]
  return {value:Number(match[1]),literal:match[1],unit:match[2].toLowerCase()==='l/s'?'L/s':'m3/s'}
 }
 const runoff=flowInput(runoffPattern,'fiveYearRunoff','Five-year runoff estimate')
 const capacity=flowInput(capacityPattern,'existingSewerCapacity','Existing sewer conveyance capacity')
 return {matched:true,fields,inputs:fields.length?null:{...(expansion?{previousArea:Number(expansion[1])}:{}),area,
  runoff:runoff.value,runoffLiteral:runoff.literal,runoffUnit:runoff.unit,
  capacity:capacity.value,capacityLiteral:capacity.literal,capacityUnit:capacity.unit}}
}

export function capacityReviewInputs(question) {
 return capacityReviewRequest(question).inputs
}

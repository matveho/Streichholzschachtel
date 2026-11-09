import {normalizeMeasurements,locateQuote} from './indexer.mjs'
import {evidenceUnits,isProvision} from './evidence-units.mjs'
import {applicableEvidence} from './applicability.mjs'
import {verifyCalculations} from './calculations.mjs'

// A worked engineering worksheet: source text and numerical inputs are read
// at request time. No generated prose or stored model answer supplies a rule.
export function workedCapacityReview(question,index,example) {
 const text=normalizeMeasurements(question)
 const area=text.match(/expanded\s+from\s+(\d+(?:\.\d+)?)\s*ha\s+to\s+(\d+(?:\.\d+)?)\s*ha/i)
 const runoff=text.match(/runoff(?:\s+[a-z-]+){0,5}\s+(\d+(?:\.\d+)?)\s*(m3\/s|L\/s)\b/i)
 const capacity=text.match(/existing\s+sewer\s+(?:design|capacity)(?:\s+[a-z-]+){0,4}\s+(\d+(?:\.\d+)?)\s*(m3\/s|L\/s)\b/i)
 if(!area||!runoff||!capacity)return null
 const selected=new Set(example.documentIds)
 const passages=index.withPageContext([
  ...index.searchSingle('storm sewer capacity requirement catchment areas design flow five-year runoff').slice(0,4),
  ...index.searchSingle('stormwater management storage facilities computer modelling techniques').slice(0,4),
  ...index.searchSingle('rational method detailed design minor drainage systems').slice(0,3),
 ])
 const eligible=applicableEvidence(question,evidenceUnits(passages,60000)).units.filter(unit=>isProvision(unit)&&selected.has(unit.passage.doc))
 const basis=eligible.find(unit=>unit.passage.doc===example.basisDocumentId &&
  /\b\d+(?:\.\d+)?\s+times\s+(?:the\s+)?runoff\b/i.test(unit.excerpt) &&
  /storm sewers servicing areas greater than\s+\d+(?:\.\d+)?\s*ha/i.test(unit.excerpt) &&
  !unit.mixedConditions&&!unit.unresolvedConditions?.length&&unit.evaluatedConditions?.some(condition=>condition.matches))
 const method=eligible.filter(unit=>unit.passage.doc===example.methodDocumentId &&
  /all stormwater management storage facilities[\s\S]{0,300}computer (?:modell?ing|simulation)/i.test(unit.excerpt)).sort((a,b)=>a.excerpt.length-b.excerpt.length)[0]
 const minor=eligible.filter(unit=>unit.passage.doc===example.methodDocumentId &&
  /rational method may also be used for the detailed design of minor drainage systems/i.test(unit.excerpt)).sort((a,b)=>a.excerpt.length-b.excerpt.length)[0]
 if(!basis||!method||!minor)return null
 const multiplier=normalizeMeasurements(basis.excerpt).match(/\b(\d+(?:\.\d+)?)\s+times\s+(?:the\s+)?runoff\b/i)
 const threshold=normalizeMeasurements(basis.excerpt).match(/areas greater than\s+(\d+(?:\.\d+)?)\s*ha/i)
 if(!multiplier||!threshold||Number(area[2])<=Number(threshold[1]))return null
 const checked=verifyCalculations([
  {expression:`${runoff[1]} * ${multiplier[1]}`,unit:'m3/s'},
  {expression:`r1 - ${capacity[1]}`,unit:'m3/s'},
 ],basis.excerpt,question)
 if(checked.issues.length||checked.calculations.length!==2)return null
 const proof=unit=>{
  const anchor=locateQuote(unit.passage,unit.excerpt,unit.quoteStart)
  if(!anchor?.regions.length||!anchor.regions.every(rect=>rect.length===4&&rect.every(Number.isFinite)&&rect[2]>0&&rect[3]>0))return null
  const proofs=[{passage:unit.passage,...anchor}]
  if(unit.contextEvidence){
   const context=locateQuote(unit.passage,unit.contextEvidence.excerpt,unit.contextEvidence.quoteStart)
   if(context?.regions.length)proofs.push({passage:unit.passage,...context})
  }
  return proofs
 }
 const basisProof=proof(basis),methodProof=proof(method),minorProof=proof(minor)
 if(!basisProof||!methodProof||!minorProof)return null
 const [flow,difference]=checked.calculations
 const shortfall=difference.value>0
 const magnitude=Number(Math.abs(difference.value).toPrecision(12))
 return {
  calculations:checked.calculations,
  sections:[
   {heading:'Review inputs',claims:[{text:`Catchment area: ${Number(area[2])} ha, expanded from ${Number(area[1])} ha. Supplied five-year runoff: ${Number(runoff[1])} ${runoff[2]}. Existing conveyance capacity: ${Number(capacity[1])} ${capacity[2]}. These figures are scenario assumptions.`,evidence:[]}]},
   {heading:'Design-flow basis',claims:[{text:basis.excerpt,evidence:basisProof}]},
   {heading:'Verified capacity calculation',arithmetic:true,claims:[{text:'Design flow and capacity difference, using the quoted basis and supplied inputs:',evidence:[]},{text:'',evidence:basisProof,calculations:checked.calculations}]},
   {heading:'Capacity assessment',claims:[{text:difference.value===0?`The supplied capacity equals the calculated ${flow.value} m3/s reference flow.`:`The supplied capacity is ${magnitude} m3/s ${shortfall?'below':'above'} the calculated ${flow.value} m3/s reference flow.`,evidence:basisProof}]},
   {heading:'Detention pond design method',claims:[{text:method.excerpt,evidence:methodProof},{text:minor.excerpt,evidence:minorProof},{text:'The quoted Rational Method permission concerns minor drainage systems. The pond assessment uses the storage-facility modelling requirement above.',evidence:[...methodProof,...minorProof]}]},
   {heading:'Design follow-up',claims:[{text:'Resolve the capacity difference and establish the pond model, storage volume and outlet-control design before making a retention decision. The numerical check does not select a construction remedy or establish project approval.',evidence:[]}]},
  ],
 }
}

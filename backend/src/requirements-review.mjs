// A presentation of already-verified evidence, never a second inference pass.
// Do not extract new quantities or compliance verdicts from generated prose.
export function attachRequirementsReview(result) {
 const references=result.references||[]
 if(!references.length)return result
 const docs=Array.isArray(result.documents)?result.documents:Object.entries(result.documents||{}).map(([id,doc])=>({id,...doc}))
 const isProject=ref=>{const doc=docs.find(doc=>doc.id===ref.doc);return doc?.category!=='reference'&&(!!doc?.ownerProjectId||!!doc?.projectArtifact||['client','design','report','supporting'].includes(doc?.category))}
 const rows=[]
 const seen=new Set()
 if(result.reviewInputs?.kind==='storm_capacity'&&result.arithmeticReview?.calculations?.length===2){
  const [flow,difference]=result.arithmeticReview.calculations
  const inputs=result.reviewInputs
  rows.push({requirement:`Calculated reference flow: ${flow.value} m³/s`,projectValue:`Supplied conveyance capacity: ${inputs.existingSewerCapacity.value} ${inputs.existingSewerCapacity.unit}`,difference:`${Math.abs(difference.value)} m³/s ${difference.value>0?'shortfall':difference.value<0?'margin':'difference'}`,assessment:'Numerical check only; inputs are scenario assumptions and applicability requires review.',refs:flow.sourceReferenceIds||[]})
 }
 for(const block of result.report||[]){
  if(/^(Review inputs|Supplied project measurements|Verified arithmetic|Verified.*calculation|Capacity assessment|Design follow-up)/i.test(block.heading||''))continue
  if(result.reviewInputs?.kind==='storm_capacity'&&block.heading==='Design-flow basis')continue
  const refs=[...new Set(block.sentences.flatMap(sentence=>sentence.refs||[]))].map(id=>references.find(ref=>ref.id===id)).filter(Boolean)
  if(!refs.length)continue
  const source=refs.filter(ref=>!isProject(ref)),project=refs.filter(isProject)
  if(!source.length)continue
  const key=refs.map(ref=>ref.id).sort().join(',')
  if(seen.has(key))continue
  seen.add(key)
  const differences=(result.calculationChecks||result.arithmeticReview?.calculations||[]).filter(step=>step.operation==='-' && step.sourceReferenceIds?.length && step.sourceReferenceIds.every(id=>refs.some(ref=>ref.id===id)))
  const text=block.sentences.map(sentence=>sentence.text).filter(Boolean).join(' ')
  rows.push({requirement:source.map(ref=>ref.excerpt).join('\n\n'),projectValue:project.length?project.map(ref=>ref.excerpt).join('\n\n'):'Missing evidence: no paired project value established for this check.',difference:differences.length?differences.map(step=>`${step.displayExpression} = ${step.value} ${step.unit} (verified arithmetic)`).join('\n'):'Not established for this check.',assessment:text,refs:refs.map(ref=>ref.id),heading:block.heading})
 }
 return rows.length?{...result,requirementsReview:{rows}}:result
}

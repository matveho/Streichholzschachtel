import { basename } from 'node:path'
import { locateQuote } from './indexer.mjs'
import { renderResult } from './answer.mjs'
import { problem } from './project-store.mjs'

export function preparedEvidence(issue, scope, projectId) {
  const evidence = issue.proofs
    .map(([filename, quote, page]) => {
      const document = scope.documents.find(
        (d) =>
          basename(d.filePath) === filename || d.filenames?.includes(filename),
      )
      if (!document)
        throw problem(
          503,
          `Prepared evidence is missing its associated source: ${filename}`,
        )
      // Explicit table proofs retain the entire extracted row, including its
      // real PDF regions; a numeric cell alone is never presented as a rule.
      if (page) {
        const compact = (s) => s.toLowerCase().replace(/[\s\u2013\u2014-]/g, '')
        const unit = scope.units.find(
          (u) =>
            u.doc === document.id &&
            u.page === page &&
            compact(u.text).includes(compact(quote)),
        )
        if (unit && unit.regions?.length)
          return {
            document,
            passage: {
              id: unit.id,
              doc: unit.doc,
              page: unit.page,
              section: unit.table || unit.heading || document.label,
              extraction: unit.extraction || 'text',
            },
            excerpt: unit.text,
            regions: unit.regions,
          }
      }
      for (const passage of scope.passages.filter(
        (p) => p.doc === document.id,
      )) {
        const anchor = locateQuote(passage, quote)
        if (anchor) return { passage, ...anchor, document }
      }
      throw problem(
        503,
        `Prepared evidence could not be anchored in ${filename}`,
      )
    })
    .sort(
      (a, b) =>
        Number(a.document.projectArtifact || false) -
          Number(b.document.projectArtifact || false) ||
        Number(a.document.category !== 'design') -
          Number(b.document.category !== 'design'),
    )
  const result = renderResult(
    [
      { heading: '', claims: [{ text: issue.explanation, evidence }] },
      ...evidence.map((e) => ({
        heading: e.document.label,
        claims: [{ text: e.excerpt, evidence: [e] }],
      })),
    ],
    scope,
    '',
    '',
    'prepared_comparison',
    [
      'Prepared comparison · source excerpts verified. Requires engineering review.',
    ],
  )
  return projectResult(result, projectId)
}
export function projectResult(result, projectId) {
  return {
    ...result,
    projectId,
    documents: result.documents.map((d) => ({
      ...d,
      file: `/v1/projects/${projectId}/documents/${d.id}/file`,
    })),
  }
}

// The model side comes from parsed IFC properties. Only the document side is
// represented as PDF evidence; require a real passage or extracted table row.
export function ifcFindingEvidence(issue, scope, projectId) {
  const evidence=[]
  for(const citation of issue.citations){
    if(!scope.documents.some(document=>document.id===citation.doc))return null
    let proof
    for(const passage of scope.passages.filter(p=>p.doc===citation.doc&&p.page===citation.page)){
      if(!passage.lines?.length||!passage.lines.every(line=>Array.isArray(line.rect)&&line.rect.length===4&&line.rect.every(Number.isFinite)&&line.rect[2]>line.rect[0]&&line.rect[3]>line.rect[1]))continue
      if(citation.tableEvidence){
        const table=citation.tableEvidence
        const clean=text=>String(text||'').replace(/[\u200b-\u200d\ufeff]/g,'').replace(/\s+/g,' ').trim()
        const cell=passage.lines.filter(line=>line.tableCell===table.cellId)
        if(!cell.length||cell.some(line=>clean(line.tableRowLabel)!==table.row||clean(line.tableColumn)!==table.column)||clean(cell.map(line=>line.text).join(' '))!==table.value)continue
        const row=table.cellId.split(':').slice(0,2).join(':')+':'
        const lines=passage.lines.filter(line=>line.tableCell?.startsWith(row))
        proof={passage,excerpt:`${table.row} — ${table.column}: ${table.value}. Table notes and exceptions require engineering review.`,regions:lines.map(line=>{const [left,top,right,bottom]=line.rect;return[left,top,right-left,bottom-top]})}
      }else{
        const anchor=locateQuote(passage,citation.excerpt)
        if(anchor)proof={passage,...anchor}
      }
      if(proof)break
    }
    if(!proof?.regions.length||!proof.regions.every(rect=>rect.length===4&&rect.every(Number.isFinite)&&rect[2]>0&&rect[3]>0))return null
    evidence.push(proof)
  }
  if(!evidence.length)return null
  const result=renderResult([
    {heading:'IFC property',claims:[{text:`${issue.model}, element ${issue.elementId} (${issue.globalId}): ${issue.property} = ${issue.modelValue??issue.actual} ${issue.modelUnit??issue.unit??''}. This value comes from the IFC property record.`,evidence:[]}]},
    {heading:'Document evidence',claims:evidence.map(proof=>({text:proof.excerpt,evidence:[proof]}))},
    {heading:'Potential discrepancy',claims:[{text:issue.explanation,evidence}]},
  ],scope,'','','ifc_comparison',['Property comparison from the current IFC model and project-scoped document evidence. Requires engineering review; this is not geometric clash detection or design approval.'])
  return {...projectResult(result,projectId),ifcFinding:{id:issue.id,model:issue.model,elementId:issue.elementId,globalId:issue.globalId,property:issue.property,actual:issue.actual,expected:issue.expected,unit:issue.unit,modelValue:issue.modelValue,modelUnit:issue.modelUnit}}
}

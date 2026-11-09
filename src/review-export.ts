import type { LiveResult, DocumentRecord } from './backend'
const escape=(value:unknown)=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!))
export function exportReview(result:LiveResult,question:string,projectName:string,projectId:string,scope:string[],documents:Record<string,DocumentRecord>) {
 const popup=window.open('', '_blank')
 if(!popup)return false
 popup.opener=null
 const e=escape
 const refs=(ids:string[]=[])=>ids.map(id=>`<a href="#source-${e(id)}">[${e(id)}]</a>`).join(' ')
 const rows=result.requirementsReview?.rows||[]
 const url=location.origin+location.pathname+'#project/'+encodeURIComponent(projectId)+'/query/'+encodeURIComponent(result.id)
 const page=`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>basis · Engineering review brief</title><style>
 body{font:14px/1.55 Arial,sans-serif;color:#172b36;max-width:1100px;margin:32px auto;padding:0 24px}h1{font-size:26px}h2{font-size:18px;border-bottom:1px solid #ccd3d7;padding-bottom:5px}h3{font-size:15px}a{color:#205776}table{width:100%;table-layout:fixed;border-collapse:collapse;font-size:11px}th:nth-child(1){width:25%}th:nth-child(2){width:18%}th:nth-child(3){width:14%}th:nth-child(4){width:35%}th:nth-child(5){width:8%}tr{break-inside:avoid}th,td{border:1px solid #ccd3d7;padding:8px;text-align:left;vertical-align:top;white-space:pre-line;overflow-wrap:break-word}th{background:#eef2f3}.meta,.note{color:#52616a;font-size:12px}.toolbar{display:flex;gap:12px;align-items:center;padding:16px;background:#eef2f3}button{padding:9px 16px;cursor:pointer}blockquote{margin:8px 0;padding-left:12px;border-left:2px solid #ccd3d7}section{margin:24px 0}.source{break-inside:avoid} @media print{body{margin:0;max-width:none;padding:0;font-size:10px;line-height:1.4}.toolbar{display:none}h2,h3{break-after:avoid}thead{display:table-header-group}a{color:inherit;text-decoration:none}table{font-size:9px}@page{size:A4;margin:16mm}}
 </style></head><body><div class="toolbar"><button id="print">Print / save PDF</button><span>Review the brief, then choose Save as PDF in the print dialog.</span></div>
 <header><p>basis / Engineering review brief</p><h1>${e(projectName||'Project review')}</h1><p>${e(question)}</p><p class="meta">Query ${e(result.id)} · Method: ${e(result.searchStats?.method||result.mode)}<br>Search recorded: ${e(result.searchStats?.recordedAt||'Not recorded for this saved result')}<br>Exported: ${e(new Date().toISOString())}<br><a href="${e(url)}">Open original review and highlighted sources</a></p></header>
 <p class="note">Engineering review aid. Supplied quantities remain assumptions unless verified against project records. Missing evidence, source applicability and final design approval require review.</p>
 <section><h2>Document scope</h2><ul>${scope.map(id=>`<li>${e(documents[id]?.label||id)}${documents[id]?.edition?' · '+e(documents[id].edition):''}</li>`).join('')}</ul></section>
 ${rows.length?`<section><h2>Requirements check</h2><table><thead><tr><th>Requirement</th><th>Project evidence</th><th>Difference</th><th>Assessment</th><th>Sources</th></tr></thead><tbody>${rows.map(row=>`<tr><td>${e(row.requirement)}</td><td>${e(row.projectValue)}</td><td>${e(row.difference)}</td><td>${e(row.assessment)}</td><td>${refs(row.refs)}</td></tr>`).join('')}</tbody></table></section>`:''}
 <section><h2>Findings, assumptions and calculations</h2>${result.report.map(block=>`<h3>${e(block.heading||'Finding')}</h3>${block.sentences.map(sentence=>`<p>${e(sentence.text)} ${refs(sentence.refs)}</p>`).join('')}`).join('')}</section>
 <section><h2>Source register</h2>${result.references.map(ref=>`<div class="source" id="source-${e(ref.id)}"><h3>[${e(ref.id)}] ${e(result.documents[ref.doc]?.label||ref.doc)} · PDF page ${e(ref.page)}</h3><p class="meta">${e(ref.label)} · ${e(ref.extraction||'text')} extraction</p><blockquote>${e(ref.excerpt)}</blockquote></div>`).join('')||'<p>No source evidence established.</p>'}</section>
 ${result.searchStats?`<section><h2>Search record</h2><p>${e(result.searchStats.scope.documents)} documents in scope; ${e(result.searchStats.index.passages)} indexed passages eligible for retrieval; ${e(result.searchStats.evidence.citations)} citations; ${e(result.searchStats.timing.processingMs)} ms backend processing.</p></section>`:''}
 </body></html>`
 popup.document.open();popup.document.write(page);popup.document.close()
 popup.document.getElementById('print')?.addEventListener('click',()=>popup.print())
 return true
}

import { Activity, ChevronDown } from 'lucide-react'
import type { LiveResult } from './backend'

const count=(value:number)=>value.toLocaleString('en-CA')
const quantity=(value:number,label:string)=>count(value)+' '+label+(value===1?'':'s')
const duration=(ms:number)=>ms<1000?Math.round(ms)+' ms':(ms/1000).toFixed(2)+' s'

export function SearchDiagnostics({result,onOpen}:{result:LiveResult;onOpen?:()=>void}) {
  const stats=result.searchStats
  const evidence=stats?.evidence || {
    documents:new Set(result.references.map(reference=>reference.doc)).size,
    pages:new Set(result.references.map(reference=>reference.doc+'/'+reference.page)).size,
    citations:result.references.length,
    highlightRegions:result.references.reduce((sum,reference)=>sum+(reference.regions?.length || 0),0),
  }
  return (
    <section className="search-diagnostics" aria-label="Search diagnostics">
      <details onToggle={event=>{if(event.currentTarget.open)onOpen?.()}}>
        <summary>
          <span><Activity size={14} /> Search diagnostics</span>
          <span className="diagnostics-overview">
            {stats && <span>{quantity(stats.scope.documents,'document')} in scope</span>}
            <span>{quantity(evidence.citations,'citation')}</span>
            <span>{quantity(evidence.pages,'source page')}</span>
            {stats && <span>{duration(stats.timing.processingMs)} processing</span>}
          </span>
          <ChevronDown size={14} className="diagnostics-chevron" />
        </summary>
        <dl>
          {stats && <>
            <dt>Selected scope</dt>
            <dd>{quantity(stats.scope.documents,'document')} · {quantity(stats.scope.pages,'PDF page')}</dd>
            <dt>Search index</dt>
            <dd>{quantity(stats.index.documents,'document')} · {quantity(stats.index.passages,'indexed passage')} · {quantity(stats.index.indexUnits,'text / table unit')}</dd>
            {stats.retrieval && <>
              <dt>Retained candidates</dt>
              <dd>{count(stats.retrieval.retainedCandidates)} {stats.retrieval.kind==='passages'?'passages':'ranked provision hits'}</dd>
            </>}
          </>}
          <dt>Cited evidence</dt>
          <dd>{quantity(evidence.documents,'document')} · {quantity(evidence.pages,'page')} · {quantity(evidence.citations,'citation')} · {quantity(evidence.highlightRegions,'PDF highlight region')}</dd>
          {stats ? <>
            <dt>OCR evidence</dt><dd>{quantity(stats.evidence.ocrPages,'cited page')}</dd>
            <dt>Execution method</dt><dd>{stats.method}{stats.model && <code>{stats.model}</code>}</dd>
            <dt>Server timing</dt>
            <dd>{duration(stats.timing.queueMs)} queued · {duration(stats.timing.processingMs)} processing · {duration(stats.timing.totalMs)} total</dd>
            <dt>Recorded run</dt>
            <dd><time dateTime={stats.recordedAt}>{new Date(stats.recordedAt).toLocaleString('en-CA',{timeZone:'UTC',timeZoneName:'short'})}</time></dd>
          </> : <><dt>Run timing</dt><dd>Not recorded for this saved report.</dd></>}
        </dl>
        {stats && <div className="diagnostics-stages">
          <span>Execution stages</span>
          <ol>{stats.timing.stages.map((stage,index)=><li key={index}><span>{stage.name}</span><span>{duration(stage.ms)}</span></li>)}</ol>
          <p>Recorded server execution. Network transfer and PDF rendering are excluded. Candidate counts describe retained retrieval results, not compliance checks.</p>
        </div>}
      </details>
    </section>
  )
}

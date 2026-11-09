export function scopeStatistics(corpus) {
  return {
    documents:corpus.documents.length,
    pages:corpus.documents.reduce((sum,document)=>sum+(document.pages || 0),0),
    passages:corpus.passages.length,
    indexUnits:(corpus.units || []).length,
  }
}

export function queryTimer(createdAt, clock=()=>performance.now(), wall=()=>Date.now()) {
  const started=clock(), queueMs=Math.max(0,wall()-Date.parse(createdAt))
  let last=started, label='Preparing scoped index'
  const stages=[]
  function stage(next) {
    const now=clock()
    stages.push({name:label,ms:Math.max(0,now-last)})
    last=now;label=next
  }
  return {stage,finish(){
    const ended=clock()
    stages.push({name:label,ms:Math.max(0,ended-last)})
    const processingMs=Math.max(0,ended-started)
    return {queueMs,processingMs,totalMs:queueMs+processingMs,
      stages:stages.map(stage=>({...stage,ms:Math.round(stage.ms*10)/10}))}
  }}
}

export function searchDiagnostics(corpus,result,trace,timing,runtime={}) {
  const references=result.references || []
  const pages=new Set(references.map(reference=>reference.doc+'/'+reference.page))
  return {version:1,scope:scopeStatistics(corpus),index:trace.index || scopeStatistics(corpus),
    ...(trace.retrieval?{retrieval:trace.retrieval}:{}),
    evidence:{documents:new Set(references.map(reference=>reference.doc)).size,pages:pages.size,
      citations:references.length,highlightRegions:references.reduce((sum,reference)=>sum+(reference.regions?.length || 0),0),
      ocrPages:new Set(references.filter(reference=>reference.extraction==='ocr').map(reference=>reference.doc+'/'+reference.page)).size},
    method:result.mode==='local_synthesis'?'Local model with evidence audit':result.mode==='verified_review'?'Source-verified calculation':result.mode==='version_answer'?'Document version lookup':trace.retrieval?'Indexed source retrieval':'Source and scope validation',
    ...(result.mode==='local_synthesis'?{model:runtime.model,provider:runtime.provider}:{}),
    timing,recordedAt:new Date().toISOString()}
}

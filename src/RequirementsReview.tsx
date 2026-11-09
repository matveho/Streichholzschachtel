import type { LiveResult } from './backend'
export function RequirementsReview({result,onSelect}:{result:LiveResult;onSelect:(refs:string[])=>void}) {
 const rows=result.requirementsReview?.rows
 if(!rows?.length)return null
 return <details className="requirements-review"><summary>Requirements check · {rows.length} {rows.length===1?'check':'checks'}</summary>
 <p>Evidence and verified calculations from this search. Missing project evidence remains unresolved; these checks do not establish design approval.</p>
 <div className="requirements-scroll"><table><thead><tr><th>Requirement / source criterion</th><th>Project value / evidence</th><th>Difference</th><th>Assessment</th><th>Sources</th></tr></thead>
 <tbody>{rows.map((row,index)=><tr key={index}><td>{row.heading&&<strong>{row.heading}<br/></strong>}{row.requirement}</td><td>{row.projectValue}</td><td>{row.difference}</td><td>{row.assessment}</td><td>{row.refs.map(id=><button key={id} onClick={()=>onSelect([id])} aria-label={`Inspect check source ${id}`}>[{id}]</button>)}</td></tr>)}</tbody></table></div></details>
}

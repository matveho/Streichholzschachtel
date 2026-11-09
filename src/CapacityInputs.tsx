import { useState } from 'react'
import type { LiveResult } from './backend'
export function CapacityInputs({result,disabled,onRun}:{result:LiveResult;disabled:boolean;onRun:(question:string)=>void}) {
 const inputs=result.reviewInputs!
 const [area,setArea]=useState(String(inputs.catchmentArea.value))
 const [runoff,setRunoff]=useState(String(inputs.fiveYearRunoff.value))
 const [capacity,setCapacity]=useState(String(inputs.existingSewerCapacity.value))
 const [runoffUnit,setRunoffUnit]=useState(inputs.fiveYearRunoff.unit)
 const [capacityUnit,setCapacityUnit]=useState(inputs.existingSewerCapacity.unit)
 const valid=[area,runoff,capacity].every(value=>value.trim()!==''&&Number.isFinite(Number(value))&&Number(value)>0)&&Number(area)>30
 return <details className="capacity-inputs"><summary>Revise capacity assumptions</summary>
 <p>Change this scenario and run a new source-checked review. Original results remain in query history. This worksheet applies only to catchments greater than 30 ha; it does not size the detention pond.</p>
 <form onSubmit={event=>{event.preventDefault();if(valid&&!disabled)onRun(`Review storm sewer capacity and detention pond sizing for a ${Number(area)} ha catchment. Five-year runoff: ${Number(runoff)} ${runoffUnit}. Existing sewer capacity: ${Number(capacity)} ${capacityUnit}. Is the Rational Method suitable?`)}}>
 <label>Catchment area (ha)<input type="number" step="any" min="30.000001" required value={area} onChange={event=>setArea(event.target.value)}/></label>
 <label>Five-year runoff<input type="number" step="any" min="0.000001" required value={runoff} onChange={event=>setRunoff(event.target.value)}/></label>
 <label>Runoff unit<select aria-label="Runoff unit" value={runoffUnit} onChange={event=>setRunoffUnit(event.target.value)}><option value="m3/s">m³/s</option><option value="L/s">L/s</option></select></label>
 <label>Existing sewer capacity<input type="number" step="any" min="0.000001" required value={capacity} onChange={event=>setCapacity(event.target.value)}/></label>
 <label>Capacity unit<select aria-label="Capacity unit" value={capacityUnit} onChange={event=>setCapacityUnit(event.target.value)}><option value="m3/s">m³/s</option><option value="L/s">L/s</option></select></label>
 {!valid&&<p role="status">Enter positive flows and a catchment area greater than 30 ha.</p>}
 <button type="submit" disabled={disabled||!valid}>Run revised capacity check</button>
 </form></details>
}

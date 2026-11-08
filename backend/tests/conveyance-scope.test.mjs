import test from 'node:test'
import assert from 'node:assert/strict'
import { applicableEvidence, incompatibleConveyanceEvidence } from '../src/applicability.mjs'
const unit={excerpt:'The maximum flow velocity shall be limited to 3.0 m/s.',heading:'1.3.1 Velocity Requirements',scope:['1.3 Sanitary Sewer Slope Requirements','1.3.1 Velocity Requirements']}
test('generic velocity clauses inherit the governing sewer system',()=>{
 assert.equal(incompatibleConveyanceEvidence('Review the storm sewer design.',unit),true)
 assert.equal(applicableEvidence('Review the storm sewer design.',[unit]).units.length,0)
 assert.equal(applicableEvidence('Review the sanitary sewer design.',[unit]).units.length,1)
})
test('mixed-system comparisons and explicit mixed clauses remain eligible',()=>{
 assert.equal(incompatibleConveyanceEvidence('Compare storm and sanitary sewer velocities.',unit),false)
 assert.equal(incompatibleConveyanceEvidence('Review storm sewers.',{...unit,excerpt:'Both storm and sanitary sewers require inspection.'}),false)
 assert.equal(incompatibleConveyanceEvidence('Review storm sewers.',{excerpt:'Check the pipe condition.'}),false)
})
test('explicit clause scope takes priority over generic or stale ancestors',()=>{
 assert.equal(incompatibleConveyanceEvidence('Review storm sewers.',{...unit,excerpt:'All storm sewers require hydraulic checks.'}),false)
})

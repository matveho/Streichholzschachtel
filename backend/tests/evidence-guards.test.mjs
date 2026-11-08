import test from 'node:test'
import assert from 'node:assert/strict'
import {evidenceInterpretationIssue as issue} from '../src/evidence-guards.mjs'
test('missing field-test counts do not establish exemptions',()=>{
 assert.match(issue('There is no mandatory field-test count.','A QA/QC test must be completed adjacent to a field test, at the same depth.'),/exemption/)
 assert.match(issue('The project does not require a servicing review.','Alternative layouts require review.'),/exemption/)
 assert.equal(issue('Testing is not required for the stated case.','Testing is not required for the stated case.'),null)
 assert.equal(issue('The provided excerpt does not establish the required number of tests.','A QA/QC test must be completed adjacent to a field test.'),null)
})
test('natural-language operators cannot repair flattened PDF equations',()=>{
 assert.match(issue('The formula is Q = CIA multiplied by 360.','The extracted formula is Q = CIA 360.'),/operators/)
 assert.match(issue('Divide ABC by 1000.','The extracted equation is X = ABC 1000.'),/operators/)
 assert.equal(issue('The formula is Q = CIA divided by 360.','The equation is Q = CIA / 360.'),null)
 assert.equal(issue('The required difference is 0.30 m.','The formula is Q = CIA 360.'),null)
})

test('exceptions cannot qualify an absolute minimum copied from another clause',()=>{
 const source='Design velocities of 0.90 to 1.0 m/s may be reduced with justification. Mean velocities below 0.6 m/s will not be allowed.'
 assert.match(issue('A minimum of 0.6 m/s applies unless justified by feasibility or cost.',source),/absolute limit/)
 assert.equal(issue('Mean velocities below 0.6 m/s are not allowed.',source),null)
 assert.equal(issue('Design velocities below 0.90 m/s need justification.',source),null)
})

test('project dwelling counts cannot replace a cited regulatory threshold',()=>{
 const source='Private storm sewer systems are required for multi-family developments of 3-plex and larger.'
 assert.match(issue('Private storm sewer systems are required for developments with four or more dwellings.',source),/threshold/)
 assert.equal(issue('Private storm sewer systems are required for developments of three units or more.',source),null)
 assert.equal(issue('A private storm sewer system is required for this four-dwelling project.',source),null)
 assert.match(issue('The rule applies to three or fewer dwellings.',source),/threshold/)
})

test('feasibility exceptions do not become ordinary project requirements',()=>{
 const source='When this is not practical, provide a minimum cover of 2.0 m for the storm service at the property line.'
 assert.match(issue('The storm service meets the minimum cover requirement of 2.0 m.',source),/feasibility exception/)
 assert.equal(issue('If the normal arrangement is not practical, the exception permits 2.0 m cover.',source),null)
 assert.match(issue('The project uses the 2.0 m exception.',source),/feasibility exception/)
 assert.equal(issue('The project uses the 2.0 m exception.',source,'The normal arrangement is not practical.'),null)
})

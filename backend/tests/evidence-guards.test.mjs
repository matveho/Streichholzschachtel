import test from 'node:test'
import assert from 'node:assert/strict'
import {evidenceInterpretationIssue as issue, recommendationLanguage} from '../src/evidence-guards.mjs'
test('an inline conditional service cannot become an unconditional installation duty',()=>{
 const source='Lots zoned for semi-detached or multi-family residential land use, where construction of side-by-side units are anticipated, one water, one sanitary and if required, one storm service line shall be provided for each unit directly off EPCOR sewer mains.'
 assert.match(issue('Conventional storm servicing requires one storm service line per unit directly off EPCOR sewer mains.',source),/conditional/)
 assert.match(issue('Storm service lines must be provided for each unit.',source),/conditional/)
 assert.equal(issue('If required, one storm service line shall be provided for each unit directly off EPCOR sewer mains.',source),null)
 assert.equal(issue('One storm service line shall be provided for each unit, where required.',source),null)
 assert.equal(issue('Confirm whether the storm service line is required for this project.',source),null)
 assert.equal(issue('One water service line shall be provided for each unit.',source),null)
 assert.match(issue('A water service line is provided if required and a storm service line must be installed for every unit.',source),/conditional/)
 assert.match(issue('If required, one storm service line shall be provided; every storm service line must be installed for each unit.',source),/conditional/)
})
test('matching numbers cannot equate pipe cover with invert-to-curb depth',()=>{
 const source='The depth of a storm service pipe at the property line shall be 2.0 m from invert elevation to finished curb top grade.'
 const claim='The project storm service cover of 2.0 m meets the requirement for 2.0 m from invert to curb grade.'
 assert.match(issue(claim,source,'Review a storm service with 2.0 m cover.'),/different datums/)
 assert.equal(issue('The specification sets a storm service depth of 2.0 m from invert elevation to finished curb top grade.',source),null)
 assert.equal(issue(claim,source,'The project depth is measured from the pipe invert to the finished curb top grade.'),null)
})
test('referenced manufacturer procedures do not weaken a duty, while recommendations retain their force',()=>{
 assert.equal(recommendationLanguage('If cover is insufficient then provide insulation in accordance with manufacturer’s recommended installation procedures.'),false)
 assert.equal(recommendationLanguage('Insulation should follow the manufacturer’s recommended installation procedures.'),true)
 assert.equal(recommendationLanguage('It is recommended that insulation be installed.'),true)
 assert.equal(recommendationLanguage('Compaction is recommended at this density.'),true)
})
test('falling short cannot select an ESAL-dependent minimum without design loading',()=>{
 const source='Design ESALs (x10 [6]) Minimum Thickness of 1st Stage ACP > 10.0 120 mm'
 const claim='The project proposes a 110 mm PAV-ACP layer, which falls short of the minimum 120 mm requirement for Design ESALs greater than 10.0.'
 assert.match(issue(claim,source,'Compare the 110 mm project layer with its governing minimum.'),/design ESALs/)
 assert.equal(issue(claim,source,'The project design ESALs are 12 million. Compare the 110 mm layer.'),null)
 assert.match(issue('The project is below the 50 mm minimum.','A minimum of 50 mm remains below the CIR layer.','Compare the proposed new asphalt layer.'),/structural role/)
})
test('necessary-traffic restrictions cannot classify an unexplained delivery as a violation',()=>{
 const source='Limit vehicular access near LID facilities to necessary traffic only during facility construction.'
 const claim='Crossing the facility with delivery vehicles constitutes unnecessary traffic.'
 assert.match(issue('Allowing delivery vehicles to cross the facility constitutes unauthorized vehicular access contrary to the restriction.',source,'Delivery vehicles crossed the facility.'),/necessary-traffic restriction/)
 assert.match(issue('Crossing the facility with delivery vehicles violates the necessary-traffic restriction.',source,'Delivery vehicles crossed the facility.'),/necessary-traffic restriction/)
 assert.match(issue('Delivery vehicles violate the restriction; confirm whether the access was necessary.',source,'Delivery vehicles crossed the facility.'),/necessary-traffic restriction/)
 assert.match(issue(claim,source,'Delivery vehicles crossed the facility.'),/purpose of the access/)
 assert.equal(issue('Confirm whether the delivery was unnecessary traffic before reporting a violation.',source,'Delivery vehicles crossed the facility.'),null)
 assert.equal(issue('Limit vehicular access to necessary traffic only.',source,'Delivery vehicles crossed the facility.'),null)
 assert.equal(issue(claim,source,'The reported delivery was unnecessary traffic.'),null)
})
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
 assert.match(issue('The normal arrangement is not practical, so the project uses the 2.0 m exception.',source),/feasibility exception/)
 assert.equal(issue('The project uses the 2.0 m exception.',source,'The normal arrangement is not practical.'),null)
})

test('acceptance-stage testing rules cannot become universal counts or exemptions',()=>{
 const source='At FAC, Guelph Permeameter testing must be conducted once per 1000 m2; this is not required for facilities with an impervious surface such as concrete or asphalt on top.'
 assert.match(issue('Testing must be conducted once per 1000 m2.',source),/acceptance stage/)
 assert.match(issue('Testing is not required for facilities with an impervious surface.',source),/acceptance stage/)
 assert.equal(issue('At FAC, testing must be conducted once per 1000 m2.',source),null)
 assert.equal(issue('At final acceptance, testing is not required for facilities with an impervious surface.',source),null)
 const construction='At CCC, submit the required inspection records.'
 assert.match(issue('Inspection records must be submitted.',construction),/acceptance stage/)
 assert.equal(issue('At construction completion, submit the inspection records.',construction),null)
})

test('symbolic operators cannot reconstruct a flattened PDF formula',()=>{
 const source='The extracted equation is Q = CIA 360.'
 assert.match(issue('The formula is Q = CIA / 360.',source),/operators/)
 assert.match(issue('Use Q = CIA × 360.',source),/operators/)
 assert.match(issue('The formula is Q = 360 * CIA.',source),/operators/)
 assert.equal(issue('The formula is Q = CIA / 360.','The equation is Q = CIA / 360.'),null)
})

test('an undefined process cannot establish the governing project minimum',()=>{
 const source='For each process a minimum 50 mm ACP overlay is required.'
 assert.match(issue('The governing standard requires a minimum asphalt pavement thickness of 50 mm for the ACP overlay.',source),/undefined process/)
 assert.match(issue('The proposed plate meets the minimum requirement.','For each process a minimum 50 mm steel plate is required.'),/undefined process/)
 assert.equal(issue('The reference states a 50 mm ACP overlay for each process; confirm the applicable process.',source),null)
 assert.equal(issue('The governing standard requires a 50 mm overlay.','The governing standard requires a 50 mm overlay.'),null)
})

test('pavement comparisons preserve layer position and construction process',()=>{
 const source='It is recommended that a minimum asphalt materials thickness of 50 mm remains below the CIR layer to support equipment.'
 const claim='The proposed 110 mm asphalt layer exceeds the recommended minimum of 50 mm below CIR layers.'
 assert.match(issue(claim,source,'Compare the proposed new asphalt layer.'),/structural role/)
 assert.equal(issue(claim,source,'Compare 110 mm of remaining asphalt below the CIR layer with this criterion.'),null)
 assert.match(issue('The proposed 110 mm layer exceeds the 50 mm overlay minimum.','For each process a minimum 50 mm ACP overlay is required.','Compare the new pavement layer.'),/overlay/)
 assert.equal(issue('The proposed 110 mm overlay exceeds the reference 50 mm overlay minimum.','A minimum 50 mm ACP overlay is required.','Compare the proposed overlay.'),null)
})

test('AADT and truck percentage cannot select an ESAL-based pavement minimum',()=>{
 const source='Minimum first-stage asphalt thickness for design ESALs less than 2 million is 60 mm.'
 const claim='The project proposes 110 mm, which exceeds the governing minimum thickness of 60 mm.'
 assert.match(issue(claim,source,'The highway has 7200 AADT with 10% trucks.'),/design ESALs/)
 assert.match(issue(claim,source,'Compare this project.',{projectEvidence:'Trial asphalt thickness is 110 mm. No ESAL-based adequacy is claimed.'}),/design ESALs/)
 assert.equal(issue(claim,source,'The project is designed for 1 million ESALs.'),null)
 assert.equal(issue('The reference lists a 60 mm criterion for design ESALs below 2 million.',source,'Compare the project.'),null)
})

test('alternative permissions cannot invent precedence or waive independent obligations',()=>{
 const source='LID may be used in lieu of traditional underground storm servicing. Private storm sewer systems are required for multi-family developments of 3-plex and larger.'
 for(const claim of ['The LID permission overrides the private storm sewer requirement.','Using LID waives the private connection obligation.','The LID guide takes precedence over the connection guide.'])
  assert.match(issue(claim,source),/precedence/)
 assert.equal(issue('The permission does not waive the separate servicing obligation.',source),null)
 assert.equal(issue('It cannot be assumed that the LID permission overrides the servicing obligation.',source),null)
 assert.equal(issue('The arrangement waives the obligation.','An explicit waiver of this obligation is provided.'),null)
 assert.equal(issue('The provision exempts the stated facility from testing.','Testing is not required for the stated facility.'),null)
 assert.equal(issue('Confirm whether an accepted alternate arrangement waives the connection obligation.',source),null)
 assert.equal(issue('An approved alternate arrangement waives the connection obligation.','An approved alternate arrangement waives the connection obligation.'),null)
})

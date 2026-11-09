import test from 'node:test'
import assert from 'node:assert/strict'
import { sourceAttributes, sourceAttributeIssue } from '../src/source-attributes.mjs'
import { evidenceInterpretationIssue } from '../src/evidence-guards.mjs'
import { evidenceReviewCheck } from '../src/answer.mjs'
import { sourceContext, cleanSourceCallout } from '../src/local-synthesis.mjs'

const connection='A Minimum of 1% slope for storm services from the property line to the crown of the public sewer main with at least 2.4m in depth (cover) at the property line.'
const conditional='Lots zoned for semi-detached or multi-family residential land use, where construction of side-by- side units are anticipated, one water, one sanitary and if required, one storm service line shall be provided for each unit directly off EPCOR sewer mains.'
const question='For a four-unit corner-lot infill, can a box planter replace conventional storm servicing?'

test('adjacent slope extent and burial location stay bound to their own source properties',()=>{
 const attributes=sourceAttributes(connection)
 assert.deepEqual(attributes.properties.map(({excerpt,...property})=>property),[
  {property:'slope',value:1,unit:'%',extent:'property-line-to-public-main-crown'},
  {property:'burial-depth',value:2.4,unit:'m',location:'property-line',datum:'not-stated'},
 ])
 assert.ok(attributes.properties.every(property=>connection.includes(property.excerpt)))
 const bad='The minimum burial depth is 2.4 m, measured from the property line to the crown of the public sewer main.'
 assert.match(sourceAttributeIssue(bad,connection),/belongs to the slope/)
 assert.match(evidenceInterpretationIssue(bad,connection),/belongs to the slope/)
 assert.match(sourceAttributeIssue('The service cover from the property line to the crown of the public sewer main must be 2.4 m.',connection),/belongs to the slope/)
 assert.equal(sourceAttributeIssue('A minimum depth of 2.4 m is required at the property line; the slope extent runs from the property line to the crown of the public sewer main.',connection),null)
 assert.equal(sourceAttributeIssue('Storm services from the property line to the crown of the public sewer main require 2.4 m depth at the property line.',connection),null,'An asset extent is not necessarily a measurement datum')
})

test('a unit count cannot establish the source side-by-side condition as a project fact',()=>{
 const bad='The guide mandates that each of the four units must be served by a direct storm service line if required, as side-by-side construction is anticipated for this land use.'
 assert.match(sourceAttributeIssue(bad,conditional,question),/not a supplied project fact/)
 assert.match(evidenceInterpretationIssue(bad,conditional,question),/not a supplied project fact/)
 assert.equal(sourceAttributeIssue(conditional,conditional,question),null,'Verbatim conditional source wording remains available')
 assert.equal(sourceAttributeIssue('If side-by-side construction is anticipated, provide one storm service per unit if required.',conditional,question),null)
 assert.equal(sourceAttributeIssue('Confirm whether side-by-side construction is anticipated before applying the service arrangement.',conditional,question),null)
 assert.equal(sourceAttributeIssue('This provision applies to side-by-side construction.',conditional,question),null,'Describing a source category does not assert the project has that arrangement')
 assert.equal(sourceAttributeIssue(bad,conditional,'The four units are arranged side-by-side. Can LID replace conventional storm servicing?'),null)
 assert.match(sourceAttributeIssue(bad,conditional,'Before design, can we consider side-by-side construction?'),/not a supplied project fact/)
 assert.match(sourceAttributeIssue(bad,conditional,'If side-by-side construction is used, can we use LID?'),/not a supplied project fact/)
 assert.equal(evidenceInterpretationIssue(bad,conditional,question,{projectEvidence:'The four units are arranged side-by-side.'}),null,'Cited project records can establish an actual project premise')
})

test('drafting and evidence review receive indexed attributes of the actual attached quote',()=>{
 const source={passage:{id:'p',doc:'guide',page:5,section:'Connections',text:connection,lines:[{text:connection,rect:[10,20,500,25]}]},excerpt:connection,heading:'Connections',quoteStart:0}
 const context=sourceContext(source,'A',[{id:'guide'}])
 assert.equal(context.attributes.properties.find(property=>property.property==='burial-depth').datum,'not-stated')
 const check=evidenceReviewCheck({text:'The source specifies 2.4 m depth at the property line.',evidence:[source]},0,question)
 assert.equal(check.quoteAttributes[0].quoteIndex,0)
 assert.equal(check.quoteAttributes[0].properties[0].property,'slope')
 assert.deepEqual(sourceAttributes('Private storm sewer systems are required.'),{properties:[],conditions:[]})
 assert.equal(sourceContext({...source,excerpt:'Private storm sewer systems are required.'},'B',[{id:'guide'}]).attributes,undefined)
})

test('internal cited-source markers do not leak into findings or erase real engineering acronyms',()=>{
 const labels=new Map([['BM',{excerpt:'Private storm sewer systems are required.'}],['A',{excerpt:'LID may replace traditional storm servicing.'}],['QA',{excerpt:'QA/QC verification is required.'}]])
 const claim='Confirm how the servicing obligation (BM) and alternative LID permission (A) apply together.'
 assert.equal(cleanSourceCallout(claim,labels,['BM','A']),'Confirm how the servicing obligation and alternative LID permission apply together.')
 assert.equal(cleanSourceCallout('Perform quality assurance (QA) verification.',labels,['QA']),'Perform quality assurance (QA) verification.')
 assert.equal(cleanSourceCallout('The IFC model references ST1 (CB).',labels,['A']),'The IFC model references ST1 (CB).')
 assert.equal(cleanSourceCallout(claim,labels,[]),claim,'Uncited identifiers must not silently become valid citations')
})

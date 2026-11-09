import test from 'node:test'
import assert from 'node:assert/strict'
import {readIfcProperties,compareIfcDocuments} from '../src/ifc-comparison.mjs'

// Real STEP references exercise unit resolution before comparison. Defaults
// belong to the project; an explicit property Unit takes precedence.
function model({value=200,type='IFCLENGTHMEASURE',unit='$',name='NominalPipeDiameter',projectUnit='#20',extra=''}={}) {
 const text=`ISO-10303-21;
 #1=IFCPROJECT('guid',$,'Project',$,$,$,$,$,#2);
 #2=IFCUNITASSIGNMENT((${projectUnit}));
 #3=IFCPIPESEGMENT('element-guid',$,'S1',$,$,$,$,'S1');
 #4=IFCPROPERTYSINGLEVALUE('${name}',$,${type}(${value}),${unit});
 #5=IFCPROPERTYSET('pset-guid',$,'Dimensions',$,(#4));
 #6=IFCRELDEFINESBYPROPERTIES('relation-guid',$,$,$,(#3),#5);
 #20=IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.);
 #21=IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.);
 #22=IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.);
 #23=IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.);
 ${extra}
 END-ISO-10303-21;`
 return {name:'units.ifc',elements:readIfcProperties(text)}
}
const doc={id:'design',label:'Design',category:'design',projectArtifact:true}
const scan=(m,text)=>compareIfcDocuments([m],[doc],[{doc:doc.id,page:1,text}])
test('typed measures inherit project units and equivalent metres do not create a discrepancy',()=>{
 const m=model()
 assert.equal(m.elements[0].properties[0].measurementUnit,'mm')
 const result=scan(m,'S1 nominal pipe diameter: 0.20 m.')
 assert.equal(result.issues.length,0)
 assert.equal(result.coverage[0].checks,1)
 const issue=scan(m,'S1 nominal pipe diameter: 0.25 m.').issues[0]
 assert.equal(issue.actual,.2);assert.equal(issue.expected,.25);assert.equal(issue.unit,'m')
 assert.equal(issue.modelValue,200);assert.equal(issue.modelUnit,'mm')
 assert.match(issue.explanation,/converts to 0.2 m/)
})
test('explicit SI units override the project unit assignment and suffix hints',()=>{
 const m=model({value:.2,unit:'#21',name:'NominalPipeDiameter_mm'})
 assert.equal(m.elements[0].properties[0].unitOrigin,'explicit')
 assert.equal(scan(m,'S1 nominal pipe diameter: 200 mm.').issues.length,0)
 assert.equal(scan(m,'S1 nominal pipe diameter: 250 mm.').issues[0].actual,200)
})
test('min/max comparisons use converted values and preserve engineering bounds',()=>{
 const m=model()
 assert.equal(scan(m,'S1 minimum nominal pipe diameter: 0.25 m.').issues.length,1)
 assert.equal(scan(m,'S1 maximum nominal pipe diameter: 0.25 m.').issues.length,0)
 assert.equal(scan(m,'S1 minimum nominal pipe diameter: 20 centimetres.').issues.length,0)
 assert.equal(scan(m,'S1 nominal pipe diameter: 0.0002 km.').coverage[0].checks,1)
 assert.equal(scan(m,'S1 nominal pipe diameter: 0.0002 km.').issues.length,0)
})
test('missing, ambiguous, unknown and dimensionally inconsistent units remain uncheckable',()=>{
 for(const options of [
  {projectUnit:'#99'},
  {projectUnit:'#20,#21'},
  {unit:'#99',name:'NominalPipeDiameter_mm'},
  {unit:'#22'},
  {unit:'#24',extra:'#24=IFCSIUNIT(*,.LENGTHUNIT.,.BOGUS.,.METRE.);'},
  {unit:'#24',extra:"#24=IFCCONVERSIONBASEDUNIT(*,.LENGTHUNIT.,'foot',#99);"},
  {unit:'#21',type:'IFCLABEL',value:"'200 mm'"},
 ]){
  const result=scan(model(options),'S1 nominal pipe diameter: 250 mm.')
  assert.equal(result.issues.length,0,JSON.stringify(options))
  assert.equal(result.coverage[0].status,'needs-review',JSON.stringify(options))
  assert.equal(result.unitDiagnostics.length,1)
  assert.equal(result.unitDiagnostics[0].propertyId,'#4')
 }
})
test('generic real numbers retain declared suffix units instead of inheriting length defaults',()=>{
 const m=model({type:'IFCREAL',name:'NominalPipeDiameter_m',value:.2})
 assert.equal(scan(m,'S1 nominal pipe diameter: 200 mm.').issues.length,0)
 assert.equal(scan(m,'S1 nominal pipe diameter: 250 mm.').issues[0].actual,200)
})
test('area and volume defaults are resolved without treating lengths as areas or volumes',()=>{
 for(const [type,name,projectUnit,unit] of [
  ['IFCAREAMEASURE','StorageArea','#22','m²'],
  ['IFCVOLUMEMEASURE','StorageVolume','#23','m³'],
 ]){
  const m=model({type,name,projectUnit,value:200})
  const words=name.replace('Storage','storage ').toLowerCase()
  assert.equal(scan(m,`S1 ${words}: 250 ${unit}.`).issues.length,1)
  assert.equal(scan(m,`S1 ${words}: 200 ${unit}.`).issues.length,0)
  assert.equal(scan(m,`S1 ${words}: 250 m.`).coverage[0].status,'needs-review')
 }
})

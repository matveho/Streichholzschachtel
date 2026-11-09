import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { buildIndex, locateQuote, annotateSections } from '../src/indexer.mjs'
import { SearchIndex, tokens } from '../src/search.mjs'
import { answer, validateSynthesis, relatedProvisions } from '../src/answer.mjs'
import { config, root } from '../src/config.mjs'
import { evidenceUnits } from '../src/evidence-units.mjs'
import { draftLocal } from '../src/local-synthesis.mjs'
import { linkedProcedureEvidence } from '../src/linked-procedures.mjs'
import { applicableEvidence } from '../src/applicability.mjs'
import {relatedCriteriaEvidence,depthCriterion} from '../src/related-criteria.mjs'
import { UnitIndex, lookup } from '../src/lookup.mjs'
import {
  replacementRequirementSearch,
  replacementPermissionSearch,
  selectedSections,
  sectionCatalog,
  passagesForSections,
  expandRetrieval,
  constructionControlSearch,
  diversePassages,
} from '../src/retrieval-plan.mjs'
const corpus = await buildIndex(),
  search = new SearchIndex(corpus)

test('the actual testing procedure retains applicable QA and preferred depth without importing deep-soil branches', () => {
 const question='What testing is needed for acceptance of a 500 m² LID facility with 600 mm of soil?'
 const passages=corpus.passages.filter(p=>p.doc==='doc-eb651c8aa7d3'&&p.page===97)
 const units=applicableEvidence(question,evidenceUnits(passages,30000)).units
 const selected=units.filter(u=>/minimum of two locations/.test(u.excerpt))
 assert.ok(selected.length)
 const added=linkedProcedureEvidence(selected,units,question)
 assert.ok(added.some(u=>/QA\/QC.*within 3 m/.test(u.excerpt)))
 assert.ok(added.some(u=>/same depth as the adjacent test/.test(u.excerpt)))
 assert.ok(added.some(u=>/preferred.*halfway depth/.test(u.excerpt)))
 assert.ok(added.some(u=>/recommended.*75%-85%/.test(u.excerpt)))
 assert.ok(added.every(u=>!/^For facilities with soil deeper than 650/.test(u.excerpt)))
 for(const unit of added) assert.deepEqual(locateQuote(unit.passage,unit.excerpt,unit.quoteStart).regions,unit.regions)
})

test('every failed check invalidates all its rejected drafts before bounded repair feedback',async(t)=>{
 const original={...config}
 t.after(()=>Object.assign(config,original))
 Object.assign(config,{provider:'ollama',extractiveOnly:false,localSynthesis:true,localSynthesisPolicy:'all',localReasoning:false,entailmentDir:'',maxFindingsPerCheck:6})
 const drafts=new Map(),retained=[]
 t.mock.method(globalThis,'fetch',async(_url,options)=>{
  const body=JSON.parse(options.body),system=body.messages[0].content,input=JSON.parse(body.messages[1].content)
  let output
  if(system.startsWith('Decompose'))output={queries:[
   {heading:'Private storm system',query:'private storm sewer systems multi-family requirements',sections:[]},
   {heading:'Property boundaries',query:'private on-site water sewer systems separately titled property requirements',sections:[]},
  ]}
  else if(system.includes('Select ALL directly')){
   const pattern=/separately/i.test(input.check)?/Private on-site water and sewer systems must not cross/:/Private storm sewer systems are required/
   const source=input.context.find(unit=>pattern.test(unit.quote))
   assert.ok(source,'The actual scoped source clause is available')
   output={answerable:true,evidence:[source.id],unresolved:[]}
  }else if(system.startsWith('Include calculation IDs')){
   const count=(drafts.get(input.focusedCheck)||0)+1
   drafts.set(input.focusedCheck,count)
   if(count===1)output={findings:Array.from({length:6},(_,i)=>({text:`The source requires a storm service diameter of ${9000+i} mm.`,evidence:[input.provisions[0].id],calculations:[]}))}
   else{
    retained.push({check:input.focusedCheck,findings:input.alreadyRetainedFindings,feedback:input.validationIssues})
    const finding={text:input.provisions[0].quote,evidence:[input.provisions[0].id],calculations:[]}
    assert.equal(input.repairTargets.length,6,'Every rejected finding receives its own slot')
    output={repairs:Object.fromEntries(input.repairTargets.map((target,i)=>[target.id,i===0?[finding]:[]]))}
   }
  }else if(system.startsWith('Use verifiedConditions'))output={verdicts:Object.fromEntries(input.claims.map(claim=>[String(claim.id),{reason:'The attached exact quote supports this scoped finding.',supported:true,relevant:true}]))}
  else throw Error('Unexpected model phase in repair regression')
  return new Response(JSON.stringify({message:{content:JSON.stringify(output)},done_reason:'stop'}))
 })
 const result=await answer('Review private storm sewer and property boundary requirements for a four-unit development, retaining all independently sourced requirements.',search,{
  publicBase:'http://localhost',token:'test',signal:AbortSignal.timeout(30000),
 })
 assert.equal(result.mode,'local_synthesis')
 assert.equal(retained.length,2)
 for(const check of retained){
  assert.deepEqual(check.findings,[],`${check.check} must not retain any rejected draft`)
  assert.ok(check.feedback.length<=8,'Feedback remains bounded per check')
 }
})

test('failed early checks cannot silently discard a valid later servicing finding',()=>{
 const quote='Private storm sewer systems are required by all commercial, industrial, institutional and multi-family developments (3-plex and larger).'
 const passage=corpus.passages.find(p=>p.text.includes(quote))
 assert.ok(passage)
 const failed=check=>({check,text:'A fabricated requirement is mandatory.',evidence:[{passageId:passage.id,quote:'This quote is not in the document.'}]})
 const valid=check=>({check,text:quote,evidence:[{passageId:passage.id,quote}]})
 const result=validateSynthesis({sections:[{claims:[...Array.from({length:6},()=>failed('design')),...Array.from({length:6},()=>failed('construction')),valid('servicing')]}]},[passage],
  'For a four-unit infill, what private storm servicing is required?',corpus.documents,{checks:['design','construction','servicing']})
 assert.equal(result.sections.flatMap(s=>s.claims).length,1)
 assert.equal(result.sections[0].claims[0].check,'servicing')
 assert.equal(result.rejected,12)
})

test('all eight bounded source checks survive the separate conclusions section',()=>{
 const quote='Private storm sewer systems are required by all commercial, industrial, institutional and multi-family developments (3-plex and larger).'
 const passage=corpus.passages.find(p=>p.text.includes(quote))
 const checks=Array.from({length:8},(_,i)=>'check-'+i)
 const source=check=>({heading:check,claims:[{check,text:quote,evidence:[{passageId:passage.id,quote}]}]})
 const result=validateSynthesis({sections:[{claims:[]},...checks.map(source)]},[passage],'Review private storm servicing.',corpus.documents,{checks})
 assert.equal(result.sections.length,8)
 assert.equal(result.sections.at(-1).claims[0].check,'check-7')
})

test('per-check findings stay bounded and unknown check IDs cannot borrow another budget',()=>{
 const quote='Private storm sewer systems are required by all commercial, industrial, institutional and multi-family developments (3-plex and larger).'
 const passage=corpus.passages.find(p=>p.text.includes(quote))
 const claim=check=>({check,text:quote,evidence:[{passageId:passage.id,quote}]})
 const first=Array.from({length:config.maxFindingsPerCheck+1},()=>claim('first'))
 const result=validateSynthesis({sections:[{claims:[...first,claim('second'),claim('unrequested')]}]},[passage],'Review private storm servicing.',corpus.documents,{checks:['first','second']})
 const accepted=result.sections.flatMap(s=>s.claims)
 assert.equal(accepted.filter(c=>c.check==='first').length,config.maxFindingsPerCheck)
 assert.equal(accepted.filter(c=>c.check==='second').length,1)
 assert.equal(accepted.some(c=>c.check==='unrequested'),false)
 assert.ok(result.issues.some(issue=>/check budget/.test(issue.reason)))
})

test('focused retrieval retains the competing connection criterion and its original anchor',()=>{
 const selected=diversePassages(search.searchSingle('Storm service connection depth criteria'))
 const units=evidenceUnits(search.withPageContext(selected),30000)
 const connection=units.find(u=>u.passage.doc==='doc-dc122df73bce'&&/storm services.*2\.4m/i.test(u.excerpt))
 assert.ok(connection,'The connection guide survives repeated design-manual hits')
 assert.ok(locateQuote(connection.passage,connection.excerpt))
 assert.ok(units.some(u=>/When this is not practical.*2\.0 m/i.test(u.excerpt)))
 const selectedUnits=units.filter(u=>/When this is not practical.*2\.0 m/i.test(u.excerpt))
 const retained=relatedCriteriaEvidence(selectedUnits,units,'storm service connection depth criteria')
 assert.ok(retained.some(u=>u.excerpt===connection.excerpt),'The numeric criterion survives model selection omitting a different reference')
 assert.equal(depthCriterion(connection).datum,'not-stated','Unspecified measurement datum is not inferred')
})

test('offline answers surface differing scoped reference criteria and honor a named publication',async()=>{
 const ids=new Set(['doc-dc122df73bce','doc-da424a924abd'])
 const scoped=new SearchIndex({...corpus,documents:corpus.documents.filter(d=>ids.has(d.id)),passages:corpus.passages.filter(p=>ids.has(p.doc)),units:corpus.units.filter(u=>ids.has(u.doc))})
 const run=question=>answer(question,scoped,{sourceOnly:true,publicBase:'http://localhost',token:'test',signal:AbortSignal.timeout(10000)})
 const result=await run('What is the minimum depth of a storm service at the property line?')
 assert.equal(result.referenceInterfaces.length,1)
 assert.equal(result.requiredInputs.kind,'reference_basis')
 assert.ok(result.references.every(r=>ids.has(r.doc)&&r.regions.length>0))
 assert.ok(result.report.some(block=>block.heading==='Reference criteria to reconcile'))
 const explicit=await run('According to the Connection Guide, what is the minimum storm service depth?')
 assert.equal(explicit.referenceInterfaces,undefined)
 assert.ok(explicit.references.every(r=>r.doc==='doc-dc122df73bce'))
})

test('decimal measurements attached to units retain their full value during source validation',()=>{
 const passage=corpus.passages.find(p=>p.doc==='doc-dc122df73bce'&&p.page===5&&p.text.includes('at least 2.4m'))
 assert.ok(passage)
 const quote='A Minimum of 1% slope for storm services from the property line to the crown of the public sewer main with at least 2.4m in depth (cover) at the property line.'
 const run=value=>validateSynthesis({answerable:true,sections:[{heading:'Finding',claims:[{text:`Storm services require at least ${value} m depth (cover) at the property line.`,evidence:[{passageId:passage.id,quote}]}]}]},[passage],'What depth does the connection guide specify for storm services?')
 assert.equal(run('2.4').sections.length,1,JSON.stringify(run('2.4').issues))
 assert.equal(run('2.5').sections.length,0)
 assert.equal(run('2.0').sections.length,0)
})

test('conditional insulation duties retain their force when incorporating manufacturer procedures',()=>{
 const passage=corpus.passages.find(p=>p.doc==='doc-09e07f57e7a3'&&p.page===11&&p.text.includes('If this cover cannot be achieved then provide'))
 assert.ok(passage)
 const quote='If this cover cannot be achieved then provide adequate pipe insulation to prevent freezing in accordance with insulation manufacturer’s recommended installation procedures and as shown on the drawings.'
 assert.ok(locateQuote(passage,quote))
 const draft={answerable:true,sections:[{heading:'Finding',claims:[{text:'If this cover cannot be achieved, adequate pipe insulation must be provided to prevent freezing in accordance with the manufacturer’s recommended installation procedures.',evidence:[{passageId:passage.id,quote}]}]}]}
 const checked=validateSynthesis(draft,[passage],'Review storm main cover and insulation requirements.')
 assert.equal(checked.sections.length,1,JSON.stringify(checked.issues))
})

test('an introductory colon retains the force of the actual sediment-basin prohibition',()=>{
 const passage=corpus.passages.find(p=>/Do not use LID facilities as temporary sediment basins/.test(p.text))
 assert.ok(passage)
 const unit=evidenceUnits([passage],30000).find(u=>/Do not use LID facilities as temporary sediment basins/.test(u.excerpt))
 assert.ok(unit)
 const checked=validateSynthesis({sections:[{claims:[{text:'LID facilities must not be used as temporary sediment basins during construction.',evidence:[{passageId:passage.id,quote:unit.excerpt,quoteStart:unit.quoteStart}]}]}]},[passage],'Review a bioretention basin used as a sediment trap during construction.')
 assert.equal(checked.sections.length,1,JSON.stringify(checked.issues))
})

test('a detached mitigation quote cannot certify an unconditional service depth',()=>{
 const passage=corpus.passages.find(p=>p.doc==='doc-09e07f57e7a3'&&p.page===17&&p.text.includes('If a minimum cover of 2.0 m is not achievable'))
 const quote='If a minimum cover of 2.0 m is not achievable, then provide insulated pipe to prevent freezing.'
 assert.ok(passage)
 const unit=evidenceUnits([passage],30000).find(u=>u.excerpt===quote)
 assert.match(unit.conditionEvidence.excerpt,/when this is not practical/)
 assert.ok(locateQuote(passage,unit.conditionEvidence.excerpt))
 const run=text=>validateSynthesis({answerable:true,sections:[{heading:'Finding',claims:[{text,evidence:[{passageId:passage.id,quote}]}]}]},[passage],'Review a storm service with 2.0 m cover at the property line.')
 const rejected=run('While the storm service meets the depth requirement, the design guidelines require insulation if the minimum cover cannot be achieved.')
 assert.equal(rejected.sections.length,0)
 assert.ok(rejected.issues.some(i=>/feasibility exception/.test(i.reason)))
 const conditional=run('Where the normal service depth is not practical, provide insulated pipe if a minimum cover of 2.0 m is not achievable.')
 assert.equal(conditional.sections.length,1,JSON.stringify(conditional.issues))
 assert.ok(conditional.sections[0].claims[0].evidence.some(e=>/when this is not practical/.test(e.excerpt)))
})

test('a main insulation finding cannot inherit an unrelated service feasibility exception',()=>{
 const passage=corpus.passages.find(p=>p.doc==='doc-09e07f57e7a3'&&p.page===11&&p.text.includes('If this cover cannot be achieved then provide'))
 const main='If this cover cannot be achieved then provide adequate pipe insulation to prevent freezing in accordance with insulation manufacturer’s recommended installation procedures and as shown on the drawings.'
 const service='If this cover cannot be achieved, provide adequate pipe insulation to prevent freezing in accordance with insulation manufacturer’s recommended installation procedures and as shown on the drawings.'
 const run=quotes=>validateSynthesis({answerable:true,sections:[{heading:'Finding',claims:[{text:'If the required cover cannot be achieved, the storm main requires adequate pipe insulation to prevent freezing.',evidence:quotes.map(quote=>({passageId:passage.id,quote}))}]}]},[passage],'Review a 450 mm storm main with 1.7 m cover.')
 assert.equal(run([service]).sections.length,0,'Service mitigation cannot establish a main duty')
 const result=run([main,service])
 assert.equal(result.sections.length,1,JSON.stringify(result.issues))
 assert.equal(result.sections[0].claims[0].evidence.length,1,'Unrelated service proof is excluded')
})

test('retrieval section numbers never become project inputs to selection or drafting', async (t) => {
  const original = { ...config }
  t.after(() => Object.assign(config, original))
  config.provider = 'ollama'
  config.localReasoning = true
  const question =
    'Describe the design requirements for box planters used on a four-unit corner-lot infill development.'
  const baseline = search.search(question),
    catalog = sectionCatalog(question, baseline, search)
  const section = catalog.find((s) => s.heading === '1.5 Box Planter Design')
  assert.ok(section)
  const requests = []
  const thinking = []
  const outputs = [
    {
      queries: [
        {
          heading: 'Planter design',
          query: 'box planter design requirements',
          sections: [section.id],
        },
      ],
    },
    { answerable: true, evidence: ['A'], unresolved: [] },
    {
      findings: [
        { text: 'A source-backed finding.', evidence: ['A'], calculations: [] },
      ],
    },
  ]
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const body = JSON.parse(options.body)
    requests.push(JSON.parse(body.messages[1].content))
    thinking.push(body.think)
    return new Response(
      JSON.stringify({
        message: { content: JSON.stringify(outputs.shift()) },
        done_reason: 'stop',
      }),
    )
  })
  const signal = new AbortController().signal
  const retrieval = await expandRetrieval(question, baseline, search, signal)
  assert.match(retrieval.topics[0].query, /1\.5 Box Planter Design/)
  await draftLocal(
    question,
    retrieval.passages,
    search,
    signal,
    [],
    undefined,
    retrieval.topics,
  )
  assert.equal(requests[1].question, 'box planter design requirements')
  assert.equal(requests[2].question, 'box planter design requirements')
  assert.deepEqual(thinking, [false, false, true], 'Only finding synthesis uses thinking; retrieval and source-ID selection stay direct')
})

test('section selection honors model priority while enforcing the program budget independently of JSON schema hints', () => {
  const catalog = ['a', 'b', 'c', 'd'].map((id) => ({ id, heading: id }))
  assert.deepEqual(
    selectedSections(['missing', 'd', 'b', 'd', 'a', 'c'], catalog).map(
      (s) => s.id,
    ),
    ['d', 'b', 'a'],
  )
})

test('sequencing table quotations stay inside their original cell and retain row and column meaning', () => {
  const pages = corpus.passages.filter(
    (p) => p.doc === 'doc-f27309b4bba5' && p.page === 40,
  )
  const units = evidenceUnits(search.withPageContext(pages), 30000)
  const excavation = units.find(
    (u) =>
      u.tableRowLabel === '2 Excavation' &&
      u.tableColumn === 'How to Implement' &&
      /Do not excavate/.test(u.excerpt),
  )
  assert.ok(excavation)
  assert.ok(locateQuote(excavation.passage, excavation.excerpt))
  assert.ok(
    excavation.regions.every(([x, , width]) => x >= 254 && x + width <= 401),
  )
  assert.doesNotMatch(
    excavation.excerpt,
    /Inspect when|Owner.s Representative|silt contaminated/,
  )
  const timing = units.find(
    (u) =>
      u.tableRowLabel === '2 Excavation' &&
      u.tableColumn === 'Inspection Timing',
  )
  assert.match(timing.excerpt, /Inspect when excavation commences/)
  assert.doesNotMatch(timing.excerpt, /Do not excavate|Equipment operating/)
})

test('actual section retrieval supplies construction controls and original anchors without inventing section IDs', () => {
  const question =
    'For a four-unit corner-lot infill, can a box planter replace conventional storm servicing, and what design and construction checks are needed?'
  const catalog = sectionCatalog(question, search.search(question), search)
  const site = catalog.find(
    (s) => s.doc === 'doc-f27309b4bba5' && s.heading === '4.2 Working On-Site',
  )
  assert.ok(site)
  assert.match(site.description, /best practices.*working on or around an LID/i)
  const passages = passagesForSections([site.id], catalog, search)
  const units = evidenceUnits(search.withPageContext(passages), 30000)
  const inspection = units.find((u) =>
    /Conduct weekly documented ESC inspections/.test(u.excerpt),
  )
  const compaction = units.find((u) => /scarifying/.test(u.excerpt))
  assert.ok(inspection)
  assert.ok(compaction)
  assert.ok(locateQuote(inspection.passage, inspection.excerpt))
  assert.ok(locateQuote(compaction.passage, compaction.excerpt))
  assert.ok(passages.every((p) => p.doc === site.doc))
  assert.deepEqual(passagesForSections(['invented'], catalog, search), [])
  assert.ok(catalog.length <= 210)
})

test('replacement searches retrieve the proposed alternative permission as well as existing obligations', () => {
  const question =
    'For a four-unit corner-lot infill, can a box planter replace conventional storm servicing, and what design and construction checks are needed?'
  const query = replacementPermissionSearch(question)
  assert.ok(query)
  const passages = search.withPageContext(
    search.searchSingle(query).slice(0, 2),
  )
  const permission = evidenceUnits(passages, 30000).find((u) =>
    /LID may be utilized in lieu of traditional underground storm servicing systems/.test(
      u.excerpt,
    ),
  )
  assert.ok(permission)
  assert.ok(locateQuote(permission.passage, permission.excerpt))
  assert.equal(
    replacementPermissionSearch('What is the minimum sewer slope?'),
    null,
  )
})

test('governing section ancestry continues across pages and resets for sibling assets without treating decimals as headings', () => {
  const line = (text, x = 50) => ({ text, rect: [x, 80, 500, 92] })
  const first = [
    line('5.2 Soil Cells'),
    line('5.2.1.'),
    line('Installation', 70),
    line('Install the cells according to the manufacturer.'),
  ]
  const active = annotateSections(first)
  assert.deepEqual(first.at(-1).sectionPath, [
    '5.2 Soil Cells',
    '5.2.1 Installation',
  ])
  const second = [
    line('Maintain the installation.'),
    line('1.25 times the design flow'),
    line('5.3 Box Planters'),
    line('Keep the base protected.'),
  ]
  annotateSections(second, active)
  assert.deepEqual(second[1].sectionPath, active)
  assert.deepEqual(second.at(-1).sectionPath, ['5.3 Box Planters'])
})

test('short engineering nouns normalize consistently with their plural and inflected forms', () => {
  for (const group of [
    ['pipe', 'pipes'],
    ['size', 'sizing'],
    ['rate', 'rates'],
    ['time', 'times'],
    ['line', 'lines'],
    ['feed', 'feeding'],
    ['ring', 'rings'],
  ]) {
    assert.equal(tokens(group[0])[0], tokens(group[1])[0], group.join(' / '))
  }
})
test('indexes all supplied original PDFs with usable anchors', () => {
  const expected = new Set()
  for (const folder of [
    '../public/documents',
    'documents',
    'references',
    'output/pdf',
  ])
    for (const file of readdirSync(resolve(root, folder)).filter((name) =>
      /\.pdf$/i.test(name),
    ))
      expected.add(
        createHash('sha256')
          .update(readFileSync(resolve(root, folder, file)))
          .digest('hex'),
      )
  assert.deepEqual(new Set(corpus.documents.map((d) => d.version)), expected)
  assert.equal(corpus.failures.length, 0)
  assert.ok(corpus.passages.length > 500)
  for (const p of corpus.passages) {
    assert.ok(p.page > 0)
    assert.ok(p.lines.length)
    assert.ok(
      p.extraction === 'ocr'
        ? p.lines.some((l) => locateQuote(p, l.text))
        : locateQuote(p, p.lines.map((l) => l.text).join(' ')),
    )
  }
})

test('recovers the infill source and its exact combined-sewer qualification', () => {
  const found = search.search(
    'Can box planter underdrains be connected to combined sewers?',
  )
  const passage = found.find(
    (p) =>
      p.page === 18 &&
      p.text.includes('should not be connected to combined sewers'),
  )
  assert.ok(
    passage,
    'The malformed hidden text layer must not hide this requirement',
  )
  const quote =
    'may contain an underdrain pipe but should not be connected to combined sewers'
  assert.ok(
    locateQuote(passage, quote),
    'OCR quote must agree with the original hidden character layer and retain page coordinates',
  )
})
test('unseen crossing and slope questions find the applicable provisions', () => {
  const crossing = search.search(
    'What minimum vertical clearance is required when sewer mains cross?',
  )
  assert.ok(
    crossing
      .slice(0, 3)
      .some((p) =>
        p.text.includes(
          'The minimum vertical clearance when sewer crossing each other shall be 300 mm.',
        ),
      ),
  )
  const slope = search.search(
    'What is the minimum slope for catch basin leads?',
  )
  assert.ok(slope.slice(0, 3).some((p) => p.text.includes('1.0%')))
})

test('retrieval follows a same-document section reference to the governing storage rule', () => {
  const passages = search.search(
    'Can the Rational Method alone be used to size a detention pond serving a 40 ha catchment?',
  )
  assert.ok(
    passages.some((p) =>
      p.text.includes(
        'all stormwater management storage facilities shall be designed using computer modelling techniques',
      ),
    ),
  )
  assert.equal(new Set(passages.map((p) => p.id)).size, passages.length)
})

test('review of a restrictive-method quote also sees the adjacent explicit permission', () => {
  const p = corpus.passages.find(
    (p) =>
      p.doc === 'doc-eb651c8aa7d3' &&
      p.page === 12 &&
      p.text.includes('Utilization of the rational method'),
  )
  const context = search.withPageContext([p])[0]
  const quote =
    'Utilization of the rational method should be restricted to preliminary design or to approximate estimates of peak flow rates.'
  const related = relatedProvisions(
    {
      text: 'The Rational Method is not permitted for final design calculations.',
      evidence: [{ passage: context, excerpt: quote }],
    },
    'For a 20 ha minor drainage system, what design methods apply?',
  )
  assert.ok(
    related.some((q) =>
      /may also be used for the detailed design of minor drainage/.test(q),
    ),
  )
})

test('same-page continuation supplies the complete velocity provision without crossing to other documents or pages', () => {
  const seed = corpus.passages.find(
    (p) =>
      p.doc === 'doc-09e07f57e7a3' &&
      p.page === 10 &&
      p.text.includes('mean velocities') &&
      !p.text.includes('below 0.6'),
  )
  assert.ok(seed)
  const expanded = search.withAdjacentPassages([seed])
  assert.ok(
    expanded.some((p) =>
      p.text.includes('Mean velocities below 0.6 m/s will not be allowed.'),
    ),
  )
  assert.ok(expanded.every((p) => p.doc === seed.doc && p.page === seed.page))
  const limit = evidenceUnits(expanded).find((u) =>
    /Mean velocities below 0\.6 m\/s/.test(u.excerpt),
  )
  assert.ok(limit)
  assert.match(limit.heading, /Storm Sewer Velocity Requirements/i)
  assert.equal(new Set(expanded.map((p) => p.id)).size, expanded.length)
})

test('page context preserves a complete qualified velocity paragraph with original anchors', () => {
  const seed = corpus.passages.find(
    (p) =>
      p.doc === 'doc-09e07f57e7a3' &&
      p.page === 10 &&
      p.text.includes('mean velocities'),
  )
  const contexts = search.withPageContext([seed, seed])
  assert.equal(contexts.length, 1)
  const paragraph = evidenceUnits(contexts).find(
    (u) =>
      /0\.90 to 1\.0 m\/s/.test(u.excerpt) && /below 0\.6 m\/s/.test(u.excerpt),
  )
  assert.ok(paragraph)
  assert.match(paragraph.excerpt, /lower velocities are to be justified/)
  assert.ok(locateQuote(paragraph.passage, paragraph.excerpt))
  assert.equal(
    new Set(contexts[0].lines.map((l) => JSON.stringify([l.rect, l.text])))
      .size,
    contexts[0].lines.length,
  )
})
test('unrelated and unsupported-domain queries return no evidence', () => {
  for (const q of [
    'What is the capital of France?',
    'How do I bake a chocolate cake?',
    'What stormwater design rules apply in Toronto?',
  ])
    assert.equal(lookup(q, new UnitIndex(corpus)).mode, 'no_evidence', q)
})

test('an unsupported query returns an explicit empty result instead of unrelated PDF sources', async () => {
  const result = await answer('What is the capital of France?', search, {
    publicBase: '',
    token: 'test',
    signal: new AbortController().signal,
  })
  assert.equal(result.mode, 'no_evidence')
  assert.deepEqual(result.documents, [])
  assert.deepEqual(result.references, [])
  assert.equal(result.report[0].heading, 'No supported answer')
})

test('an analysis outage withholds an answer instead of returning unreviewed retrieval matches', async () => {
  const originalFetch = globalThis.fetch
  const previous = {
    provider: config.provider,
    localSynthesis: config.localSynthesis,
    extractiveOnly: config.extractiveOnly,
  }
  Object.assign(config, {
    provider: 'ollama',
    localSynthesis: true,
    extractiveOnly: false,
  })
  globalThis.fetch = async () => {
    throw new Error('Simulated local analysis outage')
  }
  try {
    const result = await answer(
      'Can the Rational Method alone size a detention pond serving 40 ha?',
      search,
      {
        publicBase: 'http://localhost',
        token: 'test',
        signal: new AbortController().signal,
      },
    )
    assert.equal(result.mode, 'insufficient_evidence')
    assert.equal(result.documents.length, 0)
    assert.equal(result.references.length, 0)
    assert.equal(result.report[0].heading, 'No supported answer')
  } finally {
    globalThis.fetch = originalFetch
    Object.assign(config, previous)
  }
})

test('unverifiable recovered text produces no answer, documents or citations', async () => {
  const saved = config.extractiveOnly
  config.extractiveOnly = true
  try {
    const text = 'Recovered OCR says an invented minimum separation is 900 mm.'
    const unreadable = {
      id: 'unreliable-scan',
      doc: corpus.documents[0].id,
      page: 1,
      text,
      extraction: 'ocr',
      confidence: 0.5,
      lines: [{ text, rect: [70, 80, 400, 100], minConfidence: 0.4 }],
    }
    const result = await answer(
      'What separation is required?',
      {
        corpus,
        search: () => [unreadable],
      },
      { publicBase: '', token: 'test', signal: new AbortController().signal },
    )
    assert.equal(result.mode, 'insufficient_evidence')
    assert.deepEqual(result.documents, [])
    assert.deepEqual(result.references, [])
    assert.equal(result.report[0].heading, 'No supported answer')
    assert.ok(!JSON.stringify(result.report).includes('900'))
  } finally {
    config.extractiveOnly = saved
  }
})
test('fabricated quotes and unsupported quantities cannot enter synthesis', () => {
  const p = search.search('What is the minimum slope for catch basin leads?')[0]
  const fake = validateSynthesis(
    {
      sections: [
        {
          heading: 'Bad claim',
          claims: [
            {
              text: 'Use 99999 mm',
              evidence: [{ passageId: p.id, quote: p.text }],
            },
          ],
        },
      ],
    },
    [p],
    'What is the slope?',
  )
  assert.equal(fake.sections.length, 0)
  const quote = validateSynthesis(
    {
      sections: [
        {
          claims: [
            {
              text: 'Unsupported',
              evidence: [
                {
                  passageId: p.id,
                  quote: 'This source never says this made up passage',
                },
              ],
            },
          ],
        },
      ],
    },
    [p],
    'What is the slope?',
  )
  assert.equal(quote.sections.length, 0)
  const unrelated = validateSynthesis(
    {
      sections: [
        {
          claims: [
            {
              text: 'The Rational Method computes only peak runoff and cannot estimate detention storage volumes.',
              evidence: [{ passageId: p.id, quote: p.text }],
            },
          ],
        },
      ],
    },
    [p],
    'How should detention storage be designed?',
  )
  assert.equal(
    unrelated.sections.length,
    0,
    'An exact but unrelated quote cannot justify a claim',
  )
})

test('engineering unit capitalization cannot be silently changed', () => {
  const p = search
    .search(
      'What minimum vertical clearance is required when sewer mains cross?',
    )
    .find((p) => p.text.includes('300 mm'))
  const checked = validateSynthesis(
    {
      sections: [
        {
          claims: [
            {
              text: 'The minimum vertical clearance is 300 MM.',
              evidence: [
                {
                  passageId: p.id,
                  quote:
                    'The minimum vertical clearance when sewer crossing each other shall be 300 mm.',
                },
              ],
            },
          ],
        },
      ],
    },
    [p],
    'What clearance is required?',
  )
  assert.equal(checked.sections.length, 0)
})

test('independent findings preserve a supported result while rejecting invented quantities', () => {
  const quote =
    'The minimum vertical clearance when sewer crossing each other shall be 300 mm.'
  const p = search
    .search(
      'What minimum vertical clearance is required when sewer mains cross?',
    )
    .find((p) => p.text.includes(quote))
  const checked = validateSynthesis(
    {
      sections: [
        {
          heading: '',
          claims: [
            { text: quote, evidence: [{ passageId: p.id, quote }] },
            {
              text: 'The minimum vertical clearance shall be 999 mm.',
              evidence: [{ passageId: p.id, quote }],
            },
          ],
        },
      ],
    },
    [p],
    'What clearance is required?',
  )
  assert.equal(checked.rejected, 1)
  assert.equal(checked.sections[0].claims.length, 1)
  assert.equal(checked.sections[0].claims[0].text, quote)
  assert.equal(checked.sections[0].claims[0].evidence[0].excerpt, quote)
})

test('multi-part hyphenated questions retain context from at least three sources', () => {
  const matches = search.search(
    'For a four-unit corner-lot infill, confirm the private storm-servicing requirement, whether box-planter underdrains can connect to combined sewers, and how to avoid compaction of infiltration soils during construction.',
  )
  const labels = new Set(
    matches.map((p) => corpus.documents.find((d) => d.id === p.doc).label),
  )
  assert.ok(labels.has('Infill LID'))
  assert.ok(labels.has('Connection Guide'))
  assert.ok(labels.has('LID CIM'))
  assert.ok(labels.size >= 3)
})

test('replacement questions independently retrieve the existing service requirement', () => {
  const topic = replacementRequirementSearch(
    'For a four-unit corner-lot infill, can a box planter replace conventional storm servicing, and what checks are needed?',
  )
  assert.ok(topic)
  assert.ok(
    search
      .searchSingle(topic.query)
      .slice(0, 4)
      .some(
        (p) =>
          p.doc === 'doc-dc122df73bce' &&
          /Private storm sewer systems are required/.test(p.text),
      ),
  )
  assert.equal(
    replacementRequirementSearch('What pipe diameter is required?'),
    null,
  )
})

test('a sanitary velocity limit cannot be recast as a storm sewer finding', () => {
  const unit = evidenceUnits(corpus.passages.filter(p => p.doc === 'doc-09e07f57e7a3' && p.page === 7), 30000)
    .find(u => u.excerpt.includes('maximum flow velocity shall be limited to 3.0 m/s'))
  assert.ok(unit, 'Real sanitary provision and its section scope remain available')
  const draft = {answerable:true, sections:[{heading:'Finding',claims:[{
    text:'The maximum flow velocity for storm sewers is limited to 3.0 m/s.',
    evidence:[{passageId:unit.passage.id,quote:unit.excerpt}],
  }]}]}
  const result = validateSynthesis(draft, [unit.passage], 'What maximum flow velocity applies to storm sewers?')
  assert.equal(result.sections.length, 0)
  assert.ok(result.issues.some(issue=>/different sewer system/.test(issue.reason)))
})

test('comparison policy keeps a general engineering review offline without calling a model', async (t) => {
  const original={...config}
  t.after(()=>Object.assign(config,original))
  Object.assign(config,{provider:'ollama',localSynthesis:true,extractiveOnly:false,localSynthesisPolicy:'comparisons'})
  let calls=0
  t.mock.method(globalThis,'fetch',async()=>{calls++;throw Error('General reviews must remain offline')})
  const result=await answer('Before excavation, review a 450 mm storm main with 1.7 m cover. Can we use it without insulation?',search,{
    publicBase:'http://localhost',token:'test',signal:new AbortController().signal,
  })
  assert.equal(calls,0)
  assert.notEqual(result.mode,'local_synthesis')
  assert.ok(result.references.length>0)
  assert.ok(result.references.every(r=>r.regions.length>0))
})


test('the site-controls backstop retrieves the actual documented ESC schedule with original anchors',()=>{
 const topic=constructionControlSearch('What design and construction checks are needed for an infill?')
 const passages=search.withPageContext(search.searchSingle(topic.query).slice(0,4))
 const unit=evidenceUnits(passages,30000).find(u=>/Conduct weekly documented ESC inspections/.test(u.excerpt))
 assert.ok(unit,'The real construction-site inspection clause reaches the source pool')
 assert.ok(locateQuote(unit.passage,unit.excerpt))
})


test('a source recommendation cannot establish a mandatory runoff-control violation',()=>{
 const passage=corpus.passages.find(p=>p.doc==='doc-f27309b4bba5'&&p.page===25&&p.text.includes('should be directed around facilities'))
 assert.ok(passage)
 const quote='Runoff (e.g. overland, roof drain leaders) should be directed around facilities until stabilized'
 assert.ok(locateQuote(passage,quote))
 const draft=text=>({answerable:true,sections:[{heading:'Finding',claims:[{text,evidence:[{passageId:passage.id,quote}]}]}]})
 const rejected=validateSynthesis(draft('Using the basin as a sediment trap violates the requirement to direct runoff around facilities until stabilized.'),[passage],'Review sediment control during facility construction.')
 assert.equal(rejected.sections.length,0)
 assert.ok(rejected.issues.some(issue=>/recommendation|mandatory/.test(issue.reason)))
 const accepted=validateSynthesis(draft('Runoff should be directed around the facility until it is stabilized.'),[passage],'Review sediment control during facility construction.')
 assert.equal(accepted.sections.length,1)
})

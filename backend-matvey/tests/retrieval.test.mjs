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
import {
  replacementRequirementSearch,
  replacementPermissionSearch,
  selectedSections,
  sectionCatalog,
  passagesForSections,
  expandRetrieval,
} from '../src/retrieval-plan.mjs'
const corpus = await buildIndex(),
  search = new SearchIndex(corpus)

test('retrieval section numbers never become project inputs to selection or drafting', async (t) => {
  const original = { ...config }
  t.after(() => Object.assign(config, original))
  config.provider = 'ollama'
  const question =
    'Describe the design requirements for box planters used on a four-unit corner-lot infill development.'
  const baseline = search.search(question),
    catalog = sectionCatalog(question, baseline, search)
  const section = catalog.find((s) => s.heading === '1.5 Box Planter Design')
  assert.ok(section)
  const requests = []
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
  for (const folder of ['../public/documents', 'documents'])
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
    assert.equal(search.search(q).length, 0, q)
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

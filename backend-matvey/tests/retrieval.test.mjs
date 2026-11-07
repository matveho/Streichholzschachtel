import test from 'node:test'
import assert from 'node:assert/strict'
import { buildIndex, locateQuote } from '../src/indexer.mjs'
import { SearchIndex, tokens } from '../src/search.mjs'
import { answer, validateSynthesis } from '../src/answer.mjs'
import { config } from '../src/config.mjs'
const corpus = await buildIndex(),
  search = new SearchIndex(corpus)

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
  assert.equal(corpus.documents.length, 5)
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
test('unrelated and unsupported-domain queries return no evidence', () => {
  for (const q of [
    'What is the capital of France?',
    'How do I bake a chocolate cake?',
    'What fire resistance rating is required for a hospital staircase?',
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
  assert.ok(labels.has('Servicing'))
  assert.ok(labels.has('LID CIM'))
  assert.ok(labels.size >= 3)
})

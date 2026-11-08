import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  readIfcProperties,
  compareIfcDocuments,
} from '../src/ifc-comparison.mjs'
const elements = readIfcProperties(
  readFileSync(
    new URL('../IFC/Parkview_Exchange_Redevelopment.ifc', import.meta.url),
    'utf8',
  ),
)
const models = [{ name: 'project.ifc', elements }]
const docs = ['reference', 'client', 'design', 'report', 'supporting'].map(
  (category) => ({
    id: category,
    label: category,
    category,
    projectArtifact: category !== 'reference',
  }),
)
const compare = (text, documents = docs) =>
  compareIfcDocuments(
    models,
    documents,
    documents.map((d) => ({ doc: d.id, page: 2, text })),
  )
test('reads element-linked properties from actual IFC', () => {
  const road = elements.find((e) => e.name === 'IND-LOCAL-02')
  assert.equal(
    road.properties.find((p) => p.name === 'DesignSpeed_kph').value,
    50,
  )
  assert.ok(road.globalId)
})
test('finds differences across all five categories with both sides of evidence', () => {
  const result = compare('IND-LOCAL-02 design speed: 40 km/h')
  assert.equal(result.issues.length, 5)
  assert.equal(result.coverage.length, 5)
  assert.ok(
    result.issues.every(
      (i) =>
        i.actual === 50 &&
        i.expected === 40 &&
        i.citations[0].page === 2 &&
        i.elementId,
    ),
  )
  assert.deepEqual(
    result.issues.map((i) => i.id),
    compare('IND-LOCAL-02 design speed: 40 km/h').issues.map((i) => i.id),
  )
})
test('respects bounds and avoids unrelated elements or incompatible units', () => {
  assert.equal(
    compare('IND-LOCAL-02 minimum design speed: 40 km/h').issues.length,
    0,
  )
  assert.equal(
    compare('IND-LOCAL-02 maximum design speed: 40 km/h').issues.length,
    5,
  )
  assert.equal(compare('OTHER design speed: 40 km/h').issues.length, 0)
  assert.equal(compare('IND-LOCAL-02 design speed: 40 mm').issues.length, 0)
  assert.equal(compare('IND-LOCAL-02 design speed: 50 km/h').issues.length, 0)
})
test('reports uncheckable documents instead of implying compliance', () => {
  const result = compare('The design shall be appropriate.')
  assert.equal(result.issues.length, 0)
  assert.ok(result.coverage.every((d) => d.status === 'needs-review'))
  assert.throws(() => readIfcProperties('bad data'), /Unsupported/)
})

test('project API merges live IFC issues and preserves dismissal across rescans', async () => {
  const { ProjectApi } = await import('../src/project-api.mjs')
  const project = {
    id: 'test-comparison',
    name: 'Parkview Exchange Redevelopment',
    protectedDemo: true,
    issueStates: {},
  }
  let version = 'v1'
  let text = 'IND-LOCAL-02 design speed: 40 km/h'
  const api = Object.create(ProjectApi.prototype)
  api.store = {
    get: () => project,
    scope: () => ({
      version,
      corpus: {
        documents: [docs[0]],
        passages: [{ doc: 'reference', page: 1, text }],
      },
    }),
  }
  api.evidence = new Map()
  api.comparisonCache = new Map()
  const issues = api.issues(project.id)
  assert.equal(issues.length, 1)
  project.issueStates[issues[0].id] = { status: 'dismissed' }
  api.comparison(project.id, true)
  assert.equal(api.issues(project.id)[0].status, 'dismissed')
  text = 'IND-LOCAL-02 design speed: 50 km/h'
  version = 'v2'
  assert.equal(api.issues(project.id).length, 0)
})

test('compares labelled values and short tags in the actual project IFC output', () => {
  const projectModels = [
    {
      name: 'parkview-exchange.ifc',
      elements: readIfcProperties(
        readFileSync(
          new URL('../output/models/parkview-exchange.ifc', import.meta.url),
          'utf8',
        ),
      ),
    },
  ]
  const run = (text) =>
    compareIfcDocuments(
      projectModels,
      [docs[2]],
      [{ doc: 'design', page: 1, text }],
    )
  const result = run('S1 nominal pipe diameter: 250 mm.')
  assert.equal(result.issues.length, 1)
  assert.equal(result.issues[0].actual, 200)
  assert.equal(result.issues[0].expected, 250)
  assert.equal(result.issues[0].property, 'NominalPipeDiameter')
  assert.equal(run('S1 nominal pipe diameter: 200 mm.').issues.length, 0)
  assert.equal(run('S1 minimum grade: 1.00%.').issues.length, 1)
  assert.equal(run('S1 maximum grade: 1.00%.').issues.length, 0)
  assert.equal(
    run('S1 envelope diameter: 250 mm.').issues.some(
      (i) => i.property === 'EnvelopeDiameter',
    ),
    false,
  )
})

test('recognizes an element identifier between the property name and value', () => {
  const models = [
    {
      name: 'project.ifc',
      elements: readIfcProperties(
        readFileSync(
          new URL('../output/models/parkview-exchange.ifc', import.meta.url),
          'utf8',
        ),
      ),
    },
  ]
  const result = compareIfcDocuments(
    models,
    [docs[2]],
    [
      {
        doc: 'design',
        page: 1,
        text: 'The proposed pipe diameter for sanitary branch S1 is 250 mm PVC.',
      },
    ],
  )
  assert.equal(result.issues.length, 1)
  assert.equal(result.issues[0].actual, 200)
})

test('a changed IFC value gets a new finding identity instead of inheriting dismissal', () => {
  const doc = docs[2]
  const passages = [{ doc: doc.id, page: 1, text: 'S1 length: 40 m.' }]
  const build = (value) => [
    {
      name: 'test.ifc',
      elements: [
        {
          name: 'S1',
          elementId: '#1',
          globalId: 'element-guid',
          properties: [{ name: 'Length_m', propertyId: '#2', value }],
        },
      ],
    },
  ]
  const first = compareIfcDocuments(build(43), [doc], passages).issues[0]
  const changed = compareIfcDocuments(build(50), [doc], passages).issues[0]
  assert.notEqual(first.id, changed.id)
})

test('unsupported explicit IFC unit overrides are withheld', () => {
  const models = [
    {
      name: 'test.ifc',
      elements: [
        {
          name: 'S1',
          elementId: '#1',
          globalId: 'guid',
          properties: [
            {
              name: 'Length_m',
              propertyId: '#2',
              value: 40,
              explicitUnit: true,
            },
          ],
        },
      ],
    },
  ]
  const result = compareIfcDocuments(
    models,
    [docs[2]],
    [{ doc: 'design', page: 1, text: 'S1 length: 10 m.' }],
  )
  assert.equal(result.issues.length, 0)
  assert.equal(result.coverage[0].status, 'needs-review')
})

test('uses IFC source document/page links when drawings omit the element tag', () => {
  const models = [
    {
      name: 'north-ridge-highway.ifc',
      elements: readIfcProperties(
        readFileSync(
          new URL('../output/models/north-ridge-highway.ifc', import.meta.url),
          'utf8',
        ),
      ),
    },
  ]
  const doc = {
    ...docs[2],
    filePath: '/selected/nrh_geometric-design-plan-profile_ifr_2026-09-12.pdf',
  }
  const run = (page, text) =>
    compareIfcDocuments(models, [doc], [{ doc: doc.id, page, text }])
  const result = run(3, 'The preliminary design speed is 90 km/h.')
  assert.ok(
    result.issues.some(
      (i) =>
        i.property === 'DesignSpeed' && i.actual === 100 && i.expected === 90,
    ),
  )
  assert.equal(
    run(99, 'The preliminary design speed is 90 km/h.').issues.length,
    0,
  )
  assert.equal(run(3, 'The width is 20 m.').issues.length, 0)
})

test('includes supporting model registers so stale register values are detected', () => {
  const doc = { ...docs[4], modelFile: 'project.ifc' }
  const result = compare('IND-LOCAL-02 design speed: 40 km/h', [doc])
  assert.equal(result.coverage[0].category, 'supporting')
  assert.equal(result.issues.length, 1)
})

test('ambiguous multi-element sentences do not borrow another element value', () => {
  const models = [
    {
      name: 'test.ifc',
      elements: ['S1', 'S2'].map((name, index) => ({
        name,
        elementId: '#' + index,
        globalId: name,
        properties: [
          {
            name: 'Length_m',
            propertyId: '#' + (index + 10),
            value: index ? 50 : 43,
          },
        ],
      })),
    },
  ]
  const result = compareIfcDocuments(
    models,
    [docs[2]],
    [{ doc: 'design', page: 1, text: 'S1 length: 43 m and S2 length: 50 m.' }],
  )
  assert.equal(result.issues.length, 0)
  assert.equal(result.coverage[0].status, 'needs-review')
})

test('checks exact classification table cells with explicit limits and source coordinates', () => {
  const road = elements.find((e) => e.name === 'IND-LOCAL-01')
  const run = (row, column = 'Minimum centreline curve radii') => compareIfcDocuments(
    [{ name: 'roads.ifc', elements: [road] }], [docs[0]], [{ doc: 'reference', page: 221,
      text: 'Geometric standards', lines: [{ tableCell: '0:1:3', tableRowLabel: row,
        tableColumn: column, text: '90 m', rect: [1, 2, 3, 4] }] }],
  )
  const issue = run('Industrial Local').issues[0]
  assert.equal(issue.actual, 60)
  assert.equal(issue.expected, 90)
  assert.equal(issue.comparison, 'min')
  assert.deepEqual(issue.citations[0].regions, [[1, 2, 3, 4]])
  assert.equal(run('Residential Local').issues.length, 0)
  assert.equal(run('Industrial Local', 'Suggested radius').issues.length, 0)
})

test('generic width does not match another named width property', () => {
  const model = [{ name: 'road.ifc', elements: [{ elementId: '#1', globalId: 'guid', name: 'RD-EB',
    properties: [{ name: 'Width_m', value: 3.5, propertyId: '#2' },
      { name: 'PavedSurfaceWidth_m', value: 12, propertyId: '#3' }] }] }]
  const result = compareIfcDocuments(model, [docs[2]], [{ doc: 'design', page: 2,
    text: 'RD-EB Width 3.5 m Paved Surface Width 12.0 m.' }])
  assert.equal(result.issues.length, 0)
  assert.equal(result.coverage[0].checks, 2)
})

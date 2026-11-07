import type { ReportBlock } from './QueryReport'
import { additionalExamples, additionalReferences } from './additionalExamples'

import type { DocumentRecord } from './backend'

export const documents: Record<string, DocumentRecord> = {
  guidelines: {
    label: 'Vol. 3-03',
    code: '3-03',
    title: 'Design Guidelines',
    edition: 'May 2025',
    file: '/documents/design-guidelines.pdf',
    pages: 125,
    initialPage: 10,
    source:
      'https://www.epcor.com/content/dam/epcor/documents/supporting-documents/volume-3-03-design-guidelines%E2%80%8B%E2%80%8B.pdf',
  },
  manual: {
    label: 'Vol. 3-02',
    code: '3-02',
    title: 'Stormwater Management & Design Manual',
    edition: 'April 2025',
    file: '/documents/stormwater-manual.pdf',
    pages: 109,
    initialPage: 12,
    source:
      'https://www.epcor.com/content/dam/epcor/documents/supporting-documents/volume-3-02-stormwater-management-and-design-manual.pdf',
  },
  infill: {
    label: 'Infill LID',
    code: 'INFILL',
    title: 'Corner Lot Infill LID Guidelines',
    edition: 'May 2024',
    file: '/documents/lid-infill-guidelines.pdf',
    pages: 35,
    initialPage: 2,
    source:
      'https://www.edmonton.ca/sites/default/files/public-files/LID-Guidelines-for-Corner-Lot-Infill-Developments.pdf',
  },
  construction: {
    label: 'LID CIM',
    code: 'CIM',
    title: 'LID Construction, Inspection & Maintenance',
    edition: 'May 2016',
    file: '/documents/lid-construction-guide.pdf',
    pages: 174,
    initialPage: 24,
    source:
      'https://www.edmonton.ca/sites/default/files/public-files/assets/LID%20CIM%20Guide.pdf',
  },
  connection: {
    label: 'Servicing',
    code: 'SERVICE',
    title: 'Drainage Customer Connection Guide',
    edition: 'May 2023',
    file: '/documents/drainage-connection-guide.pdf',
    pages: 14,
    initialPage: 6,
    source:
      'https://www.epcor.com/content/dam/epcor/documents/supporting-documents/water-drainage_customer-connection-guide.pdf',
  },
} as const
export type DocId = string
// PDF points measured from the top-left of each original 612 × 792 pt page.
export type Reference = {
  id: string
  doc: DocId
  page: number
  label: string
  rect: [number, number, number, number]
  regions?: [number, number, number, number][]
  excerpt?: string
}
export const references: Reference[] = [
  {
    id: '1',
    doc: 'guidelines',
    page: 10,
    label: 'Table 2.1 · p. 4',
    rect: [100, 310, 461, 59],
  },
  {
    id: '2',
    doc: 'manual',
    page: 12,
    label: 'Table 1.1 · p. 12',
    rect: [100, 360, 461, 60],
  },
  {
    id: '3',
    doc: 'manual',
    page: 12,
    label: '§1.4.1–2 · p. 12',
    rect: [99, 540, 463, 188],
  },
  {
    id: '4',
    doc: 'guidelines',
    page: 10,
    label: '§2.1.1(ii) · p. 4',
    rect: [100, 375, 462, 98],
  },
  {
    id: '5',
    doc: 'guidelines',
    page: 10,
    label: '§2.1.1(iii) · p. 4',
    rect: [117, 565, 445, 33],
  },
  {
    id: '6',
    doc: 'guidelines',
    page: 10,
    label: '§2.1.2(i) · p. 4',
    rect: [100, 630, 462, 42],
  },
  {
    id: '7',
    doc: 'manual',
    page: 13,
    label: '§1.4.3–4 · p. 13',
    rect: [99, 77, 463, 141],
  },
  {
    id: '8',
    doc: 'manual',
    page: 13,
    label: '§1.4.6 · p. 13',
    rect: [99, 341, 463, 165],
  },
  {
    id: '9',
    doc: 'manual',
    page: 12,
    label: '§1.2 · p. 12',
    rect: [99, 218, 463, 70],
  },
]
references.push(
  {
    id: '10',
    doc: 'infill',
    page: 2,
    label: 'Servicing approval and alternatives · p. 2',
    rect: [52, 444, 514, 223],
  },
  {
    id: '11',
    doc: 'connection',
    page: 6,
    label: 'Minimum requirements · p. 5',
    rect: [48, 57, 518, 34],
  },
  {
    id: '12',
    doc: 'construction',
    page: 24,
    label: '§4.2.4 · p. 16',
    rect: [58, 576, 505, 125],
  },
  {
    id: '13',
    doc: 'infill',
    page: 18,
    label: '§1.5.1–2 · p. 18',
    rect: [52, 292, 333, 123],
  },
  {
    id: '14',
    doc: 'infill',
    page: 18,
    label: '§1.5.4–5 · p. 18',
    rect: [52, 492, 514, 164],
  },
  {
    id: '15',
    doc: 'construction',
    page: 24,
    label: '§4.2.2 · p. 16',
    rect: [58, 181, 505, 188],
  },
  {
    id: '16',
    doc: 'construction',
    page: 25,
    label: '§4.2.6 · p. 17',
    rect: [58, 346, 505, 331],
  },
)
export const exampleQuery =
  'For a 20 ha development, what design storm, runoff method and pipe-sizing criteria apply to the minor storm sewer system?'
export const report: ReportBlock[] = [
  {
    sentences: [
      {
        text: 'Use the 1:5-year rainfall event for this 20 ha catchment.',
        refs: ['1', '2'],
      },
      {
        text: 'Both documents place areas of 30 ha or less in this category; the additional 25% capacity allowance applies to areas above 30 ha.',
        refs: ['1', '2'],
      },
    ],
  },
  {
    sentences: [
      {
        text: 'The Rational Method is permitted for minor-system catchments of approximately 65 ha or less: Q = CIA / 360, with Q in m³/s, I in mm/h and A in ha.',
        refs: ['3'],
      },
      {
        text: 'Computer simulation is recommended for final analyses and detailed design.',
        refs: ['9'],
      },
    ],
  },
  {
    heading: 'Pipe design',
    sentences: [
      {
        text: 'Size the storm sewer with Manning’s equation at full flow (d/D = 1), using n = 0.013 for smooth-wall pipe.',
        refs: ['4'],
      },
      {
        text: 'The minimum storm-main diameter is 300 mm; catch-basin leads may be 250 mm.',
        refs: ['5'],
      },
      {
        text: 'Target a full-flow mean velocity of 0.90–1.0 m/s. Lower velocities require a feasibility or cost justification; values below 0.6 m/s are not permitted.',
        refs: ['6'],
      },
    ],
  },
  {
    heading: 'Information still needed',
    sentences: [
      {
        text: 'A final pipe diameter cannot be established from catchment area alone.',
        refs: ['4'],
      },
      {
        text: 'Determine the runoff coefficient from ultimate land use or imperviousness, the IDF intensity at the time of concentration, and the proposed pipe slope.',
        refs: ['7', '8', '4'],
      },
    ],
  },
]

export type QueryCase = {
  id: string
  title: string
  prompt: string
  documentIds: DocId[]
  referenceIds: string[]
  initialReferences: string[]
  report: ReportBlock[]
}
export const infillQuery =
  'For a four-unit corner-lot infill, can a box planter replace conventional storm servicing, and what design and construction checks are needed?'
export const infillReport: ReportBlock[] = [
  {
    sentences: [
      {
        text: 'A box-planter concept needs both a confirmed servicing arrangement and a construction plan that protects its infiltration media.',
        refs: ['10', '11', '12'],
      },
      {
        text: 'The 2024 corner-lot guideline allows LID in place of traditional underground storm servicing, but utility connections remain subject to EPCOR approval.',
        refs: ['10'],
      },
      {
        text: 'The 2023 connection guide states a general private-storm-system requirement for developments of three units or more. Confirm the site-specific servicing arrangement with EPCOR rather than treating the LID guideline as an automatic exemption.',
        refs: ['11', '10'],
      },
    ],
  },
  {
    heading: 'Box-planter checks',
    sentences: [
      {
        text: 'The corner-lot guideline limits ponding depth to 350 mm, requires a width of at least 450 mm and surface slopes below 0.5%, and directs garage and dwelling roof leaders into the facility.',
        refs: ['13', '14'],
      },
      {
        text: 'Box-planter underdrains should not connect to combined sewers; without an underdrain, provide a surface outlet.',
        refs: ['13'],
      },
    ],
  },
  {
    heading: 'Protect the facility during construction',
    sentences: [
      {
        text: 'The 2016 construction guide recommends building LID last where possible; otherwise keep it offline and divert runoff around it during construction.',
        refs: ['15'],
      },
      {
        text: 'Mark and protect no-compaction zones before construction. Do not use the facility as a temporary sediment basin; divert runoff until stabilized, document weekly erosion-control inspections, and inspect and repair controls after rainfall.',
        refs: ['12', '16'],
      },
    ],
  },
  {
    heading: 'Before proceeding',
    sentences: [
      {
        text: 'Confirm the applicable editions and the accepted servicing arrangement. These guides address different scopes and dates; the cited passages do not establish project approval or a complete facility design.',
        refs: ['10', '11'],
      },
    ],
  },
]
export const queryCases: QueryCase[] = [
  {
    id: 'storm',
    title: 'Minor storm sewer design',
    prompt: exampleQuery,
    documentIds: ['guidelines', 'manual'],
    referenceIds: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
    initialReferences: ['1', '2'],
    report,
  },
  {
    id: 'infill',
    title: 'Corner-lot LID and servicing',
    prompt: infillQuery,
    documentIds: ['infill', 'connection', 'construction'],
    referenceIds: ['10', '11', '12', '13', '14', '15', '16'],
    initialReferences: ['10', '11', '12'],
    report: infillReport,
  },
]

references.push(...additionalReferences)
queryCases.push(...additionalExamples)

export const referenceSets: Record<string, Reference[]> = Object.fromEntries(
  queryCases.map((c) => [
    c.id,
    references.filter((r) => c.referenceIds.includes(r.id)),
  ]),
)

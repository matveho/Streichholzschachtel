export type DocId = 'guidelines' | 'manual'
export const documents = {
  guidelines: {
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
    code: '3-02',
    title: 'Stormwater Management & Design Manual',
    edition: 'April 2025',
    file: '/documents/stormwater-manual.pdf',
    pages: 109,
    initialPage: 12,
    source:
      'https://www.epcor.com/content/dam/epcor/documents/supporting-documents/volume-3-02-stormwater-management-and-design-manual.pdf',
  },
} as const
// PDF points measured from the top-left of each original 612 × 792 pt page.
export type Reference = {
  id: string
  doc: DocId
  page: number
  label: string
  rect: [number, number, number, number]
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
export const exampleQuery =
  'For a 20 ha development in Edmonton, what design storm, runoff method and pipe-sizing criteria apply to the minor storm sewer system?'
export const findings = [
  {
    title: 'Design storm',
    text: 'Use the 1:5-year rainfall event for this 20 ha catchment. Both documents place areas ≤30 ha in this category; the additional 25% capacity allowance applies to areas above 30 ha.',
    refs: ['1', '2'],
  },
  {
    title: 'Runoff method',
    text: 'The Rational Method is permitted for minor-system catchments of approximately 65 ha or less: Q = CIA / 360, with Q in m³/s, I in mm/h and A in ha. Computer simulation is recommended for final analyses and detailed design.',
    refs: ['3', '9'],
  },
  {
    title: 'Pipe sizing',
    text: 'Size the storm sewer with Manning’s equation at full flow (d/D = 1). Use n = 0.013 for smooth-wall pipe. Minimum storm-main diameter is 300 mm; catch-basin leads may be 250 mm.',
    refs: ['4', '5'],
  },
  {
    title: 'Velocity',
    text: 'Target a full-flow mean velocity of 0.90–1.0 m/s. Lower velocities require a feasibility or cost justification; values below 0.6 m/s are not permitted.',
    refs: ['6'],
  },
  {
    title: 'Inputs still required',
    text: 'A final pipe diameter cannot be established from catchment area alone. Determine the runoff coefficient from ultimate land use or imperviousness, the IDF intensity at the time of concentration, and the proposed pipe slope.',
    refs: ['7', '8', '4'],
  },
]

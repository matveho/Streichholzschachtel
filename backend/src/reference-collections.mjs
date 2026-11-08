import { basename } from 'node:path'

// Membership is explicit. Similar filenames are not evidence of applicability.
const definitions = [
  {
    id: 'edmonton-urban-servicing',
    title: 'Urban Development & Servicing',
    authority: 'City of Edmonton / EPCOR',
    jurisdiction: 'Edmonton, Alberta',
    description:
      'Drainage, water, development approval and Complete Streets references for integrated municipal servicing and frontage design. Confirm project applicability and incorporated amendments.',
    files: [
      'design-guidelines.pdf',
      'stormwater-manual.pdf',
      'volume-3-01-development-planning-procedure-and-framework.pdf',
      'volume-3-05-drawing-requirements-approvals-and-asset-acceptance-transfer.pdf',
      'volume-3-06-construction-specifications-and-standard-drawings.pdf',
      '2024_water_design-standards_volume-4.pdf',
      '2024-09_design-guidelines.pdf',
      'hydraulic-network-analysis-process-overview.pdf',
      'COE-IM-GUIDE-0046-CSDCS-2-01-standards.pdf',
      'COE-IM-GUIDE-0048-CSDCS-2-03.pdf',
    ],
  },
  {
    id: 'alberta-highway-design',
    title: 'Provincial Highway Design',
    authority: 'Alberta Transportation and Economic Corridors',
    jurisdiction: 'Alberta',
    description:
      'Rural highway principles, alignment, cross-sections, intersections, access, traffic assessment, pavement and work-zone references, including indexed amendments. Confirm additional active bulletins before final design.',
    files: [
      'trans-highway-geometric-design-guide-chapter-a-2022-02.pdf',
      'trans-highway-geometric-design-guide-chapter-b-2020-09.pdf',
      'trans-highway-geometric-design-guide-chapter-c-2022-02.pdf',
      'trans-highway-geometric-design-guide-chapter-d-1999-08.pdf',
      'trans-highway-geometric-design-guide-chapter-i-2005-10.pdf',
      'trans-traffic-impact-assessment-guidelines-2021-02.pdf',
      'pavedm2.pdf',
      'design-bulletin-77-march-2017.pdf',
      'trans-design-bulletin-99-revision-8-2023-04.pdf',
      'tec-design-exceptions-guideline-2026-09.pdf',
      'tec-traffic-accommodation-in-work-zones-2025.pdf',
    ],
  },
  {
    id: 'edmonton-drainage',
    title: 'Drainage & Stormwater',
    authority: 'City of Edmonton / EPCOR',
    jurisdiction: 'Edmonton, Alberta',
    description:
      'Current indexed drainage design, stormwater, connection, construction and low-impact-development publications. Confirm applicability and incorporated addenda for the project.',
    files: [
      'stormwater-manual.pdf',
      'design-guidelines.pdf',
      '2023_drainage_design-standards_addendum-2_volume-3-02.pdf',
      'volume-3-06-construction-specifications-and-standard-drawings.pdf',
      'drainage-connection-guide.pdf',
      'lid-infill-guidelines.pdf',
      'lid-construction-guide.pdf',
      'drainage-approved-product-list.pdf',
    ],
  },
  {
    id: 'edmonton-development',
    title: 'Development Planning & Acceptance',
    authority: 'City of Edmonton / EPCOR',
    jurisdiction: 'Edmonton, Alberta',
    description:
      'Drainage development planning, drawing submissions, approvals and asset acceptance.',
    files: [
      'volume-3-01-development-planning-procedure-and-framework.pdf',
      'volume-3-05-drawing-requirements-approvals-and-asset-acceptance-transfer.pdf',
    ],
  },
  {
    id: 'edmonton-water',
    title: 'Water Infrastructure',
    authority: 'City of Edmonton / EPCOR',
    jurisdiction: 'Edmonton, Alberta',
    description:
      'Water design and construction, demand/fire-flow design guidance, and the hydraulic network analysis process.',
    files: [
      '2024_water_design-standards_volume-4.pdf',
      '2024-09_design-guidelines.pdf',
      'hydraulic-network-analysis-process-overview.pdf',
    ],
  },
  {
    id: 'edmonton-roadways',
    title: 'Transportation & Roadways',
    authority: 'City of Edmonton',
    jurisdiction: 'Edmonton, Alberta',
    description:
      'Municipal transportation, complete-street geometry and roadway/walkway lighting references.',
    files: [
      'COE-IM-GUIDE-0013.pdf',
      'COE-IM-GUIDE-0046-CSDCS-2-01-standards.pdf',
      'COE-IM-GUIDE-0048-CSDCS-2-03.pdf',
      'Road_Walkway_Lighting_Design_Standards.pdf',
    ],
  },
  {
    id: 'alberta-bridges',
    title: 'Bridge Design & Highway Infrastructure',
    authority: 'Alberta Transportation',
    jurisdiction: 'Alberta',
    description:
      'Bridge Structures Design Criteria v9.0 and highway geometric design chapters B and C. The project must establish its adopted editions and contractual applicability.',
    files: [
      'trans-bridge-structures-design-criteria-version-9-0.pdf',
      'trans-highway-geometric-design-guide-chapter-b-2020-09.pdf',
      'trans-highway-geometric-design-guide-chapter-c-2022-02.pdf',
    ],
  },
  {
    id: 'edmonton-transit',
    title: 'High-Floor LRT',
    authority: 'City of Edmonton',
    jurisdiction: 'Edmonton, Alberta',
    description:
      'High-floor light rail design guidance; separate from general roadway standards.',
    files: ['High-Floor-LRT-Design-Guidelines.pdf'],
  },
  {
    id: 'edmonton-power',
    title: 'Underground Power Distribution',
    authority: 'City of Edmonton',
    jurisdiction: 'Edmonton, Alberta',
    description: 'Volume 7 underground power distribution standards, May 2026.',
    files: ['2026-power-design-standards-volume-7.pdf'],
  },
]

export function referenceCollections(corpus) {
  return definitions
    .map(({ files, ...item }) => {
      const documents = corpus.documents.filter(
        (d) =>
          !d.projectArtifact &&
          [basename(d.filePath), ...(d.filenames || [])].some((name) =>
            files.includes(name),
          ),
      )
      return {
        ...item,
        documentIds: documents.map((d) => d.id),
        documentCount: documents.length,
        missingFiles: files.filter(
          (file) =>
            !documents.some((d) =>
              [basename(d.filePath), ...(d.filenames || [])].includes(file),
            ),
        ),
      }
    })
    .filter((c) => c.documentCount > 0)
}

import type { QueryCase, Reference } from './data'

export const additionalReferences: Reference[] = [
  {
    id: '17',
    doc: 'guidelines',
    page: 11,
    label: '§2.2.1 · p. 5',
    rect: [63, 455, 500, 69],
  },
  {
    id: '18',
    doc: 'guidelines',
    page: 11,
    label: '§2.2.2 · p. 5',
    rect: [63, 524, 500, 65],
  },
  {
    id: '19',
    doc: 'connection',
    page: 5,
    label: 'Storm-service cover · p. 4',
    rect: [48, 589, 518, 34],
  },
  {
    id: '20',
    doc: 'connection',
    page: 4,
    label: 'Applications: elevation changes · p. 3',
    rect: [48, 431, 518, 60],
  },
  {
    id: '21',
    doc: 'manual',
    page: 13,
    label: '§1.5.1 · p. 13',
    rect: [63, 617, 500, 58],
  },
  {
    id: '22',
    doc: 'manual',
    page: 12,
    label: 'Table 1.1: major-system basis · p. 12',
    rect: [100, 360, 461, 168],
  },
  {
    id: '23',
    doc: 'manual',
    page: 97,
    label: '§5.16.2(ii)(a–b) · p. 97',
    rect: [63, 258, 500, 116],
  },
  {
    id: '24',
    doc: 'manual',
    page: 97,
    label: '§5.16.2(ii)(c–f) · p. 97',
    rect: [63, 373, 500, 119],
  },
  {
    id: '25',
    doc: 'manual',
    page: 97,
    label: '§5.16.2(i) · p. 97',
    rect: [63, 177, 500, 80],
  },
  {
    id: '26',
    doc: 'manual',
    page: 97,
    label: '§5.16.2(vi) · p. 97',
    rect: [63, 565, 500, 43],
  },
  {
    id: '27',
    doc: 'infill',
    page: 30,
    label: '§1.8: erosion and sediment control · p. 30',
    rect: [52, 120, 514, 207],
  },
]

export const additionalExamples: QueryCase[] = [
  {
    id: 'cover',
    title: 'Shallow sewer cover review',
    prompt:
      'Before excavation, review a 450 mm storm main with 1.7 m cover and a storm service with 2.0 m cover at the property line. Can we use these details without insulation or further approval?',
    documentIds: ['guidelines', 'connection'],
    referenceIds: ['17', '18', '19', '20'],
    initialReferences: ['17', '19'],
    report: [
      {
        sentences: [
          {
            text: 'The proposed uninsulated main detail needs revision: 1.7 m is 0.3 m short of the 2025 guideline’s 2.0 m cover requirement for storm pipes smaller than 600 mm.',
            refs: ['17'],
          },
          {
            text: 'Where that cover cannot be achieved, §2.2.1 calls for adequate frost insulation installed to the manufacturer’s procedures and shown on the drawings; the 1.5 m threshold applies to pipes of 600 mm or larger, not this 450 mm main.',
            refs: ['17'],
          },
        ],
      },
      {
        heading: 'Resolve the service-interface discrepancy',
        sentences: [
          {
            text: 'For the service, the 2025 guideline says to match the sanitary-service depth where practical, otherwise provide at least 2.0 m cover or adequate insulation if that cannot be achieved.',
            refs: ['18'],
          },
          {
            text: 'The separate May 2023 connection guide specifies at least 2.4 m cover for storm services at the property line. The proposed 2.0 m is 0.4 m below that value. Confirm the governing service detail with EPCOR; do not assume the newer main-design provision alone resolves this difference in scope and edition.',
            refs: ['19', '18'],
          },
        ],
      },
      {
        heading: 'Before setting out the trench',
        sentences: [
          {
            text: 'Check finished-grade and pipe-obvert elevations, establish the accepted service-interface elevation, and resolve the insulation detail with the designer. Cover alone does not establish an insulation thickness.',
            refs: ['17', '18', '19'],
          },
          {
            text: 'Notify EPCOR of changes to private-site service alignments or property-line elevations before construction of its portion of the services. The connection guide identifies additional charges or construction to the previously accepted elevations as possible consequences of unresolved changes.',
            refs: ['20'],
          },
        ],
      },
    ],
  },
  {
    id: 'expansion',
    title: 'Drainage capacity after expansion',
    prompt:
      'A subdivision has expanded from 28 ha to 42 ha. The revised five-year runoff estimate is 1.20 m³/s, but the existing sewer design carries 0.90 m³/s. Can we retain it and size the new detention pond with the Rational Method?',
    documentIds: ['guidelines', 'manual'],
    referenceIds: ['1', '2', '3', '4', '7', '8', '9', '21', '22'],
    initialReferences: ['1', '2'],
    report: [
      {
        sentences: [
          {
            text: 'The stated 0.90 m³/s capacity is insufficient on the supplied assumptions. At 42 ha, the minor sewer falls above the 30 ha threshold and must accommodate 1.25 times the five-year runoff.',
            refs: ['1', '2'],
          },
          {
            text: 'Using the query’s revised runoff estimate, 1.25 × 1.20 = 1.50 m³/s, leaving a 0.60 m³/s capacity gap against the stated design. This is a comparison of the supplied figures, not a verified hydraulic model or a recommended pipe diameter.',
            refs: ['1', '2'],
          },
        ],
      },
      {
        heading: 'Separate conveyance from storage',
        sentences: [
          {
            text: 'At 42 ha, the Rational Method remains permitted for minor conveyance design because the catchment is below approximately 65 ha; computer simulation is nevertheless recommended for final analyses.',
            refs: ['3', '9'],
          },
          {
            text: 'That allowance does not extend to sizing the detention pond: §1.5.1 requires computer modelling for all stormwater management storage facilities, regardless of catchment area.',
            refs: ['21'],
          },
          {
            text: 'The major conveyance system has a separate 100-year rainfall basis. A minor-sewer capacity check alone does not demonstrate protection during larger events.',
            refs: ['22'],
          },
        ],
      },
      {
        heading: 'Revise before carrying the design forward',
        sentences: [
          {
            text: 'Verify the expanded catchment’s land use, runoff coefficient and time of concentration before accepting the 1.20 m³/s input. Recalculate full-flow pipe capacity with Manning’s equation and model the proposed storage.',
            refs: ['7', '8', '4', '21'],
          },
          {
            text: 'The next deliverable is a revised conveyance-and-storage assessment, not simply a 25% increase in the old 28 ha flow or an assumed proportional increase in pipe diameter.',
            refs: ['1', '4', '21'],
          },
        ],
      },
    ],
  },
  {
    id: 'acceptance',
    title: 'LID infiltration acceptance',
    prompt:
      'A four-unit corner-lot bioretention basin was used as a sediment trap and crossed by delivery vehicles. It has 500 m² of surface area and 600 mm of LID soil. Are completion photos enough for acceptance, or what testing and corrective work should we require?',
    documentIds: ['manual', 'construction', 'infill'],
    referenceIds: ['12', '16', '23', '24', '25', '26', '27'],
    initialReferences: ['23', '16', '27'],
    report: [
      {
        sentences: [
          {
            text: 'Completion photos do not establish infiltration performance. The reported traffic and sediment exposure warrant a documented inspection and testing plan before treating this facility as ready for acceptance.',
            refs: ['23', '16', '27'],
          },
          {
            text: 'The 2016 construction guide advises against using LID as a temporary sediment basin, while the 2024 corner-lot guideline calls for fencing to prevent compaction and sediment entry, maintained through plant establishment.',
            refs: ['16', '27'],
          },
        ],
      },
      {
        heading: 'Tests for the stated size and soil depth',
        sentences: [
          {
            text: 'Under the supplied April 2025 standard, a 500 m² facility requires Guelph Permeameter testing at a minimum of two locations, plus a QA/QC test adjacent to one location within 3 m. These tests are required before concrete placement or planting.',
            refs: ['23'],
          },
          {
            text: 'For 600 mm soil, halfway-depth testing is preferred. The exemption for soil 300 mm deep or less does not apply. Confirm the accepted media specification and test results with the reviewer.',
            refs: ['24'],
          },
        ],
      },
      {
        heading: 'Avoid applying the wrong compaction criterion',
        sentences: [
          {
            text: 'The standard’s growing-media recommendation is 75–85% Standard Proctor density depending on soil type, unless structural purposes require more. Its separate 95% minimum concerns soil-cell subgrade and granular base; it is not a blanket bioretention growing-media target.',
            refs: ['25', '26'],
          },
        ],
      },
      {
        heading: 'Correct and verify',
        sentences: [
          {
            text: 'Stop further traffic and sediment inflow, inspect the affected media and restore the protective controls. Have the designer specify corrective work and verification; the construction guide links compaction to reduced infiltration, so visual tidiness alone cannot demonstrate recovery.',
            refs: ['12', '16', '27'],
          },
          {
            text: 'If planting has already occurred or test results fail, agree the corrective and testing route with the reviewer. The 2025 standard permits the contractor to request alternative testing after failed Guelph tests at the contractor’s cost; it does not grant acceptance automatically.',
            refs: ['23', '24'],
          },
        ],
      },
    ],
  },
]

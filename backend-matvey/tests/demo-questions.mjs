// Demo question set with the facts each answer must contain.
// `expect` entries are matched case-insensitively against the rendered answer
// text; `docs` against the cited document labels/editions; `mode` against the
// result mode. Used by tests/demo.test.mjs and `node tests/run-demo.mjs`.
export const demoQuestions = [
  {
    q: 'What are the runoff coefficients for residential areas in Edmonton?',
    expect: [
      '0.65 or 0.7',
      '0.7 or 0.75',
      'Residential (Low Density)',
      'Residential (High Density)',
      'removed and replaced',
      'Addendum #2',
    ],
    docs: ['Vol. 3-02 Addendum #2'],
  },
  {
    q: 'Which edition of Vol. 3-01 is currently in effect and when did it become effective?',
    expect: ['April 2025', 'effective as of August 2025'],
    mode: 'version_answer',
  },
  {
    q: 'What changed in Vol. 3-01 between the previous edition and April 2025?',
    expect: [
      '300 mm',
      '0.5 m',
      '8.5.3',
      '8.5.4',
      '1.0 m',
      '2012',
      'maintenance hole',
    ],
    mode: 'version_answer',
  },
  {
    q: 'When was Vol. 3-05 last updated?',
    expect: ['May 2025'],
    mode: 'version_answer',
  },
  {
    q: 'When was the Drainage Approved Product List last updated?',
    expect: ['June 2026'],
    mode: 'version_answer',
  },
  {
    q: 'What is the runoff coefficient for industrial land use in Edmonton?',
    expect: ['BE, IH, IM', '0.85 to 0.95'],
  },
  {
    q: 'What runoff coefficient applies to River Valley zoning in Edmonton?',
    expect: ['RVSA, NA', '0.2'],
  },
  {
    q: 'What runoff coefficient should I use for a commercial development with landscaped parking areas?',
    expect: ['CB, CG, MU', '0.85 to 0.95', 'landscaped areas'],
  },
  {
    q: 'My project is zoned UF. What runoff coefficient applies?',
    expect: ['Urban Facilities', '0.6'],
  },
  {
    q: 'What per capita daily sewage flow rate do I use for designing new residential developments?',
    expect: ['160', 'For design of all new and infill developments', '220'],
  },
  {
    q: 'What is the inflow and infiltration allowance for a new development?',
    expect: ['0.14', 'For design of new developments', '0.28'],
  },
  {
    q: 'What changed in the sanitary flow design guidelines in August 2024?',
    expect: [
      'Reduction in residential sanitary flow generation',
      'Inflow and Infiltration',
      'sag location',
      'foundation drain',
      'Restructure the HNA section',
    ],
    mode: 'version_answer',
  },
  {
    q: 'What is the residential unit density for an RS zone?',
    expect: ['RS | Small Scale Residential Zone | 35'],
  },
  {
    q: 'What sanitary flow rate applies to a hotel?',
    expect: ['Hotels | 50', 'm3/day'],
  },
  {
    q: 'What is the minimum water pressure for residential fire sprinklers?',
    expect: ['Minimum Residential Fire Sprinklers Pressure (MDD) | 350 kPa'],
  },
  {
    q: 'What fire flow is required for single family residential development?',
    expect: ['Single Family Residential (RS, RSF, RR) | 100 L/s'],
  },
  {
    q: 'What fire flow is required for a high-density multi-family residential development zoned RM?',
    expect: ['(RM, RL, MU, BE, IH, UI, AJ) | 300 L/s'],
  },
  {
    q: 'What must be submitted 3 months before Final Acceptance Certificate for sewer work?',
    expect: ['as-built POR drawings shall be submitted 3 months prior to FAC'],
  },
  {
    q: 'What leakage testing percentage is required for sanitary sewers at Construction Completion?',
    expect: ['10% of all sanitary sewers'],
  },
  {
    q: 'What is required before EPCOR will review detailed engineering drawings?',
    expect: ['approved NDR'],
  },
  {
    q: 'What is the minimum slope for a sanitary service from property line to crown of the public sewer?',
    expect: ['2% slope for sanitary service', '2.4m'],
  },
  {
    q: 'What is the minimum slope for a storm service connection?',
    expect: ['1% slope for storm services', '2.4m'],
  },
  {
    q: 'What depth must water services be at the property line?',
    expect: ['between 2.4m and 2.75m'],
  },
  {
    q: 'Do I need stormwater runoff control on a 0.5 hectare commercial lot?',
    expect: ['greater than 0.16ha'],
  },
  {
    q: 'Is HDPE pipe approved for use in storm sewers in Edmonton?',
    expect: [
      'HDPE pipe is approved for forcemains and pipe busting applications only',
    ],
  },
  {
    q: 'What PVC pipe is approved for sewer forcemains and trenchless applications?',
    expect: ['PVC PSM SDR14/SDR18', 'IPEX', 'CSA B137.3', 'shall not be blue'],
  },
  {
    q: 'Who are the approved manufacturers of reinforced concrete pipe in Edmonton?',
    expect: ['Lafarge/Amrize', 'Proform', 'Inland Pipe', 'Precon'],
  },
  {
    // Vol. 4 Water (Dec 2024) is in the collection; Table 1.2 gives invert depth.
    q: 'What is the minimum depth of water main invert below the curb top in Edmonton?',
    expect: ['minimum depth of water main invert below the curb top', '2.59 m'],
    docs: ['Vol. 4 Water'],
  },
  {
    q: "What are Strathcona County's runoff coefficients?",
    expect: [
      'Strathcona County design standards are not in the indexed documents',
    ],
    mode: 'no_evidence',
  },
  // Out-of-scope questions must not be answered from loosely related text.
  {
    q: 'What is the minimum ceiling height for a basement suite?',
    expect: ['not found'],
    mode: 'no_evidence',
  },
  {
    q: 'What is the posted speed limit on residential streets?',
    expect: ['not found'],
    mode: 'no_evidence',
  },
  {
    q: 'How many parking stalls are required for a restaurant?',
    expect: ['not found'],
    mode: 'no_evidence',
  },
  {
    q: 'What is the maximum stair riser height in a house?',
    expect: ['not found'],
    mode: 'no_evidence',
  },
  {
    q: 'What are the runoff coefficients used in Calgary?',
    expect: ['not in the indexed documents'],
    mode: 'no_evidence',
  },
]

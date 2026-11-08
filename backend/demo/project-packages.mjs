// Fictional project artifacts; governing publications remain unmodified originals.
// All people, owners and consultant identities in these packages are invented.
const doc = (file, title, code, category, date, pages, drawing) => ({
  file,
  title,
  code,
  category,
  edition: `Issued for review · ${date}`,
  date,
  origin: 'synthetic-project-artifact',
  pages,
  drawing,
})
const px = (suffix) => `pxr_${suffix}.pdf`
const nr = (suffix) => `nrh_${suffix}.pdf`
export const projectPackages = [
  {
    id: 'parkview-exchange',
    name: 'Parkview Exchange Redevelopment',
    client: 'Parkview Exchange Developments Ltd.',
    location: 'Edmonton, Alberta',
    discipline: 'Municipal servicing & streetscape',
    description:
      'Civil servicing and frontage coordination for a 0.84 ha mixed-use redevelopment: 92 residences, 1,250 m² commercial space and connections to existing municipal infrastructure.',
    collectionIds: ['edmonton-urban-servicing'],
    projectNumber: 'PX-26017',
    documents: [
      doc(
        px('client-design-brief_rev0_2026-09-18'),
        'Client design brief',
        'PX-CR-001',
        'client',
        '2026-09-18',
        [
          [
            'Project mandate',
            'Parkview Exchange Developments Ltd. commissions Cairnfield Civil Studio Ltd. to develop the civil servicing, grading and frontage concept for Parkview Exchange Redevelopment, project PX-26017. The site is 0.84 ha. The six-storey development comprises 92 residential units and 1,250 m² of ground-floor commercial space. Target occupancy is Q3 2028.',
            'Scope includes sanitary and storm servicing, water servicing, surface drainage, pedestrian frontage and coordination of access. This issue establishes the owner brief for review; no construction authorization or municipal acceptance is represented.',
          ],
          [
            'Servicing strategy',
            'Minimize utility relocation where technically acceptable. Connect to existing municipal systems only after capacity, geometry, acceptance and property interfaces are confirmed. The 250 m² east retail/frontage component is assigned to upstream sanitary branch S1. The 92 residences and remaining 1,000 m² commercial space use separate building service S2.',
            'S1 is a proposed municipal upstream reach, not the sanitary service for the entire development. The preliminary 0.34 L/s peak dry-weather-flow allocation to S1 requires confirmation through the accepted neighbourhood design report. Whole-site sanitary loading and downstream capacity remain hold points.',
          ],
          [
            'Deliverables and acceptance',
            'Review package: existing conditions survey, C101/C102 servicing drawings, servicing design memo, C201/C202 grading drawings and coordination register. Design Basis: current applicable EPCOR Volume 3 drainage publications, Volume 4 water standards and City Complete Streets standards.',
            'Resolve S1 upstream grade, ST1 terminal reach grade, storm cover and water/sewer crossing X1 before detailed design. Owner preference for reduced excavation does not constitute approval of a departure from a governing criterion.',
          ],
        ],
      ),
      doc(
        px('existing-conditions-survey_rev0_2026-09-22'),
        'Existing conditions and survey summary',
        'PX-SV-001',
        'report',
        '2026-09-22',
        [
          [
            'Survey control and site',
            'Working site envelope: 84 m east-west by 100 m north-south; area 8,400 m². Local working coordinates are used for this review package. Benchmark BM1 elevation is 671.420 m. Existing site elevations range from 670.85 m to 672.10 m.',
            'Boundary and utility information are preliminary design inputs. Legal boundaries, easements, municipal survey datum and buried plant must be confirmed before detailed design. Utility elevations below are coordination values, not certified as-built records.',
          ],
          [
            'Existing utility register',
            'MH-S0: existing sanitary maintenance hole, rim 671.220 m, outgoing invert 668.300 m. MH-ST0: existing storm maintenance hole, rim 671.180 m, outgoing invert 668.700 m. Existing municipal watermain is nominally 150 mm.',
            'Crossing X1: watermain underside elevation 668.600 m; proposed S2 sewer-service outside crown elevation 668.380 m. The sewer service passes below the watermain. Utility exposure is required to confirm the assumed outside surfaces.',
          ],
          [
            'Constraints and coordination',
            'The east utility corridor constrains excavation and the owner prefers avoiding relocation. The proposed finished floor is 672.250 m. Ground at ST1 chainage 0+018 is proposed to finish at 671.300 m.',
            'No infiltration rate or seasonal groundwater level has been adopted. Field investigation and receiving-system capacity checks are outstanding. These omissions are explicit hold points rather than assumed evidence of acceptable performance.',
          ],
        ],
      ),
      doc(
        px('site-servicing-plan_ifr_2026-10-02'),
        'Site servicing plan and utility profile',
        'C101 / C102',
        'design',
        '2026-10-02',
        [
          [
            'C101 · Site servicing plan',
            'S1 is a 200 mm PVC upstream sanitary reach, 43 m long at 0.30% grade, with peak DWF 0.34 L/s. S1 serves only the 250 m² east retail/frontage component. S2 separately serves the 92 residences and remaining 1,000 m² commercial area.',
            'ST1 is the most upstream storm reach, from the terminal maintenance hole to the first downstream maintenance hole: 300 mm nominal diameter, 38 m long at 0.25% grade.',
          ],
          [
            'C102 · Utility profile',
            'At ST1 chainage 0+018, finished grade is 671.300 m and outside pipe crown is 669.650 m, providing 1.650 m cover. No insulation detail is included in this issue.',
            'At crossing X1, sewer service S2 passes below the watermain with 0.220 m vertical clearance between outside surfaces. Water underside 668.600 m minus sewer crown 668.380 m equals 0.220 m.',
          ],
        ],
        'parkview-servicing',
      ),
      doc(
        px('servicing-design-memo_rev1_2026-10-03'),
        'Servicing design basis and calculations',
        'PX-DM-001',
        'report',
        '2026-10-03',
        [
          [
            'Design Basis and limits',
            'This memorandum records the preliminary servicing basis for PX-26017. Applicable editions are EPCOR Volume 3-03, May 2025, together with the current planning, stormwater, approval and water publications associated with the project. Approval of an alternate detail is not assumed.',
            'The network is divided into S1, a limited upstream branch serving 250 m² east retail/frontage, and S2, the remaining building service. A complete accepted whole-development flow model and downstream capacity review are not yet available.',
          ],
          [
            'Sanitary branch S1',
            'Peak dry-weather flow assigned to upstream branch S1 is 0.34 L/s. This is not the total flow from 92 residences. The allocation is provisional and must be reconciled with the accepted neighbourhood design report.',
            'The proposed pipe diameter for sanitary branch S1 is 200 mm PVC. Selected S1 geometry: 200 mm PVC; length 43.0 m; upstream invert 668.480 m; downstream invert 668.351 m. Fall = 43.0 × 0.0030 = 0.129 m. Grade = 0.129 / 43.0 × 100 = 0.30%. The shallow grade was selected to reduce excavation; compliance with the upstream criterion is unresolved.',
          ],
          [
            'Storm reach ST1',
            'ST1 is a 300 mm terminal storm reach, 38.0 m long at 0.25% grade. Outside crown levels are 669.695 m at 0+000, 669.650 m at 0+018 and 669.600 m at 0+038. Total fall = 38.0 × 0.0025 = 0.095 m.',
            'Cover at 0+018 = finished grade 671.300 minus outside crown 669.650 = 1.650 m. No insulation design or accepted alternate cover detail is provided. Upstream minimum slope and shallow-cover provisions require separate review.',
          ],
          [
            'Utility crossing and hold points',
            'X1 is the S2 sanitary sewer service crossing below the 150 mm watermain. Vertical clearance = 668.600 - 668.380 = 0.220 m. Dimensions are outside-to-outside and require field confirmation.',
            'Before release: revise or resolve S1 and ST1 slopes; provide adequate insulation if retaining shallow ST1 cover; coordinate X1 clearance; complete whole-site flows, hydraulic network analysis and receiving-system acceptance. No pipe capacity, fire-flow sufficiency or infiltration performance conclusion is issued here.',
          ],
        ],
      ),
      doc(
        px('site-grading-plan_ifr_2026-10-02'),
        'Site grading and drainage details',
        'C201 / C202',
        'design',
        '2026-10-02',
        [
          [
            'C201 · Site grading plan',
            'Proposed finished floor elevation is 672.250 m. Benchmark BM1 is 671.420 m. Existing ground ranges from 670.85 m to 672.10 m. Proposed east corridor grade at ST1 0+018 is 671.300 m.',
            'Preliminary spot grades route surface drainage away from the building to the frontage drainage route. Barrier-free transitions, overland capacity and adjacent-property tie-ins require detailed review.',
          ],
          [
            'C202 · Storm cover and crossing details',
            'ST1 at 0+018: finished grade 671.300 m; outside crown 669.650 m; cover 1.650 m. Insulation is not detailed. Confirm whether revised levels or an adequate insulation detail will resolve the shallow installation.',
            'X1: S2 sewer service outside crown 668.380 m below watermain underside 668.600 m; vertical clearance 0.220 m. Detail is schematic, NTS; confirm buried elevations before finalizing the crossing.',
          ],
        ],
        'parkview-grading',
      ),
      doc(
        px('design-coordination-memo_2026-10-07'),
        'Civil design coordination register',
        'PX-CM-001',
        'report',
        '2026-10-07',
        [
          [
            'Design decisions and interfaces',
            'The owner requests that the shallow east utility corridor be retained if a technically acceptable design can be developed. This preference does not waive EPCOR requirements. S1 and ST1 geometry remain issued for review.',
            'Open item PX-01: sanitary upstream slope and DWF allocation, civil lead. PX-02: terminal storm slope, civil lead. PX-03: storm cover and insulation detail, civil/utilities. PX-04: X1 sewer-service/watermain clearance and exposure, utilities coordinator. All four remain unresolved.',
          ],
          [
            'Release hold points',
            'Issue revised C101, C102, C201 and C202 together when geometry changes. Reconcile the servicing memorandum, project calculations and drawing schedules before submission. Confirm whole-site loading, receiving-system capacity and water demand separately.',
            'No accepted design exception, shallow-cover insulation detail or crossing resolution is included in this package. The review register identifies items requiring professional resolution, not an automatic compliance determination.',
          ],
        ],
      ),
    ],
    issues: [
      {
        id: 'sanitary-upstream-grade',
        title: 'Sanitary upstream grade needs revision',
        explanation:
          'S1 is a 200 mm upstream reach at 0.30% with 0.34 L/s peak DWF. EPCOR Table 1.1 specifies 1.00% for the 0.25–0.40 L/s band. The proposed grade is also below the general 0.40% minimum. Confirm the branch flow allocation and revise the geometry or obtain a documented resolution.',
        proofs: [
          [
            px('site-servicing-plan_ifr_2026-10-02'),
            'S1 is a 200 mm PVC upstream sanitary reach, 43 m long at 0.30% grade, with peak DWF 0.34 L/s.',
          ],
          [
            'design-guidelines.pdf',
            'For the upstream reaches of the sanitary system, where peak dry weather flow (DWF) is equal to or less than 1.5 L/s, the designer is to follow slopes per Table 1.1.',
          ],
          ['design-guidelines.pdf', '0.25–0.40 | 1.00', 8],
        ],
      },
      {
        id: 'storm-upstream-grade',
        title: 'Terminal storm reach is below the upstream slope',
        explanation:
          'ST1 is the terminal 300 mm storm reach at 0.25%. EPCOR requires at least 0.4% for the most upstream leg, a separate condition from the general pipe-size slope table. Review the terminal reach layout and revise or document an accepted alternative.',
        proofs: [
          [
            px('site-servicing-plan_ifr_2026-10-02'),
            'ST1 is the most upstream storm reach, from the terminal maintenance hole to the first downstream maintenance hole: 300 mm nominal diameter, 38 m long at 0.25% grade.',
          ],
          [
            'design-guidelines.pdf',
            'The minimum slope shall be 0.4% for the most upstream leg of any storm system',
          ],
        ],
      },
      {
        id: 'storm-cover',
        title: 'Shallow storm cover has no insulation detail',
        explanation:
          'The 300 mm ST1 profile provides 1.650 m cover rather than the 2.0 m stated minimum. EPCOR permits shallower cover with adequate pipe insulation. No insulation detail is included: revise the levels or provide the required insulation design and obtain review.',
        proofs: [
          [
            px('site-servicing-plan_ifr_2026-10-02'),
            'At ST1 chainage 0+018, finished grade is 671.300 m and outside pipe crown is 669.650 m, providing 1.650 m cover.',
          ],
          [
            px('site-servicing-plan_ifr_2026-10-02'),
            'No insulation detail is included in this issue.',
          ],
          [
            'design-guidelines.pdf',
            'A minimum cover from finished grade to pipe obvert of 2.0 m',
          ],
          [
            'design-guidelines.pdf',
            'If this cover cannot be achieved then provide adequate pipe insulation',
          ],
        ],
      },
      {
        id: 'crossing-clearance',
        title: 'Water and sewer-service clearance needs review',
        explanation:
          'X1 places sewer service S2 below the watermain with 0.220 m clearance. EPCOR calls for 300 mm vertical separation for this arrangement. Verify the outside surfaces by exposure and coordinate a revised crossing or documented accepted resolution.',
        proofs: [
          [
            px('site-servicing-plan_ifr_2026-10-02'),
            'At crossing X1, sewer service S2 passes below the watermain with 0.220 m vertical clearance between outside surfaces.',
          ],
          [
            'design-guidelines.pdf',
            'Sewer services below the water main: a minimum of 300 mm separation between the top of the',
          ],
          [
            'design-guidelines.pdf',
            'sewer service pipe and the bottom of the water main.',
          ],
        ],
      },
    ],
  },
  {
    id: 'north-ridge-highway',
    name: 'North Ridge Highway Intersection Upgrade',
    client: 'North Ridge Industrial Lands Partnership',
    location: 'Central Alberta',
    discipline: 'Highway geometry, traffic & pavement',
    projectNumber: 'NRH-26104',
    description:
      'Intersection safety and industrial-access review on a two-lane provincial highway, combining geometric drawings, sight-distance survey, traffic forecasts and pavement design inputs.',
    collectionIds: ['alberta-highway-design'],
    documents: [
      doc(
        nr('owner-design-brief_rev0_2026-08-14'),
        'Owner design brief',
        'NRH-CR-001',
        'client',
        '2026-08-14',
        [
          [
            'Commission and scope',
            'North Ridge Industrial Lands Partnership commissions Cairnfield Civil Studio Ltd. for project NRH-26104, North Ridge Highway Intersection Upgrade. The rural two-lane provincial corridor serves an expanding industrial area in central Alberta. Scope includes turning-lane geometry, profile review, access, pavement and construction traffic accommodation.',
            'The project uses a 100 km/h preliminary design speed and a 90 km/h existing posted speed. The owner adopts 185 m as the initial stopping-sight-distance screening value. Final highway classification, grade effects and any design exception require review with the provincial road authority.',
          ],
          [
            'Performance and deliverables',
            'Opening year is 2027. Review the combined development and background traffic at 10- and 20-year horizons. The proposed work must retain access and maintain traffic during construction, subject to an accepted traffic accommodation plan.',
            'Deliverables: survey/geotechnical summary, G101/G102/G201 geometric plan and profile, traffic impact assessment, pavement memorandum and traffic accommodation concept. No design exception or construction authorization is included in this issue.',
          ],
          [
            'Design Basis and coordination',
            'Use the current applicable Alberta Highway Geometric Design Guide chapters, Traffic Impact Assessment Guidelines, Pavement Design Manual together with Design Bulletin 77 amendments, and the 2025 Traffic Accommodation in Work Zones manual.',
            'Use a reconciled base-year traffic dataset across traffic and pavement disciplines. Differences in forecasting method must be justified; traffic volumes, truck definitions, axle loading and design-lane allocation must be traceable before pavement selection.',
          ],
        ],
      ),
      doc(
        nr('existing-conditions-survey-geotech_2026-08-28'),
        'Existing conditions and ground summary',
        'NRH-SV-001',
        'report',
        '2026-08-28',
        [
          [
            'Road and survey basis',
            'The existing paved surface is 12.0 m wide, with two 3.5 m painted through lanes and two 2.5 m paved shoulders. The north industrial access forms a T-intersection near chainage 0+300. Local working coordinates and elevations are used in the review drawings.',
            'Preliminary measured eastbound stopping sight distance at the crest is 165 m. This value requires validation against the adopted eye/object heights, actual grades and the final accepted design basis.',
          ],
          [
            'Profile and sight-distance review',
            'Vertical curve: BVC 0+175 at 670.000 m; incoming grade +3.0%; outgoing grade -3.0%; curve length 250 m. PVI is at 0+300 with tangent-intersection elevation 673.750 m. The road-surface crest at 0+300 is 671.875 m.',
            'Calculated K = 250 / 6 = 41.67 m/%. The current profile is retained for review only. A grade-corrected sight-distance check and any exception submission remain outstanding.',
          ],
          [
            'Traffic and ground inputs',
            '2026 base-year AADT is 7,800 vehicles/day with 14% heavy vehicles. The traffic assessment adopts 2.0% annual non-compounded background growth. Truck classification and axle-load spectra require confirmation for pavement design.',
            'Preliminary subgrade design input is CBR 5%. Localized cracking and edge deterioration are noted. Coring, laboratory testing, drainage assessment and confirmation of seasonal conditions are required before final pavement design.',
          ],
        ],
      ),
      doc(
        nr('geometric-design-plan-profile_ifr_2026-09-12'),
        'Geometric design plan and profile',
        'G101 / G102 / G201',
        'design',
        '2026-09-12',
        [
          [
            'G101 · Overall plan',
            'The preliminary design speed is 100 km/h. The north industrial access connects at chainage 0+300 on the rural undivided provincial corridor. No south access leg is proposed.',
            'The existing 12.0 m paved surface retains two 3.5 m painted through lanes and two 2.5 m shoulders in this issue. The 3.5 m dimensions refer to through lanes, not auxiliary turn lanes.',
          ],
          [
            'G102 · Intersection geometry',
            'The concept provides a north access throat and a 3.5 m auxiliary turn-lane allowance. Final turn-lane storage and taper lengths require the accepted traffic assessment and road-authority review.',
            'Through-lane paint allocation remains 3.5 m on each side. No approved departure from the rural undivided highway lane-width guidance is recorded.',
          ],
          [
            'G201 · Longitudinal profile',
            'Available eastbound stopping sight distance at the crest is 165 m for the preliminary 100 km/h design speed. The owner screening value is 185 m; grade effects and final design criteria remain to be assessed.',
            'BVC 0+175 elevation 670.000 m; EVC 0+425 elevation 670.000 m; curve length 250 m; grades +3.0% and -3.0%. Road crest 0+300 elevation 671.875 m. No approved design exception is included.',
          ],
        ],
        'highway-geometry',
      ),
      doc(
        nr('traffic-impact-assessment_rev1_2026-09-15'),
        'Traffic impact assessment',
        'NRH-TIA-001',
        'report',
        '2026-09-15',
        [
          [
            'Study basis and scope',
            'The 2026 base-year traffic dataset is AADT 7,800 vehicles/day and 14% heavy vehicles. Adopt 2.0% annual non-compounded background growth for the preliminary traffic assessment. Opening year is 2027.',
            'The current assessment includes 2027 opening and 2037 ten-year combined-traffic horizons only. No 2047 twenty-year combined-traffic analysis is included. This omission is a study hold point, not an assertion that the shorter horizon is sufficient.',
          ],
          [
            'Forecast calculations',
            'Background AADT in year y = 7,800 × [1 + 0.02 × (y - 2026)]. Opening 2027 background = 7,956 vehicles/day. 2037 background = 9,516 vehicles/day. These daily values exclude the new development increment.',
            'Base 2026 peak approach flows are eastbound 420, westbound 390 and north access 90 vehicles/hour. New development adds 100 peak-hour trips: 60 entering and 40 exiting. Entries assign 35 eastbound and 25 westbound; exits assign 25 left and 15 right.',
          ],
          [
            'Combined peak-hour screening',
            '2027 combined approach flows: eastbound 463, westbound 423, north access 132 vehicles/hour; total 1,018. 2037 combined approach flows: eastbound 547, westbound 501, north access 150; total 1,198. Values are rounded after applying the stated linear background growth.',
            'These are demand screens only. No calibrated capacity model, HCM level-of-service result or validated queue/storage length is supplied. Complete the 2047 combined demand and accepted capacity/safety analysis before final geometry.',
          ],
          [
            'Traffic-to-pavement interface',
            'Base-year heavy traffic = 7,800 × 0.14 = 1,092 vehicles/day, two-way. This is a heavy-vehicle count, not an equivalent standard axle load. Reconcile vehicle classification and axle-load inputs with the pavement discipline.',
            'The pavement draft uses a different base-year AADT and truck share. Confirm the common count source, count year, site increment and forecasting method before either discipline freezes its design basis.',
          ],
        ],
      ),
      doc(
        nr('pavement-design-memo_rev0_2026-09-19'),
        'Preliminary pavement design memorandum',
        'NRH-PV-001',
        'report',
        '2026-09-19',
        [
          [
            'Pavement design inputs',
            'The pavement draft assumes 2026 AADT 7,200 vehicles/day, 10% trucks and 1.0% annual non-compounded growth. The preliminary subgrade input is CBR 5%. These traffic assumptions have not been reconciled with NRH-TIA-001.',
            'Trial structure: 110 mm asphalt concrete over 250 mm granular base. This is an option for review, not a verified structural design. Final design must apply the Alberta Pavement Design Manual with applicable Design Bulletin 77 amendments and accepted project inputs.',
          ],
          [
            'Traffic coordination calculation',
            'Draft base-year truck count = 7,200 × 0.10 = 720/day. Over 20 years from 2027 through 2046, sum of year offsets 1 through 20 = 210. Two-way truck-pass screen = 720 × (20 + 0.01 × 210) × 365 = 5,807,880. At 50% directional split this is 2,903,940 truck passes.',
            'Using the TIA inputs on the same screening basis gives 1,092 × (20 + 0.02 × 210) × 365 = 9,645,636 two-way truck passes, or 4,822,818 at 50% directional split. These are not ESALs. No axle-load factors, truck-class distribution or lane allocation has been applied.',
          ],
          [
            'Required resolution',
            'The differing 7,200 versus 7,800 AADT and 10% versus 14% truck shares lack a documented source reconciliation. Growth methods may legitimately differ by design method, but any difference must be explained and supported.',
            'Do not approve the trial pavement section from these truck-pass calculations. Obtain accepted base-year data, design life, classification, load factors and design-lane ESALs; confirm subgrade and drainage; then compare structural alternatives under the applicable guidance.',
          ],
        ],
      ),
      doc(
        nr('traffic-accommodation-plan_ifr_2026-09-22'),
        'Traffic accommodation concept',
        'TA101 / TA102',
        'design',
        '2026-09-22',
        [
          [
            'TA101 · Construction stages',
            'Stage 1: establish temporary protection and work on the north access tie-in while maintaining the provincial through route. Stage 2: reconstruct one side of the intersection under a separately accepted traffic control arrangement.',
            'Stage limits shown are schematic. Temporary speed, lane widths, device spacing, tapers and queue protection are not approved. Develop the detailed plan using the Alberta Traffic Accommodation in Work Zones 2025 manual and accepted site conditions.',
          ],
          [
            'TA102 · Interfaces and hold points',
            'Maintain emergency access and coordinate industrial deliveries before each stage. Check queues, sight lines, work-space protection, pedestrian needs and temporary drainage with the contractor and road authority.',
            'Select applicable official typical drawings after the staging and speed basis are accepted. No government typical drawing, permit, traffic-control approval or professional authentication is reproduced in this concept.',
          ],
        ],
        'highway-staging',
      ),
    ],
    issues: [
      {
        id: 'through-lane-width',
        title: 'Through-lane marking differs from the rural section',
        explanation:
          'The 12.0 m rural undivided surface retains 3.5 m painted through lanes. HGDG Chapter C states that a 3.7 m through lane is painted where the surface exceeds 10 m. This concerns through lanes, not the 3.5 m auxiliary lane. Confirm classification and revise the marking allocation or document an accepted exception.',
        proofs: [
          [
            nr('geometric-design-plan-profile_ifr_2026-09-12'),
            'The existing 12.0 m paved surface retains two 3.5 m painted through lanes and two 2.5 m shoulders in this issue.',
          ],
          [
            'trans-highway-geometric-design-guide-chapter-c-2022-02.pdf',
            'A 3.7 m wide through lane is painted for all rural undivided highways where the surface width exceeds 10 metres.',
          ],
        ],
      },
      {
        id: 'stopping-sight-distance',
        title: 'Crest sight distance is below the screening value',
        explanation:
          'The profile records 165 m available eastbound sight distance at 100 km/h. HGDG Chapter B Table B-2-3a gives 185 m level-road design SSD at that speed, also adopted in the owner brief. Confirm measurement, grade effects and final classification before revising the profile or pursuing a documented exception.',
        proofs: [
          [
            nr('geometric-design-plan-profile_ifr_2026-09-12'),
            'Available eastbound stopping sight distance at the crest is 165 m for the preliminary 100 km/h design speed.',
          ],
          [
            nr('owner-design-brief_rev0_2026-08-14'),
            'The owner adopts 185 m as the initial stopping-sight-distance screening value.',
          ],
          [
            'trans-highway-geometric-design-guide-chapter-b-2020-09.pdf',
            '100 | 69.4 | 113.5 | 182.92 | 185',
            9,
          ],
        ],
      },
      {
        id: 'traffic-horizon',
        title: 'Twenty-year traffic horizon is missing',
        explanation:
          'The TIA includes opening 2027 and ten-year 2037 analyses, with no 2047 combined-traffic analysis. Alberta guidance calls for minimum 10- and 20-year horizons. Complete the missing horizon and its geometry implications before final design.',
        proofs: [
          [
            nr('traffic-impact-assessment_rev1_2026-09-15'),
            'No 2047 twenty-year combined-traffic analysis is included.',
          ],
          [
            'trans-traffic-impact-assessment-guidelines-2021-02.pdf',
            'the combined traffic should be projected to at least the 10-year and 20-year horizons',
          ],
        ],
      },
      {
        id: 'pavement-traffic-inputs',
        title: 'Traffic and pavement inputs are inconsistent',
        explanation:
          'The TIA uses 7,800 AADT and 14% heavy vehicles; the pavement draft uses 7,200 and 10% trucks. Growth also differs without a documented method reconciliation. Confirm the common count basis and justified forecasting methods before deriving design-lane ESALs. The trial pavement thickness is not assessed by this finding.',
        proofs: [
          [
            nr('traffic-impact-assessment_rev1_2026-09-15'),
            'The 2026 base-year traffic dataset is AADT 7,800 vehicles/day and 14% heavy vehicles.',
          ],
          [
            nr('pavement-design-memo_rev0_2026-09-19'),
            'The pavement draft assumes 2026 AADT 7,200 vehicles/day, 10% trucks and 1.0% annual non-compounded growth.',
          ],
          [
            'pavedm2.pdf',
            'truck traffic is the major consideration in the structural design of pavements.',
          ],
        ],
      },
    ],
  },
]
for (const p of projectPackages) {
  p.queries = p.issues.map((i) => ({
    id: i.id,
    issueId: i.id,
    question:
      p.id === 'parkview-exchange'
        ? {
            'sanitary-upstream-grade':
              'Does upstream sanitary branch S1 meet the applicable minimum slope?',
            'storm-upstream-grade':
              'Does the terminal storm reach ST1 meet the upstream slope criterion?',
            'storm-cover':
              'Can the shallow storm cover be retained without insulation?',
            'crossing-clearance':
              'What needs review at water and sewer crossing X1?',
          }[i.id]
        : {
            'through-lane-width':
              'Do the proposed through-lane markings match the rural highway guidance?',
            'stopping-sight-distance':
              'Is the available crest sight distance consistent with the design basis?',
            'traffic-horizon': 'Which traffic study horizon is missing?',
            'pavement-traffic-inputs':
              'Are traffic inputs consistent between the TIA and pavement memo?',
          }[i.id],
  }))
}
projectPackages[0].queries.push(
  {
    id: 'sanitary-diameter',
    question: 'What is the proposed pipe diameter for sanitary branch S1?',
    sourceOnly: true,
  },
  {
    id: 'finished-floor',
    question: 'What is the proposed finished floor elevation?',
    sourceOnly: true,
  },
)
projectPackages[1].queries.push(
  {
    id: 'available-sight-distance',
    question:
      'What stopping sight distance is available eastbound at the crest?',
    sourceOnly: true,
  },
  {
    id: 'traffic-basis',
    question: 'What is the 2026 base-year traffic dataset?',
    sourceOnly: true,
  },
)

// Synthetic project material is deliberately separate from published standards.
export const demoProjects = [
  {
    id: 'demo-mill-creek',
    name: 'Mill Creek Corner Infill',
    client: 'Rivermark Developments (fictional)',
    location: 'Bonnie Doon, Edmonton',
    discipline: 'Drainage & stormwater',
    description:
      'Concept drainage review for four side-by-side homes on a 1,080 m² corner lot. Two box planters receive roof drainage; outfall and architectural width constraints remain unresolved.',
    collectionIds: ['edmonton-drainage', 'edmonton-development'],
    documents: [
      {
        file: 'mill-creek-client-brief.pdf',
        title: 'Client requirements and design brief',
        code: 'MC-CR-001',
        category: 'client',
        sections: [
          [
            'Project scope',
            'Four side-by-side infill homes on a 20 m by 54 m corner parcel. Concept review only; this is not an issued-for-construction package. Rivermark Developments is a fictional demonstration client.',
          ],
          [
            'Architectural interface',
            'The current landscape allocation limits the overall width of each box planter to 400 mm. The allocation may be revised following engineering review. Maintain a continuous accessible entrance route.',
          ],
          [
            'Drainage objectives',
            'Provide two box planters for roof runoff from a combined 320 m² roof catchment. Confirm the applicable Corner Lot Infill LID Guidelines and obtain an accepted drainage connection arrangement before design release. A planter is not assumed to waive private storm-servicing requirements.',
          ],
          [
            'Review hold points',
            'Confirm planter width, underdrain discharge route, overflow routing and groundwater separation. No construction authorization is implied by this brief.',
          ],
        ],
      },
      {
        file: 'mill-creek-concept-design.pdf',
        title: 'Preliminary drainage layout and planter section',
        code: 'MC-DD-101',
        category: 'design',
        drawing: 'planter',
        sections: [
          [
            'Planter schedule - concept P1/P2',
            'Two box planters are proposed, each 20 m long with an overall width of 400 mm. Nominal wall thickness is 50 mm. The concept provides 600 mm of soil media, a 350 mm drainage layer and a 200 mm surface ponding zone. These dimensions require review against the adopted guidelines.',
          ],
          [
            'Connection detail C1',
            'The proposed 100 mm perforated underdrains join at J1 and discharge through a 150 mm lateral to the existing combined sewer at C1. This is the current concept route, not an approved connection.',
          ],
          [
            'Surface overflow',
            'Surface overflow is directed away from the dwellings to the shared side-yard swale and public right-of-way. Final lot grading, receiving levels and erosion protection remain to be coordinated.',
          ],
          [
            'Drawing status',
            'Revision P01, 6 November 2026. Synthetic demonstration drawing. Not for construction. All lengths and levels are concept assumptions; no municipal acceptance is represented.',
          ],
        ],
      },
      {
        file: 'mill-creek-site-note.pdf',
        title: 'Site constraints and preliminary drainage checks',
        code: 'MC-TN-002',
        category: 'report',
        sections: [
          [
            'Catchment accounting',
            'Demonstration parcel area: 1,080 m². Combined roof catchment directed to P1/P2: 320 m². Other paved and landscaped areas are outside this preliminary planter check. Two 20 m by 0.4 m overall planter footprints total 16 m²; this is not a verified effective media area or treatment-volume calculation.',
          ],
          [
            'Existing services',
            'The concept utility sketch identifies a combined sewer at C1. No accepted storm-only underdrain connection is currently established. Utility locations and invert levels require survey and confirmation with EPCOR.',
          ],
          [
            'Ground conditions',
            'The assumed seasonal groundwater level is 2.8 m below grade. No project borehole or infiltration test has been completed. Confirm field conditions before relying on the planter section or selecting the discharge arrangement.',
          ],
          [
            'Required coordination',
            'Resolve the architectural width allocation and underdrain outlet before detailed design. The preliminary note does not establish capacity, infiltration performance or approval of the overall drainage design.',
          ],
        ],
      },
    ],
    issues: [
      {
        id: 'planter-width',
        title: 'Planter width allocation needs revision',
        explanation:
          'The client allocation and concept show 400 mm overall width. The infill guideline specifies at least 450 mm. Confirm the dimension convention and revise the coordinated section before release.',
        proofs: [
          [
            'mill-creek-client-brief.pdf',
            'The current landscape allocation limits the overall width of each box planter to 400 mm.',
          ],
          [
            'mill-creek-concept-design.pdf',
            'Two box planters are proposed, each 20 m long with an overall width of 400 mm.',
          ],
          [
            'lid-infill-guidelines.pdf',
            'The width of the box planter must be greater than or equal to 450 mm.',
          ],
        ],
      },
      {
        id: 'combined-outfall',
        title: 'Underdrain outlet conflicts with the infill detail',
        explanation:
          'The concept discharges the underdrains to a combined sewer. The box-planter guideline prohibits that connection. Resolve a permitted outlet arrangement with the drainage reviewer; this is not a blanket rejection of the LID concept.',
        proofs: [
          [
            'mill-creek-concept-design.pdf',
            'The proposed 100 mm perforated underdrains join at J1 and discharge through a 150 mm lateral to the existing combined sewer at C1.',
          ],
          [
            'lid-infill-guidelines.pdf',
            'Box planter underdrains shall not be connected to combined sewer systems.',
          ],
        ],
      },
    ],
    queries: [
      {
        id: 'width-review',
        question:
          'Does the concept box-planter width agree with the infill guideline?',
        issueId: 'planter-width',
      },
      {
        id: 'outfall-review',
        question:
          'Can the proposed box-planter underdrains connect to the combined sewer at C1?',
        issueId: 'combined-outfall',
      },
    ],
  },
  {
    id: 'demo-willow-creek',
    name: 'Willow Creek Bridge Renewal',
    client: 'Prairie County Transportation (fictional)',
    location: 'Rural Alberta - fictional site',
    discipline: 'Bridge & highway infrastructure',
    description:
      'Preliminary replacement of a 24 m single-span rural road bridge. Review deck drainage geometry and the approval basis before advancing the constrained approach profile.',
    collectionIds: ['alberta-bridges'],
    documents: [
      {
        file: 'willow-creek-client-brief.pdf',
        title: 'Owner brief and adopted design basis',
        code: 'WC-CR-001',
        category: 'client',
        sections: [
          [
            'Project scope',
            'Replace a deteriorated rural crossing with a 24 m single-span steel-girder bridge and concrete deck. The proposed carriageway is 8.0 m wide within an 8.4 m deck. Prairie County Transportation and this site are fictional demonstration entities.',
          ],
          [
            'Adopted references',
            'For this demonstration contract, adopt Alberta Transportation Bridge Structures Design Criteria, Version 9.0, January 2022, including Section 4.2 for bridge deck geometry. The reference is a contract design basis; this brief does not establish the latest publication or statutory applicability.',
          ],
          [
            'Approach constraints',
            'Minimize approach raising near adjacent farm accesses. The owner requests evaluation of a 0.35% longitudinal deck grade. Any departure requiring approval must be documented before design release.',
          ],
          [
            'Release requirements',
            'Confirm deck drainage crossfall, longitudinal grade and any required approval. Complete hydraulic and geotechnical design before advancing the foundation or freeboard decisions. No construction release is authorized.',
          ],
        ],
      },
      {
        file: 'willow-creek-concept-design.pdf',
        title: 'General arrangement and deck drainage geometry',
        code: 'WC-DD-101',
        category: 'design',
        drawing: 'bridge',
        sections: [
          [
            'Alignment and deck section',
            'The bridge is on a straight tangent horizontal alignment and is not super-elevated. The proposed deck crossfall is 1.0% away from the crown on both sides. The 8.0 m carriageway comprises two 3.5 m lanes and two 0.5 m shoulders.',
          ],
          [
            'Longitudinal profile',
            'The proposed longitudinal deck grade is 0.35% over the 24 m span. The profile has a constant grade with no crest curve on the deck. This geometry reflects the owner approach-earthworks constraint and is subject to acceptance.',
          ],
          [
            'Structural concept',
            'Four longitudinal steel girders support the cast-in-place deck. Girder spacing is 2.4 m, with 0.6 m deck overhangs beyond the outside girder centrelines. Structural sizing, foundation design and load rating are not established by this concept.',
          ],
          [
            'Drawing status',
            'Revision P01, 6 November 2026. Synthetic demonstration drawing. Not for construction. Geometry is for coordinated preliminary review only.',
          ],
        ],
      },
      {
        file: 'willow-creek-drainage-note.pdf',
        title: 'Deck drainage geometry and outstanding approvals',
        code: 'WC-TN-003',
        category: 'report',
        sections: [
          [
            'Geometry checks',
            'At 1.0% crossfall, the fall from crown to either carriageway edge over a 4.0 m half-width is 40 mm. At 2.0%, the corresponding fall is 80 mm. These geometric calculations do not replace a drainage design.',
          ],
          [
            'Profile check',
            'A 0.35% constant grade over 24 m gives an 84 mm longitudinal level difference. The concept does not include a crest curve or super-elevation exception.',
          ],
          [
            'Approval record',
            'No approval for a longitudinal grade below 0.5% has been obtained or included in this package. The approach constraint is an owner preference, not an approved departure from the adopted bridge criteria.',
          ],
          [
            'Outstanding investigations',
            'A site-specific hydraulic assessment, flood levels, scour assessment and geotechnical investigation are outstanding. No freeboard, foundation capacity or final hydraulic adequacy claim is made.',
          ],
        ],
      },
    ],
    issues: [
      {
        id: 'deck-crossfall',
        title: 'Deck crossfall differs from the adopted criterion',
        explanation:
          'The tangent, non-super-elevated concept uses 1.0% crossfall. The adopted criteria specify 2% away from the crown unless super-elevated. Coordinate the section and drainage design before release.',
        proofs: [
          [
            'willow-creek-concept-design.pdf',
            'The bridge is on a straight tangent horizontal alignment and is not super-elevated.',
          ],
          [
            'willow-creek-concept-design.pdf',
            'The proposed deck crossfall is 1.0% away from the crown on both sides.',
          ],
          [
            'trans-bridge-structures-design-criteria-version-9-0.pdf',
            'Bridge decks shall have a 2% crossfall away from the crown line unless the bridge structure is super-elevated.',
          ],
        ],
      },
      {
        id: 'grade-approval',
        title: 'Low longitudinal grade needs an approval decision',
        explanation:
          'The concept uses 0.35% longitudinal grade. The adopted criteria require approval below 0.5%; the project note records no approval. Confirm an accepted profile or document the required approval rather than assuming an automatic prohibition.',
        proofs: [
          [
            'willow-creek-concept-design.pdf',
            'The proposed longitudinal deck grade is 0.35% over the 24 m span.',
          ],
          [
            'willow-creek-drainage-note.pdf',
            'No approval for a longitudinal grade below 0.5% has been obtained or included in this package.',
          ],
          [
            'trans-bridge-structures-design-criteria-version-9-0.pdf',
            'Approval will be required to use a longitudinal grade of less than 0.5%.',
          ],
        ],
      },
    ],
    queries: [
      {
        id: 'crossfall-review',
        question:
          'Does the bridge deck crossfall agree with the adopted design criterion?',
        issueId: 'deck-crossfall',
      },
      {
        id: 'grade-review',
        question:
          'What needs review before accepting the proposed 0.35% longitudinal deck grade?',
        issueId: 'grade-approval',
      },
    ],
  },
]

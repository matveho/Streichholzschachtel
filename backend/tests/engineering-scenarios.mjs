export const engineeringScenarios = [
  {
    id: 'minor-system',
    question:
      'For a 20 ha development, what design storm, runoff method and pipe-sizing criteria apply to the minor storm sewer system?',
    terms: [
      /5[- ]year|1:5/i,
      /Rational/i,
      /Manning/i,
      /Smooth.Wall Pipe\s+0\.013/i,
      /300\s*mm/,
      /250\s*mm/,
      /(?:below|less than|minimum)[^.]{0,60}0\.6\s*m\/s/i,
    ],
    minSources: 2,
    findingTerms: [/5[- ]year|1:5/i, /Rational/i],
    forbidden: [/minor storm sewers?[^.]{0,150}critical storage/i],
  },
  {
    id: 'infill-servicing',
    question:
      'For a four-unit corner-lot infill, can a box planter replace conventional storm servicing, and what design and construction checks are needed?',
    terms: [
      /private.*storm|storm.*private/i,
      /combined/i,
      /compact/i,
      /weekly documented ESC inspections/i,
    ],
    findingTerms: [
      /private.*storm|storm.*private/i,
      /(?:(?:confirm|resolve|clarif|EPCOR|remain|still|separat)[^.]{0,150}(?:servic|obligation|requirement)|(?:servic|obligation)[^.]{0,150}(?:confirm|resolve|clarif|EPCOR|remain|still|separat))/i,
    ],
    minSources: 3,
  },
  {
    id: 'frost-cover',
    question:
      'Before excavation, review a 450 mm storm main with 1.7 m cover and a storm service with 2.0 m cover at the property line. Can we use these details without insulation or further approval?',
    terms: [
      /2\.0\s*m/,
      /2\.4\s*m/,
      /insulat/i,
      /confirm|resolve|notify|EPCOR/i,
    ],
    minSources: 2,
    findingTerms: [
      /1\.7\s*m|0\.3\s*m|300\s*mm/,
      /insulat|confirm|resolve|EPCOR|approv/i,
    ],
  },
  {
    id: 'expanded-capacity',
    question:
      'A subdivision has expanded from 28 ha to 42 ha. The revised five-year runoff estimate is 1.20 m³/s, but the existing sewer design carries 0.90 m³/s. Can we retain it and size the new detention pond with the Rational Method?',
    terms: [
      /1\.5(?:0)?/,
      /0\.6(?:0)?/,
      /computer.*(?:modell|simulat)|modell?ing/i,
      /storage/i,
      /100[- ]year|100 years/i,
    ],
    minSources: 2,
    findingTerms: [/1\.5(?:0)?/, /0\.6(?:0)?/, /computer|model|simulat/i],
  },
  {
    id: 'damaged-lid',
    question:
      'A four-unit corner-lot bioretention basin was used as a sediment trap and crossed by delivery vehicles. It has 500 m² of surface area and 600 mm of LID soil. Are completion photos enough for acceptance, or what testing and corrective work should we require?',
    terms: [
      /two locations|2\s+(?:test|locations)/i,
      /QA\/QC/i,
      /3\s*m/,
      /halfway|half.?depth/i,
      /75.*85/,
      /compact/i,
      /sediment/i,
    ],
    minSources: 3,
    findingTerms: [
      /QA\/QC|quality assurance/i,
      /halfway|half.?depth/i,
      /compact|scarif|sediment/i,
    ],
    forbidden: [/(?:growing media|LID soil).{0,50}(?:minimum of )?95%/i],
  },
  {
    id: 'shallow-soil-exemption',
    question:
      'Is Guelph Permeameter testing required for a 500 m² LID facility with only 250 mm of soil?',
    terms: [/not required|not.*require|no.*require/i, /300\s*mm/],
  },
  {
    id: 'exact-area-boundary',
    question:
      'How many Guelph Permeameter test locations are mandated for a facility with exactly 1000 m² of surface area?',
    noAnswer: true,
  },
  {
    id: 'field-test-count',
    question:
      'How many Guelph Permeameter field test locations are required before planting a 500 m² LID facility with 600 mm of soil, and what QA/QC check is needed?',
    terms: [/\b(?:two|2)\s+(?:(?:Guelph|Permeameter|field)\s+)*(?:test\s+)?locations\b/i, /QA\/QC/i, /3\s*m/],
    findingTerms: [/\b(?:two|2)\s+(?:(?:Guelph|Permeameter|field)\s+)*(?:test\s+)?locations\b/i],
    minSources: 1,
  },
]

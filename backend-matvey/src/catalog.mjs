// Document identity and version catalog.
//
// Exact SHA-256 hashes identify publications, so renamed or duplicated files
// resolve to the same record. Editions and effective dates were read from each
// PDF's cover and Terms of Use page. `series` groups editions of the same
// publication; the newest non-addendum edition in a series is treated as the
// current edition in this collection. Unknown PDFs still index, with an
// explicit "edition not supplied" label and no version claims.

const EDMONTON = 'City of Edmonton'

const entries = [
  {
    hash: 'b760a155f725ccf5fa3ee85c5c3777511eb1579ebbaf132ffef75bec8eaf7b65',
    series: '3-compiled',
    label: 'Vol. 3 (2021)',
    title:
      'Volume 3: Drainage Design and Construction Standards (2021 compilation of Vol. 3-01 to 3-06)',
    edition: 'December 2021',
    date: '2021-12',
    effective: 'December 1, 2021',
    supersededNote:
      'Replaced by the separately published Vol. 3-01 to 3-06 sub-volumes (2025 editions).',
  },
  {
    hash: '7dd6f827e093b45f240431c9f0755deb607e5e27d3e47bfc59c51abd34306731',
    series: '3-01',
    label: 'Vol. 3-01',
    title: 'Development Planning Procedure and Framework',
    edition: 'December 2021',
    date: '2021-12',
    effective: 'December 1, 2021',
  },
  {
    hash: '851846770fd91a557050ad80828f3ccd349aa502d499d065c07c6b15a74df0e1',
    series: '3-01',
    label: 'Vol. 3-01',
    title: 'Development Planning Procedure and Framework',
    edition: 'April 2025',
    date: '2025-04',
    effective: 'August 2025',
  },
  {
    hash: '3497aee4ecf0b6a334392d7f84043899df7febee0ea23a74f5b82cb5248e465b',
    series: '3-02',
    label: 'Vol. 3-02',
    title: 'Stormwater Management & Design Manual',
    edition: 'February 2022',
    date: '2022-02',
    effective: 'December 1, 2021 (Volume 3)',
  },
  {
    hash: '1544213df645caeb26d53a393b113a3dc9a2ce0d64644f95de277a32d2ef5b41',
    series: '3-02',
    kind: 'addendum',
    label: 'Vol. 3-02 Addendum #2',
    title: 'Addendum #2 to Vol. 3-02 Stormwater Management & Design Manual',
    edition: 'December 2023',
    date: '2023-12',
    effective: 'December 2023',
    replaces: [
      {
        section: 'Table 2.1',
        pattern: /\bTable 2\.1\b|\brunoff coefficient/i,
        oldTitle:
          'Table 2.1: Storm Runoff Coefficients and Imperviousness According to Zoning',
        newTitle:
          'Table 2.1: Storm Runoff Coefficients According to Zoning and Zoning Category',
        note: 'Table 2.1 of Vol. 3-02 was removed and replaced by Addendum #2 (December 2023), updating runoff coefficients for Zoning Bylaw 20001.',
      },
    ],
  },
  {
    hash: 'eb651c8aa7d3f6f4b4aaf717b7fde03d19f7c8f27ce0c01beeebea9b6cbe3672',
    series: '3-02',
    label: 'Vol. 3-02',
    title: 'Stormwater Management & Design Manual',
    edition: 'April 2025',
    date: '2025-04',
    effective: 'August 2025 (Volume 3)',
  },
  {
    hash: '84fd80c510f86b10a8ed7d6c49fae9b335b3d9e847478f3f706c11f170a457d5',
    series: '3-03',
    label: 'Vol. 3-03',
    title: 'Design Guidelines',
    edition: 'December 2021',
    date: '2021-12',
    effective: 'December 1, 2021',
  },
  {
    hash: '09e07f57e7a30c87ec77fd8ab066cad99cef47e332af889c0a3c9126688a7a55',
    series: '3-03',
    label: 'Vol. 3-03',
    title: 'Design Guidelines',
    edition: 'May 2025',
    date: '2025-05',
    effective: 'May 2025',
  },
  {
    hash: '5f8ff95d1ca536224dfa8a8a0b9c47bba04efba5abe040fc4d4906681008b287',
    series: '3-04',
    label: 'Vol. 3-04',
    title: 'Pump Station and Forcemain Design Guidelines',
    edition: 'May 2025',
    date: '2025-05',
    effective: 'May 1, 2025',
  },
  {
    hash: '787b1218443e5e64d81bb69a097da9072bb05ec4346d01ba850bc2e5786ae822',
    series: '3-05',
    label: 'Vol. 3-05',
    title: 'Drawing Requirements, Approvals and Asset Acceptance/Transfer',
    edition: 'May 2025',
    date: '2025-05',
    effective: 'May 2025',
  },
  {
    hash: 'da424a924abd57855885430c3fc4175562b9d0f64eaf861238292a74aea9e679',
    series: '3-06',
    label: 'Vol. 3-06',
    title: 'Construction Specifications and Standard Drawings',
    edition: 'May 2025',
    date: '2025-05',
    effective: 'May 2025',
  },
  {
    hash: 'f4129b25a1a6fd3df4356ff9071d99063a162bd27930ddd347fd109526809aeb',
    series: 'dapl',
    label: 'DAPL',
    title: 'Drainage Approved Product List',
    edition: 'June 2026',
    date: '2026-06',
    effective: 'June 2026',
  },
  {
    hash: 'ad1aa8236ea063b32e0c6f8636e50367a56ec0e4a4c8edc3815bcf8b26bfbcf7',
    series: 'sanitary-hna',
    label: 'Design Guidelines (NDR/HNA)',
    title:
      'Design Guidelines: Sanitary Flow Generation for NDR, Water Consumption and Fire Flow for HNA',
    edition: 'September 2024',
    date: '2024-09',
    effective: 'August 1, 2024',
  },
  {
    hash: '9f6b74f9dcc6a9ffe3afa4da73438c1c3a54bcdab77093fc25456b32754e8bc9',
    series: '4',
    label: 'Vol. 4 Water',
    title: 'Design and Construction Standards Volume 4: Water',
    edition: 'December 2024',
    date: '2024-12',
    effective: 'December 2024',
  },
  {
    hash: '912cb907450e57b6a76a148f2ce921966b7326c32d23cd23d1a70c7ad8380390',
    series: '7',
    label: 'Vol. 7 Power',
    title: 'Volume 7: Underground Power Distribution Systems',
    edition: 'May 2026',
    date: '2026-05',
    effective: 'May 1, 2026 (released March 30, 2026)',
  },
  {
    hash: 'dc122df73bce86fcebb22c58a05a5a99ce8e4ca85aa22e71fc21b3f4a83d028e',
    series: 'connection-guide',
    label: 'Connection Guide',
    title: 'Drainage Customer Connection Guide',
    edition: 'May 2023',
    date: '2023-05',
    effective: 'May 1, 2023 (release date)',
  },
  {
    hash: '31270f05bbcdc71e79424769d301b9f9f3424b644143780bc8ae4f3b5f37b5db',
    series: 'lid-infill',
    label: 'Infill LID',
    title: 'Corner Lot Infill LID Guidelines',
    edition: 'May 2024',
    date: '2024-05',
  },
  {
    hash: 'f27309b4bba5defe865e811bd1cbac115a4898b7feb0deb5a01523f9304be2b9',
    series: 'lid-cim',
    label: 'LID CIM',
    title: 'LID Construction, Inspection & Maintenance Guide',
    edition: 'May 2016',
    date: '2016-05',
  },
]

const byHash = new Map(entries.map((e) => [e.hash, e]))

export function catalogEntry(hash) {
  const entry = byHash.get(hash)
  if (!entry) return null
  const { hash: _hash, ...rest } = entry
  return { kind: 'edition', jurisdiction: EDMONTON, ...rest }
}

// Questions name publications in many ways; map those names to a series.
const seriesPatterns = [
  [/\bvol(?:ume)?\.?\s*0?3\s*[-‐‑–]\s*0?1\b/i, '3-01'],
  [/\bvol(?:ume)?\.?\s*0?3\s*[-‐‑–]\s*0?2\b/i, '3-02'],
  [/\bvol(?:ume)?\.?\s*0?3\s*[-‐‑–]\s*0?3\b/i, '3-03'],
  [/\bvol(?:ume)?\.?\s*0?3\s*[-‐‑–]\s*0?4\b/i, '3-04'],
  [/\bvol(?:ume)?\.?\s*0?3\s*[-‐‑–]\s*0?5\b/i, '3-05'],
  [/\bvol(?:ume)?\.?\s*0?3\s*[-‐‑–]\s*0?6\b/i, '3-06'],
  [/\bapproved product list\b|\bDAPL\b/i, 'dapl'],
  [
    /\bsanitary (?:sewer )?(?:flow )?design guidelines\b|\bsanitary flow (?:generation )?guidelines\b|\bHNA\b|\bhydraulic network analysis\b/i,
    'sanitary-hna',
  ],
  [/\bcustomer connection guide\b|\bconnection guide\b/i, 'connection-guide'],
  [/\bvol(?:ume)?\.?\s*4\b|\bwater (?:design )?standards\b/i, '4'],
  [/\bvol(?:ume)?\.?\s*7\b|\bpower distribution\b/i, '7'],
  [/\bstormwater management (?:and|&) design manual\b/i, '3-02'],
  [/\bdevelopment planning procedure\b/i, '3-01'],
]

export function seriesInQuestion(question) {
  const found = []
  for (const [pattern, series] of seriesPatterns)
    if (pattern.test(question) && !found.includes(series)) found.push(series)
  return found
}

// Marks each document current or superseded within its series.
export function annotateVersions(documents) {
  const bySeries = new Map()
  for (const d of documents) {
    if (!d.series) continue
    if (!bySeries.has(d.series)) bySeries.set(d.series, [])
    bySeries.get(d.series).push(d)
  }
  for (const docs of bySeries.values()) {
    const editions = docs
      .filter((d) => d.kind !== 'addendum')
      .sort((a, b) => b.date.localeCompare(a.date))
    editions.forEach((d, i) => {
      d.status = i === 0 && !d.supersededNote ? 'current' : 'superseded'
      if (i > 0) d.supersededBy = `${editions[0].label} ${editions[0].edition}`
    })
    for (const addendum of docs.filter((d) => d.kind === 'addendum')) {
      const later = editions.find((d) => d.date > addendum.date)
      addendum.status = 'current'
      if (later) addendum.incorporatedInto = `${later.label} ${later.edition}`
    }
  }
  for (const d of documents) {
    if (d.supersededNote) d.status = 'superseded'
    if (!d.status) d.status = d.series ? 'current' : 'unknown'
  }
  return documents
}

// Jurisdictions covered by the indexed collection. Other named municipalities
// are reported as not indexed instead of being answered with Edmonton rules.
const otherJurisdictions =
  /\b(Strathcona County|Sherwood Park|St\.? Albert|Calgary|Red Deer|Leduc(?: County)?|Spruce Grove|Stony Plain|Fort Saskatchewan|Beaumont|Parkland County|Sturgeon County|Lethbridge|Medicine Hat|Grande Prairie|Airdrie|Okotoks|Cochrane|Lacombe|Camrose|Wetaskiwin|Devon|Morinville|Vancouver|Toronto|Saskatoon|Regina|Winnipeg|Ottawa|Calgary)\b/i
const genericJurisdiction =
  /\b(?:City|Town|County|Municipality|District|Region) of ([A-Z][a-zA-Z]+(?: [A-Z][a-zA-Z]+)?)|\b([A-Z][a-zA-Z]+) (County|Municipal District)\b/

export function foreignJurisdiction(question, documents) {
  const covered = new Set(documents.map((d) => d.jurisdiction).filter(Boolean))
  const named = question.match(otherJurisdictions)?.[1]
  if (named) return named
  const generic = question.match(genericJurisdiction)
  if (!generic) return null
  const name = generic[0]
  if (/edmonton/i.test(name)) return null
  return [...covered].some((c) => c.toLowerCase().includes(name.toLowerCase()))
    ? null
    : name
}

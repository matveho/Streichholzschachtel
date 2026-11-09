import { normalize } from './indexer.mjs'

const sourceKey = (source) => {
  const doc = source.passage?.doc ?? source.doc
  const page = source.passage?.page ?? source.page
  const text = source.excerpt ?? source.text
  return doc && typeof text === 'string'
    ? JSON.stringify([doc, page, normalize(text), source.quoteStart ?? null])
    : null
}

function sourceLedger(units, findings, references) {
  const uses = new Map()
  for (const finding of findings)
    for (const proof of finding.evidence || []) {
      const key = sourceKey(proof)
      if (!key) continue
      if (!uses.has(key)) uses.set(key, new Set())
      uses.get(key).add(finding.check)
    }
  const unique = new Map(
    units.map((unit) => [sourceKey(unit), unit]).filter(([key]) => key),
  )
  const provisions = [...unique].map(([key, unit]) => {
    const refs = references.filter((reference) => sourceKey(reference) === key)
    const findingChecks = [...(uses.get(key) || [])].filter(Boolean)
    return {
      doc: unit.passage.doc,
      page: unit.passage.page,
      ...(unit.quoteStart !== undefined ? { quoteStart: unit.quoteStart } : {}),
      status: uses.has(key)
        ? 'cited_in_finding'
        : refs.length
          ? 'source_evidence_only'
          : 'not_reported',
      referenceIds: refs.map((reference) => reference.id),
      findingChecks,
    }
  })
  return {
    selectedSourceCount: provisions.length,
    citedSourceCount: provisions.filter(
      (provision) => provision.status === 'cited_in_finding',
    ).length,
    sourceOnlyCount: provisions.filter(
      (provision) => provision.status === 'source_evidence_only',
    ).length,
    unreportedSourceCount: provisions.filter(
      (provision) => provision.status === 'not_reported',
    ).length,
    provisions,
  }
}

function pendingSourceReport(checks, documents) {
  const pages = new Map()
  for (const check of checks)
    for (const provision of check.evidenceCoverage?.provisions || []) {
      if (provision.status !== 'source_evidence_only') continue
      const key = `${provision.doc}/${provision.page}`
      if (!pages.has(key))
        pages.set(key, {
          doc: provision.doc,
          page: provision.page,
          refs: new Set(),
          titles: new Set(),
        })
      const page = pages.get(key)
      provision.referenceIds.forEach((id) => page.refs.add(id))
      page.titles.add(check.title)
    }
  if (!pages.size) return []
  const rows = [...pages.values()]
  return [
    {
      heading: 'Selected evidence awaiting interpretation',
      sentences: [
        {
          text: 'These selected source provisions have no corresponding cited finding. Review their applicability; this list does not establish missing project work or noncompliance.',
        },
        ...rows.slice(0, 8).map((row) => ({
          text: `${[...row.titles].join('; ')} · ${documents.find((doc) => doc.id === row.doc)?.label || 'Source document'} · PDF p. ${row.page}: ${row.refs.size} selected provision(s) for review.`,
          refs: [...row.refs],
        })),
        ...(rows.length > 8
          ? [
              {
                text: `${rows.length - 8} additional source page(s) remain listed in the cited source sections.`,
              },
            ]
          : []),
      ],
    },
  ]
}

// Citation use is reported explicitly. It never establishes design approval,
// source applicability or complete interpretation of every clause in a quote.
export function attachReviewCoverage(result, topics = [], plan, checked) {
  const groups = plan?.groups || []
  const requested = topics.length
    ? [
        ...topics,
        ...groups.filter(
          (group) =>
            ['comparison','replacement-interface'].includes(group.role) &&
            !topics.some((topic) => topic.heading === group.heading),
        ),
      ]
    : groups
  const sections = checked?.sections || []
  const allFindings = sections
    .filter((section) => !section.heading)
    .flatMap((section) => section.claims)
  const allUnits = groups.flatMap((group) => group.units || [])
  const references = result.references || []
  const checks = requested.map((topic, index) => {
    const group = groups.find((g) => g.heading === topic.heading)
    const findings = group
      ? sections
          .filter((s) => !s.heading)
          .flatMap((s) => s.claims)
          .filter((c) => c.check === group.id)
      : []
    const shared = plan?.sharedEvidence?.[topic.heading] || []
    const evidence = sections
      .filter((s) => s.heading)
      .flatMap((s) => s.claims)
      .filter((c) => (group ? c.check === group.id : shared.includes(c.check)))
    const open = (plan?.unresolved || []).filter(
      (item) => item === topic.heading,
    )
    const ownProofs = new Set(
      findings.flatMap((finding) => (finding.evidence || []).map(sourceKey)),
    )
    const units = [
      ...(group?.units || []),
      ...groups
        .filter((candidate) => shared.includes(candidate.id))
        .flatMap((candidate) => candidate.units || []),
      ...allUnits.filter((unit) => ownProofs.has(sourceKey(unit))),
    ]
    const coverage = units.length
      ? sourceLedger(units, allFindings, references)
      : null
    return {
      id: group?.id || `unresolved-${index}`,
      title: topic.heading,
      status: findings.length
        ? open.length || (coverage && coverage.citedSourceCount < coverage.selectedSourceCount)
          ? 'partial_findings'
          : 'findings_available'
        : evidence.length
          ? 'evidence_only'
          : 'unresolved',
      findingCount: findings.length,
      ...(coverage ? { evidenceCoverage: coverage } : {}),
      ...(shared.length
        ? {
            sharedWith: groups
              .filter((g) => shared.includes(g.id))
              .map((g) => g.heading),
          }
        : {}),
      ...(open.length ? { limitations: open } : {}),
    }
  })
  const review = {
    checks,
    limitations: [...new Set(plan?.unresolved || [])],
    requiresEngineeringReview: true,
  }
  const labels = {
    findings_available: 'Findings available',
    partial_findings:
      'Partial findings; selected source provisions remain for review',
    evidence_only: 'Source evidence only; interpretation unresolved',
    unresolved:
      'Unresolved; applicable evidence or project information required',
  }
  return {
    ...result,
    ...(plan?.calculationUnavailable?{notes:[...(result.notes||[]),'The model did not establish a calculation plan. Any displayed arithmetic must still pass independent operand and unit verification.']}:{}),
    review,
    report: [
      ...result.report,
      ...(checks.length
        ? [
            {
              heading: 'Review coverage',
              sentences: checks.map((c) => ({
                text: `${c.title}: ${c.sharedWith?.length ? 'Source evidence shared with ' + c.sharedWith.join('; ') : c.limitations?.length && c.status === 'partial_findings' ? 'Partial findings; this check remains unresolved' : labels[c.status]}.${c.evidenceCoverage ? ` ${c.evidenceCoverage.citedSourceCount} of ${c.evidenceCoverage.selectedSourceCount} selected source provisions cited in findings; ${c.evidenceCoverage.sourceOnlyCount} source-only; ${c.evidenceCoverage.unreportedSourceCount} not reported.` : ''}`,
              })),
            },
          ]
        : []),
      ...pendingSourceReport(checks, result.documents || []),
    ],
  }
}

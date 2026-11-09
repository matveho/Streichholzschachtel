const textKey = (text) => String(text).replace(/\s+/g, ' ').trim()

export function rejectedFindingTargets(cached, issues) {
  return cached.flatMap(finding => {
    const failures = issues.filter(issue => textKey(issue.claim) === textKey(finding.text))
    return failures.length ? [{ finding: finding.text, reasons: [...new Set(failures.map(issue => issue.reason))] }] : []
  }).map((target, index) => ({ id: `repair-${index}`, ...target }))
}

// One named slot per rejected finding prevents retained facts from consuming
// another finding's repair budget. An empty slot explicitly withholds a repair.
export function repairResponseFormat(format, targets) {
  if (!targets.length) return format
  return { type: 'object', properties: { repairs: {
    type: 'object', additionalProperties: false,
    properties: Object.fromEntries(targets.map(target => [target.id, {
      type: 'array', maxItems: 1, items: format.properties.findings.items,
    }])),
    required: targets.map(target => target.id),
  } }, required: ['repairs'] }
}

export function repairedFindings(output, targets) {
  if (!targets.length) return Array.isArray(output.findings) ? output.findings : []
  return targets.flatMap(target => Array.isArray(output.repairs?.[target.id]) ? output.repairs[target.id].slice(0, 1) : [])
}

export function repairFeedback(cached, issues, limit = 8) {
  const draftKeys = new Set(cached.map(finding => textKey(finding.text)))
  const ownDrafts = issues.filter(issue => draftKeys.has(textKey(issue.claim)))
  const sourceIssues = issues.filter(issue => !draftKeys.has(textKey(issue.claim)))
  const seen = new Set()
  return [...ownDrafts, ...sourceIssues].filter(issue => {
    const key = textKey(issue.claim) + '\0' + issue.reason
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, limit)
}

export function scopedRepair(cached, issues, check) {
  const own = issues.filter((issue) => !issue.check || issue.check === check)
  const failed = new Set(own.map((issue) => textKey(issue.claim)))
  return {
    issues: own,
    retained: cached.filter((finding) => !failed.has(textKey(finding.text))),
  }
}

export function mergeApprovedSynthesis(previous, repaired, maxFindingsPerCheck = 2) {
  const sections = new Map(),
    seen = new Set(),
    counts = new Map()
  for (const result of [previous, repaired]) {
    for (const section of result.sections) {
      const heading = section.heading || ''
      if (!sections.has(heading))
        sections.set(heading, { ...section, claims: [] })
      for (const claim of section.claims) {
        const key = heading + '\0' + textKey(claim.text)
        if (seen.has(key)) continue
        if (!heading && claim.check && (counts.get(claim.check) || 0) >= maxFindingsPerCheck)
          continue
        sections.get(heading).claims.push(claim)
        seen.add(key)
        if (!heading && claim.check)
          counts.set(claim.check, (counts.get(claim.check) || 0) + 1)
      }
    }
  }
  const accepted = new Set(
    [...sections.values()].flatMap((s) => s.claims.map((c) => textKey(c.text))),
  )
  const issues = repaired.issues.filter(
    (issue) => !accepted.has(textKey(issue.claim)),
  )
  return {
    ...repaired,
    sections: [...sections.values()].filter((s) => s.claims.length),
    issues,
    rejected: issues.length,
  }
}

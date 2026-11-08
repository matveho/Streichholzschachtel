const textKey = (text) => String(text).replace(/\s+/g, ' ').trim()

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

// Coverage describes available outputs, never design approval or completeness.
export function attachReviewCoverage(result, topics = [], plan, checked) {
  const groups = plan?.groups || []
  const requested = topics.length ? topics : groups
  const sections = checked?.sections || []
  const checks = requested.map((topic, index) => {
    const group = groups.find(g => g.heading === topic.heading)
    const findings = group ? sections.filter(s => !s.heading).flatMap(s => s.claims).filter(c => c.check === group.id) : []
    const evidence = group ? sections.filter(s => s.heading).flatMap(s => s.claims).filter(c => c.check === group.id) : []
    const open = (plan?.unresolved || []).filter(item => item === topic.heading)
    return {
      id: group?.id || `unresolved-${index}`,
      title: topic.heading,
      status: findings.length ? 'findings_available' : evidence.length ? 'evidence_only' : 'unresolved',
      findingCount: findings.length,
      ...(open.length ? {limitations: open} : {}),
    }
  })
  const review = { checks, limitations: [...new Set(plan?.unresolved || [])], requiresEngineeringReview: true }
  const labels = {findings_available:'Findings available',evidence_only:'Source evidence only; interpretation unresolved',unresolved:'Unresolved; applicable evidence or project information required'}
  return { ...result, review, report: [...result.report, ...(checks.length ? [{heading:'Review coverage',sentences:checks.map(c=>({text:`${c.title}: ${labels[c.status]}.`}))}] : [])] }
}

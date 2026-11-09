// Policies choose a workflow, never establish regulatory applicability.
export function permitsLocalSynthesis(question, documents, policy = 'all') {
  if (policy === 'all') return true
  if (policy !== 'comparisons') return false
  if (!/\b(?:compare|comparison|difference|versus|against)\b/i.test(question)) return false
  if (/\b(?:approve|approval|acceptance|compliant|compliance|safe)\b/i.test(question)) return false
  return documents.some(d => d.projectArtifact) && documents.some(d => !d.projectArtifact)
}

export function hasPairedProjectComparison(sections, documents) {
  const byId = new Map(documents.map(doc => [doc.id, doc]))
  const roles = claim => new Set(claim.evidence.flatMap(evidence => {
    const doc = byId.get(evidence.passage.doc)
    return doc ? [doc.projectArtifact ? 'project' : 'reference'] : []
  }))
  const paired = set => set.has('project') && set.has('reference')
  const findings = sections.filter(section => !section.heading).flatMap(section => section.claims)
  if (!paired(new Set(findings.flatMap(claim => [...roles(claim)])))) return false
  // Separate atomic observations can establish the two sides. Each derived
  // comparison must additionally carry both sides in its own evidence.
  let completed = false
  for (const claim of findings) {
    const text = claim.text || ''
    const quantities = new Set(text.match(/\d+(?:\.\d+)?/g) || [])
    const relational = /\b(?:below|above|less than|greater than|exceeds?|shortfall|difference|deficit|falls? short|compared)\b/i.test(text)
    const judgment = /\b(?:meets?|complies with|compliant|approved|acceptable)\b/i.test(text)
    const derived = claim.calculations?.length || (relational && (quantities.size > 1 || /\b(?:project|proposed|model|IFC)\b/i.test(text))) || judgment
    if (/\b(?:approved|compliant|safe to use|accepted for construction)\b/i.test(text)) return false
    if (derived) {
      if (!paired(roles(claim))) return false
      completed = true
    }
  }
  return completed
}

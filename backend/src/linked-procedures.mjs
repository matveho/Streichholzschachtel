import { evidenceUnitKey } from './evidence-units.mjs'

// Keep the remaining clauses of an explicitly identified testing procedure.
// Candidates have already passed the question's applicability filter. This
// supplies original provisions, not an inferred test plan or acceptance verdict.
export function linkedProcedureEvidence(selected, candidates, question, limit = 8) {
  if (limit <= 0) return []
  if (!/\b(?:tests?|testing|sampling|inspections?|acceptance|commissioning|verification)\b/i.test(question)) return []
  const procedure = unit => {
    const heading = unit.heading || ''
    const title = heading.split(' · ').at(-1).replace(/^\d+(?:\.\d+)*\s*/, '')
    return /\b(?:testing|sampling|inspection|commissioning)\b/i.test(title) && title.split(/\s+/).length >= 3
      ? JSON.stringify([unit.passage.doc, heading, unit.scope || []]) : null
  }
  const families = new Map()
  const parents = new Map()
  for (const unit of selected) {
    const key = procedure(unit)
    if (!key) continue
    if (!families.has(key)) families.set(key, [])
    families.get(key).push(unit)
    const parent = unit.heading.split(' · ')[0]
    if (parent !== unit.heading && /^\d+(?:\.\d+){2,}\s/.test(parent))
      parents.set(JSON.stringify([unit.passage.doc, parent, unit.scope || []]), unit)
  }
  const seen = new Set(selected.map(evidenceUnitKey))
  const added = []
  for (const unit of candidates) {
    let anchors = families.get(procedure(unit))
    // Quantified performance criteria in the procedure's actual parent
    // subsection are relevant to acceptance/condition checks, not every lookup.
    if (!anchors && /\b(?:compaction|acceptance|corrective|remediation)\b/i.test(question) && /\d/.test(unit.excerpt) && /\b(?:minimum|maximum|recommended|required|must|shall)\b/i.test(unit.excerpt)) {
      const parent = parents.get(JSON.stringify([unit.passage.doc, unit.heading, unit.scope || []]))
      if (parent) anchors = [parent]
    }
    if (!anchors || !anchors.some(anchor => Number.isInteger(anchor.passage.page) && Math.abs(anchor.passage.page - unit.passage.page) <= 1)) continue
    const key = evidenceUnitKey(unit)
    if (seen.has(key)) continue
    seen.add(key)
    added.push(unit)
    if (added.length >= limit) break
  }
  return added
}

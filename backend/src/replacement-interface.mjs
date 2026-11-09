import { evidenceUnitKey } from './evidence-units.mjs'
import { conditionalSourceItems } from './evidence-guards.mjs'
import { normalize } from './indexer.mjs'

// Plan one bounded reconciliation task from sources already selected for this
// request. This identifies an interface to review; it does not resolve it.
export function replacementInterface(question, groups, originalKeys = []) {
  if (!/\breplace(?:ment)?\b|\bin lieu\b|\bsubstitut/i.test(question) || groups.length >= 8) return null
  const originals = new Set(originalKeys)
  const all = [...new Map(groups.flatMap(group=>group.units).map(unit=>[evidenceUnitKey(unit),unit])).values()]
  const obligations = all.filter(unit=>originals.has(evidenceUnitKey(unit)) && /\b(?:must|shall|required)\b/i.test(unit.excerpt) &&
    !/\b(?:not required|shall not|must not)\b/i.test(unit.excerpt))
    .sort((a,b)=>conditionalSourceItems(a.excerpt).length-conditionalSourceItems(b.excerpt).length).slice(0,1)
  const alternatives = all.filter(unit=>!obligations.includes(unit) &&
    /\b(?:may|can|(?:is|are)\s+(?:permitted|allowed))\b(?!\s+(?:not|never)\b)[^.!?]{0,160}\b(?:in lieu|replace|instead of|alternative to)\b/i.test(unit.excerpt)).slice(0,1)
  if (!obligations.length || !alternatives.length) return null
  return {id:`check-${groups.length}`,heading:'Replacement servicing interface',
    query:question,role:'replacement-interface',units:[...obligations,...alternatives],
    evidenceRoles:{obligation:obligations,alternative:alternatives}}
}

export function replacementInterfaceIssue(text, evidence, group) {
  if (group?.role !== 'replacement-interface') return null
  for (const [role,units] of Object.entries(group.evidenceRoles)) {
    const cited = units.some(unit=>evidence.some(proof=>proof.passage.doc===unit.passage.doc &&
      proof.passage.page===unit.passage.page && proof.quoteStart===unit.quoteStart && normalize(proof.excerpt)===normalize(unit.excerpt)))
    if (!cited) return `The replacement interface must cite its actual ${role} provision. Related context cannot replace positive evidence from both source roles.`
  }
  if (!/\b(?:confirm|resolve|clarify|reconcile)\b/i.test(text))
    return 'State the unresolved servicing interface to confirm, rather than deciding that one provision overrides the other.'
  return null
}

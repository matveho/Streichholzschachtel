const key = unit => `${unit.passage.doc}:${unit.excerpt}`
const table = unit => unit.heading?.match(/\bTable\s+\d+(?:\.\d+)*(?:\s*:[^·]+)?/i)?.[0]
const generic = new Set('table minimum maximum design requirement requirements values value criteria numerical general coefficient coefficients sewer sewers storm water sanitary pipe pipes'.split(' '))
const methodTerms = text => new Set((text.toLowerCase().replace(/['’]s\b/g, '').match(/[a-z]{5,}/g) || []).filter(word => !generic.has(word)))
const section = unit => [...(unit.scope || []), unit.heading?.split(' · ')[0]].filter(Boolean).findLast(s => /^\d+(?:\.\d+){2,}\b/.test(s))

// Retain immutable table evidence, never infer a value or approve applicability.
export function linkedTableEvidence(selected, candidates, limit = 8) {
  const seen = new Set(selected.map(key)), groups = new Map()
  for (const candidate of candidates) {
    const caption = table(candidate)
    if (!caption || !/\d/.test(candidate.excerpt) || seen.has(key(candidate))) continue
    const number = caption.match(/\d+(?:\.\d+)*/)[0]
    const linked = selected.some(source => {
      if (source.passage.doc !== candidate.passage.doc) return false
      const explicit = new RegExp(`\\bTable\\s+${number.replaceAll('.', '\\.')}\\b`, 'i').test(source.excerpt)
      const sameSection = section(source) && section(source) === section(candidate)
      const sourceTerms = methodTerms(source.excerpt)
      const samePageMethod = source.passage.page === candidate.passage.page && [...methodTerms(caption)].some(term => sourceTerms.has(term))
      return explicit || samePageMethod || (sameSection && Math.abs(source.passage.page-candidate.passage.page) <= 1)
    })
    if (!linked) continue
    const id=candidate.passage.doc+':'+caption
    if (!groups.has(id)) groups.set(id,[])
    groups.get(id).push(candidate)
  }
  const added=[]
  // Round robin prevents one large table consuming the entire evidence budget.
  while (added.length < limit && [...groups.values()].some(rows=>rows.length)) {
    for (const rows of groups.values()) {
      const row=rows.shift()
      if (!row || seen.has(key(row))) continue
      seen.add(key(row));added.push(row)
      if (added.length===limit) break
    }
  }
  return added
}

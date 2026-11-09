import { UnitIndex, lookup } from './lookup.mjs'
import { pipeMeasurementSearches } from './project-measurements.mjs'
import { incompatiblePipeRole, conveyanceScope } from './applicability.mjs'
import { foreignJurisdiction, seriesInQuestion } from './catalog.mjs'

// Split source retrieval, not the engineering decision. Reuse the ordinary
// lookup over the already scoped corpus; never look up a global document ID.
export function mixedPipeEvidence(question, index) {
  if (foreignJurisdiction(question, index.corpus.documents)) return null
  // Historical/edition questions retain the ordinary version-aware lookup.
  if (/\b(previous|old|older|prior|former|20(?:1\d|2[0-2]))\b/i.test(question)) return null
  const topics = pipeMeasurementSearches(question, [])
  if (!topics.length) return null
  const referenceDocuments = index.corpus.documents.filter(document => !document.projectArtifact)
  const named = referenceDocuments.filter(document => [document.title,document.label].some(name =>
    name?.length > 6 && question.toLowerCase().includes(name.toLowerCase())))
  const series = seriesInQuestion(question)
  const documents = (named.length === 1 ? named : referenceDocuments)
    .filter(document => !series.length || series.includes(document.series))
  const selected = new Set(documents.map(document => document.id))
  const sections = [], checks = []
  for (const topic of topics) {
    const {role,system} = topic.assetScope
    const units = index.corpus.units.filter(unit => {
      if (!selected.has(unit.doc)) return false
      const source = {excerpt:unit.text,heading:unit.frame || unit.heading}
      if (incompatiblePipeRole(`${system} ${role}`,source)) return false
      const scope = conveyanceScope(source)
      return !(system === 'storm' && scope.sanitary && !scope.storm) &&
        !(system === 'sanitary' && scope.storm && !scope.sanitary)
    })
    const focused = new UnitIndex({...index.corpus,documents,units})
    const searches = ['cover','depth'].map(property => lookup(
      `${system} ${role === 'main' ? 'sewer' : 'service'} minimum ${property}`,
      focused,
    ))
    const retained = [], seen = new Set()
    for (const result of searches) {
      if (result.mode !== 'extractive_answer') continue
      const hasDepth = sentence => sentence.units?.some(unit => /\b(?:cover|depth|burial)\b/i.test(unit.text))
      if (!result.sections.some(section=>section.sentences.some(hasDepth))) continue
      for (const section of result.sections) for (const sentence of section.sentences) {
        if (!hasDepth(sentence) && !/Conditions from the table notes|Version and applicability/.test(section.heading)) continue
        if (!sentence.units?.length || !sentence.units.every(unit => selected.has(unit.doc) && unit.regions?.length)) continue
        const key = sentence.units.map(unit => unit.id).join('/')
        if (seen.has(key)) continue
        seen.add(key)
        retained.push(sentence)
      }
    }
    checks.push({role,system,status:retained.length ? 'source_evidence' : 'not_found',
      units:retained.flatMap(sentence => sentence.units)})
    sections.push({heading:`${system[0].toUpperCase()+system.slice(1)} ${role} cover · source evidence`,
      sentences:retained.length ? retained : [{text:'No directly matching cover or depth criterion was found for this asset in the selected documents.',units:[]}]})
  }
  return {mode:checks.some(check => check.units.length) ? 'source_evidence' : 'insufficient_evidence',
    sections,checks,notes:['Cover and depth source clauses are retrieved separately for each asset. They do not establish project compliance, insulation suitability, approval, or completion of other requested checks.']}
}

import { pipeProjectMeasurements } from './project-measurements.mjs'
import { applicableEvidence, incompatiblePipeRole, conveyanceScope } from './applicability.mjs'

// Describe missing project inputs, not a compliance verdict. Only references
// already returned within the query scope can motivate a requested input.
export function attachPipeReviewInputs(result, question) {
  if (!/\b(?:cover|burial|depth)\b/i.test(question) ||
      !/\b(?:review|assess|compare|meets?|compliance|insulation|approval)\b|\bcan we use\b/i.test(question)) return result
  const measurements = pipeProjectMeasurements(question)
  const documents = new Map((result.documents || []).map(document => [document.id, document]))
  const references = (result.references || []).filter(reference => {
    const document = documents.get(reference.doc)
    return document && !document.projectArtifact && reference.regions?.length
  })
  const fields = []
  const assets = new Map(measurements.map(record => [record.system + '/' + record.role, record]))
  for (const asset of assets.values()) {
    const own = measurements.filter(record => record.role === asset.role && record.system === asset.system)
    if (!own.some(record => record.property !== 'diameter')) continue
    const name = [asset.system, asset.role].filter(Boolean).join(' ')
    const scoped = references.filter(reference => {
      const unit = {excerpt: reference.excerpt, heading: reference.label}
      const system = conveyanceScope(unit)
      if (asset.system === 'storm' && system.sanitary && !system.storm) return false
      if (asset.system === 'sanitary' && system.storm && !system.sanitary) return false
      return !incompatiblePipeRole(name, unit)
    })
    const units = applicableEvidence(question, scoped.map(reference => ({
      excerpt: reference.excerpt, heading: reference.label, referenceId: reference.id,
    })), {pipeScope: {role: asset.role, system: asset.system}}).units
    const depthRules = units.filter(unit => /\b(?:cover|depth)\b/i.test(unit.excerpt) &&
      /\b(?:minimum|maximum|shall|must|required|at least)\b/i.test(unit.excerpt))
    const datumRules = depthRules.filter(unit => /\b(?:from|to)\s+(?:the\s+)?(?:pipe\s+)?(?:obvert|invert)\b/i.test(unit.excerpt))
    for (const record of own.filter(record => record.property !== 'diameter' && record.datum === 'not-stated')) {
      if (!datumRules.length) continue
      fields.push({key: `${asset.system || 'pipe'}_${asset.role}_${record.property}_datum`,
        label: `${name[0].toUpperCase() + name.slice(1)} ${record.property} datum`,
        property: 'measurement_datum', role: asset.role, system: asset.system,
        reason: `Identify the measurement endpoints for the supplied ${record.value} ${record.unit} ${record.property}; confirm compatibility with each cited obvert/invert criterion.`,
        referenceIds: [...new Set(datumRules.map(unit => unit.referenceId))]})
    }
    const diameterRules = depthRules.filter(unit => unit.unresolvedConditions?.some(condition => condition.property === 'diameter'))
    if (diameterRules.length) fields.push({key: `${asset.system || 'pipe'}_${asset.role}_diameter`,
      label: `${name[0].toUpperCase() + name.slice(1)} diameter`, unit: 'mm',
      property: 'diameter', role: asset.role, system: asset.system,
      reason: 'Provide one confirmed diameter for this asset to evaluate the cited diameter-dependent cover criterion. A different asset’s diameter cannot establish it.',
      referenceIds: [...new Set(diameterRules.map(unit => unit.referenceId))]})
  }
  if (!fields.length) return result
  const action = 'Confirm the listed project inputs before assessing compliance or selecting an insulation detail.'
  const prior = result.requiredInputs
  return {...result,
    requiredInputs: !prior || prior.kind === 'reference_basis'
      ? {kind: 'pipe_review_inputs', fields, action: prior ? prior.action + ' ' + action : action}
      : prior,
    report: [...result.report, {heading: 'Project inputs to confirm', sentences: [
      {text: action},
      ...fields.map(field => ({text: `${field.label}${field.unit ? ` (${field.unit})` : ''}: ${field.reason}`, refs: field.referenceIds})),
    ]}],
  }
}

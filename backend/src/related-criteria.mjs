import { quantityUnits } from './indexer.mjs'
import { conveyanceScope, pipeRole, applicableEvidence } from './applicability.mjs'
import { evidenceUnits, isProvision } from './evidence-units.mjs'

// Classify the quoted criterion, never its authority or project compliance.
export function depthCriterion(unit) {
  const text = [unit.excerpt, unit.conditionEvidence?.excerpt]
    .filter(Boolean)
    .join(' ')
  if (
    !/\b(?:cover|depth)\b/i.test(text) ||
    !/\b(?:minimum|maximum|at least|at most|shall|must|required)\b/i.test(text)
  )
    return null
  const role = pipeRole([text, unit.heading, ...(unit.scope || [])].join(' '))
  const system = conveyanceScope(unit)
  if (!role || system.storm === system.sanitary) return null
  const measured = quantityUnits(text).flatMap((value) => {
    const [number, units] = value.split(':')
    const scale = { mm: 0.001, cm: 0.01, m: 1, km: 1000 }[units]
    return scale
      ? [{ value: Number((Number(number) * scale).toPrecision(12)), unit: 'm' }]
      : []
  })
  const values = [
    ...new Map(measured.map((value) => [value.value, value])).values(),
  ]
  // Without a full property binding, a pipe diameter and burial depth in one
  // clause cannot both be labelled as depth. Keep such text in source evidence.
  if (values.length !== 1) return null
  const invertDatum = /\b(?:from|to)\s+(?:the\s+)?(?:pipe\s+)?invert\b/i.test(text)
  const obvertDatum = /\b(?:from|to)\s+(?:the\s+)?(?:pipe\s+)?obvert\b/i.test(text)
  return {
    property: 'burial-depth',
    role,
    system: system.storm ? 'storm' : 'sanitary',
    datum: invertDatum && !obvertDatum
      ? /\binvert(?:\s+elevation)?\s+to\s+(?:the\s+)?(?:finished\s+)?curb(?:\s+top)?\s+grade\b/i.test(text)
        ? 'invert-to-curb'
        : 'invert-depth'
      : obvertDatum && !invertDatum
        ? 'cover-to-obvert'
        : 'not-stated',
    values,
  }
}

export function relatedCriteriaEvidence(selected, ranked, question) {
  if (!/\b(?:cover|burial|depth)\b/i.test(question)) return []
  const criteria = selected.flatMap((unit) => {
    const criterion = depthCriterion(unit)
    return criterion ? [{ ...criterion, doc: unit.passage.doc }] : []
  })
  const seen = new Set(
    selected.map((unit) => unit.passage.doc + ':' + unit.excerpt),
  )
  const added = []
  const addedDocuments = new Set(selected.map(unit=>unit.passage.doc))
  for (const unit of ranked) {
    const key = unit.passage.doc + ':' + unit.excerpt
    if (seen.has(key) || addedDocuments.has(unit.passage.doc)) continue
    const candidate = depthCriterion(unit)
    if (
      !candidate ||
      !criteria.some(
        (c) =>
          c.doc !== unit.passage.doc &&
          c.role === candidate.role &&
          c.system === candidate.system,
      )
    )
      continue
    added.push(unit)
    addedDocuments.add(unit.passage.doc)
    seen.add(key)
    if (added.length === 2) break
  }
  return added
}

export function supplementaryReferenceCriteria(question, selected, index) {
  if (!selected.some(depthCriterion)) return []
  const documents = index.corpus.documents.filter(doc=>!doc.projectArtifact)
  if (!documents.length) return []
  const named = documents.filter(doc=>[doc.title,doc.label].some(name=>name?.length>6 && question.toLowerCase().includes(name.toLowerCase())))
  if (named.length === 1) return []
  const passages = index.withPageContext(index.searchSingle(question,documents.map(doc=>doc.id)).slice(0,12))
  const candidates = applicableEvidence(question,evidenceUnits(passages,30000)).units.filter(isProvision)
  return relatedCriteriaEvidence(selected,candidates,question)
}

export function attachReferenceCriteria(result) {
  const documents = new Map(result.documents.map((doc) => [doc.id, doc]))
  const groups = new Map()
  for (const reference of result.references) {
    const document = documents.get(reference.doc)
    if (!document || document.projectArtifact) continue
    const criterion = depthCriterion({
      excerpt: reference.excerpt,
      heading: reference.label,
      passage: { doc: reference.doc },
    })
    if (!criterion) continue
    const key =
      criterion.system + '/' + criterion.role + '/' + criterion.property
    if (!groups.has(key)) groups.set(key, [])
    groups
      .get(key)
      .push({
        ...criterion,
        doc: reference.doc,
        page: reference.page,
        referenceId: reference.id,
        label: document.label,
        conditional: /\b(?:if|when|where|unless)\b/i.test(reference.excerpt),
      })
  }
  const interfaces = []
  for (const [key, rows] of groups) {
    const distinct = [
      ...new Map(
        rows.map((row) => [
          row.doc +
            '/' +
            row.datum +
            '/' +
            JSON.stringify(row.values) +
            '/' +
            row.conditional,
          row,
        ]),
      ).values(),
    ]
    if (new Set(distinct.map((row) => row.doc)).size < 2) continue
    if (
      new Set(
        distinct.map(
          (row) =>
            row.datum +
            '/' +
            JSON.stringify(row.values) +
            '/' +
            row.conditional,
        ),
      ).size < 2
    )
      continue
    interfaces.push({ key, status: 'review_required', criteria: distinct })
  }
  if (!interfaces.length) return result
  const datumLabels = {
    'cover-to-obvert': 'cover to pipe obvert',
    'invert-to-curb': 'invert to finished curb grade',
    'invert-depth': 'depth to invert',
    'not-stated': 'measurement datum not stated',
  }
  return {
    ...result,
    referenceInterfaces: interfaces,
    requiredInputs: result.requiredInputs || {kind:'reference_basis',action:'Confirm the applicable reference criteria and the project measurement datum, or select the intended reference document.'},
    report: [
      ...result.report,
      {
        heading: 'Reference criteria to reconcile',
        sentences: interfaces.flatMap((item) => [
          {
            text: `${item.criteria[0].system === 'storm' ? 'Storm' : 'Sanitary'} ${item.criteria[0].role} depth: references use differing values, conditions or measurement datums. Confirm applicability and the project datum before making a compliance decision.`,
          },
          ...item.criteria.map((row) => ({
            text: `${row.label} · PDF p. ${row.page}: ${row.values.map((value) => `${value.value} ${value.unit}`).join(', ')}; ${datumLabels[row.datum]}${row.conditional ? '; conditional provision—review its stated condition' : ''}.`,
            refs: [row.referenceId],
          })),
        ]),
      },
    ],
  }
}

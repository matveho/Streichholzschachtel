import { createHash } from 'node:crypto'

export const comparisonCategories = [
  'reference',
  'client',
  'design',
  'report',
  'supporting',
]
const hash = (value) =>
  createHash('sha256').update(value).digest('hex').slice(0, 24)
const unquote = (s) => s.slice(1, -1).replaceAll("''", "'")

// Split STEP arguments without splitting nested typed values or escaped strings.
function args(text) {
  const result = []
  let start = 0,
    depth = 0,
    quoted = false
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "'") {
      if (quoted && text[i + 1] === "'") {
        i++
        continue
      }
      quoted = !quoted
    }
    if (quoted) continue
    if (text[i] === '(') depth++
    if (text[i] === ')') depth--
    if (text[i] === ',' && depth === 0) {
      result.push(text.slice(start, i).trim())
      start = i + 1
    }
  }
  result.push(text.slice(start).trim())
  return result
}
const refs = (s = '') => s.match(/#\d+/g) || []
export function readIfcProperties(text) {
  if (!text.includes('ISO-10303-21;'))
    throw new Error('Unsupported IFC encoding; STEP IFC is required.')
  const entities = new Map()
  for (const match of text.matchAll(
    /(#\d+)\s*=\s*(IFC\w+)\s*\(((?:[^';]|'(?:[^']|'')*')*)\)\s*;/gi,
  ))
    entities.set(match[1], {
      type: match[2].toUpperCase(),
      args: args(match[3]),
    })
  const result = []
  for (const relation of entities.values()) {
    if (relation.type !== 'IFCRELDEFINESBYPROPERTIES') continue
    const set = entities.get(relation.args[5])
    if (set?.type !== 'IFCPROPERTYSET') continue
    for (const elementId of refs(relation.args[4])) {
      const element = entities.get(elementId)
      if (!element) continue
      const properties = []
      for (const propertyId of refs(set.args[4])) {
        const p = entities.get(propertyId)
        if (p?.type !== 'IFCPROPERTYSINGLEVALUE') continue
        const typed = p.args[2]?.match(/^IFC\w+\((.*)\)$/i)
        if (!typed) continue
        properties.push({
          name: unquote(p.args[0]),
          value: typed[1].startsWith("'")
            ? unquote(typed[1])
            : Number(typed[1]),
          propertyId,
          explicitUnit: p.args[3] !== '$',
        })
      }
      result.push({
        elementId,
        globalId: unquote(element.args[0]),
        name: element.args[2]?.startsWith("'")
          ? unquote(element.args[2])
          : elementId,
        identifiers: [element.args[2], element.args[7], element.args[0]]
          .filter((value) => value?.startsWith("'"))
          .map(unquote)
          .filter((value) => value.trim()),
        properties,
      })
    }
  }
  const merged = new Map()
  for (const element of result) {
    const existing = merged.get(element.elementId)
    if (existing) existing.properties.push(...element.properties)
    else merged.set(element.elementId, element)
  }
  for (const element of merged.values()) {
    element.sources = ['Source', 'RelatedSource'].flatMap((prefix) => {
      const file = element.properties.find(
        (p) => p.name === prefix + 'Document',
      )?.value
      const page = Number(
        element.properties.find((p) => p.name === prefix + 'Page')?.value,
      )
      return typeof file === 'string' && Number.isInteger(page) && page > 0
        ? [{ file, page }]
        : []
    })
  }
  return [...merged.values()]
}
const unitNames = {
  m: 'm',
  mm: 'mm',
  '%': 'percent',
  percent: 'percent',
  'km/h': 'kph',
  kph: 'kph',
  'L/s': 'lps',
  'm³/s': 'm3ps',
  'm3/s': 'm3ps',
  'm²': 'm2',
  m2: 'm2',
  'm³': 'm3',
  m3: 'm3',
}
function propertyMetric(property) {
  if (property.explicitUnit) return null
  const name = property.name
  const labelled =
    typeof property.value === 'string' &&
    property.value
      .trim()
      .match(
        /^(-?\d+(?:\.\d+)?)\s*(mm|m|%|percent|km\/h|kph|L\/s|m³\/s|m3\/s|m²|m2|m³|m3)$/,
      )
  const match = name.match(/^(.*)_(m|mm|percent|kph|m2|m3)$/i)
  if (!match && !labelled) return null
  const words = (match ? match[1] : name)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
  const bound = words.startsWith('min ')
    ? 'min'
    : words.startsWith('max ')
      ? 'max'
      : 'exact'
  return {
    words: words.replace(/^(min|max) /, '').split(' '),
    unit: labelled ? unitNames[labelled[2]] : match[2].toLowerCase(),
    value: labelled ? Number(labelled[1]) : property.value,
    bound,
  }
}
const units = {
  m: 'm(?:et(?:re|er)s?)?',
  mm: 'mm|millimet(?:re|er)s?',
  percent: '%|percent',
  kph: 'km/h|kph|kmph',
  m2: 'm²|m2',
  m3: 'm³|m3',
  lps: 'L/s',
  m3ps: 'm³/s|m3/s',
}

function identifies(element, text) {
  return (element.identifiers || [element.name]).some((identifier) => {
    if (!identifier?.trim()) return false
    const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(?<![\\w-])${escaped}(?![\\w-])`, 'i').test(text)
  })
}

export function compareIfcDocuments(models, documents, passages) {
  const issues = [],
    coverage = []
  for (const doc of documents) {
    const category = doc.projectArtifact ? doc.category : 'reference'
    if (!comparisonCategories.includes(category)) continue
    let checks = 0
    const seen = new Set()
    for (const passage of passages.filter((p) => p.doc === doc.id)) {
      // Keep each comparison within one sentence or extracted table row.
      const chunks = passage.text.split(/(?<=[.;])\s+/)
      for (const chunk of chunks) {
        for (const model of models) {
          const mentioned = new Set(
            model.elements
              .filter((element) => identifies(element, chunk))
              .map((element) => element.elementId),
          )
          // Do not assign one asset's value to another in a flattened table row.
          if (mentioned.size > 1) continue
          for (const element of model.elements) {
            const identifiers = element.identifiers || [element.name]
            const identified = mentioned.has(element.elementId)
            if (mentioned.size && !identified) continue
            const filenames = [
              doc.filename,
              doc.originalFilename,
              doc.filePath,
              ...(doc.filenames || []),
            ]
              .filter(Boolean)
              .map((file) => file.split(/[\\/]/).at(-1))
            const linkedSource = element.sources?.some(
              (source) =>
                filenames.includes(source.file) && source.page === passage.page,
            )
            if (!identified && !linkedSource) continue
            for (const property of element.properties) {
              const metric = propertyMetric(property)
              if (!metric || !Number.isFinite(metric.value)) continue
              // A source-page link alone cannot disambiguate generic labels like
              // "width" between several assets on a drawing.
              if (!identified && metric.words.length < 2) continue
              const words = metric.words.map((w) =>
                w
                  .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                  .replace('centreline', '(?:centreline|centerline)'),
              )
              const metricPattern = words
                .join('[\\s_-]+')
                .replace(
                  'nominal[\\s_-]+pipe[\\s_-]+diameter',
                  '(?:nominal[\\s_-]+(?:pipe[\\s_-]+)?|pipe[\\s_-]+)diameter',
                )
                .replace(/^slope$/, '(?:slope|grade)')
              const number = '(-?\\d+(?:\\.\\d+)?)'
              const identifierPattern = identifiers
                .map((id) => id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
                .join('|')
              const locator = `(?:\\s+(?:of|for)\\s+(?:[a-z]+\\s+){0,3}(?:${identifierPattern}))?`
              const pattern = new RegExp(
                `(?:(minimum|maximum|min|max|at least|at most)\\s+)?${metricPattern}${locator}\\s*(?:shall be|must be|is|of|=|:)?\\s*(?:(minimum|maximum|min|max|at least|at most)\\s*)?${number}\\s*(${units[metric.unit]})(?![a-z0-9²³/])`,
                'ig',
              )
              for (const match of chunk.matchAll(pattern)) {
                const expected = Number(match[3]),
                  qualifier = match[1] || match[2] || ''
                const bound = /minimum|^min$|at least/i.test(qualifier)
                  ? 'min'
                  : /maximum|^max$|at most/i.test(qualifier)
                    ? 'max'
                    : 'exact'
                const key = `${model.name}/${element.elementId}/${property.propertyId}/${doc.id}/${passage.page}/${expected}/${bound}/${metric.value}`
                if (seen.has(key)) continue
                seen.add(key)
                checks++
                const fails =
                  bound === 'min'
                    ? metric.value < expected
                    : bound === 'max'
                      ? metric.value > expected
                      : Math.abs(metric.value - expected) > 1e-6
                if (!fails) continue
                issues.push({
                  id: 'ifc-' + hash(key),
                  title: `${element.name}: ${property.name} differs from ${doc.label || doc.title}`,
                  explanation: `${model.name}, ${element.elementId} (${element.globalId}) has ${property.name} = ${metric.value} ${metric.unit}. The document states ${bound === 'exact' ? '' : bound + ' '}${expected} ${metric.unit}. Review this potential discrepancy.`,
                  prepared: false,
                  verified: true,
                  queryId: null,
                  category,
                  model: model.name,
                  elementId: element.elementId,
                  globalId: element.globalId,
                  property: property.name,
                  actual: metric.value,
                  expected,
                  comparison: bound,
                  citations: [
                    {
                      doc: doc.id,
                      page: passage.page,
                      label: doc.label || doc.title,
                      excerpt: chunk,
                    },
                  ],
                })
              }
            }
          }
        }
      }
    }
    coverage.push({
      doc: doc.id,
      label: doc.label || doc.title,
      category,
      checks,
      status: checks ? 'compared' : 'needs-review',
      reason: checks
        ? undefined
        : 'No supported numeric statement could be matched using an IFC element identifier or model source-page link with a matching property and unit. Tables, general standards, geometry and qualitative requirements need review.',
    })
  }
  return {
    issues,
    coverage,
    modelCount: models.length,
    checkedAt: new Date().toISOString(),
  }
}

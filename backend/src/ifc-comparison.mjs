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
const measureTypes = {
  IFCLENGTHMEASURE: 'LENGTHUNIT', IFCPOSITIVELENGTHMEASURE: 'LENGTHUNIT',
  IFCNONNEGATIVELENGTHMEASURE: 'LENGTHUNIT', IFCAREAMEASURE: 'AREAUNIT',
  IFCVOLUMEMEASURE: 'VOLUMEUNIT',
}
// Resolve supported IFC units, rather than assuming an SI-looking property
// name overrides IfcPropertySingleValue.Unit or the project unit context.
function siUnit(entities, id) {
  const entity = entities.get(id)
  if (entity?.type !== 'IFCSIUNIT') return null
  const [,type,prefix,name] = entity.args
  if (type === '.LENGTHUNIT.' && name === '.METRE.')
    return ({'$':'m','.MILLI.':'mm','.CENTI.':'cm','.KILO.':'km'})[prefix] || null
  if (prefix !== '$') return null
  if (type === '.AREAUNIT.' && name === '.SQUARE_METRE.') return 'm2'
  if (type === '.VOLUMEUNIT.' && name === '.CUBIC_METRE.') return 'm3'
  return null
}
const unitType = unit => ({m:'LENGTHUNIT',mm:'LENGTHUNIT',cm:'LENGTHUNIT',km:'LENGTHUNIT',m2:'AREAUNIT',m3:'VOLUMEUNIT'})[unit]
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
  const projects = [...entities.values()].filter(entity=>entity.type==='IFCPROJECT')
  const assignment = projects.length===1 ? entities.get(projects[0].args[8]) : null
  const defaults = new Map()
  if (assignment?.type==='IFCUNITASSIGNMENT') for (const id of refs(assignment.args[0])) {
    const type=entities.get(id)?.args[1]?.replaceAll('.','')
    if (type) defaults.set(type,defaults.has(type)?null:siUnit(entities,id))
  }
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
        const typed = p.args[2]?.match(/^(IFC\w+)\((.*)\)$/i)
        if (!typed) continue
        const value = typed[2].startsWith("'") ? unquote(typed[2]) : Number(typed[2])
        const explicitUnit = !!p.args[3] && p.args[3] !== '$'
        const requiredType = measureTypes[typed[1].toUpperCase()]
        const measurementUnit = explicitUnit ? siUnit(entities,p.args[3]) : requiredType ? defaults.get(requiredType) : null
        properties.push({
          name: unquote(p.args[0]),
          value,
          propertyId,
          explicitUnit,
          ...((explicitUnit || requiredType) ? {
            unitRequired:true,
            measurementUnit: typeof value==='number' && (!requiredType||unitType(measurementUnit)===requiredType) ? measurementUnit || null : null,
            unitOrigin:explicitUnit?'explicit':'project',
          } : {}),
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
  if ((property.explicitUnit || property.unitRequired) && !property.measurementUnit) return null
  const name = property.name
  const labelled =
    typeof property.value === 'string' &&
    property.value
      .trim()
      .match(
        /^(-?\d+(?:\.\d+)?)\s*(mm|m|%|percent|km\/h|kph|L\/s|m³\/s|m3\/s|m²|m2|m³|m3)$/,
      )
  const match = name.match(/^(.*)_(m|mm|cm|km|percent|kph|m2|m3)$/i)
  if (!match && !labelled && !property.measurementUnit) return null
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
    unit: property.measurementUnit || (labelled ? unitNames[labelled[2]] : match[2].toLowerCase()),
    value: labelled ? Number(labelled[1]) : property.value,
    bound,
  }
}
const units = {
  m: 'm(?:et(?:re|er)s?)?',
  mm: 'mm|millimet(?:re|er)s?',
  cm: 'cm|centimet(?:re|er)s?',
  km: 'km|kilomet(?:re|er)s?',
  percent: '%|percent',
  kph: 'km/h|kph|kmph',
  m2: 'm²|m2',
  m3: 'm³|m3',
  lps: 'L/s',
  m3ps: 'm³/s|m3/s',
}
const lengths = {m:1,mm:.001,cm:.01,km:1000}
function documentUnit(text, fallback) {
  if (!(fallback in lengths)) return fallback
  const name=text.toLowerCase()
  if (/^(mm|millimet)/.test(name)) return 'mm'
  if (/^(cm|centimet)/.test(name)) return 'cm'
  if (/^(km|kilomet)/.test(name)) return 'km'
  return 'm'
}

function identifies(element, text) {
  return (element.identifiers || [element.name]).some((identifier) => {
    if (!identifier?.trim()) return false
    const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(?<![\\w-])${escaped}(?![\\w-])`, 'i').test(text)
  })
}

const clean = (text) => String(text || '').replace(/[\u200b-\u200d\ufeff]/g, '').replace(/\s+/g, ' ').trim()
// Only use extracted table cells with an exact IFC classification and an
// explicit minimum/maximum column. Never infer a rule from flattened numbers.
function classifiedCells(passage, models) {
  const cells = new Map()
  for (const line of passage.lines || []) {
    if (!line.tableCell) continue
    const cell = cells.get(line.tableCell) || { lines: [], row: clean(line.tableRowLabel), column: clean(line.tableColumn) }
    cell.lines.push(line)
    cells.set(line.tableCell, cell)
  }
  const columns = [
    [/^minimum centreline (?:curve )?radii/i, 'MinCentrelineRadius_m'],
    [/^minimum horizontal curve lengths/i, 'MinHorizontalCurveLength_m'],
    [/^maximum gradient/i, 'MaxGradient_percent'],
    [/^minimum gradient/i, 'MinGradient_percent'],
    [/^minimum tangent (?:section )?lengths/i, 'MinTangentLength_m'],
    [/^minimum intersection spacing/i, 'MinIntersectionSpacing_m'],
  ]
  const result = []
  for (const [cellId,cell] of cells) {
    const propertyName = columns.find(([pattern]) => pattern.test(cell.column))?.[1]
    if (!propertyName) continue
    const value = clean(cell.lines.map((l) => l.text).join(' ')).match(/^(\d+(?:\.\d+)?)\s*(m|%)(?:\s*(?:\[\d+(?:\s*,\s*\d+)*\]|\d+(?:\s*,\s*\d+)*))*$/)
    if (!value) continue
    for (const model of models) for (const element of model.elements) {
      const classification = element.properties.find((p) => p.name === 'Classification')?.value
      if (!classification || clean(classification).toLowerCase() !== cell.row.toLowerCase()) continue
      const property = element.properties.find((p) => p.name === propertyName)
      const metric = property && propertyMetric(property)
      if (!metric) continue
      result.push({
        text: `${element.name} ${metric.bound === 'max' ? 'maximum' : 'minimum'} ${metric.words.join(' ')}: ${value[1]} ${value[2]}.`,
        excerpt: `${cell.row} — ${cell.column}: ${clean(cell.lines.map((l) => l.text).join(' '))}. Table notes and exceptions require engineering review.`,
        model: model.name, elementId: element.elementId, propertyName,
        regions: cell.lines.map((l) => l.rect).filter(Boolean),
        tableEvidence:{cellId,row:cell.row,column:cell.column,value:clean(cell.lines.map(line=>line.text).join(' '))},
      })
    }
  }
  return result
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
      const chunks = [
        ...passage.text.split(/(?<=[.;])\s+/).map((text) => ({ text })),
        ...classifiedCells(passage, models),
      ]
      for (const source of chunks) {
        const chunk = source.text
        for (const model of models) {
          const mentioned = new Set(
            model.elements
              .filter((element) => identifies(element, chunk))
              .map((element) => element.elementId),
          )
          // Do not assign one asset's value to another in a flattened table row.
          if (mentioned.size > 1) continue
          for (const element of model.elements) {
            if (source.elementId && (source.model !== model.name || source.elementId !== element.elementId)) continue
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
              if (source.propertyName && source.propertyName !== property.name) continue
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
                `(?:(minimum|maximum|min|max|at least|at most)\\s+)?${metricPattern}${locator}\\s*(?:shall be|must be|is|of|=|:)?\\s*(?:(minimum|maximum|min|max|at least|at most)\\s*)?${number}\\s*(${metric.unit in lengths ? ['mm','cm','km','m'].map(unit=>units[unit]).join('|') : units[metric.unit]})(?![a-z0-9²³/])`,
                'ig',
              )
              for (const match of chunk.matchAll(pattern)) {
                // A generic Width must not also match Paved Surface Width, etc.
                const prefix = chunk.slice(0, match.index).toLowerCase()
                const shadowed = element.properties.some((other) => {
                  const longer = propertyMetric(other)
                  if (!longer || longer.words.length <= metric.words.length ||
                      longer.words.slice(-metric.words.length).join(' ') !== metric.words.join(' ')) return false
                  return prefix.trimEnd().endsWith(longer.words.slice(0, -metric.words.length).join(' '))
                })
                if (shadowed) continue
                const expected = Number(match[3]),
                  qualifier = match[1] || match[2] || ''
                const comparedUnit=documentUnit(match[4],metric.unit)
                const actual=comparedUnit===metric.unit ? metric.value : Number((metric.value*lengths[metric.unit]/lengths[comparedUnit]).toPrecision(12))
                const bound = /minimum|^min$|at least/i.test(qualifier)
                  ? 'min'
                  : /maximum|^max$|at most/i.test(qualifier)
                    ? 'max'
                    : 'exact'
                const key = `${model.name}/${element.elementId}/${property.propertyId}/${doc.id}/${passage.page}/${expected}/${bound}/${actual}` + (comparedUnit!==metric.unit?`/${comparedUnit}`:'')
                if (seen.has(key)) continue
                seen.add(key)
                checks++
                const fails =
                  bound === 'min'
                    ? actual < expected
                    : bound === 'max'
                      ? actual > expected
                      : Math.abs(actual - expected) > 1e-6
                if (!fails) continue
                issues.push({
                  id: 'ifc-' + hash(key),
                  title: `${element.name}: ${property.name} differs from ${doc.label || doc.title}`,
                  explanation: `${model.name}, ${element.elementId} (${element.globalId}) has ${property.name} = ${metric.value} ${metric.unit}.${comparedUnit!==metric.unit?` This converts to ${actual} ${comparedUnit}.`:''} The document states ${bound === 'exact' ? '' : bound + ' '}${expected} ${comparedUnit}. Review this potential discrepancy.`,
                  prepared: false,
                  verified: true,
                  queryId: null,
                  category,
                  model: model.name,
                  elementId: element.elementId,
                  globalId: element.globalId,
                  property: property.name,
                  actual,
                  expected,
                  unit:comparedUnit,
                  modelValue:metric.value,
                  modelUnit:metric.unit,
                  comparison: bound,
                  citations: [
                    {
                      doc: doc.id,
                      page: passage.page,
                      label: doc.label || doc.title,
                      excerpt: source.excerpt || chunk,
                      regions: source.regions || [],
                      ...(source.tableEvidence?{tableEvidence:source.tableEvidence}:{}),
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
    unitDiagnostics: models.flatMap(model=>model.elements.flatMap(element=>element.properties
      .filter(property=>(property.explicitUnit||property.unitRequired)&&!property.measurementUnit)
      .map(property=>({model:model.name,elementId:element.elementId,property:property.name,propertyId:property.propertyId,
        reason:'Unsupported, missing or ambiguous numeric value/unit definition; this property was not compared.'})))),
    modelCount: models.length,
    checkedAt: new Date().toISOString(),
  }
}

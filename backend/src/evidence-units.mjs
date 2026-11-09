import { normalize, locateQuote } from './indexer.mjs'

// Ranking clones a unit; its score is not part of its identity. Repeated text
// on another page or under another asset heading is independent evidence.
export const evidenceUnitKey = (unit) => JSON.stringify([
  unit.passage.doc,
  unit.passage.page ?? null,
  unit.passage.id ?? null,
  unit.quoteStart ?? null,
  unit.excerpt,
  unit.heading ?? null,
  unit.scope ?? [],
  unit.tableColumn ?? null,
  unit.tableRowLabel ?? null,
  unit.contextEvidence?.excerpt ?? null,
  unit.conditionEvidence?.excerpt ?? null,
])

// Keep actionable provisions, category definitions, and labelled table data.
// Navigation and introductory prose otherwise consume the selector's small
// context and displace the actual requirements.
export function isProvision(unit) {
  const text = unit.excerpt
  if (/^Table\s+\d+(?:\.\d+)*\s*:[^.!?\d]*$/i.test(text)) return false
  if (
    /^(?:Refer to|See (?:Section|Table)|This (?:section|guide)|The emphasis of|General .*activities are outlined)/i.test(
      text,
    )
  )
    return false
  if (
    /\b(?:shall|must|may|can|required|requirement|minimum|maximum|recommended|preferred|should|not (?:be )?(?:allowed|permitted|approved)|(?:is|are) (?:not )?to be)\b/i.test(
      text,
    )
  )
    return true
  if (
    /^(?:Conduct|Install|Keep|Use|Avoid|Restrict|Prevent|Ensure|Protect|Limit|Submit|Inspect|Test|Obtain|Provide|Retain|Maintain|Do not)\b/i.test(
      text,
    )
  )
    return true
  if (/\b(?:is|are)\s+(?:a|an|the)\b|\bmeans\b/i.test(text)) return true
  return (
    /\bTable\s+\d/i.test(unit.heading || '') &&
    /\d/.test(text) &&
    !/^Table\s+\d/i.test(text)
  )
}

function sourceBlocks(passage) {
  const blocks = []
  let cursor = 0
  const starts = passage.lines.map(line => {
    const start = cursor
    cursor += normalize(line.text).length + 1
    return start
  })
  let blockStart = 0
  let lines = [],
    heading = passage.section,
    sectionHeading = passage.section,
    scope = passage.lines[0]?.sectionPath || [],
    tableCaption = '',
    inTable = false
  let tableColumn = '',
    tableRowLabel = ''
  const flush = () => {
    if (lines.length)
      blocks.push({
        text: lines.join(' '),
        start: blockStart,
        heading,
        tableCaption: inTable ? tableCaption : '',
        scope,
        tableColumn,
        tableRowLabel,
      })
    lines = []
  }
  for (let i = 0; i < passage.lines.length; i++) {
    const text = passage.lines[i].text
    if (passage.lines[i].tableCell !== passage.lines[i - 1]?.tableCell) {
      flush()
      tableColumn = passage.lines[i].tableColumn || ''
      tableRowLabel = passage.lines[i].tableRowLabel || ''
      tableCaption = passage.lines[i].tableCaption || ''
      inTable = !!passage.lines[i].tableCell
      heading = [sectionHeading, tableCaption, tableRowLabel, tableColumn]
        .filter(Boolean)
        .join(' · ')
    }
    if (
      passage.lines[i].section &&
      passage.lines[i].section !== sectionHeading
    ) {
      flush()
      heading = passage.lines[i].section
      sectionHeading = heading
      scope = passage.lines[i].sectionPath || []
      inTable = false
    }
    if (/^[1-9]\d*(?:\.\d+)+\.?\s+[A-Z]/.test(text) && text.length < 110) {
      flush()
      heading = passage.lines[i].section || text
      sectionHeading = heading
      inTable = false
      continue
    }
    if (/^Table\s+\d+(?:\.\d+)*\s*:/i.test(text)) {
      flush()
      heading = [sectionHeading, text].filter(Boolean).join(' · ')
      tableCaption = text
      inTable = true
    }
    const previous = passage.lines[i - 1]
    const current = passage.lines[i]
    if (
      previous &&
      (inTable ? /^[A-Z\d]/.test(text) : /^[A-Z]/.test(text)) &&
      current.rect[1] - previous.rect[1] >
        (passage.extraction === 'ocr' ? 1.8 : inTable ? 0.95 : 1.25) *
          Math.max(
            previous.rect[3] - previous.rect[1],
            current.rect[3] - current.rect[1],
          )
    )
      flush()
    if (/^(?:[a-z]|[ivxlcdm]+)[.)]$/.test(text)) {
      flush()
      if (inTable) {
        heading = sectionHeading
        inTable = false
      }
      continue
    }
    // OCR often places a list marker and its text on the same line. Keep
    // separate list items separate so one damaged item cannot hide its neighbors.
    if (
      passage.extraction === 'ocr' &&
      /^(?:[a-z]|[ivxlcdm]+)[.),]\s+\S/.test(text)
    ) {
      flush()
      if (inTable) {
        heading = sectionHeading
        inTable = false
      }
    }
    const next = passage.lines[i + 1]?.text
    if (
      /:$/.test(text) &&
      next &&
      next.length < 80 &&
      /^[A-Z]/.test(next) &&
      !/[.!?:]$/.test(next)
    ) {
      flush()
      heading = `${heading ? heading + ' · ' : ''}${next}`
      blockStart = starts[i]
      lines.push(text, next)
      i++
      continue
    }
    if (
      /^[1-9]\d*(?:\.\d+)+\.?$/.test(text) &&
      next &&
      /^[A-Z]/.test(next) &&
      next.length < 85 &&
      next.split(/\s+/).length < 10 &&
      !/[.!?]$/.test(next)
    ) {
      flush()
      heading = `${text} ${next}`
      sectionHeading = heading
      inTable = false
      i++
      continue
    }
    if (!lines.length) blockStart = starts[i]
    lines.push(text)
  }
  flush()
  return blocks
}

// Sentence-sized source IDs let a model cite immutable text without retyping it.
export function evidenceUnits(
  passages,
  maxCharacters = 18000,
  { groupParagraphs = true } = {},
) {
  const units = [],
    seen = new Set()
  let characters = 0
  for (const passage of passages) {
    for (const block of sourceBlocks(passage)) {
      const sentences = [
        ...new Intl.Segmenter('en', {
          granularity: 'sentence',
        }).segment(block.text),
      ]
      // Keep a short, internally qualified requirement together. Split distinct
      // applicability branches so numerical filtering can still evaluate them.
      const segments =
        groupParagraphs &&
        block.text.length <= 1100 &&
        sentences.length > 1 &&
        (block.tableCaption ||
          (!/\b(?:less than|greater than|deeper than|shallower than|or less|or greater|or smaller)\b/i.test(
            block.text,
          ) &&
            !sentences
              .slice(1)
              .some((s) => /^(?:If|When|For)\b/.test(s.segment.trim()))))
          ? [{ segment: block.text }]
          : sentences
      for (const [segmentIndex, segment] of segments.entries()) {
        const sentence = normalize(segment.segment)
          .replace(/^[•●▪‣]\s*/, '')
          .replace(/^(?:[ivxlcdm]+|[a-z]|\d+(?:\.\d+)*)[.),]\s+(?=[A-Z])/, '')
          .replace(/([.!?])\s+(?:[a-z]|i{1,3}|iv|vi{0,3}|ix|x)\.$/, '$1')
        const alternatives = [sentence]
        // A separately quantified subject retains its universal predicate.
        if (/^All\b/.test(sentence)) {
          const split = sentence.indexOf(' and all ')
          if (split >= 0 && /\b(?:shall|must)\b/.test(sentence.slice(split)))
            alternatives.push(sentence.slice(split + 5))
        }
        for (const quote of alternatives) {
          if (
            quote.length < 25 ||
            (/^[a-z]/.test(quote) && !/^all\b/.test(quote))
          )
            continue
          if (/\b(?:a|an|the|of|to|and|or|must|shall)\s*$/i.test(quote))
            continue
          const blockText = normalize(block.text)
          const withinBlock = blockText.toLowerCase().indexOf(quote.toLowerCase(), normalize(block.text.slice(0, segment.index || 0)).length)
          if (withinBlock < 0) continue
          const quoteStart = block.start + withinBlock
          const key = evidenceUnitKey({ passage, excerpt: quote, quoteStart, heading: block.heading, scope: block.scope, tableColumn: block.tableColumn, tableRowLabel: block.tableRowLabel })
          if (seen.has(key) || characters + quote.length > maxCharacters)
            continue
          const anchor = locateQuote(passage, quote, quoteStart)
          if (!anchor) continue
          const caption =
            block.tableCaption && block.tableCaption !== quote
              ? locateQuote(passage, block.tableCaption)
              : null
          // A following mitigation sentence can depend on the immediately
          // preceding feasibility exception. Keep its immutable source anchor;
          // a detached "if this cover..." must not create a universal criterion.
          const previous = segmentIndex > 0 ? normalize(segments[segmentIndex - 1].segment) : ''
          const condition = /^(?:If|When)\s+(?:this|that|the|a minimum)\b/i.test(quote) &&
            /\b(?:when|if)\b[^!?]{0,120}\b(?:not practical|not feasible|impractical|unachievable)\b/i.test(previous)
            ? locateQuote(passage, previous, block.start + blockText.toLowerCase().lastIndexOf(previous.toLowerCase(), withinBlock)) : null
          seen.add(key)
          characters += quote.length
          units.push({
            id: units.length,
            passage,
            heading: block.heading,
            scope: block.scope,
            ...(block.tableColumn
              ? {
                  tableColumn: block.tableColumn,
                  tableRowLabel: block.tableRowLabel,
                }
              : {}),
            ...(caption ? { contextEvidence: caption } : {}),
            ...(condition ? { conditionEvidence: condition } : {}),
            ...anchor,
          })
        }
      }
    }
  }
  return units
}

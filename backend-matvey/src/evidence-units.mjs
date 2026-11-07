import { normalize, locateQuote } from './indexer.mjs'

function sourceBlocks(passage) {
  const blocks = []
  let lines = [],
    heading = passage.section
  const flush = () => {
    if (lines.length) blocks.push({ text: lines.join(' '), heading })
    lines = []
  }
  for (let i = 0; i < passage.lines.length; i++) {
    const text = passage.lines[i].text
    if (/^(?:[a-z]|[ivxlcdm]+)[.)]$/.test(text)) {
      flush()
      continue
    }
    const next = passage.lines[i + 1]?.text
    if (
      /^\d+(?:\.\d+)+$/.test(text) &&
      next &&
      next.length < 85 &&
      next.split(/\s+/).length < 10 &&
      !/[.!?]$/.test(next)
    ) {
      flush()
      heading = `${text} ${next}`
      i++
      continue
    }
    lines.push(text)
  }
  flush()
  return blocks
}

// Sentence-sized source IDs let a model cite immutable text without retyping it.
export function evidenceUnits(passages, maxCharacters = 18000) {
  const units = [],
    seen = new Set()
  let characters = 0
  for (const passage of passages) {
    for (const block of sourceBlocks(passage)) {
      for (const segment of new Intl.Segmenter('en', {
        granularity: 'sentence',
      }).segment(block.text)) {
        const quote = normalize(segment.segment)
          .replace(/^(?:[ivxlcdm]+|[a-z]|\d+(?:\.\d+)*)[.)]\s+(?=[A-Z])/, '')
          .replace(/\s+(?:[a-z]|[ivxlcdm]+)\.$/, '')
        if (quote.length < 25 || /^[a-z]/.test(quote)) continue
        if (/\b(?:a|an|the|of|to|and|or|must|shall)\s*$/i.test(quote)) continue
        const key = passage.doc + ':' + quote
        if (seen.has(key) || characters + quote.length > maxCharacters) continue
        const anchor = locateQuote(passage, quote)
        if (!anchor) continue
        seen.add(key)
        characters += quote.length
        units.push({
          id: units.length,
          passage,
          heading: block.heading,
          ...anchor,
        })
      }
    }
  }
  return units
}

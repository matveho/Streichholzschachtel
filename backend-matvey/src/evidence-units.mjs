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
    const previous = passage.lines[i - 1]
    const current = passage.lines[i]
    if (
      previous &&
      /^[A-Z]/.test(text) &&
      current.rect[1] - previous.rect[1] >
        (passage.extraction === 'ocr' ? 1.8 : 1.25) *
          Math.max(
            previous.rect[3] - previous.rect[1],
            current.rect[3] - current.rect[1],
          )
    )
      flush()
    if (/^(?:[a-z]|[ivxlcdm]+)[.)]$/.test(text)) {
      flush()
      continue
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
      lines.push(text, next)
      i++
      continue
    }
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
        const sentence = normalize(segment.segment)
          .replace(/^(?:[ivxlcdm]+|[a-z]|\d+(?:\.\d+)*)[.)]\s+(?=[A-Z])/, '')
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
          const key = passage.doc + ':' + quote
          if (seen.has(key) || characters + quote.length > maxCharacters)
            continue
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
  }
  return units
}

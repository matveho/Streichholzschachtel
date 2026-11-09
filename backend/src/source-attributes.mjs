// Bounded attribute bindings for clauses whose adjacent requirements are easy
// to conflate. These describe the source text, never project compliance.
const sideBySide = '\\bside\\s*(?:-\\s*)?by\\s*(?:-\\s*)?side\\b'
const arrangement = new RegExp(sideBySide,'i')

export function sourceAttributes(source) {
  const properties = [], conditions = []
  const slope = source.match(/\b(?:minimum\s+of\s+)?(\d+(?:\.\d+)?)\s*%\s+slope\b[^.!?;]{0,100}\bfrom\s+(?:the\s+)?property line\s+to\s+(?:the\s+)?crown\s+of\s+(?:the\s+)?public sewer main\b/i)
  const depth = source.match(/\bwith\s+(?:at least|a minimum of)\s+(\d+(?:\.\d+)?)\s*(mm|cm|m)\s+in\s+depth\s*\(cover\)\s+at\s+(?:the\s+)?property line\b/i)
  if (slope && depth && depth.index >= slope.index+slope[0].length) {
    properties.push({property:'slope',value:Number(slope[1]),unit:'%',extent:'property-line-to-public-main-crown',excerpt:slope[0]})
    properties.push({property:'burial-depth',value:Number(depth[1]),unit:depth[2].toLowerCase(),location:'property-line',datum:'not-stated',excerpt:depth[0]})
  }
  const geometry = source.match(new RegExp('\\bwhere\\s+construction\\s+of\\s+'+sideBySide+'\\s+units\\s+(?:is|are)\\s+anticipated\\b','i'))
  if (geometry) conditions.push({property:'unit-arrangement',value:'side-by-side',excerpt:geometry[0]})
  return {properties,conditions}
}

export function sourceAttributeIssue(claim, source, question='') {
  const attributes = sourceAttributes(source)
  if (attributes.properties.some(property=>property.property==='burial-depth') &&
      /\bfrom\s+(?:the\s+)?property line\s+to\s+(?:the\s+)?crown\s+of\s+(?:the\s+)?public sewer main\b/i.test(claim) &&
      (/\b(?:depth|cover)\s+(?:(?:of\s+)?\d+(?:\.\d+)?\s*(?:mm|cm|m|metres|meters)\s+)?(?:measured\s+)?from\s+(?:the\s+)?property line\b/i.test(claim) ||
       /\b(?:depth|cover|burial)\b(?:[^.!?;]|\.(?=\d)){0,100}\b(?:measured|measurement|datum)\b[^.!?;]{0,30}\bfrom\s+(?:the\s+)?property line\b/i.test(claim)))
    return 'The property-line-to-main-crown extent belongs to the slope clause. The depth criterion is located at the property line and has no stated measurement datum; do not transfer the slope endpoints to burial depth.'
  if (!attributes.conditions.length || !arrangement.test(claim)) return null
  const supplied = question.split(/[;!?]|\.(?=\s|$)/).some(clause=>{
    const match=arrangement.exec(clause)
    if (!match) return false
    const before=clause.slice(0,match.index)
    return !/^\s*(?:is|are|can|could|would|should|does|do)\b/i.test(clause) &&
      !/\b(?:if|whether|assuming|can|could|would|should)\b/i.test(before)
  })
  const qualified = new RegExp('\\b(?:where|if|when|assuming|whether)\\b[^,;.!?]{0,100}'+sideBySide,'i')
  const projectAssertion = /\b(?:project|proposed|these units|the units|four units|4 units|this land use)\b/i.test(claim) ||
    new RegExp('\\b(?:as|because|since)\\b[^,;.!?]{0,70}'+sideBySide,'i').test(claim)
  if (projectAssertion && !supplied && !qualified.test(claim))
    return 'Side-by-side construction is a condition in the cited source, not a supplied project fact. Preserve that condition or request the actual unit arrangement; a four-unit count alone cannot establish it.'
  return null
}

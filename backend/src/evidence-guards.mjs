// Conservative vetoes for source extraction ambiguity and unsupported exemptions.
// These checks may withhold a claim; they never approve an engineering conclusion.
const exemption = /\b(?:no\s+(?:mandatory|required)\b|not\s+(?:required|necessary|mandated)|does\s+not\s+require|exempt(?:ed|ion)?\b)/i
export function evidenceInterpretationIssue(claim, source, question = '') {
  const feasibility = /\b(?:when|if)\b[^!?]{0,120}\b(?:not practical|not feasible|impractical|unachievable)\b/i
  const established = /\b(?:is|are|was|were)\s+not\s+(?:practical|feasible)\s*[.;]/i.test(question)
  if (feasibility.test(source) && !established &&
      !/\b(?:if|when|unless|conditional|subject|confirm|confirmation|unresolved)\b/i.test(claim))
    return 'This source provides a feasibility exception, not an unconditional requirement. Preserve the condition or establish that it applies to the project.'

  if (reversedBound(claim, source))
    return 'The finding reverses the cited numeric bound. A maximum project allocation cannot establish a minimum requirement, or vice versa.'

  if (unsupportedCountThreshold(claim, source))
    return 'The stated population threshold is not preserved in the cited source. A project dwelling count must not become a regulatory cutoff.'
  if (exemption.test(claim) && !exemption.test(source))
    return 'Missing evidence cannot establish an exemption or prove that a requirement does not exist. The cited evidence must explicitly support the claimed exemption.'
  const flattened = [...source.matchAll(/\b[A-Za-z]\s*=\s*[A-Za-z]{2,}\s+(\d+(?:\.\d+)?)(?=[\s.,;]|$)/g)]
  if (/\b(?:multipl(?:y|ied|ication)|divid(?:e|ed)|division|denominator|numerator)\b/i.test(claim) &&
      flattened.some(match => new RegExp(`\\b${match[1].replace('.', '\\.')}\\b`).test(claim)))
    return 'The extracted equation does not preserve its operators. Inspect the original formula before asserting multiplication or division.'
  const absoluteLimits = [...source.matchAll(/\b(?:below|less than)\s+(\d+(?:\.\d+)?)\s*([a-zA-Z]+(?:\/[a-zA-Z]+)?)[^.]*?\b(?:not be allowed|prohibited|not permitted)/gi)]
  if (/\b(?:unless|except)\b/i.test(claim) && absoluteLimits.some(match => claim.includes(match[1]) && claim.includes(match[2])))
    return 'The finding combines an absolute limit with an exception. Separate the design target from the absolute prohibition and preserve each condition.'
  return null
}

const countWords = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve']
function countThresholds(text) {
 const count='(\\d+|'+countWords.join('|')+')'
 const unit='(plex|units?|dwellings?|homes?|buildings?)'
 const relation='(or more|and larger|or larger|or greater|and above|or fewer|or less|or smaller|and below)'
 const matches=[...text.matchAll(new RegExp('\\b'+count+'(?:[ -]'+unit+')?\\s+'+relation+'(?:\\s+'+unit+')?\\b','gi'))]
 return matches.filter(m=>m[2]||m[4]).map(m=>({number:/^\d/.test(m[1])?Number(m[1]):countWords.indexOf(m[1].toLowerCase()),direction:/fewer|less|smaller|below/i.test(m[3])?'lower':'upper'}))
}
export function unsupportedCountThreshold(claim, source) {
 const asserted=countThresholds(claim), supported=countThresholds(source)
 return asserted.some(a=>!supported.some(s=>s.number===a.number&&s.direction===a.direction))
}

function numericBounds(text) {
  const result = []
  const pattern = /(?=\b(minimum|maximum|at least|at most|not less than|not more than|limits?[^.!?;\d]{0,60}?\bto)\b([^.!?;\d]{0,65}?)(\d+(?:\.\d+)?)\s*(mm|cm|m|%)(?![a-z0-9/]))/gi
  for (const match of text.matchAll(pattern)) {
    // Another bound in the gap belongs to the value instead of this one.
    if (/\b(?:minimum|maximum|at least|at most|not less than|not more than)\b/i.test(match[2]) || (/^limits?/i.test(match[1]) && /\b(?:minimum|maximum)\b/i.test(match[1]))) continue
    const direction = /^(?:minimum|at least|not less than)$/i.test(match[1]) ? 'min' : 'max'
    result.push({ direction, value: Number(match[3]), unit: match[4].toLowerCase() })
  }
  return result
}
export function reversedBound(claim, source) {
  const cited = numericBounds(source)
  return numericBounds(claim).some(bound => {
    const matching = cited.filter(other => other.value === bound.value && other.unit === bound.unit)
    return matching.length && matching.every(other => other.direction !== bound.direction)
  })
}

// Conservative vetoes for source extraction ambiguity and unsupported exemptions.
// These checks may withhold a claim; they never approve an engineering conclusion.
import { sourceAttributeIssue } from './source-attributes.mjs'
export function namedReferenceEvidenceIssue(claim,evidence,documents){
  const words=text=>String(text||'').toLowerCase().replace(/[^\p{L}\d]+/gu,' ').trim()
  const text=' '+words(claim)+' '
  const cited=new Set(evidence.map(proof=>proof.passage?.doc))
  const aliases=new Map()
  for(const document of documents)for(const name of [document.title,document.label]){
    const alias=words(name)
    if(alias.length<8||alias.split(' ').length<2)continue
    if(!aliases.has(alias))aliases.set(alias,new Set())
    aliases.get(alias).add(document.id)
  }
  const named=[],attributed=[]
  for(const [alias,owners] of aliases){
    const position=text.indexOf(' '+alias+' ')
    if(position<0)continue
    named.push(owners)
    const after=text.slice(position+alias.length+2).trimStart()
    if(/^(?:(?:which|that|also)\s+){0,2}(?:requires?|specif(?:y|ies)|states?|mandates?|recommends?|permits?|allows?|provides?|defines?)\b|^(?:s\s+)?(?:minimum|maximum|required)\b/.test(after))attributed.push(owners)
  }
  if(named.some(a=>named.some(b=>![...a].some(id=>b.has(id))))&&/\b(?:conflict|contradict|whereas|unresolved interface|differing|reconcil)\w*\b/i.test(claim))attributed.push(...named)
  if(attributed.some(owners=>![...owners].some(id=>cited.has(id))))return 'The finding attributes a requirement or a cross-reference comparison to a named publication without citing that publication. Cite each actual source for its own rule; related context cannot supply missing positive evidence.'
  return null
}
const exemption = /\b(?:no\s+(?:mandatory|required)\b|not\s+(?:required|necessary|mandated)|does\s+not\s+require|exempt(?:ed|ion|s)?\b)/i
const projectComparison = /\b(?:exceeds?|meets?|complies|greater than|less than|shortfall|falls? short|satisfies|adequate|sufficient|(?:is|are) (?:below|above)|(?:thicker|thinner) than|defici(?:t|ent))\b/i
export function recommendationLanguage(text) {
  // Incorporating a manufacturer's procedures does not make the enclosing
  // installation duty optional. A "should" elsewhere remains advisory.
  const modality = text.replace(/\b(?:manufacturer|supplier)(?:['’]s)?\s+recommended\s+(?:(?:installation|testing|maintenance)\s+)?(?:procedures?|instructions?|methods?)\b/gi, 'referenced procedures')
  return /\b(?:should|preferred|recommend(?:ed|ation)?)\b/i.test(modality)
}
export function evidenceInterpretationIssue(claim, source, question = '', {projectEvidence = ''} = {}) {
  const attributeIssue=sourceAttributeIssue(claim,source,question+'; '+projectEvidence)
  if(attributeIssue)return attributeIssue
  if (/\b(?:may|can|permitted|allowed)\b[^.!?]{0,120}\b(?:in lieu|replace|instead of)\b/i.test(claim) &&
      !/\b(?:in lieu|replac\w*|instead of|alternativ\w*|substitut\w*)\b/i.test(source))
    return 'The attached evidence does not establish the claimed alternative permission. Cite its actual permission provision separately from the existing-system obligation.'
  if (dropsConditionalItem(claim, source))
    return 'The cited item is conditional on being required or applicable. Preserve that condition for this item; an adjacent mandatory item does not establish an unconditional installation duty.'
  if (/\b(?:capacity|design flow|shortfall|deficit)\b/i.test(claim) &&
      /\bnecessitat(?:es|ing|ed)\s+(?:an?\s+)?upgrade\b|\b(?:must|shall|needs? to|required to)\s+(?:be\s+)?upgrad|\b(?:requires?|needs?)\s+(?:an?\s+)?upgrade\b/i.test(claim) &&
      !/\bupgrad\w*\b/i.test(source))
    return 'Verified capacity arithmetic does not establish a particular construction remedy. State the numerical difference and review capacity/control options; do not mandate an upgrade without a source establishing that remedy.'
  const precedence = /\b(?:overrides?|supersedes?|waives?|takes? precedence)\b/i
  if (!/\b(?:overrid\w*|supersed\w*|waiv\w*|precedence|notwithstanding)\b/i.test(source)) {
    for (const sentence of claim.split(/[;!?]|\.(?=\s|$)/)) {
      if (precedence.test(sentence) && !/\b(?:not|never|cannot|without assuming|unresolved|uncertain|confirm whether|review whether)\b/i.test(sentence))
        return 'An alternative permission does not establish precedence or waive a separate obligation. Cite an explicit waiver/precedence provision or retain the unresolved interface.'
    }
  }
  const projectBasis = question + ' ' + projectEvidence
  if (/\binvert(?:\s+elevation)?\s+to\b/i.test(source) &&
      /\bcover\b/i.test(claim) && projectComparison.test(claim) &&
      !/\b(?:depth|cover)\b[^.;!?]{0,45}\b(?:to|from)\s+(?:the\s+)?(?:pipe\s+)?invert\b/i.test(projectBasis) &&
      !/\b(?:confirm|unresolved|different datums|not directly comparable|cannot be compared)\b/i.test(claim))
    return 'Pipe cover and depth measured to the invert use different datums. Establish the project measurement datum before claiming that matching depths satisfy the criterion.'
  if ((/\bnecessary (?:construction )?traffic only\b/i.test(source)||/\bunnecessary (?:construction )?traffic\b/i.test(claim)) &&
      claim.split(/[;!?]|\.(?=\s|$)/).some(clause =>
        /\b(?:delivery|reported|crossing|crossed|project|proposed)\b/i.test(clause) &&
        /\bunnecessary (?:construction )?traffic\b|\bunauthori[sz]ed\b[^.!?;]{0,60}\b(?:access|traffic|vehicles?)\b|\b(?:delivery|vehicles?|access|traffic)\b[^.!?;]{0,150}\b(?:violates?|violation|contravenes?|breaches?|noncompliant|contrary)\b/i.test(clause) &&
        !/\b(?:if|whether|confirm|verify|assess|determine|unresolved)\b/i.test(clause)) &&
      !/\bunnecessary (?:construction )?traffic\b/i.test(projectBasis) &&
      !/\bunauthori[sz]ed\s+(?:vehicular\s+)?(?:access|traffic)\b/i.test(projectBasis))
    return 'A necessary-traffic restriction does not establish that a reported delivery was unnecessary. Confirm the purpose of the access before classifying it as a project violation.'
  if (/\bESALs?\b/i.test(source) &&
      (projectComparison.test(claim) || /\bgoverning\b/i.test(claim)) &&
      !/\b(?:design|cumulative|project)\s+ESALs?\s*(?:(?:of|is|are|were|estimated at)\s*|[:=]\s*)?\d|\b\d+(?:\.\d+)?\s*(?:million|M)?\s+(?:design\s+)?ESALs?\b|\bESALs?\s*[:=]\s*\d/i.test(projectBasis))
    return 'This pavement criterion depends on design ESALs. AADT and truck percentage do not establish cumulative axle loading; provide the project design ESALs before selecting a minimum or reporting a project comparison.'
  const roleIssue = pavementComparisonRoleIssue(claim, source, projectBasis)
  if (roleIssue) return roleIssue
  const atFinal = /\bat\s+(?:FAC|final acceptance(?: certificate)?|final acceptance inspection)\b/i.test(source)
  const atConstruction = /\bat\s+(?:CCC|construction completion(?: certificate)?)\b/i.test(source)
  if (atFinal !== atConstruction) {
    const retained = atFinal
      ? /\bFAC\b|\bfinal acceptance\b/i.test(claim)
      : /\bCCC\b|\bconstruction completion\b/i.test(claim)
    if (!retained)
      return 'The cited requirement is specific to an acceptance stage. Preserve the FAC/final acceptance or CCC/construction completion qualifier; it is not a universal testing rule.'
  }
  if (/\b(?:for each|under these|in this|for these|for those)\s+(?:process(?:es)?|methods?|cases?|conditions?|procedures?)\b/i.test(source) &&
      /\bgoverning\b|\bappl(?:ies|icable) to (?:this|the) project\b|\b(?:meets?|complies with) (?:the )?(?:minimum|requirement|standard)/i.test(claim) &&
      !/\bgoverning\b|\bapplicable to (?:this|the) project\b/i.test(source))
    return 'The cited clause refers to an undefined process or condition. Include its governing context before asserting that it establishes a project requirement.'

  const feasibility = /\b(?:when|if)\b[^!?]{0,120}\b(?:not practical|not feasible|impractical|unachievable)\b/i
  const established = /\b(?:is|are|was|were)\s+not\s+(?:practical|feasible)\s*[.;]/i.test(question)
  const qualified = /\b(?:if|when|where|unless)\b[^.!?]{0,180}\b(?:not practical|not feasible|impractical|unachievable)\b|\b(?:conditional|subject|confirm|confirmation|unresolved)\b/i.test(claim)
  if (feasibility.test(source) && !established &&
      !qualified)
    return 'This source provides a feasibility exception, not an unconditional requirement. Preserve the condition or establish that it applies to the project.'

  if (reversedBound(claim, source))
    return 'The finding reverses the cited numeric bound. A maximum project allocation cannot establish a minimum requirement, or vice versa.'

  if (unsupportedCountThreshold(claim, source))
    return 'The stated population threshold is not preserved in the cited source. A project dwelling count must not become a regulatory cutoff.'
  if (exemption.test(claim) && !exemption.test(source))
    return 'Missing evidence cannot establish an exemption or prove that a requirement does not exist. The cited evidence must explicitly support the claimed exemption.'
  const flattened = [...source.matchAll(/\b[A-Za-z]\s*=\s*[A-Za-z]{2,}\s+(\d+(?:\.\d+)?)(?=[\s.,;]|$)/g)]
  if (flattened.some(match => {
    const factor = match[1].replace('.', '\\.')
    const namedOperator = /\b(?:multipl(?:y|ied|ication)|divid(?:e|ed)|division|denominator|numerator)\b/i.test(claim) && new RegExp(`\\b${factor}\\b`).test(claim)
    const symbolicOperator = new RegExp(`(?:[×*÷/]\\s*${factor}\\b|\\b${factor}\\s*[×*÷/])`).test(claim)
    return namedOperator || symbolicOperator
  }))
    return 'The extracted equation does not preserve its operators. Inspect the original formula before asserting multiplication or division.'
  const absoluteLimits = [...source.matchAll(/\b(?:below|less than)\s+(\d+(?:\.\d+)?)\s*([a-zA-Z]+(?:\/[a-zA-Z]+)?)[^.]*?\b(?:not be allowed|prohibited|not permitted)/gi)]
  if (/\b(?:unless|except)\b/i.test(claim) && absoluteLimits.some(match => claim.includes(match[1]) && claim.includes(match[2])))
    return 'The finding combines an absolute limit with an exception. Separate the design target from the absolute prohibition and preserve each condition.'
  return null
}

// A shared "shall" must not erase an inline condition on one item in a list.
export function conditionalSourceItems(source) {
 return [...source.matchAll(/\b(?:if|where|when)\s+(?:required|necessary|applicable|needed)\s*,?\s+(?:(?:a|an|one|the|each|any)\s+)?([a-z]+(?:[ -][a-z]+){0,5}?)\s+(?:shall|must)\s+(?:be\s+)?(?:provided|installed|included|constructed)\b/gi)]
  .map(item=>({subject:item[1].trim(),condition:item[0].match(/^(?:if|where|when)\s+(?:required|necessary|applicable|needed)/i)[0],excerpt:item[0]}))
}
export function dropsConditionalItem(claim, source) {
  const items = conditionalSourceItems(source)
  for (const item of items) {
    const words = item.subject.split(/[ -]+/)
    if (words.length < 2) continue
    const noun = words.map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + 's?').join('[ -]+')
    const object = new RegExp('\\b' + noun + '\\b', 'i')
    const tail = words.length > 2 && /^(?:storm|sanitary|water)$/i.test(words[0])
      ? new RegExp('\\b'+words.slice(1).map(word=>word+'s?').join('[ -]+')+'\\b','gi') : null
    const gap = '(?:(?!\\b(?:and|but)\\b)[^;!?]){0,70}'
    const qualified = boundNoun => new RegExp(
      '\\b(?:if|where|when)\\s+(?:required|necessary|applicable|needed)\\b' + gap + '\\b' + boundNoun + '\\b|' +
      '\\b' + boundNoun + '\\b' + gap + '\\b(?:if|where|when)\\s+(?:required|necessary|applicable|needed)\\b|' +
      '\\b(?:if|where|when|confirm whether|determine whether|verify whether)\\b' + gap + '\\b' + boundNoun + '\\b' + gap + '\\b(?:required|necessary|applicable|needed)\\b', 'i')
    for (const clause of claim.split(/[;!?]|\.(?=\s|$)/)) {
      const ambiguous = tail && [...clause.matchAll(tail)].some(match=>!new RegExp('\\b(?:'+['storm','sanitary','water'].filter(word=>word!==words[0].toLowerCase()).join('|')+')(?:[ -]+[a-z]+){0,2}[ -]+$','i').test(clause.slice(0,match.index)))
      const specific=object.test(clause)
      if ((!specific && !ambiguous) || !/\b(?:must|shall|requires?|required|requirements?|obligations?|mandatory|needs?|provid(?:e|ed)|install(?:ed)?|construct(?:ed)?)\b/i.test(clause)) continue
      if (!qualified(specific?noun:words.slice(1).map(word=>word+'s?').join('[ -]+')).test(clause)) return true
    }
  }
  return false
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

export function pavementComparisonRoleIssue(claim, source, projectBasis) {
  if (!projectComparison.test(claim)) return null
  const belowRecycledLayer = /\b(?:below|beneath|under)\s+(?:the\s+)?(?:CIR|cold[ -]in[ -]place recycling)\s+layer/i
  if (belowRecycledLayer.test(source) && !belowRecycledLayer.test(projectBasis))
    return 'The reference thickness concerns asphalt retained beneath a recycled layer. The project evidence does not establish that structural role for the proposed layer; keep these quantities separate.'
  if (/\b(?:ACP|asphalt(?: concrete)?)\s+overlay\b/i.test(source) && !/\boverlay\b/i.test(projectBasis))
    return 'The reference concerns a pavement overlay. Establish that the proposed layer is an overlay before comparing its thickness with this criterion.'
  return null
}

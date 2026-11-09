export function missingFindingTerms(report, terms = []) {
  const findings = (report || []).filter(block => !block.heading)
    .flatMap(block => block.sentences || []).map(sentence => sentence.text || '')
  // Whole-report JSON lets a regex join unrelated facts across sentences.
  // Each required finding must occur within an actual finding sentence.
  return terms.filter(term => !findings.some(text => new RegExp(term.source, term.flags).test(text)))
}

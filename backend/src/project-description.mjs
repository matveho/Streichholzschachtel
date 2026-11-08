export function describeProject(documents, collections) {
  if (!documents.length) return ''
  const subjects = [...new Set(collections.map((c) => c.title.toLowerCase()))]
  const own = documents.filter((d) => d.projectArtifact)
  const topics = own
    .map((d) => [d.title, d.descriptionSubject || ''].join(' '))
    .join(' ')
  const domain = /bridge/i.test(topics)
    ? 'Bridge design'
    : /drain|storm|sewer/i.test(topics)
      ? 'Drainage and stormwater'
      : /road|transport|highway/i.test(topics)
        ? 'Transportation'
        : /\bwater\b/i.test(topics)
          ? 'Water infrastructure'
          : subjects.length
            ? subjects.slice(0, 2).join(' and ')
            : 'Engineering document'
  const roles = [
    ['client', 'client requirements'],
    ['design', 'design documents'],
    ['report', 'technical reports'],
  ]
    .filter(([key]) => own.some((d) => d.category === key))
    .map(([, label]) => label)
  const summary = domain.charAt(0).toUpperCase() + domain.slice(1) + ' review'
  return summary + (roles.length ? ' with ' + roles.join(', ') : '') + '.'
}

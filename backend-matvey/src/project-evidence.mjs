import { basename } from 'node:path'
import { locateQuote } from './indexer.mjs'
import { renderResult } from './answer.mjs'
import { problem } from './project-store.mjs'

export function preparedEvidence(issue, scope, projectId) {
  const evidence = issue.proofs
    .map(([filename, quote, page]) => {
      const document = scope.documents.find(
        (d) =>
          basename(d.filePath) === filename || d.filenames?.includes(filename),
      )
      if (!document)
        throw problem(
          503,
          `Prepared evidence is missing its associated source: ${filename}`,
        )
      // Explicit table proofs retain the entire extracted row, including its
      // real PDF regions; a numeric cell alone is never presented as a rule.
      if (page) {
        const compact = (s) => s.toLowerCase().replace(/[\s\u2013\u2014-]/g, '')
        const unit = scope.units.find(
          (u) =>
            u.doc === document.id &&
            u.page === page &&
            compact(u.text).includes(compact(quote)),
        )
        if (unit && unit.regions?.length)
          return {
            document,
            passage: {
              id: unit.id,
              doc: unit.doc,
              page: unit.page,
              section: unit.table || unit.heading || document.label,
              extraction: unit.extraction || 'text',
            },
            excerpt: unit.text,
            regions: unit.regions,
          }
      }
      for (const passage of scope.passages.filter(
        (p) => p.doc === document.id,
      )) {
        const anchor = locateQuote(passage, quote)
        if (anchor) return { passage, ...anchor, document }
      }
      throw problem(
        503,
        `Prepared evidence could not be anchored in ${filename}`,
      )
    })
    .sort(
      (a, b) =>
        Number(a.document.projectArtifact || false) -
          Number(b.document.projectArtifact || false) ||
        Number(a.document.category !== 'design') -
          Number(b.document.category !== 'design'),
    )
  const result = renderResult(
    [
      { heading: '', claims: [{ text: issue.explanation, evidence }] },
      ...evidence.map((e) => ({
        heading: e.document.label,
        claims: [{ text: e.excerpt, evidence: [e] }],
      })),
    ],
    scope,
    '',
    '',
    'prepared_comparison',
    [
      'Prepared comparison · source excerpts verified. Requires engineering review.',
    ],
  )
  return projectResult(result, projectId)
}
export function projectResult(result, projectId) {
  return {
    ...result,
    projectId,
    documents: result.documents.map((d) => ({
      ...d,
      file: `/v1/projects/${projectId}/documents/${d.id}/file`,
    })),
  }
}

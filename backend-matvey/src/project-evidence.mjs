import { basename } from 'node:path'
import { locateQuote } from './indexer.mjs'
import { renderResult } from './answer.mjs'
import { problem } from './project-store.mjs'

export function preparedEvidence(issue, scope, projectId) {
  const evidence = issue.proofs
    .map(([filename, quote]) => {
      const document = scope.documents.find(
        (d) =>
          basename(d.filePath) === filename || d.filenames?.includes(filename),
      )
      if (!document)
        throw problem(
          503,
          `Prepared evidence is missing its associated source: ${filename}`,
        )
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

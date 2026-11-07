import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { DocumentRecord } from './backend'
import type { DocId } from './data'

GlobalWorkerOptions.workerSrc = workerUrl
const cache = new Map<DocId, Promise<PDFDocumentProxy>>()
export function loadPdf(id: DocId, doc: DocumentRecord) {
  const key = id + doc.file
  if (!cache.has(key)) cache.set(key, getDocument({ url: doc.file }).promise)
  return cache.get(key)!
}
export function clearPdf(id: DocId) {
  for (const key of cache.keys()) if (key.startsWith(id)) cache.delete(key)
}

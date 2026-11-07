import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { documents } from './data'
import type { DocId } from './data'

GlobalWorkerOptions.workerSrc = workerUrl
const cache = new Map<DocId, Promise<PDFDocumentProxy>>()
export function loadPdf(id: DocId) {
  if (!cache.has(id))
    cache.set(id, getDocument({ url: documents[id].file }).promise)
  return cache.get(id)!
}
export function clearPdf(id: DocId) {
  cache.delete(id)
}

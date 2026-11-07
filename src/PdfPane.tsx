import { useEffect, useRef, useState } from 'react'
import { getDocument, GlobalWorkerOptions, TextLayer } from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import {
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  Scan,
  ExternalLink,
  FileText,
} from 'lucide-react'
import { documents } from './data'
import type { DocId, Reference } from './data'
import 'pdfjs-dist/web/pdf_viewer.css'

GlobalWorkerOptions.workerSrc = workerUrl
const cache = new Map<DocId, Promise<PDFDocumentProxy>>()
function loadPdf(id: DocId) {
  if (!cache.has(id))
    cache.set(id, getDocument({ url: documents[id].file }).promise)
  return cache.get(id)!
}
export function PdfPane({
  id,
  active,
  navigationKey,
}: {
  id: DocId
  active: Reference[]
  navigationKey: number
}) {
  const doc = documents[id]
  const [page, setPage] = useState<number>(doc.initialPage)
  const [zoom, setZoom] = useState(1)
  const [width, setWidth] = useState(650)
  const [status, setStatus] = useState('Loading document…')
  const [retry, setRetry] = useState(0)
  const canvas = useRef<HTMLCanvasElement>(null)
  const text = useRef<HTMLDivElement>(null)
  const scroll = useRef<HTMLDivElement>(null)
  const targets = active.filter((r) => r.doc === id)
  const targetPage = targets[0]?.page
  const targetTop = targets[0]?.rect[1]
  const request = `${targetPage ?? ''}:${navigationKey}`
  const [previousRequest, setPreviousRequest] = useState(request)
  if (request !== previousRequest) {
    setPreviousRequest(request)
    if (targetPage) setPage(targetPage)
  }
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0)
        setWidth(Math.min(900, Math.max(300, entry.contentRect.width - 56)))
    })
    observer.observe(scroll.current!)
    return () => observer.disconnect()
  }, [])
  const scale = (width / 612) * zoom
  useEffect(() => {
    let cancelled = false
    let render:
      | ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']>
      | undefined
    let layer: TextLayer | undefined
    async function draw() {
      try {
        const pdf = await loadPdf(id)
        const pdfPage = await pdf.getPage(page)
        if (cancelled) return
        const viewport = pdfPage.getViewport({ scale })
        const el = canvas.current!
        const ratio = window.devicePixelRatio || 1
        el.width = Math.floor(viewport.width * ratio)
        el.height = Math.floor(viewport.height * ratio)
        render = pdfPage.render({
          canvas: el,
          viewport,
          transform: [ratio, 0, 0, ratio, 0, 0],
        })
        await render.promise
        if (cancelled) return
        text.current!.replaceChildren()
        layer = new TextLayer({
          textContentSource: await pdfPage.getTextContent(),
          container: text.current!,
          viewport,
        })
        await layer.render()
        if (!cancelled) setStatus('')
      } catch (error) {
        if (!cancelled) {
          console.error(error)
          setStatus('Unable to render document.')
        }
      }
    }
    void draw()
    return () => {
      cancelled = true
      render?.cancel()
      layer?.cancel()
    }
  }, [id, page, scale, retry])
  useEffect(() => {
    const el = scroll.current!
    if (targetTop !== undefined && page === targetPage)
      el.scrollTo({
        top: Math.max(0, targetTop * scale - el.clientHeight * 0.28 + 24),
        behavior: 'smooth',
      })
    else el.scrollTo({ top: 0 })
  }, [targetTop, targetPage, page, scale, navigationKey])
  return (
    <section className="pdf-pane" aria-label={doc.title}>
      <div className="pane-title">
        <FileText size={14} />
        <strong>VOL. {doc.code}</strong>
        <span>{doc.title}</span>
        <span className="edition">{doc.edition}</span>
      </div>
      <div className="pdf-toolbar">
        <button
          aria-label={`Previous page in ${doc.title}`}
          disabled={page === 1}
          onClick={() => setPage((p) => p - 1)}
        >
          <ChevronLeft />
        </button>
        <label className="page-control">
          <span>PDF</span>
          <input
            aria-label={`Page in ${doc.title}`}
            type="number"
            min="1"
            max={doc.pages}
            value={page}
            onChange={(e) => {
              const n = Number(e.target.value)
              if (n >= 1 && n <= doc.pages) setPage(n)
            }}
          />
          <span>/ {doc.pages}</span>
        </label>
        <button
          aria-label={`Next page in ${doc.title}`}
          disabled={page === doc.pages}
          onClick={() => setPage((p) => p + 1)}
        >
          <ChevronRight />
        </button>
        <span className="tool-divider" />
        <button
          title="Zoom out"
          aria-label={`Zoom out ${doc.title}`}
          disabled={zoom <= 0.6}
          onClick={() => setZoom((z) => Math.max(0.6, z - 0.15))}
        >
          <Minus />
        </button>
        <span className="zoom-label">{Math.round(zoom * 100)}%</span>
        <button
          title="Zoom in"
          aria-label={`Zoom in ${doc.title}`}
          disabled={zoom >= 2}
          onClick={() => setZoom((z) => Math.min(2, z + 0.15))}
        >
          <Plus />
        </button>
        <button
          title="Fit width"
          aria-label={`Fit width ${doc.title}`}
          onClick={() => setZoom(1)}
        >
          <Scan />
        </button>
        <a
          className="original-link"
          href={`${doc.file}#page=${page}`}
          target="_blank"
          rel="noreferrer"
          title="Open original PDF"
        >
          <ExternalLink size={14} />
          <span>Original PDF</span>
        </a>
      </div>
      <div className="pdf-scroll" ref={scroll}>
        <div
          className="pdf-sheet"
          style={
            {
              width: 612 * scale,
              height: 792 * scale,
              '--scale-factor': scale,
            } as React.CSSProperties
          }
        >
          <canvas ref={canvas} style={{ width: '100%', height: '100%' }} />
          <div ref={text} className="textLayer" />
          <div className="highlights" aria-label="Source highlights">
            {targets
              .filter((r) => r.page === page)
              .map((r) => (
                <div
                  key={r.id}
                  data-reference={r.id}
                  className="source-highlight"
                  style={{
                    left: r.rect[0] * scale,
                    top: r.rect[1] * scale,
                    width: r.rect[2] * scale,
                    height: r.rect[3] * scale,
                  }}
                >
                  <span>{r.id}</span>
                </div>
              ))}
          </div>
        </div>
        {status && (
          <div
            className={`pdf-status ${status.startsWith('Unable') ? 'error' : ''}`}
            role="status"
          >
            {status}
            {status.startsWith('Unable') && (
              <button
                onClick={() => {
                  cache.delete(id)
                  setRetry((v) => v + 1)
                }}
              >
                Retry
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

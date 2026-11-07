import { memo, useEffect, useRef, useState } from 'react'
import { useDocuments } from './DocumentContext'
import type { DocId, Reference } from './data'
import { loadPdf } from './pdf'

const thumbnailWidth = 64
const wholePageViewport = { top: 0, height: 1 }
// Cache only visited thumbnails, not a second render of every PDF page.
const thumbnails = new Map<string, string>()

const MiniPage = memo(function MiniPage({
  id,
  page,
  current,
  active,
  viewport,
  root,
  onNavigate,
  sourceReferences,
}: {
  id: DocId
  page: number
  current: boolean
  active: Reference[]
  viewport: { top: number; height: number }
  root: React.RefObject<HTMLDivElement | null>
  onNavigate: (page: number, fraction: number) => void
  sourceReferences: Reference[]
}) {
  const documents = useDocuments()
  const button = useRef<HTMLButtonElement>(null)
  const key = `${id}:${page}`
  const [image, setImage] = useState(thumbnails.get(key))
  const [failed, setFailed] = useState(false)
  const markers = sourceReferences.filter(
    (r) => r.doc === id && r.page === page,
  )
  useEffect(() => {
    if (image) return
    let cancelled = false
    let task:
      | ReturnType<
          Awaited<
            ReturnType<Awaited<ReturnType<typeof loadPdf>>['getPage']>
          >['render']
        >
      | undefined
    const observer = new IntersectionObserver(
      async ([entry]) => {
        if (!entry.isIntersecting) return
        observer.disconnect()
        try {
          const pdf = await loadPdf(id, documents[id])
          const pdfPage = await pdf.getPage(page)
          if (cancelled) return
          const canvas = document.createElement('canvas')
          const view = pdfPage.getViewport({
            scale: (thumbnailWidth * 2) / pdfPage.view[2],
          })
          canvas.width = Math.ceil(view.width)
          canvas.height = Math.ceil(view.height)
          task = pdfPage.render({ canvas, viewport: view })
          await task.promise
          if (cancelled) return
          const url = canvas.toDataURL('image/webp')
          thumbnails.set(key, url)
          setImage(url)
        } catch {
          if (!cancelled) setFailed(true)
        }
      },
      { root: root.current, rootMargin: '160px' },
    )
    observer.observe(button.current!)
    return () => {
      cancelled = true
      observer.disconnect()
      task?.cancel()
    }
  }, [id, page, key, image, root, documents])
  return (
    <button
      ref={button}
      className={`minimap-page ${current ? 'current' : ''}`}
      data-page={page}
      tabIndex={current ? 0 : -1}
      aria-label={`PDF page ${page}${markers.length ? `, ${markers.length} cited passages` : ''}`}
      aria-current={current ? 'page' : undefined}
      title={`PDF page ${page}${markers.length ? ` · ${markers.length} cited passages` : ''}`}
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect()
        onNavigate(
          page,
          Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
        )
      }}
    >
      {image ? (
        <img src={image} alt="" draggable={false} />
      ) : (
        <span className="minimap-placeholder">{failed ? '—' : page}</span>
      )}
      {markers.map((r) => (
        <span
          key={r.id}
          className={`minimap-mark ${active.some((a) => a.id === r.id) ? 'active' : ''}`}
          data-minimap-reference={r.id}
          style={{
            top: `${(r.rect[1] / (documents[id].pageSizes?.[page]?.[1] ?? 792)) * 100}%`,
            left: `${(r.rect[0] / (documents[id].pageSizes?.[page]?.[0] ?? 612)) * 100}%`,
            width: `${(r.rect[2] / (documents[id].pageSizes?.[page]?.[0] ?? 612)) * 100}%`,
            height: `${(r.rect[3] / (documents[id].pageSizes?.[page]?.[1] ?? 792)) * 100}%`,
          }}
        />
      ))}
      {current && (
        <span
          className="minimap-viewport"
          style={{
            top: `${viewport.top * 100}%`,
            height: `${viewport.height * 100}%`,
          }}
        />
      )}
      <span className="minimap-page-number">{page}</span>
    </button>
  )
})

export function DocumentMinimap({
  id,
  page,
  active,
  viewport,
  onNavigate,
  onSelectReferences,
  sourceReferences,
}: {
  id: DocId
  page: number
  active: Reference[]
  viewport: { top: number; height: number }
  onNavigate: (page: number, fraction: number) => void
  onSelectReferences: (ids: string[]) => void
  sourceReferences: Reference[]
}) {
  const documents = useDocuments()
  const root = useRef<HTMLDivElement>(null)
  const total = documents[id].pages
  const markers = sourceReferences.filter((r) => r.doc === id)
  const groups = [...new Set(markers.map((r) => r.page))].map((page) => ({
    page,
    refs: markers.filter((r) => r.page === page),
  }))
  useEffect(() => {
    const el = root.current!
    const current = el.querySelector<HTMLElement>(`[data-page="${page}"]`)!
    const keepCurrentVisible = () => {
      if (!el.clientHeight) return
      if (
        current.offsetTop < el.scrollTop ||
        current.offsetTop + current.offsetHeight >
          el.scrollTop + el.clientHeight
      ) {
        el.scrollTo({
          top:
            current.offsetTop - el.clientHeight / 2 + current.offsetHeight / 2,
          behavior: 'instant',
        })
      }
    }
    keepCurrentVisible()
    const observer = new ResizeObserver(keepCurrentVisible)
    observer.observe(el)
    return () => observer.disconnect()
  }, [page])
  return (
    <aside
      className="document-minimap"
      aria-label={`Document minimap: ${documents[id].title}`}
    >
      <div className="minimap-heading">{total} PAGES</div>
      <div className="minimap-body">
        <div
          className="minimap-pages"
          ref={root}
          onKeyDown={(event) => {
            const next =
              event.key === 'ArrowDown'
                ? page + 1
                : event.key === 'ArrowUp'
                  ? page - 1
                  : event.key === 'Home'
                    ? 1
                    : event.key === 'End'
                      ? total
                      : null
            if (next !== null) {
              event.preventDefault()
              onNavigate(Math.max(1, Math.min(total, next)), 0)
            }
          }}
        >
          {Array.from({ length: total }, (_, i) => (
            <MiniPage
              key={i}
              id={id}
              page={i + 1}
              current={page === i + 1}
              active={active}
              viewport={page === i + 1 ? viewport : wholePageViewport}
              root={root}
              onNavigate={onNavigate}
              sourceReferences={sourceReferences}
            />
          ))}
        </div>
        <div
          className="minimap-overview"
          title="Whole document · click to navigate"
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect()
            const location = Math.max(
              0,
              Math.min(
                total - 0.001,
                ((event.clientY - rect.top) / rect.height) * total,
              ),
            )
            onNavigate(Math.floor(location) + 1, location % 1)
          }}
        >
          <span
            className="overview-current"
            style={{
              top: `${((page - 1) / total) * 100}%`,
              height: `${100 / total}%`,
            }}
          />
          {groups.map((group) => (
            <button
              key={group.page}
              className={`overview-mark ${active.some((a) => a.page === group.page) ? 'active' : ''}`}
              aria-label={`Jump to ${group.refs.length} cited passages, PDF page ${group.page}`}
              title={`PDF page ${group.page} · Sources ${group.refs.map((r) => r.id).join(', ')}`}
              style={{
                top: `${((group.page - 0.5) / total) * 100}%`,
              }}
              onClick={(event) => {
                event.stopPropagation()
                onSelectReferences(group.refs.map((r) => r.id))
                onNavigate(
                  group.page,
                  group.refs[0].rect[1] /
                    (documents[id].pageSizes?.[group.page]?.[1] ?? 792),
                )
              }}
            />
          ))}
        </div>
      </div>
    </aside>
  )
}

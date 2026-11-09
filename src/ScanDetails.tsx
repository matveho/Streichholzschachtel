import { useRef, useState } from 'react'
import { ListFilter, X } from 'lucide-react'
import { categoryLabels } from './fileCategories'
import type { ProjectData } from './projects'

export function ScanDetails({
  scan,
}: {
  scan: NonNullable<ProjectData['comparison']>
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [compared, setCompared] = useState(true)
  const checked = scan.coverage.filter((file) => file.checks > 0)
  const skipped = scan.coverage.filter((file) => file.checks === 0)
  const rows = compared ? checked : skipped
  return (
    <>
      <button
        type="button"
        className="scan-trigger"
        aria-haspopup="dialog"
        onClick={() => {
          setCompared(checked.length > 0 || skipped.length === 0)
          dialog.current?.showModal()
        }}
      >
        <ListFilter size={14} aria-hidden="true" />
        Scan details
        {scan.errors.length > 0 && <span aria-label="Scan notices">!</span>}
      </button>
      <dialog ref={dialog} className="scan-dialog" aria-labelledby="scan-title">
        <header>
          <h2 id="scan-title">IFC scan coverage</h2>
          <button
            type="button"
            aria-label="Close scan details"
            onClick={() => dialog.current?.close()}
          >
            <X size={17} />
          </button>
        </header>
        <p className="scan-summary">
          {checked.length} of {scan.coverage.length} files compared against{' '}
          {scan.modelCount} {scan.modelCount === 1 ? 'model' : 'models'}.
        </p>
        <div className="scan-filter" role="group" aria-label="Coverage filter">
          <button aria-pressed={compared} onClick={() => setCompared(true)}>
            Compared ({checked.length})
          </button>
          <button aria-pressed={!compared} onClick={() => setCompared(false)}>
            Not compared ({skipped.length})
          </button>
        </div>
        <div
          className="scan-list"
          tabIndex={0}
          aria-label="File coverage details"
          role="region"
        >
          {scan.errors.map((message, i) => (
            <p className="scan-notice" key={i}>
              {message}
            </p>
          ))}
          {rows.length ? (
            <ul>
              {rows.map((file) => (
                <li key={file.doc}>
                  <div>
                    <strong>{file.label}</strong>
                    <small>
                      {categoryLabels[file.category] ?? file.category}
                    </small>
                  </div>
                  <span>
                    {compared
                      ? file.checks + (file.checks === 1 ? ' check' : ' checks')
                      : file.reason || 'No matching IFC property.'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              {compared ? 'No files were compared.' : 'No files were skipped.'}
            </p>
          )}
        </div>
      </dialog>
    </>
  )
}

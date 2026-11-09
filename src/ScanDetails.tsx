import { useRef } from 'react'
import { ListFilter, X } from 'lucide-react'
import { categoryLabels } from './fileCategories'
import type { ProjectData } from './projects'

export function ScanDetails({
  scan,
}: {
  scan: NonNullable<ProjectData['comparison']>
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const checked = scan.coverage.filter((file) => file.checks > 0)
  const skipped = scan.coverage.filter((file) => file.checks === 0)
  const notices = [...new Set(scan.errors)]
  return (
    <>
      <button
        type="button"
        className="scan-trigger"
        aria-haspopup="dialog"
        onClick={() => {
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
        <p className="scan-summary">Property checks compare explicit model values with document evidence. Check counts are not pass counts.</p>
        {skipped.length > 0 && <p className="scan-summary">{skipped.length} {skipped.length === 1 ? 'file was' : 'files were'} not assessed: no matching element/property value with compatible units was established. Only compared files are listed below.</p>}
        <div
          className="scan-list"
          tabIndex={0}
          aria-label="File coverage details"
          role="region"
        >
          {notices.map((message, i) => (
            <p className="scan-notice" key={i}>
              {message}
            </p>
          ))}
          {checked.length ? (
            <ul>
              {checked.map((file) => (
                <li key={file.doc}>
                  <div>
                    <strong>{file.label}</strong>
                    <small>
                      {categoryLabels[file.category] ?? file.category}
                    </small>
                  </div>
                  <span>
                    {file.checks + (file.checks === 1 ? ' property check' : ' property checks')}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              No comparable property values were established. Review model identifiers, numeric properties and units alongside the document records.
            </p>
          )}
        </div>
      </dialog>
    </>
  )
}

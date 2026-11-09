import { categoryLabels, saveFileCategories } from './fileCategories'
import { useEffect, useRef, useState } from 'react'
import { Search, X, Plus, FolderOpen, FilePlus, RotateCcw } from 'lucide-react'
import { api, readSettings } from './backend'
import { projectPath, requestProject } from './projects'
import type { Project, ProjectDocument, Collection } from './projects'

export function ProjectEditor({
  project,
  uploadOnly = false,
  existingDocuments = [],
  onClose,
  onSaved,
}: {
  project?: Project
  uploadOnly?: boolean
  existingDocuments?: ProjectDocument[]
  onClose: () => void
  onSaved: (id: string) => void
}) {
  const [catalog, setCatalog] = useState<{
    collections: Collection[]
    documents: ProjectDocument[]
  }>()
  const [name, setName] = useState(project?.name || ''),
    [client, setClient] = useState(project?.client || ''),
    [location, setLocation] = useState(project?.location || '')
  const [description, setDescription] = useState(project?.description || ''),
    [automatic, setAutomatic] = useState(
      !project?.description || project.descriptionMode === 'auto',
    )
  const [collections, setCollections] = useState(project?.collectionIds || []),
    [documents, setDocuments] = useState(project?.documentIds || [])
  const [search, setSearch] = useState(''),
    [open, setOpen] = useState(false),
    [files, setFiles] = useState<File[]>([]),
    [fileTypes, setFileTypes] = useState(new Map<File, string>()),
    [existingTypes, setExistingTypes] = useState<Record<string, string>>({}),
    [error, setError] = useState(''),
    [progress, setProgress] = useState('')
  const [savedId, setSavedId] = useState(project?.id)
  const nameInput = useRef<HTMLInputElement>(null),
    collectionPicker = useRef<HTMLDivElement>(null),
    fileInput = useRef<HTMLInputElement>(null),
    folderInput = useRef<HTMLInputElement>(null),
    createdId = useRef(project?.id),
    imported = useRef(new Map<File, ProjectDocument[]>())
  useEffect(() => {
    nameInput.current?.focus()
    const controller = new AbortController()
    api(readSettings(), '/v1/reference-collections', {
      signal: controller.signal,
    })
      .then(setCatalog)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message)
      })
    return () => controller.abort()
  }, [])
  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (!collectionPicker.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])
  const allDocuments = [
    ...new Map(
      [...(catalog?.documents || []), ...existingDocuments].map((d) => [
        d.id,
        d,
      ]),
    ).values(),
  ]
  function toggleCollection(collection: Collection, checked: boolean) {
    const next = checked
      ? [...new Set([...collections, collection.id])]
      : collections.filter((id) => id !== collection.id)
    setCollections(next)
    setDocuments((ids) =>
      checked
        ? [...new Set([...ids, ...collection.documentIds])]
        : ids.filter(
            (id) =>
              !collection.documentIds.includes(id) ||
              catalog?.collections.some(
                (c) => next.includes(c.id) && c.documentIds.includes(id),
              ),
          ),
    )
    setSearch('')
    setOpen(false)
  }
  function addFiles(list: FileList | null) {
    if (!list) return
    const accepted = Array.from(list).filter(
      (f) => /\.pdf$/i.test(f.name) && f.size <= 12 * 1024 * 1024,
    )
    setFiles((current) => [...new Set([...current, ...accepted])])
    setError(
      accepted.length === list.length
        ? ''
        : `${list.length - accepted.length} ${list.length - accepted.length === 1 ? 'file' : 'files'} excluded. Choose PDFs up to 12 MB each.`,
    )
  }
  async function save(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setProgress('Saving project…')
    try {
      const response =
        uploadOnly && project
          ? { project }
          : await requestProject(
              createdId.current
                ? projectPath(createdId.current)
                : '/v1/projects',
              createdId.current ? 'PATCH' : 'POST',
              {
                name,
                client,
                location,
                description: automatic ? '' : description,
                collectionIds: collections,
                documentIds: documents,
              },
            )
      createdId.current = response.project.id
      setSavedId(response.project.id)
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        if (imported.current.has(file)) continue
        setProgress(`Indexing ${i + 1}/${files.length}: ${file.name}`)
        const content = await new Promise<string>((done, reject) => {
          const reader = new FileReader()
          reader.onload = () => done(String(reader.result).split(',')[1])
          reader.onerror = () =>
            reject(new Error('Could not read ' + file.name))
          reader.readAsDataURL(file)
        })
        const importedDocument = await requestProject(
          projectPath(createdId.current!) + '/documents/import',
          'POST',
          { name: file.name, content, category: fileTypes.get(file) },
        )
        setDocuments((ids) => [
          ...new Set([
            ...ids,
            ...importedDocument.documents.map((d: ProjectDocument) => d.id),
          ]),
        ])
        imported.current.set(file, importedDocument.documents)
      }
      const changes = { ...existingTypes }
      for (const [file, added] of imported.current) {
        const category = fileTypes.get(file)
        if (category) for (const doc of added) changes[doc.id] = category
      }
      saveFileCategories(createdId.current!, changes)
      onSaved(createdId.current!)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save project.')
      setProgress('')
    }
  }
  return (
    <div
      className="project-modal-backdrop"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !progress) onClose()
      }}
    >
      <section
        className="project-modal compact-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-editor-title"
      >
        <div className="project-modal-heading">
          <h1 id="project-editor-title">
            {uploadOnly
              ? 'Upload documents'
              : project || savedId
                ? 'Manage project'
                : 'New project'}
          </h1>
          <button
            type="button"
            aria-label="Close project editor"
            onClick={onClose}
            disabled={!!progress}
          >
            <X size={17} />
          </button>
        </div>
        <form onSubmit={save}>
          <div hidden={uploadOnly}>
            <label className="project-name-field">
              Project name
              <input
                ref={nameInput}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={100}
              />
            </label>
            <div className="collection-search" ref={collectionPicker}>
              <Search size={15} />
              <input
                role="combobox"
                aria-label="Reference Collections"
                aria-expanded={open}
                aria-controls="collection-options"
                placeholder="Add reference collection…"
                value={search}
                onFocus={() => setOpen(true)}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setOpen(true)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && open) {
                    setOpen(false)
                    e.stopPropagation()
                  }
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    const first = catalog?.collections.find(
                      (c) =>
                        !collections.includes(c.id) &&
                        `${c.title} ${c.authority} ${c.jurisdiction}`
                          .toLowerCase()
                          .includes(search.toLowerCase()),
                    )
                    if (open && first) toggleCollection(first, true)
                  }
                }}
              />
              {open && (
                <div
                  className="collection-results"
                  id="collection-options"
                  role="listbox"
                >
                  {catalog?.collections
                    .filter(
                      (c) =>
                        !collections.includes(c.id) &&
                        `${c.title} ${c.authority} ${c.jurisdiction}`
                          .toLowerCase()
                          .includes(search.toLowerCase()),
                    )
                    .map((c) => (
                      <button
                        type="button"
                        role="option"
                        aria-selected={false}
                        key={c.id}
                        onClick={() => toggleCollection(c, true)}
                      >
                        <Plus size={14} />
                        <span>
                          {c.authority}
                          <strong>{c.title}</strong>
                        </span>
                        <small>{c.documentCount}</small>
                      </button>
                    ))}
                  {!catalog && <div>Loading…</div>}
                </div>
              )}
            </div>
            <div className="selected-collections">
              {catalog?.collections
                .filter((c) => collections.includes(c.id))
                .map((c) => (
                  <span key={c.id}>
                    {c.title}
                    <button
                      type="button"
                      aria-label={'Remove collection ' + c.title}
                      onClick={() => toggleCollection(c, false)}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
            </div>
            <div className="selected-documents" aria-label="Selected documents">
              {allDocuments
                .filter(
                  (d) =>
                    collections.some((id) =>
                      catalog?.collections
                        .find((c) => c.id === id)
                        ?.documentIds.includes(d.id),
                    ) || existingDocuments.some((x) => x.id === d.id),
                )
                .map((d) => (
                  <div key={d.id} className="managed-file">
                    <label className="collection-document">
                      <input
                        type="checkbox"
                        checked={documents.includes(d.id)}
                        onChange={(e) =>
                          setDocuments((ids) =>
                            e.target.checked
                              ? [...new Set([...ids, d.id])]
                              : ids.filter((id) => id !== d.id),
                          )
                        }
                      />
                      <span>
                        {d.title}
                        <small>{d.edition}</small>
                      </span>
                    </label>
                    {d.projectArtifact && documents.includes(d.id) && (
                      <select
                        aria-label={'Type for ' + d.title}
                        value={existingTypes[d.id] ?? d.category}
                        disabled={!!progress}
                        onChange={(event) =>
                          setExistingTypes((prev) => ({
                            ...prev,
                            [d.id]: event.target.value,
                          }))
                        }
                      >
                        {Object.entries(categoryLabels).map(([id, label]) => (
                          <option key={id} value={id}>
                            {label}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
            </div>
          </div>
          <div className="project-import-actions">
            <button
              type="button"
              autoFocus={uploadOnly}
              onClick={() => fileInput.current?.click()}
            >
              <FilePlus size={14} />
              Add PDFs
            </button>
            <button type="button" onClick={() => folderInput.current?.click()}>
              <FolderOpen size={14} />
              Select folder
            </button>
            <input
              ref={fileInput}
              aria-label="Add PDF files"
              type="file"
              accept=".pdf,application/pdf"
              multiple
              hidden
              onChange={(e) => {
                addFiles(e.target.files)
                e.target.value = ''
              }}
            />
            <input
              ref={(el) => {
                folderInput.current = el
                el?.setAttribute('webkitdirectory', '')
              }}
              aria-label="Select document folder"
              type="file"
              multiple
              hidden
              onChange={(e) => {
                addFiles(e.target.files)
                e.target.value = ''
              }}
            />
          </div>
          {!!files.length && (
            <ul className="pending-files">
              {files.map((file, i) => (
                <li key={i}>
                  <span title={file.webkitRelativePath || file.name}>
                    {file.webkitRelativePath || file.name}
                  </span>
                  <select
                    aria-label={'Type for ' + file.name}
                    value={fileTypes.get(file) ?? ''}
                    disabled={!!progress}
                    onChange={(event) =>
                      setFileTypes((prev) =>
                        new Map(prev).set(file, event.target.value),
                      )
                    }
                  >
                    <option value="">Automatic type</option>
                    {Object.entries(categoryLabels).map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    aria-label={'Remove file ' + file.name}
                    disabled={!!progress}
                    onClick={() =>
                      setFiles((rows) => rows.filter((_, index) => index !== i))
                    }
                  >
                    <X size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {(files.length > 0 ||
            (!uploadOnly &&
              existingDocuments.some((d) => d.projectArtifact))) && (
            <small className="file-type-note">
              File type choices are saved in this browser.
            </small>
          )}
          <details className="project-details-fields" hidden={uploadOnly}>
            <summary>Project details</summary>
            <div className="project-form-fields">
              <label>
                Client / owner
                <input
                  value={client}
                  onChange={(e) => setClient(e.target.value)}
                  maxLength={150}
                />
              </label>
              <label>
                Location
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  maxLength={150}
                />
              </label>
              <label className="description-field">
                Description
                <div className="description-input">
                  <input
                    value={automatic ? '' : description}
                    placeholder="Automatic from documents"
                    onChange={(e) => {
                      setDescription(e.target.value)
                      setAutomatic(false)
                    }}
                    maxLength={1000}
                  />
                  <button
                    type="button"
                    title="Generate from documents"
                    aria-label="Generate description from documents"
                    onClick={() => {
                      setAutomatic(true)
                      setDescription('')
                    }}
                  >
                    <RotateCcw size={14} />
                  </button>
                </div>
              </label>
            </div>
          </details>
          {error && (
            <p role="alert" className="project-form-error">
              {error}
            </p>
          )}
          {progress && (
            <p role="status" className="project-import-progress">
              {progress}
            </p>
          )}
          <footer className="project-modal-footer">
            <button type="button" disabled={!!progress} onClick={onClose}>
              Cancel
            </button>
            <button
              className="primary-action"
              disabled={
                !!progress ||
                (uploadOnly ? files.length === 0 : !name.trim() || !catalog)
              }
            >
              {progress
                ? 'Saving…'
                : uploadOnly
                  ? 'Upload and index'
                  : project || savedId
                    ? 'Save project'
                    : 'Create project'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}

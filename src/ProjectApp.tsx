import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  FolderOpen,
  Plus,
  Search,
  ArrowLeft,
  ArrowUpRight,
  Trash2,
  RotateCcw,
  Star,
  X,
  FileText,
  ShieldCheck,
  BookOpen,
} from 'lucide-react'
import LegacyApp, { QueryWorkspace } from './App'
import { api, ApiError, readSettings } from './backend'
import { navigate, navigateLink } from './navigation'
import { AppHeader } from './AppHeader'
import { DocumentContext } from './DocumentContext'
import { PdfPane } from './PdfPane'
import { projectPath, requestProject, projectDocumentMap } from './projects'
import type {
  Project,
  ProjectData,
  ProjectDocument,
  Collection,
  ProjectQuery,
} from './projects'
import type { Reference } from './data'
import './projects.css'

const emptyReferences: Reference[] = []
const labels: Record<string, string> = {
  reference: 'Reference documents',
  client: 'Client requirements',
  design: 'Design documents & drawings',
  report: 'Technical reports',
  supporting: 'Supporting materials',
}
const date = (value: string) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Edmonton',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
function useResource<T>(path: string, context = '') {
  const [settings] = useState(readSettings),
    [version, setVersion] = useState(0)
  const [state, setState] = useState<{
    key: string
    data: T | null
    error: string
    status: number
  }>({ key: '', data: null, error: '', status: 0 })
  const key = JSON.stringify([path, version, context])
  const identity = JSON.stringify([path, context])
  useEffect(() => {
    const controller = new AbortController()
    let retry: ReturnType<typeof setTimeout> | undefined
    api(settings, path, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted)
          setState({ key: identity, data, error: '', status: 200 })
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          if (error instanceof ApiError && error.status === 503) {
            retry = setTimeout(() => setVersion((v) => v + 1), 1500)
            return
          }
          setState({
            key: identity,
            data: null,
            error: error.message,
            status: error instanceof ApiError ? error.status : 0,
          })
        }
      })
    return () => {
      controller.abort()
      clearTimeout(retry)
    }
  }, [path, key, identity, settings])
  return {
    ...(state.key === identity
      ? state
      : { key: identity, data: null, error: '', status: 0 }),
    refresh: () => setVersion((v) => v + 1),
  }
}
function Shell({
  children,
  actions,
  title = 'Projects',
}: {
  children: React.ReactNode
  actions?: React.ReactNode
  title?: string
}) {
  return (
    <main className="project-shell">
      <header className="app-header project-header">
        <a className="project-brand" href="#projects" onClick={navigateLink}>
          <img src="/basis.svg" alt="" width="26" height="26" />
          <strong>Basis</strong>
        </a>
        <span className="project-header-title">{title}</span>
        <div className="project-header-actions">{actions}</div>
      </header>
      {children}
    </main>
  )
}
function Message({
  text,
  error,
  onRetry,
}: {
  text: string
  error?: boolean
  onRetry?: () => void
}) {
  return (
    <div
      className={`project-message ${error ? 'has-error' : ''}`}
      role={error ? 'alert' : 'status'}
    >
      <span>{text}</span>
      {onRetry && <button onClick={onRetry}>Retry</button>}
    </div>
  )
}
function ProjectEditor({
  project,
  onClose,
  onSaved,
}: {
  project?: Project
  onClose: () => void
  onSaved: (id: string) => void
}) {
  const resource = useResource<{
    collections: Collection[]
    documents: ProjectDocument[]
  }>('/v1/reference-collections')
  const [name, setName] = useState(project?.name || ''),
    [client, setClient] = useState(project?.client || ''),
    [location, setLocation] = useState(project?.location || ''),
    [description, setDescription] = useState(project?.description || '')
  const [collections, setCollections] = useState(project?.collectionIds || []),
    [documents, setDocuments] = useState(project?.documentIds || [])
  const [error, setError] = useState(''),
    [saving, setSaving] = useState(false)
  const nameInput = useRef<HTMLInputElement>(null)
  useEffect(() => {
    nameInput.current?.focus()
  }, [])
  const data = resource.data
  function toggleCollection(collection: Collection, checked: boolean) {
    setCollections((ids) =>
      checked
        ? [...new Set([...ids, collection.id])]
        : ids.filter((id) => id !== collection.id),
    )
    setDocuments((ids) =>
      checked
        ? [...new Set([...ids, ...collection.documentIds])]
        : ids.filter((id) => !collection.documentIds.includes(id)),
    )
  }
  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const response = await requestProject(
        project ? projectPath(project.id) : '/v1/projects',
        project ? 'PATCH' : 'POST',
        {
          name,
          client,
          location,
          description,
          collectionIds: collections,
          documentIds: documents,
        },
      )
      onSaved(response.project.id)
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Could not save project.',
      )
      setSaving(false)
    }
  }
  return (
    <div
      className="project-modal-backdrop"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
    >
      <section
        className="project-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-editor-title"
      >
        <div className="project-modal-heading">
          <h1 id="project-editor-title">
            {project ? 'Manage project' : 'New project'}
          </h1>
          <button
            type="button"
            aria-label="Close project editor"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <form onSubmit={save}>
          <div className="project-form-fields">
            <label>
              Project name
              <input
                ref={nameInput}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={100}
              />
            </label>
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
            <label>
              Scope
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={1000}
              />
            </label>
          </div>
          <div className="collection-heading">
            <h2>Reference Collections</h2>
            <span>{documents.length} documents selected</span>
          </div>
          {resource.error ? (
            <Message text={resource.error} error onRetry={resource.refresh} />
          ) : !data ? (
            <Message text="Loading Reference Collections…" />
          ) : (
            <div className="collection-picker">
              {data.collections.map((collection) => (
                <section className="collection-option" key={collection.id}>
                  <label className="collection-toggle">
                    <input
                      type="checkbox"
                      checked={collections.includes(collection.id)}
                      onChange={(e) =>
                        toggleCollection(collection, e.target.checked)
                      }
                    />
                    <span>
                      <strong>{collection.title}</strong>
                      <small>
                        {collection.authority} · {collection.documentCount}{' '}
                        documents
                      </small>
                    </span>
                  </label>
                  <p>{collection.description}</p>
                  <details>
                    <summary>
                      Choose individual documents ·{' '}
                      {
                        collection.documentIds.filter((id) =>
                          documents.includes(id),
                        ).length
                      }{' '}
                      selected
                    </summary>
                    {data.documents
                      .filter((doc) => collection.documentIds.includes(doc.id))
                      .map((doc) => (
                        <label className="collection-document" key={doc.id}>
                          <input
                            type="checkbox"
                            disabled={!collections.includes(collection.id)}
                            checked={documents.includes(doc.id)}
                            onChange={(e) =>
                              setDocuments((ids) =>
                                e.target.checked
                                  ? [...new Set([...ids, doc.id])]
                                  : ids.filter((id) => id !== doc.id),
                              )
                            }
                          />
                          <span>
                            {doc.title}
                            <small>
                              {doc.edition} · {doc.pages} pages
                            </small>
                          </span>
                        </label>
                      ))}
                  </details>
                </section>
              ))}
            </div>
          )}
          {error && <Message text={error} error />}
          <footer className="project-modal-footer">
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button
              className="primary-action"
              disabled={!name.trim() || saving || !data}
            >
              {saving ? 'Saving…' : project ? 'Save project' : 'Create project'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}
function ProjectsOverview() {
  const resource = useResource<{ projects: Project[] }>('/v1/projects'),
    [filter, setFilter] = useState(''),
    [creating, setCreating] = useState(false)
  const shown =
    resource.data?.projects.filter((p) =>
      `${p.name} ${p.client} ${p.location} ${p.discipline}`
        .toLowerCase()
        .includes(filter.toLowerCase()),
    ) || []
  return (
    <Shell
      actions={
        <button className="primary-action" onClick={() => setCreating(true)}>
          <Plus size={15} />
          New project
        </button>
      }
    >
      <div className="projects-overview">
        <div className="project-page-heading">
          <div>
            <h1>Projects</h1>
            <p>
              Engineering documents, requirements and source-verified research.
            </p>
          </div>
          <label className="project-filter">
            <Search size={15} />
            <input
              aria-label="Filter projects"
              placeholder="Find a project"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </label>
        </div>
        {resource.error ? (
          <Message text={resource.error} error onRetry={resource.refresh} />
        ) : !resource.data ? (
          <Message text="Loading projects…" />
        ) : (
          <div className="projects-grid">
            {shown.map((project) => (
              <a
                className="project-card"
                href={'#project/' + project.id}
                onClick={navigateLink}
                key={project.id}
              >
                <div className="project-card-top">
                  <FolderOpen size={21} />
                  {project.protectedDemo && (
                    <span className="project-badge">
                      <ShieldCheck size={12} />
                      Demonstration
                    </span>
                  )}
                </div>
                <span className="project-discipline">{project.discipline}</span>
                <h2>{project.name}</h2>
                <p className="project-client">
                  {project.client || 'Client not set'}
                </p>
                <p>{project.description || 'Project document workspace'}</p>
                <div className="project-card-footer">
                  <span>
                    {project.documentCount} documents · {project.openIssueCount}{' '}
                    potential issues
                  </span>
                  <ArrowUpRight size={17} />
                </div>
              </a>
            ))}
          </div>
        )}
        {resource.data && !shown.length && (
          <Message text="No matching projects." />
        )}
      </div>
      {creating && (
        <ProjectEditor
          onClose={() => setCreating(false)}
          onSaved={(id) => navigate('project/' + id)}
        />
      )}
    </Shell>
  )
}
function ProjectDashboard({
  data,
  onRefresh,
}: {
  data: ProjectData
  onRefresh: () => void
}) {
  const { project, documents, queries, issues } = data
  const [filter, setFilter] = useState(''),
    [category, setCategory] = useState('all'),
    [issueTab, setIssueTab] = useState('open'),
    [savedOnly, setSavedOnly] = useState(false),
    [editing, setEditing] = useState(false),
    [error, setError] = useState(''),
    [pending, setPending] = useState(false)
  const shown = documents.filter(
    (doc) =>
      (category === 'all' || doc.category === category) &&
      `${doc.label} ${doc.title} ${doc.edition}`
        .toLowerCase()
        .includes(filter.toLowerCase()),
  )
  const visibleIssues = issues.filter((issue) => issue.status === issueTab),
    visibleQueries = queries.filter((q) => !savedOnly || q.saved)
  const route = (tail = '') => '#project/' + project.id + tail
  async function action(path: string, method: string, value?: unknown) {
    setPending(true)
    setError('')
    try {
      await requestProject(projectPath(project.id) + path, method, value)
      if (path === '/reset') {
        setIssueTab('open')
        setSavedOnly(false)
        setFilter('')
        setCategory('all')
      }
      onRefresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The operation failed.')
    } finally {
      setPending(false)
    }
  }
  async function remove() {
    if (
      !window.confirm(
        `Delete ${project.name}? Its query history and associations will be removed. Shared reference documents are retained.`,
      )
    )
      return
    setPending(true)
    try {
      await requestProject(projectPath(project.id), 'DELETE')
      navigate('projects')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete project.')
      setPending(false)
    }
  }
  return (
    <Shell
      title={project.name}
      actions={
        <>
          {!project.protectedDemo && (
            <button disabled={pending} onClick={() => setEditing(true)}>
              Manage project
            </button>
          )}
          {project.protectedDemo ? (
            <button
              disabled={pending}
              onClick={() => {
                if (
                  window.confirm(
                    'Restore this demo’s documents, initial queries and open findings?',
                  )
                )
                  void action('/reset', 'POST', {})
              }}
            >
              <RotateCcw size={14} />
              Reset demo
            </button>
          ) : (
            <button
              aria-label="Delete project"
              title="Delete project"
              disabled={pending}
              onClick={remove}
            >
              <Trash2 size={15} />
            </button>
          )}
          <button
            className="primary-action"
            disabled={!documents.length}
            onClick={() => navigate('project/' + project.id + '/new')}
          >
            <Plus size={15} />
            New query
          </button>
        </>
      }
    >
      <div className="project-dashboard">
        <div className="project-page-heading">
          <div>
            <a className="project-back" href="#projects" onClick={navigateLink}>
              <ArrowLeft size={13} />
              Projects
            </a>
            <h1>{project.name}</h1>
            <p>
              {project.client || 'Client not set'} ·{' '}
              {project.location || 'Location not set'}
              {project.protectedDemo ? ' · Demonstration project' : ''}
            </p>
          </div>
          <span className="project-context-count">
            {documents.length} documents in search scope
          </span>
        </div>
        <p className="project-scope">
          {project.description || 'Add a project scope through Manage project.'}
        </p>
        {error && <Message text={error} error />}
        <div className="project-dashboard-grid">
          <section
            className="project-panel project-documents"
            aria-label="Project documents"
          >
            <div className="project-panel-heading">
              <h2>
                Project documents <span>{documents.length}</span>
              </h2>
              <label className="project-filter">
                <Search size={14} />
                <input
                  aria-label="Filter project documents"
                  placeholder="Find a document"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
              </label>
            </div>
            <div
              className="document-category-filter"
              role="group"
              aria-label="Document categories"
            >
              {[
                ['all', 'All'],
                ...Object.entries(labels)
                  .filter(([id]) => documents.some((d) => d.category === id))
                  .map(([id, label]) => [
                    id,
                    label.replace(' documents', '').replace(' & drawings', ''),
                  ]),
              ].map(([id, label]) => (
                <button
                  key={id}
                  className={category === id ? 'selected' : ''}
                  onClick={() => setCategory(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            {!documents.length && (
              <div className="project-empty">
                <p>
                  Select Reference Collections to begin research in this
                  project.
                </p>
                <button
                  className="primary-action"
                  onClick={() => setEditing(true)}
                >
                  Select Reference Collections
                </button>
              </div>
            )}
            {['client', 'design', 'report', 'reference', 'supporting'].map(
              (type) => {
                const group = shown.filter((d) => d.category === type)
                return group.length ? (
                  <section className="project-document-group" key={type}>
                    <h3>
                      {labels[type]} <span>{group.length}</span>
                    </h3>
                    {group.map((doc) => (
                      <a
                        className="project-document-row"
                        key={doc.id}
                        href={route('/document/' + doc.id)}
                        onClick={navigateLink}
                      >
                        <FileText size={17} />
                        <span>
                          <strong>{doc.title}</strong>
                          <small>
                            {doc.label} · {doc.edition}
                            {doc.projectArtifact
                              ? ' · Synthetic demonstration document'
                              : ''}
                          </small>
                        </span>
                        <span className="document-pages">{doc.pages} pp.</span>
                        <ArrowUpRight size={14} />
                      </a>
                    ))}
                  </section>
                ) : null
              },
            )}
            {documents.length > 0 && !shown.length && (
              <Message text="No matching documents." />
            )}
            <div className="project-collection-summary">
              <BookOpen size={14} />
              <span>
                {data.collections.map((c) => c.title).join(' · ') ||
                  'No Reference Collections selected'}
              </span>
            </div>
          </section>
          <aside className="project-sidebar">
            <section className="project-panel" aria-label="Potential issues">
              <div className="project-panel-heading">
                <h2>Potential issues</h2>
                <span className="project-badge">Prepared findings</span>
              </div>
              <div className="project-panel-tabs">
                <button
                  className={issueTab === 'open' ? 'selected' : ''}
                  onClick={() => setIssueTab('open')}
                >
                  Open {issues.filter((i) => i.status === 'open').length}
                </button>
                <button
                  className={issueTab === 'dismissed' ? 'selected' : ''}
                  onClick={() => setIssueTab('dismissed')}
                >
                  Dismissed{' '}
                  {issues.filter((i) => i.status === 'dismissed').length}
                </button>
              </div>
              {visibleIssues.map((issue) => (
                <article className="project-issue" key={issue.id}>
                  <h3>{issue.title}</h3>
                  <p>{issue.explanation}</p>
                  <div className="issue-sources">
                    {[
                      ...new Set(
                        issue.citations.map((c) => `${c.label} · p. ${c.page}`),
                      ),
                    ].map((label) => (
                      <span key={label}>{label}</span>
                    ))}
                  </div>
                  <div className="issue-actions">
                    <button
                      className="evidence-action"
                      disabled={!issue.verified || pending}
                      onClick={() =>
                        navigate(
                          'project/' + project.id + '/query/' + issue.queryId,
                        )
                      }
                    >
                      Inspect evidence
                      <ArrowUpRight size={13} />
                    </button>
                    <button
                      disabled={pending}
                      onClick={() =>
                        void action('/issues/' + issue.id, 'PATCH', {
                          status:
                            issue.status === 'open' ? 'dismissed' : 'open',
                        })
                      }
                    >
                      {issue.status === 'open' ? 'Dismiss' : 'Restore'}
                    </button>
                  </div>
                  {!issue.verified && (
                    <p className="project-error">
                      Evidence is unavailable; the finding cannot be relied on.
                    </p>
                  )}
                </article>
              ))}
              {!visibleIssues.length && (
                <p className="project-empty">
                  {issueTab === 'dismissed'
                    ? 'No dismissed findings.'
                    : 'No potential issues recorded.'}
                </p>
              )}
            </section>
            <section
              className="project-panel"
              aria-label="Project query history"
            >
              <div className="project-panel-heading">
                <h2>Query history</h2>
                <button
                  className={savedOnly ? 'selected' : ''}
                  onClick={() => setSavedOnly((v) => !v)}
                  aria-pressed={savedOnly}
                >
                  <Star size={13} />
                  Saved
                </button>
              </div>
              {visibleQueries.slice(0, 10).map((query) => (
                <div className="project-query-row" key={query.id}>
                  <a href={route('/query/' + query.id)} onClick={navigateLink}>
                    <span>{query.question}</span>
                    <small>
                      {query.prepared
                        ? 'Prepared comparison'
                        : query.state === 'completed'
                          ? 'Completed'
                          : query.state}{' '}
                      · {date(query.createdAt)}
                      {query.stale ? ' · Documents changed' : ''}
                    </small>
                  </a>
                  <button
                    aria-label={query.saved ? 'Unsave query' : 'Save query'}
                    onClick={() =>
                      void action('/queries/' + query.id, 'PATCH', {
                        saved: !query.saved,
                      })
                    }
                  >
                    <Star
                      size={14}
                      fill={query.saved ? 'currentColor' : 'none'}
                    />
                  </button>
                </div>
              ))}
              {!visibleQueries.length && (
                <p className="project-empty">
                  {savedOnly ? 'No saved queries.' : 'No queries yet.'}
                </p>
              )}
            </section>
          </aside>
        </div>
      </div>
      {editing && (
        <ProjectEditor
          project={project}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false)
            onRefresh()
          }}
        />
      )}
    </Shell>
  )
}
function QueryReader({
  data,
  id,
  onRun,
}: {
  data: ProjectData
  id: string
  onRun: (question: string, sourceOnly?: boolean) => void
}) {
  const resource = useResource<ProjectQuery>(
    projectPath(data.project.id) + '/queries/' + id,
  )
  if (resource.error)
    return (
      <Shell title={data.project.name}>
        <Message text={resource.error} error onRetry={resource.refresh} />
      </Shell>
    )
  const job = resource.data
  if (!job)
    return (
      <Shell title={data.project.name}>
        <Message text="Opening project query…" />
      </Shell>
    )
  if (job.stale)
    return (
      <Shell title={data.project.name}>
        <div className="project-empty">
          <p>
            The project documents have changed. This cached answer is withheld.
          </p>
          <button
            className="primary-action"
            onClick={() => onRun(job.question, job.sourceOnly)}
          >
            Run with current documents
          </button>
          <a href={'#project/' + data.project.id} onClick={navigateLink}>
            Project dashboard
          </a>
        </div>
      </Shell>
    )
  return (
    <QueryWorkspace
      key={job.id}
      entry={{
        id: job.id,
        queryId: job.id,
        projectId: data.project.id,
        prompt: job.question,
        title: job.question,
        caseId: 'storm',
        sourceOnly: job.sourceOnly,
      }}
      settings={readSettings()}
      projectName={data.project.name}
      projectDocuments={projectDocumentMap(data.documents)}
      onRun={(q, _case, sourceOnly) => onRun(q, sourceOnly)}
      onNew={() => navigate('project/' + data.project.id + '/new')}
    />
  )
}
function ProjectPage({
  id,
  section,
  record,
}: {
  id: string
  section?: string
  record?: string
}) {
  const resource = useResource<ProjectData>(
      projectPath(id),
      `${section || ''}/${record || ''}`,
    ),
    [error, setError] = useState('')
  async function run(question: string, sourceOnly = false) {
    setError('')
    try {
      const job = await requestProject(projectPath(id) + '/queries', 'POST', {
        question,
        sourceOnly,
        id: crypto.randomUUID(),
      })
      navigate('project/' + id + '/query/' + job.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not run the query.')
    }
  }
  if (resource.error)
    return (
      <Shell>
        <Message text={resource.error} error onRetry={resource.refresh} />
      </Shell>
    )
  const data = resource.data
  if (!data)
    return (
      <Shell>
        <Message text="Opening project documents…" />
      </Shell>
    )
  let content
  if (section === 'query' && record)
    content = <QueryReader key={record} data={data} id={record} onRun={run} />
  else if (section === 'new')
    content = (
      <QueryWorkspace
        key={id + '-new'}
        entry={{
          id: 'new',
          projectId: id,
          prompt: '',
          title: '',
          caseId: 'storm',
        }}
        settings={readSettings()}
        projectName={data.project.name}
        projectDocuments={projectDocumentMap(data.documents)}
        onRun={(q, _case, sourceOnly) => void run(q, sourceOnly)}
        onNew={() => navigate('project/' + id + '/new')}
      />
    )
  else if (section === 'document' && record) {
    const documents = projectDocumentMap(data.documents)
    content = documents[record] ? (
      <DocumentContext.Provider value={documents}>
        <main className="workspace">
          <AppHeader
            context={data.project.name}
            homeHref={'#project/' + id}
            onNew={() => navigate('project/' + id + '/new')}
          />
          <div className="project-document-view">
            <PdfPane
              key={record}
              id={record}
              active={emptyReferences}
              navigationKey={0}
              sourceReferences={emptyReferences}
              onSelectReferences={() => {}}
            />
          </div>
        </main>
      </DocumentContext.Provider>
    ) : (
      <Shell>
        <Message
          text="This document is not associated with the project."
          error
        />
      </Shell>
    )
  } else content = <ProjectDashboard data={data} onRefresh={resource.refresh} />
  return (
    <>
      {content}
      {error && (
        <div className="project-toast" role="alert">
          {error}
          <button aria-label="Dismiss error" onClick={() => setError('')}>
            <X size={14} />
          </button>
        </div>
      )}
    </>
  )
}
function subscribe(change: () => void) {
  window.addEventListener('hashchange', change)
  return () => window.removeEventListener('hashchange', change)
}
export default function ProjectApplication() {
  const capability = useResource<{ projects: Project[] }>('/v1/projects')
  const hash = useSyncExternalStore(
    subscribe,
    () => location.hash,
    () => '#projects',
  )
  const match = hash.match(
    /^#project\/([a-zA-Z0-9-]+)(?:\/(new|query|document)(?:\/([a-zA-Z0-9-]+))?)?$/,
  )
  if (capability.status === 404 && !match) return <LegacyApp />
  if (capability.error)
    return (
      <Shell>
        <Message text={capability.error} error onRetry={capability.refresh} />
      </Shell>
    )
  if (!capability.data)
    return (
      <Shell>
        <Message text="Connecting to the local project workspace…" />
      </Shell>
    )
  return match ? (
    <ProjectPage
      key={match[1]}
      id={match[1]}
      section={match[2]}
      record={match[3]}
    />
  ) : (
    <ProjectsOverview />
  )
}

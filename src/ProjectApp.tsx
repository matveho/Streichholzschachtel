import { ScanDetails } from './ScanDetails'
import { categoryLabels as labels } from './fileCategories'
import { useEffect, useState, useSyncExternalStore } from 'react'
import {
  FolderOpen,
  TriangleAlert,
  ChevronRight,
  Plus,
  Search,
  ArrowLeft,
  ArrowUpRight,
  RotateCcw,
  Star,
  X,
  FileText,
  Pencil,
  Trash2,
} from 'lucide-react'
import { QueryWorkspace } from './App'
import { ProjectDocumentReader } from './ProjectDocumentReader'
import type { RunContext } from './App'
import { ProjectEditor } from './ProjectEditor'
import { WorkspaceSettings } from './WorkspaceSettings'
import { api, ApiError } from './backend'
import { navigate, navigateLink } from './navigation'
import { projectPath, requestProject, projectDocumentMap } from './projects'
import type { Project, ProjectData, ProjectQuery } from './projects'
import { QueryTabBar } from './QueryTabs'
import type { ThreadTurn } from './assist'
import { useQueryTabs } from './useQueryTabs'
import './projects.css'

/** Finished jobs fetched while a search ran, so their page opens instantly. */
const settledJobs = new Map<string, ProjectQuery>()
const unansweredLabels: Record<string, string> = {
  not_found: 'Not found',
  partial: 'No direct answer',
  jurisdiction: 'Other municipality',
}
const date = (value: string) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Edmonton',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
function useResource<T>(path: string, context = '', keepStale = false) {
  const [version, setVersion] = useState(0)
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
    api(path, { signal: controller.signal })
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
  }, [path, key, identity])
  return {
    ...(state.key === identity
      ? state
      : {
          key: identity,
          // Optionally keep the last record on screen until the next arrives.
          data: keepStale && !state.error ? state.data : null,
          error: '',
          status: 0,
        }),
    refresh: () => setVersion((v) => v + 1),
  }
}
function Shell({
  children,
  actions,
  title = '',
  settings,
  settingsProject,
  onSettingsChange,
}: {
  children: React.ReactNode
  actions?: React.ReactNode
  title?: string
  settings?: React.ReactNode
  settingsProject?: Project
  onSettingsChange?: () => void
}) {
  return (
    <main className="project-shell">
      <header className="app-header project-header">
        <a className="project-brand" href="#projects" onClick={navigateLink}>
          <img src="/basis-logo.png" alt="" width="44" height="44" />
          <strong>basis</strong>
        </a>
        {title && <span className="project-header-title">{title}</span>}
        <div className="project-header-actions">
          {actions}
          <WorkspaceSettings
            project={settingsProject}
            onProjectChange={onSettingsChange}
          >
            {settings}
          </WorkspaceSettings>
        </div>
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
                </div>
                <h2>{project.name}</h2>
                <p className="project-client">{project.client}</p>
                {project.description && (
                  <p
                    className="project-card-description"
                    title={project.description}
                  >
                    {project.description}
                  </p>
                )}
                <div className="project-card-footer">
                  <span>
                    {project.documentCount}{' '}
                    {project.documentCount === 1 ? 'document' : 'documents'}
                  </span>
                  <span className="overview-issue-count">
                    {project.openIssueCount > 0 && (
                      <TriangleAlert size={14} aria-hidden="true" />
                    )}
                    {project.openIssueCount}{' '}
                    {project.openIssueCount === 1 ? 'issue' : 'issues'}
                  </span>
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
          onClose={() => {
            setCreating(false)
            resource.refresh()
          }}
          onSaved={(id) => navigate('project/' + id)}
        />
      )}
    </Shell>
  )
}
function ProjectDashboard({
  data,
  onRefresh,
  onQueryFiles,
  uploading = false,
  onUploadDone,
  onQueryDeleted,
}: {
  data: ProjectData
  onRefresh: () => void
  onQueryFiles: () => void
  /** Opens the document manager straight away (from a query's upload button). */
  uploading?: boolean
  onUploadDone?: () => void
  onQueryDeleted: (id: string) => void
}) {
  const { project, documents, queries, issues } = data
  const [filter, setFilter] = useState(''),
    [category, setCategory] = useState('all'),
    [issueTab, setIssueTab] = useState('open'),
    [savedOnly, setSavedOnly] = useState(false),
    [historyLimit, setHistoryLimit] = useState(10),
    [editing, setEditing] = useState(uploading),
    [uploadOnly, setUploadOnly] = useState(uploading),
    [error, setError] = useState(''),
    [pending, setPending] = useState(false)
  const [nameDraft, setNameDraft] = useState<string | null>(null)
  const [descriptionEditing, setDescriptionEditing] = useState(false),
    [description, setDescription] = useState(project.description)
  const shown = documents.filter(
    (doc) =>
      (category === 'all' || doc.category === category) &&
      `${doc.label} ${doc.title} ${doc.edition}`
        .toLowerCase()
        .includes(filter.toLowerCase()),
  )
  const openIssueCount = issues.filter(
    (issue) => issue.status === 'open',
  ).length
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
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The operation failed.')
      return false
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
      settingsProject={project}
      onSettingsChange={onRefresh}
      settings={
        <>
          {!project.protectedDemo && (
            <button
              disabled={pending}
              onClick={() => {
                setUploadOnly(false)
                setEditing(true)
              }}
            >
              Manage project
            </button>
          )}
          {!project.protectedDemo && (
            <button disabled={pending} onClick={remove}>
              Delete project
            </button>
          )}
        </>
      }
    >
      <div className="project-dashboard">
        <header className="dashboard-heading">
          <a className="project-back" href="#projects" onClick={navigateLink}>
            <ArrowLeft size={13} /> Projects
          </a>
          {nameDraft === null ? (
            <div className="dashboard-project-name">
              <h1>{project.name}</h1>
              {!project.protectedDemo && (
                <button
                  title="Rename project"
                  aria-label="Rename project"
                  onClick={() => setNameDraft(project.name)}
                >
                  <Pencil size={14} />
                </button>
              )}
            </div>
          ) : (
            <form
              className="dashboard-project-name"
              onSubmit={async (event) => {
                event.preventDefault()
                if (
                  nameDraft.trim() &&
                  (await action('', 'PATCH', { name: nameDraft.trim() }))
                )
                  setNameDraft(null)
              }}
            >
              <input
                autoFocus
                aria-label="Project name"
                value={nameDraft}
                maxLength={100}
                disabled={pending}
                onFocus={(event) => event.target.select()}
                onChange={(event) => setNameDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setNameDraft(null)
                }}
              />
              <button disabled={pending || !nameDraft.trim()}>Save</button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setNameDraft(null)}
              >
                Cancel
              </button>
            </form>
          )}
          <button
            className="primary-action query-files"
            disabled={!documents.length}
            onClick={onQueryFiles}
          >
            <Search size={16} /> New query
          </button>
          {(project.client || project.location) && (
            <p>
              {[project.client, project.location]
                .filter(Boolean)
                .join(' \u00b7 ')}
            </p>
          )}
        </header>
        {descriptionEditing ? (
          <form
            className="project-description-editor"
            onSubmit={async (e) => {
              e.preventDefault()
              await action('', 'PATCH', { description })
              setDescriptionEditing(false)
            }}
          >
            <input
              autoFocus
              aria-label="Project description"
              value={description}
              maxLength={1000}
              onChange={(e) => setDescription(e.target.value)}
            />
            <button disabled={pending} type="submit">
              Save
            </button>
            <button
              type="button"
              disabled={pending}
              title="Generate from documents"
              aria-label="Generate description from documents"
              onClick={async () => {
                await action('', 'PATCH', { description: '' })
                setDescriptionEditing(false)
              }}
            >
              <RotateCcw size={14} />
            </button>
            <button type="button" onClick={() => setDescriptionEditing(false)}>
              Cancel
            </button>
          </form>
        ) : (
          <div className="project-description-line">
            <p className="project-scope">{project.description}</p>
            <button
              type="button"
              aria-label="Edit description"
              title="Edit description"
              onClick={() => {
                setDescription(project.description)
                setDescriptionEditing(true)
              }}
            >
              <Pencil size={13} />
            </button>
          </div>
        )}
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
              <div className="register-tools">
                <select
                  aria-label="Filter by document category"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                >
                  <option value="all">All categories</option>
                  {Object.entries(labels)
                    .filter(([id]) => documents.some((d) => d.category === id))
                    .map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                </select>
                <label className="project-filter">
                  <Search size={14} />
                  <input
                    aria-label="Filter project documents"
                    placeholder="Find a document"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="project-upload-button"
                  aria-label="Upload documents"
                  title="Upload documents"
                  onClick={() => {
                    setUploadOnly(true)
                    setEditing(true)
                  }}
                >
                  <Plus size={14} /> Upload
                </button>
              </div>
            </div>
            {shown.length > 0 && (
              <div className="register-columns" aria-hidden="true">
                <span>Document</span>
                <span>Revision / edition</span>
                <span>Pages</span>
              </div>
            )}
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
                  <details
                    className="project-document-group"
                    key={type + category + filter}
                    open
                  >
                    <summary>
                      <ChevronRight size={15} aria-hidden="true" />
                      <h3>
                        {labels[type]} <span>{group.length}</span>
                      </h3>
                    </summary>
                    {group.map((doc) => (
                      <div className="project-document-entry" key={doc.id}>
                        <a
                          className="project-document-row"
                          href={route('/document/' + doc.id)}
                          onClick={navigateLink}
                        >
                          <FileText size={15} />
                          <span>
                            <strong>{doc.title}</strong>
                            {doc.label && doc.label !== doc.title && (
                              <small>{doc.label}</small>
                            )}
                          </span>
                          <span className="register-edition">
                            {doc.edition || '\u2014'}
                          </span>
                          <span className="document-pages">{doc.pages}</span>
                        </a>
                        {doc.model && (
                          <a
                            className="model-download"
                            href={projectDocumentMap([doc])[doc.id].model}
                            download
                            aria-label={`Download IFC model for ${project.name}`}
                            title="Download IFC model"
                          >
                            IFC <ArrowUpRight size={13} />
                          </a>
                        )}
                      </div>
                    ))}
                  </details>
                ) : null
              },
            )}
            {documents.length > 0 && !shown.length && (
              <Message text="No matching documents." />
            )}
          </section>
          <aside className="project-sidebar">
            <section className="project-panel" aria-label="Potential issues">
              <div className="project-panel-heading">
                <h2 title="Document and IFC findings requiring engineering review">
                  Potential issues
                </h2>
                <button
                  disabled={pending}
                  onClick={() => void action('/rescan', 'POST')}
                >
                  {pending ? 'Scanning…' : 'Rescan'}
                </button>
              </div>
              <div className="project-panel-tabs">
                <button
                  className={issueTab === 'open' ? 'selected' : ''}
                  onClick={() => setIssueTab('open')}
                >
                  Open {openIssueCount}
                </button>
                <button
                  className={issueTab === 'dismissed' ? 'selected' : ''}
                  onClick={() => setIssueTab('dismissed')}
                >
                  Dismissed{' '}
                  {issues.filter((i) => i.status === 'dismissed').length}
                </button>
                {data.comparison && <ScanDetails scan={data.comparison} />}
              </div>
              {visibleIssues.map((issue) => (
                <details className="project-issue" key={issue.id}>
                  <summary>
                    {issue.status === 'open' && (
                      <TriangleAlert
                        className="issue-warning"
                        size={14}
                        aria-hidden="true"
                      />
                    )}
                    <strong>{issue.title}</strong>
                    <ChevronRight
                      className="issue-chevron"
                      size={14}
                      aria-hidden="true"
                    />

                    {issue.citations.length > 0 && (
                      <span className="issue-sources">
                        {[
                          ...new Set(
                            issue.citations.map(
                              (c) => `${c.label} p.\u00a0${c.page}`,
                            ),
                          ),
                        ].join(' \u00b7 ')}
                      </span>
                    )}
                  </summary>
                  {issue.category && (
                    <p>{labels[issue.category] || issue.category}</p>
                  )}
                  <p>{issue.explanation}</p>
                  <div className="issue-actions">
                    {!issue.queryId && (
                      <details>
                        <summary>Inspect evidence</summary>
                        {issue.citations.map((c, i) => (
                          <p key={i}>
                            {c.label} · p. {c.page}: {c.excerpt}
                          </p>
                        ))}
                      </details>
                    )}
                    {issue.queryId && (
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
                    )}
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
                </details>
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
              {visibleQueries.slice(0, historyLimit).map((query) => (
                <div className="project-query-row" key={query.id}>
                  <a href={route('/query/' + query.id)} onClick={navigateLink}>
                    <span>{query.question}</span>
                    <small>
                      {!query.stale &&
                        query.outcome &&
                        unansweredLabels[query.outcome] && (
                          <span className="unanswered-badge">
                            {unansweredLabels[query.outcome]}
                          </span>
                        )}
                      {query.state !== 'completed' ? query.state + ' · ' : ''}
                      {date(query.createdAt)}
                      {query.stale ? ' · Documents changed' : ''}
                    </small>
                  </a>
                  <button
                    disabled={pending}
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
                  <button
                    className="query-delete-button"
                    aria-label="Delete query"
                    title="Delete query"
                    disabled={pending}
                    onClick={async () => {
                      if (await action('/queries/' + query.id, 'DELETE'))
                        onQueryDeleted(query.id)
                    }}
                  >
                    <Trash2 size={14} />
                  </button>

                </div>
              ))}
              {visibleQueries.length > historyLimit && (
                <button
                  className="history-more"
                  onClick={() => setHistoryLimit((limit) => limit + 10)}
                >
                  Show more queries
                </button>
              )}
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
          uploadOnly={uploadOnly}
          existingDocuments={documents}
          onClose={() => {
            setEditing(false)
            onUploadDone?.()
          }}
          onSaved={() => {
            setEditing(false)
            onRefresh()
            onUploadDone?.()
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
  onNew,
  thread,
}: {
  data: ProjectData
  id: string
  onRun: (
    question: string,
    sourceOnly?: boolean,
    context?: RunContext,
  ) => Promise<void>
  onNew: () => void
  thread?: ThreadTurn[]
}) {
  const resource = useResource<ProjectQuery>(
    projectPath(data.project.id) + '/queries/' + id,
    '',
    true,
  )
  if (resource.error)
    return (
      <Shell title={data.project.name}>
        <Message text={resource.error} error onRetry={resource.refresh} />
      </Shell>
    )
  const job =
    resource.data?.id === id
      ? resource.data
      : (settledJobs.get(id) ?? resource.data)
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
            onClick={() =>
              onRun(job.question, job.sourceOnly, {
                from: job.question,
                fresh: true,
                documentIds: job.documentIds,
              })
            }
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
        queryId: job.id,
        projectId: data.project.id,
        prompt: job.question,
        sourceOnly: job.sourceOnly,
        documentIds: job.documentIds,
      }}
      projectName={data.project.name}
      projectDocuments={projectDocumentMap(data.documents)}
      onRun={onRun}
      preloadedJob={job}
      finding={data.issues.some(
        (issue) => issue.queryId === job.id && issue.verified,
      )}
      onNew={onNew}
      thread={thread}
      onUpload={
        data.project.protectedDemo
          ? undefined
          : () => navigate(`project/${data.project.id}/upload/${job.id}`)
      }
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
      true,
    ),
    [error, setError] = useState('')
  const tabs = useQueryTabs({
    scope: 'project:' + id,
    target:
      section === 'new' ? 'new' : section === 'query' && record ? record : null,
    open: (target) =>
      navigate(
        'project/' + id + (target === 'new' ? '/new' : '/query/' + target),
      ),
    onEmpty: () => navigate('project/' + id),
  })
  const onQueryRoute = section === 'new' || (section === 'query' && !!record)
  // Keep the tab buttons mounted while navigation replaces the query pane.
  function withTabs(content: React.ReactNode) {
    return (
      <div className="tabbed-workspace">
        {content}
        <QueryTabBar
          tabs={tabs}
          dashboard={{ href: '#project/' + id, active: !onQueryRoute }}
        />
      </div>
    )
  }
  async function run(
    question: string,
    sourceOnly = false,
    context?: RunContext,
  ) {
    setError('')
    const startedAt = location.hash
    try {
      const job = await requestProject(projectPath(id) + '/queries', 'POST', {
        question,
        sourceOnly,
        id: crypto.randomUUID(),
        ...(context?.documentIds === undefined
          ? {}
          : { documentIds: context.documentIds }),
      })
      await settle(job)
      // The user moved elsewhere meanwhile; the result waits in history.
      if (location.hash !== startedAt) return
      if (section !== 'document')
        tabs.markRun(context && { ...context, to: question })
      navigate('project/' + id + '/query/' + job.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not run the query.')
    }
  }
  /** Waits until a submitted query finishes, so the result appears at once. */
  async function settle(job: { id: string; state: string }) {
    const deadline = Date.now() + 120000
    let current = job
    while (['queued', 'running'].includes(current.state)) {
      if (Date.now() > deadline) return
      await new Promise((resolve) => setTimeout(resolve, 700))
      try {
        current = await requestProject(
          projectPath(id) + '/queries/' + job.id,
          'GET',
        )
      } catch {
        return
      }
    }
    if (current.state === 'completed')
      settledJobs.set(job.id, current as ProjectQuery)
  }
  if (resource.error)
    return withTabs(
      <Shell>
        <Message text={resource.error} error onRetry={resource.refresh} />
      </Shell>,
    )
  const data = resource.data
  if (!data)
    return withTabs(
      <Shell>
        <Message text="Opening project documents…" />
      </Shell>,
    )
  let content
  if (section === 'query' && record)
    content = (
      <QueryReader
        data={data}
        id={record}
        onRun={run}
        onNew={tabs.openNew}
        thread={tabs.activeTab?.thread}
      />
    )
  else if (section === 'new') {
    // Each unsent tab gets its own workspace and keeps its own typed text.
    const draftTab = tabs.activeTab
    content = (
      <QueryWorkspace
        key={id + '-new-' + (draftTab?.key ?? '')}
        draft={draftTab?.draft}
        onDraftChange={
          draftTab ? (text) => tabs.setDraft(draftTab.key, text) : undefined
        }
        entry={{
          projectId: id,
          prompt: '',
        }}
        projectName={data.project.name}
        projectDocuments={projectDocumentMap(data.documents)}
        onRun={run}
        onNew={tabs.openNew}
      />
    )
  } else if (section === 'document' && record) {
    const documents = projectDocumentMap(data.documents)
    content = documents[record] ? (
      <ProjectDocumentReader
        key={record}
        projectId={id}
        projectName={data.project.name}
        documentId={record}
        documents={documents}
        onRun={(question, documentIds) =>
          run(question, false, { from: '', fresh: true, documentIds })
        }
      />
    ) : (
      <Shell>
        <Message
          text="This document is not associated with the project."
          error
        />
      </Shell>
    )
  } else
    content = (
      <ProjectDashboard
        data={data}
        onRefresh={resource.refresh}
        onQueryFiles={tabs.openNew}
        onQueryDeleted={(queryId) => {
          settledJobs.delete(queryId)
          for (const tab of tabs.tabs)
            if (tab.target === queryId) tabs.close(tab.key)
        }}
        uploading={section === 'upload'}
        onUploadDone={
          section === 'upload'
            ? () =>
                navigate('project/' + id + (record ? '/query/' + record : ''))
            : undefined
        }
      />
    )
  return withTabs(
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
    </>,
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
    /^#project\/([a-zA-Z0-9-]+)(?:\/(new|query|document|upload)(?:\/([a-zA-Z0-9-]+))?)?$/,
  )
  if (capability.error)
    return (
      <Shell>
        <Message
          text={
            capability.status === 404
              ? 'The project workspace API is unavailable. Check the backend connection, then retry.'
              : capability.error
          }
          error
          onRetry={capability.refresh}
        />
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

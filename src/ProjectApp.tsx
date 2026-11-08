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
  BookOpen,
  Pencil,
} from 'lucide-react'
import LegacyApp, { QueryWorkspace } from './App'
import type { RunContext } from './App'
import { ProjectEditor } from './ProjectEditor'
import { WorkspaceSettings } from './WorkspaceSettings'
import { api, ApiError, readSettings } from './backend'
import { navigate, navigateLink } from './navigation'
import { AppHeader } from './AppHeader'
import { DocumentContext } from './DocumentContext'
import { PdfPane } from './PdfPane'
import { projectPath, requestProject, projectDocumentMap } from './projects'
import type { Project, ProjectData, ProjectQuery } from './projects'
import type { Reference } from './data'
import { QueryTabBar } from './QueryTabs'
import type { ThreadTurn } from './assist'
import { useQueryTabs } from './useQueryTabs'
import './projects.css'

const emptyReferences: Reference[] = []
const unansweredLabels: Record<string, string> = {
  not_found: 'Not found',
  partial: 'No direct answer',
  jurisdiction: 'Other municipality',
}
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
          <strong>Basis</strong>
        </a>
        <span className="project-header-title">{title}</span>
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
                    {project.documentCount} documents · {project.openIssueCount}{' '}
                    issues
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
}: {
  data: ProjectData
  onRefresh: () => void
  onQueryFiles: () => void
  /** Opens the document manager straight away (from a query's upload button). */
  uploading?: boolean
  onUploadDone?: () => void
}) {
  const { project, documents, queries, issues } = data
  const [filter, setFilter] = useState(''),
    [category, setCategory] = useState('all'),
    [issueTab, setIssueTab] = useState('open'),
    [savedOnly, setSavedOnly] = useState(false),
    [editing, setEditing] = useState(uploading && !project.protectedDemo),
    [error, setError] = useState(''),
    [pending, setPending] = useState(false)
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
    visibleQueries = queries.filter((q) => !savedOnly || q.saved),
    unanswered = queries.filter(
      (q) => !q.stale && q.outcome && q.outcome in unansweredLabels,
    )
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
      settingsProject={project}
      onSettingsChange={onRefresh}
      settings={
        <>
          {!project.protectedDemo && (
            <button disabled={pending} onClick={() => setEditing(true)}>
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
        <div className="project-page-heading">
          <div>
            <a className="project-back" href="#projects" onClick={navigateLink}>
              <ArrowLeft size={13} />
              Projects
            </a>
            <h1>{project.name}</h1>
            <p>
              {[project.client, project.location].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
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
                          <FileText size={17} />
                          <span>
                            <strong>{doc.title}</strong>
                            <small>
                              {doc.label} · {doc.edition}
                            </small>
                          </span>
                          <span className="document-pages">
                            {doc.pages} pp.
                          </span>
                          <ArrowUpRight size={14} />
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
            <div className="project-collection-summary">
              <BookOpen size={14} />
              <span>
                {data.collections.map((c) => c.title).join(' · ') ||
                  'No Reference Collections selected'}
              </span>
            </div>
          </section>
          <aside className="project-sidebar">
            <button
              className="primary-action query-files"
              disabled={!documents.length}
              onClick={onQueryFiles}
            >
              <Search size={17} />
              Query Files
            </button>
            <section className="project-panel" aria-label="Potential issues">
              <div className="project-panel-heading">
                <h2 title="Source-verified example findings requiring engineering review">
                  {openIssueCount > 0 && (
                    <TriangleAlert
                      className="issue-warning"
                      size={17}
                      aria-hidden="true"
                    />
                  )}
                  Potential issues
                </h2>
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
            {unanswered.length > 0 && (
              <section
                className="project-panel"
                aria-label="Unanswered questions"
              >
                <div className="project-panel-heading">
                  <h2 title="Questions the project documents could not answer">
                    Unanswered questions <span>{unanswered.length}</span>
                  </h2>
                </div>
                <p className="unanswered-hint">
                  These may need documents that aren't in the project yet.
                </p>
                {unanswered.slice(0, 5).map((query) => (
                  <div className="project-query-row" key={query.id}>
                    <a
                      href={route('/query/' + query.id)}
                      onClick={navigateLink}
                    >
                      <span>{query.question}</span>
                      <small>
                        <span className="unanswered-badge">
                          {unansweredLabels[query.outcome!]}
                        </span>
                        {date(query.createdAt)}
                      </small>
                    </a>
                  </div>
                ))}
              </section>
            )}
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
                      {query.state !== 'completed' ? query.state + ' · ' : ''}
                      {date(query.createdAt)}
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
  onRun: (question: string, sourceOnly?: boolean, context?: RunContext) => void
  onNew: () => void
  thread?: ThreadTurn[]
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
      onRun={(q, _case, sourceOnly, context) => onRun(q, sourceOnly, context)}
      onNew={onNew}
      thread={thread}
      onUpload={
        data.project.protectedDemo
          ? undefined
          : () => navigate(`project/${data.project.id}/upload/${job.id}`)
      }
      uploadNote="This example project is read-only. Create a new project to upload your own documents."
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
    return onQueryRoute ? (
      <div className="tabbed-workspace">
        {content}
        <QueryTabBar tabs={tabs} />
      </div>
    ) : (
      content
    )
  }
  async function run(
    question: string,
    sourceOnly = false,
    context?: RunContext,
  ) {
    setError('')
    try {
      const job = await requestProject(projectPath(id) + '/queries', 'POST', {
        question,
        sourceOnly,
        id: crypto.randomUUID(),
      })
      tabs.markRun(context && { ...context, to: question })
      navigate('project/' + id + '/query/' + job.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not run the query.')
    }
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
        key={record}
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
          id: 'new',
          projectId: id,
          prompt: '',
          title: '',
          caseId: 'storm',
        }}
        settings={readSettings()}
        projectName={data.project.name}
        projectDocuments={projectDocumentMap(data.documents)}
        onRun={(q, _case, sourceOnly, context) =>
          void run(q, sourceOnly, context)
        }
        onNew={tabs.openNew}
      />
    )
  } else if (section === 'document' && record) {
    const documents = projectDocumentMap(data.documents)
    content = documents[record] ? (
      <DocumentContext.Provider value={documents}>
        <main className="workspace">
          <AppHeader
            context={data.project.name}
            homeHref={'#project/' + id}
            onNew={() => navigate('project/' + id + '/new')}
            showNewQuery={false}
          />
          {documents[record].model && (
            <div className="model-document-toolbar">
              <a
                className="model-download"
                href={documents[record].model}
                download
              >
                Download IFC
              </a>
            </div>
          )}
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
  } else
    content = (
      <ProjectDashboard
        data={data}
        onRefresh={resource.refresh}
        onQueryFiles={tabs.openNew}
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

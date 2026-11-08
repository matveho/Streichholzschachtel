import { House, Plus } from 'lucide-react'
import { navigateLink } from './navigation'
import { WorkspaceSettings } from './WorkspaceSettings'

export function AppHeader({
  onNew,
  home = false,
  homeHref = '#home',
  context,
  showNewQuery = true,
}: {
  onNew: () => void
  home?: boolean
  homeHref?: string
  context?: string
  showNewQuery?: boolean
}) {
  return (
    <header className="app-header">
      <img
        className="brand-mark"
        src="/basis-logo.png"
        alt=""
        width="44"
        height="44"
      />
      <strong>basis</strong>
      <a
        className={`home-link ${home ? 'active' : ''}`}
        href={homeHref}
        onClick={navigateLink}
        aria-label={
          homeHref.startsWith('#project/') ? 'Project dashboard' : 'Home'
        }
        aria-current={home ? 'page' : undefined}
        title={
          homeHref.startsWith('#project/') ? 'Project dashboard' : 'Projects'
        }
      >
        <House size={15} />
      </a>
      {context && <span className="workspace-context">{context}</span>}
      {showNewQuery && (
        <button className="new-query" onClick={onNew}>
          <Plus size={14} />
          New query
        </button>
      )}
      <WorkspaceSettings
        projectId={homeHref.match(/^#project\/([a-zA-Z0-9-]+)/)?.[1]}
      />
    </header>
  )
}

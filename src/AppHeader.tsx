import { House, Plus } from 'lucide-react'
import { navigateLink } from './navigation'

export function AppHeader({
  onNew,
  home = false,
}: {
  onNew: () => void
  home?: boolean
}) {
  return (
    <header className="app-header">
      <img
        className="brand-mark"
        src="/basis.svg"
        alt=""
        width="26"
        height="26"
      />
      <strong>Basis</strong>
      <a
        className={`home-link ${home ? 'active' : ''}`}
        href="#home"
        onClick={navigateLink}
        aria-label="Home"
        aria-current={home ? 'page' : undefined}
        title="Query history"
      >
        <House size={15} />
      </a>
      <button className="new-query" onClick={onNew}>
        <Plus size={14} />
        New query
      </button>
    </header>
  )
}

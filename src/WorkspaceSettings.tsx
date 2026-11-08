import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Settings } from 'lucide-react'
import { requestProject, projectPath } from './projects'

export function WorkspaceSettings({ children }: { children?: ReactNode }) {
  const [open, setOpen] = useState(false),
    [error, setError] = useState(''),
    [pending, setPending] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', escape)
    }
  }, [open])
  async function reset() {
    if (
      !confirm(
        'Restore both example projects, including their documents, query history and findings?',
      )
    )
      return
    setPending(true)
    setError('')
    try {
      for (const id of ['demo-mill-creek', 'demo-willow-creek'])
        await requestProject(projectPath(id) + '/reset', 'POST', {})
      location.hash = '#projects'
      location.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not restore projects')
      setPending(false)
    }
  }
  return (
    <div className="workspace-settings" ref={root}>
      <button
        type="button"
        title="Settings"
        aria-label="Settings"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Settings size={16} />
      </button>
      {open && (
        <div
          className="workspace-settings-menu"
          role="group"
          aria-label="Workspace settings"
          onClick={() => {
            if (children) setOpen(false)
          }}
        >
          {children || (
            <button
              type="button"
              disabled={pending}
              onClick={() => void reset()}
            >
              Restore example projects
            </button>
          )}
          {error && <p role="alert">{error}</p>}
        </div>
      )}
    </div>
  )
}

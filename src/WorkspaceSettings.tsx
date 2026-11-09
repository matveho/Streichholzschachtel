import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Settings, Lock } from 'lucide-react'
import { requestProject, projectPath } from './projects'
import type { Project } from './projects'
import { api, readSettings } from './backend'

export function WorkspaceSettings({
  children,
  project,
  projectId,
  onProjectChange,
}: {
  children?: ReactNode
  project?: Project
  projectId?: string
  onProjectChange?: () => void
}) {
  const [open, setOpen] = useState(false),
    [error, setError] = useState(''),
    [pending, setPending] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const [context, setContext] = useState<Project>()
  const requestedId = project?.id || projectId
  const current = context?.id === requestedId ? context : project
  useEffect(() => {
    if (!open || !requestedId || project) return
    const controller = new AbortController()
    api(readSettings(), projectPath(requestedId), { signal: controller.signal })
      .then((data) => setContext(data.project))
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message)
      })
    return () => controller.abort()
  }, [open, requestedId, project])
  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) {
        setOpen(false)
        setContext(undefined)
      }
    }
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setContext(undefined)
      }
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
        'Reset the workspace? Projects not marked “Keep on reset” will be deleted, including their imported files and query history. Built-in examples will be restored.',
      )
    )
      return
    setPending(true)
    setError('')
    try {
      await requestProject('/v1/demo/reset', 'POST', {})
      location.hash = '#projects'
      location.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not restore projects')
      setPending(false)
    }
  }
  async function persist(value: boolean) {
    if (!current || current.protectedDemo) return
    setPending(true)
    setError('')
    setContext({ ...current, persistOnReset: value })
    try {
      const result = await requestProject(projectPath(current.id), 'PATCH', {
        persistOnReset: value,
      })
      setContext(result.project)
      onProjectChange?.()
    } catch (e) {
      setContext(current)
      setError(e instanceof Error ? e.message : 'Could not update project')
    } finally {
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
        onClick={() => {
          setOpen((v) => !v)
          setContext(undefined)
        }}
      >
        <Settings size={16} />
      </button>
      {open && (
        <div
          className="workspace-settings-menu"
          role="group"
          aria-label="Workspace settings"
        >
          {children && (
            <div
              onClick={() => {
                setOpen(false)
                setContext(undefined)
              }}
            >
              {children}
            </div>
          )}
          <button type="button" disabled={pending} onClick={() => void reset()}>
            Reset workspace
          </button>
          {current && (
            <label
              className="demo-retention"
              title={
                current.protectedDemo
                  ? 'Built-in examples always persist'
                  : 'Preserve this project when resetting the workspace'
              }
            >
              <input
                type="checkbox"
                aria-label="Keep on reset"
                checked={
                  current.protectedDemo || current.persistOnReset === true
                }
                disabled={pending || current.protectedDemo}
                onChange={(e) => void persist(e.target.checked)}
              />
              <span>Keep on reset</span>
              {current.protectedDemo && <Lock size={11} aria-label="Locked" />}
            </label>
          )}
          {error && <p role="alert">{error}</p>}
        </div>
      )}
    </div>
  )
}

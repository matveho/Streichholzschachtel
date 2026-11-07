import { useState } from 'react'
import { api, connectionKey } from './backend'
import type { BackendSettings } from './backend'
export function BackendSelector({
  settings,
  onChange,
}: {
  settings: BackendSettings
  onChange: (value: BackendSettings) => void
}) {
  const [status, setStatus] = useState('')
  return (
    <section className="backend-selector" aria-label="Backend connection">
      <label>
        Data source
        <select
          aria-label="Data source"
          value={settings.mode}
          onChange={(e) => {
            setStatus('')
            onChange({
              ...settings,
              mode: e.target.value as BackendSettings['mode'],
            })
          }}
        >
          <option value="main">Backend (main)</option>
          <option value="matvey">Matvey’s backend</option>
          <option value="static">Static data</option>
        </select>
      </label>
      {settings.mode !== 'static' && (
        <>
          <label>
            Service URL
            <input
              aria-label="Backend URL"
              type="url"
              placeholder="https://…"
              value={
                settings.mode === 'main' ? settings.mainUrl : settings.matveyUrl
              }
              onChange={(e) => {
                setStatus('')
                onChange({
                  ...settings,
                  [settings.mode === 'main' ? 'mainUrl' : 'matveyUrl']:
                    e.target.value,
                })
              }}
            />
          </label>
          <label>
            Connection key
            <input
              aria-label="Connection key"
              type="password"
              value={connectionKey(settings)}
              onChange={(e) => {
                setStatus('')
                onChange({
                  ...settings,
                  [settings.mode === 'main' ? 'mainKey' : 'key']:
                    e.target.value,
                })
              }}
            />
          </label>
          <button
            onClick={async () => {
              setStatus('Checking…')
              try {
                await api(settings, '/v1/documents', {
                  signal: AbortSignal.timeout(10000),
                })
                const health = await api(settings, '/health', {
                  signal: AbortSignal.timeout(10000),
                })
                setStatus(
                  health.ready
                    ? `Ready · ${health.documents} documents`
                    : health.stage || 'Service is starting',
                )
              } catch (error) {
                setStatus(
                  error instanceof Error && error.message !== 'Failed to fetch'
                    ? error.message
                    : 'Cannot connect. Start the launcher and use its HTTPS connection link.',
                )
              }
            }}
          >
            Check connection
          </button>
          <span role="status">{status}</span>
        </>
      )}
    </section>
  )
}

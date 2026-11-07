import { readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'

try {
  const connection = JSON.parse(
    readFileSync(new URL('./state/connection.json', import.meta.url), 'utf8'),
  )
  const backend = new URL(connection.url)
  if (backend.protocol !== 'https:')
    throw Error('The HTTPS tunnel is unavailable. Run Start Demo.cmd first.')
  const response = await fetch(new URL('/health', backend), {
    signal: AbortSignal.timeout(15000),
  })
  const health = await response.json()
  if (
    !response.ok ||
    health.service !== 'basis-backend-matvey' ||
    !health.ready
  )
    throw Error('The local backend is not ready. Run Start Demo.cmd first.')
  const page = new URL('https://streichholzschachtel.vercel.app/')
  page.hash =
    'connect?' +
    new URLSearchParams({ url: backend.origin, key: connection.key })
  // Keep the private bootstrap link out of terminal output and the repository.
  const child = spawn(
    'rundll32.exe',
    ['url.dll,FileProtocolHandler', page.href],
    {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    },
  )
  child.on('error', () => {
    console.error('Could not open the browser.')
    process.exitCode = 1
  })
  child.unref()
  console.log('Opened the Vercel frontend with the local backend connection.')
} catch (error) {
  console.error(
    error.code === 'ENOENT'
      ? 'Run Start Demo.cmd first to create the local connection.'
      : error.message,
  )
  process.exitCode = 1
}

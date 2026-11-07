import { spawn, execFile, execFileSync } from 'node:child_process'
import {
  existsSync,
  writeFileSync,
  createWriteStream,
  statfsSync,
} from 'node:fs'
import { resolve } from 'node:path'
import { homedir } from 'node:os'
import { config, root, stateDir } from './src/config.mjs'

const children = []
const local = `http://127.0.0.1:${config.port}`
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const open = (url) => {
  if (process.env.BASIS_NO_OPEN !== '1' && process.platform === 'win32')
    execFile(
      'rundll32.exe',
      ['url.dll,FileProtocolHandler', url],
      { windowsHide: true },
      () => {},
    )
}
const connectionUrl = (frontend, api) =>
  `${frontend.replace(/\/$/, '')}/#connect?url=${encodeURIComponent(api)}&key=${encodeURIComponent(config.token)}`
function run(cmd, args, env = {}) {
  const child = spawn(cmd, args, {
    cwd: root,
    windowsHide: true,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  children.push(child)
  return child
}
function clean() {
  for (const child of children) child.kill()
  process.exit()
}
process.on('SIGINT', clean)
process.on('SIGTERM', clean)
process.on('exit', () => {
  for (const child of children) child.kill()
})

console.log(
  'Basis · Matvey backend\nKeep this window open while using the service. Ctrl+C stops it.\n',
)
if (Number(process.versions.node.split('.')[0]) < 24)
  throw new Error('Node.js 24 or newer is required.')
console.log('Building the current frontend into backend-matvey/state/frontend…')
const build = spawn(
  process.execPath,
  [
    resolve(root, '../node_modules/vite/bin/vite.js'),
    'build',
    '--outDir',
    resolve(stateDir, 'frontend'),
  ],
  { cwd: resolve(root, '..'), windowsHide: true, stdio: 'inherit' },
)
if (
  (await new Promise((done, reject) => {
    build.once('error', reject)
    build.once('exit', done)
  })) !== 0
)
  throw new Error(
    'Frontend build failed. Run npm ci in the repository root once, then retry.',
  )
const python = resolve(
  root,
  process.platform === 'win32'
    ? '.venv/Scripts/python.exe'
    : '.venv/bin/python',
)
if (!existsSync(python)) {
  console.log('Preparing the isolated PDF extractor…')
  for (const [cmd, args] of [['python', ['-m', 'venv', '.venv']]]) {
    const child = run(cmd, args)
    child.stdout.pipe(process.stdout)
    child.stderr.pipe(process.stderr)
    const code = await new Promise((done, reject) => {
      child.once('error', reject)
      child.once('exit', done)
    })
    if (code !== 0)
      throw new Error(
        'Could not prepare Python PDF extraction. See the README.',
      )
  }
}
try {
  execFileSync(python, ['-c', 'import pymupdf'], {
    windowsHide: true,
    stdio: 'ignore',
  })
} catch {
  const install = run(python, [
    '-m',
    'pip',
    'install',
    '-r',
    'requirements.txt',
  ])
  install.stdout.pipe(process.stdout)
  install.stderr.pipe(process.stderr)
  if (
    (await new Promise((done, reject) => {
      install.once('error', reject)
      install.once('exit', done)
    })) !== 0
  )
    throw new Error('PDF extractor installation failed. See the README.')
}
if (!config.extractiveOnly && config.provider === 'ollama') {
  try {
    await fetch(`${config.ollamaUrl}/api/version`, {
      signal: AbortSignal.timeout(2000),
    })
  } catch {
    const executable =
      process.env.OLLAMA_PATH ||
      resolve(homedir(), 'AppData/Local/Programs/Ollama/ollama.exe')
    if (
      existsSync(executable) &&
      config.ollamaUrl === 'http://127.0.0.1:11435'
    ) {
      console.log('Starting the installed local model runtime…')
      const modelServer = run(executable, ['serve'], {
        OLLAMA_HOST: '127.0.0.1:11435',
        OLLAMA_MODELS: resolve(stateDir, 'models'),
        OLLAMA_CONTEXT_LENGTH: '8192',
      })
      const modelLog = createWriteStream(resolve(stateDir, 'ollama.log'), {
        flags: 'a',
      })
      modelServer.stdout.pipe(modelLog, { end: false })
      modelServer.stderr.pipe(modelLog, { end: false })
      modelServer.on('exit', () => modelLog.end())
      modelServer.on('error', () =>
        console.log(
          'Local model runtime unavailable; source excerpts remain available.',
        ),
      )
      for (let i = 0; i < 15; i++) {
        try {
          await fetch(`${config.ollamaUrl}/api/version`, {
            signal: AbortSignal.timeout(1000),
          })
          break
        } catch {
          await wait(1000)
        }
      }
    }
  }
  try {
    const tags = await (
      await fetch(`${config.ollamaUrl}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      })
    ).json()
    if (!tags.models?.some((m) => m.name === config.model)) {
      const disk = statfsSync(stateDir)
      if (disk.bavail * disk.bsize < 6 * 1024 ** 3)
        throw new Error(
          'At least 6 GB free space is required before downloading a model. Use an existing model service or free disk space first.',
        )
      if (config.ollamaUrl !== 'http://127.0.0.1:11435')
        throw new Error(
          'Install the selected model on your configured Ollama server first.',
        )
      console.log(
        `Downloading ${config.model} into the isolated model store. First run only…`,
      )
      const pull = await fetch(`${config.ollamaUrl}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: config.model }),
        signal: AbortSignal.timeout(1800000),
      })
      if (!pull.ok) throw new Error('Model download failed')
      let buffer = '',
        last = 0
      for await (const chunk of pull.body) {
        buffer += Buffer.from(chunk).toString()
        const lines = buffer.split('\n')
        buffer = lines.pop()
        for (const line of lines) {
          if (!line) continue
          const item = JSON.parse(line)
          if (item.error) throw new Error(item.error)
          if (Date.now() - last > 5000 || item.status === 'success') {
            console.log(
              item.status,
              item.total
                ? `${Math.round((100 * item.completed) / item.total)}%`
                : '',
            )
            last = Date.now()
          }
        }
      }
    }
    console.log(`Local synthesis: ${config.model}`)
  } catch (error) {
    console.log(
      `Local model setup unavailable: ${error.message}. Queries will return clearly labelled source excerpts.`,
    )
  }
}
let existing = false
try {
  const health = await (
    await fetch(`${local}/health`, { signal: AbortSignal.timeout(2000) })
  ).json()
  if (health.service !== 'basis-backend-matvey')
    throw new Error('Port occupied')
  existing = true
} catch {}
if (!existing) {
  const child = run(process.execPath, ['src/server.mjs'])
  child.stdout.pipe(process.stdout)
  child.stderr.pipe(process.stderr)
  child.on('exit', (code) => {
    if (code) console.error('Backend stopped with code', code)
  })
}
let ready = false
for (let i = 0; i < 600; i++) {
  try {
    const health = await (
      await fetch(`${local}/health`, { signal: AbortSignal.timeout(2000) })
    ).json()
    if (health.service === 'basis-backend-matvey' && health.ready) {
      ready = true
      console.log(
        `\nReady: ${health.documents} documents, ${health.passages} passages.`,
      )
      break
    }
  } catch {}
  await wait(1000)
}
if (!ready)
  throw new Error('Backend did not become ready. Check the messages above.')
let tunnel
let opened = false
function show(base) {
  // Keep the owner's browser origin stable across quick-tunnel restarts.
  const url = connectionUrl(
    process.env.FRONTEND_URL || local + '/app',
    process.env.FRONTEND_URL ? base : local,
  )
  const remoteFrontend = connectionUrl(base + '/app', base)
  writeFileSync(
    resolve(stateDir, 'connection.json'),
    JSON.stringify(
      { url: base, key: config.token, frontend: url, remoteFrontend },
      null,
      2,
    ),
  )
  console.log(`\nOpen Basis with this connection:\n${url}\n`)
  if (base !== local)
    console.log(`Remote connection (keep private):\n${remoteFrontend}\n`)
  if (!opened) {
    opened = true
    open(url)
  }
}
const cloudflared =
  process.env.CLOUDFLARED_PATH ||
  (existsSync('C:/Program Files (x86)/cloudflared/cloudflared.exe')
    ? 'C:/Program Files (x86)/cloudflared/cloudflared.exe'
    : 'cloudflared')
console.log('Starting an authenticated HTTPS development tunnel…')
tunnel = run(cloudflared, [
  'tunnel',
  '--url',
  local,
  '--no-autoupdate',
  '--protocol',
  'http2',
])
let announced = false
const parse = (chunk) => {
  const message = chunk.toString()
  process.stdout.write(message)
  const url = message.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)?.[0]
  if (url && !announced) {
    announced = true
    setTimeout(() => show(url), 4000)
  }
}
tunnel.stdout.on('data', parse)
tunnel.stderr.on('data', parse)
tunnel.on('error', () => {
  console.log('\nHTTPS tunnel unavailable. Local access still works.')
  show(local)
})
tunnel.on('exit', (code) => {
  if (!announced) {
    console.log(
      `Tunnel exited (${code}). Using loopback; a public website may ask for local-network permission.`,
    )
    show(local)
  }
})
setTimeout(() => {
  if (!announced) {
    console.log(
      'Still waiting for HTTPS. You can use this local connection in the meantime:',
    )
    show(local)
  }
}, 25000).unref()

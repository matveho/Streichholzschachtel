import { spawn, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import {
  existsSync,
  readFileSync,
  writeFileSync,
  renameSync,
  mkdirSync,
  openSync,
  closeSync,
  unlinkSync,
  readdirSync,
  statfsSync,
  realpathSync,
} from 'node:fs'
import { resolve, basename, dirname } from 'node:path'
import { homedir } from 'node:os'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { createInterface } from 'node:readline/promises'
import { config, root, stateDir } from './src/config.mjs'
import {
  validateFrontendDirectory,
  readFrontendLocation,
  publishFrontend,
  frontendPointer,
} from './src/frontend-location.mjs'

const run = promisify(execFile)
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
export function validPort(value) {
  const port = Number(value)
  if (
    !Number.isInteger(port) ||
    port < 1024 ||
    port > 65535 ||
    [11434, 11435, 11436].includes(port)
  )
    throw new Error(
      'Choose a backend/gateway port between 1024 and 65535, outside model ports.',
    )
  return port
}
const apiPort = validPort(process.env.BASIS_CONTROL_API_PORT || config.port)
const gatewayPort = validPort(
  process.env.BASIS_CONTROL_GATEWAY_PORT ||
    (apiPort === 8787 ? 8789 : apiPort + 2),
)
if (apiPort === gatewayPort)
  throw new Error('API and gateway ports must be different.')
const apiBase = `http://127.0.0.1:${apiPort}`
const gatewayBase = `http://127.0.0.1:${gatewayPort}`
const localApp = gatewayBase + '/app/#home'
const logsDir = resolve(stateDir, `control-logs-${apiPort}`)
const stateFile = resolve(stateDir, `control-${apiPort}.json`)
const lockFile = resolve(stateDir, `control-${apiPort}.lock`)
const repo = resolve(root, '..')
mkdirSync(logsDir, { recursive: true })
function load() {
  try {
    return JSON.parse(readFileSync(stateFile, 'utf8'))
  } catch {
    return { profile: 'offline', processes: {} }
  }
}
function save(state) {
  writeFileSync(stateFile + '.tmp', JSON.stringify(state, null, 2))
  renameSync(stateFile + '.tmp', stateFile)
}
async function locked(action, file = lockFile) {
  if (existsSync(file)) {
    let alive = true
    try {
      const pid = Number(readFileSync(file, 'utf8'))
      process.kill(pid, 0)
    } catch {
      alive = false
    }
    if (alive)
      throw new Error(
        'Another basis start/stop operation is in progress. Try Status in a moment.',
      )
    unlinkSync(file)
  }
  const fd = openSync(file, 'wx')
  writeFileSync(fd, String(process.pid))
  closeSync(fd)
  try {
    return await action()
  } finally {
    if (existsSync(file)) unlinkSync(file)
  }
}
async function probe(base, path = '/health') {
  try {
    const response = await fetch(base + path, {
      signal: AbortSignal.timeout(2500),
    })
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}
async function portOwner(port) {
  if (process.platform !== 'win32')
    throw new Error('Process controls currently support Windows only.')
  const script = `$c=Get-NetTCPConnection -State Listen -LocalPort ${validPort(port)} -ErrorAction SilentlyContinue | Select-Object -First 1; if($c) { Get-CimInstance Win32_Process -Filter "ProcessId=$($c.OwningProcess)" | Select-Object ProcessId,Name,CommandLine | ConvertTo-Json -Compress }; exit 0`
  const { stdout } = await run(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', script],
    { windowsHide: true },
  )
  return stdout.trim() ? JSON.parse(stdout) : null
}
export function isBasisProcess(owner, role) {
  if (!owner || owner.Name?.toLowerCase() !== 'node.exe') return false
  const command = owner.CommandLine || ''
  const script =
    role === 'api'
      ? /(?:^|[\\/\s])src[\\/]server\.mjs(?:["\s]|$)/i
      : /(?:^|[\\/\s])demo-gateway\.mjs(?:["\s]|$)/i
  return (
    script.test(command) &&
    (command.includes(root.replace(/[\\/]$/, '')) ||
      /(?:^|\s)(?:state[\\/]demo-engine[\\/])?src[\\/]server\.mjs(?:\s|$)/i.test(
        command,
      ) ||
      (role === 'gateway' && /\sdem[o]-gateway\.mjs(?:\s|$)/i.test(command)))
  )
}
function spawnLogged(role, command, args, env = {}, cwd = root) {
  const stdout = openSync(resolve(logsDir, `${role}.log`), 'a')
  const stderr = openSync(resolve(logsDir, `${role}-error.log`), 'a')
  try {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      windowsHide: true,
      detached: true,
      stdio: ['ignore', stdout, stderr],
    })
    child.on('error', (error) => console.error(`${role}: ${error.message}`))
    if (!child.pid)
      throw new Error(
        `Could not start ${role}. Check available memory and the service logs.`,
      )
    child.unref()
    return { pid: child.pid, startedAt: new Date().toISOString() }
  } finally {
    closeSync(stdout)
    closeSync(stderr)
  }
}
async function stopRole(role, port) {
  const owner = await portOwner(port)
  if (!owner) return
  if (!isBasisProcess(owner, role))
    throw new Error(
      `Port ${port} belongs to another application. It was not stopped.`,
    )
  await run('taskkill.exe', ['/PID', String(owner.ProcessId), '/T', '/F'], {
    windowsHide: true,
  })
  for (let i = 0; i < 20; i++) {
    if (!(await probe(`http://127.0.0.1:${port}`))) return
    await wait(150)
  }
  throw new Error(`${role} did not stop. Inspect the logs before restarting.`)
}
function sourceFingerprint() {
  const hash = createHash('sha256')
  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = resolve(dir, entry.name)
      if (entry.isDirectory()) visit(path)
      else if (/\.(?:ts|tsx|css|svg)$/.test(entry.name))
        hash.update(path).update(readFileSync(path))
    }
  }
  visit(resolve(repo, 'src'))
  for (const file of [
    'package.json',
    'package-lock.json',
    'index.html',
    'vite.config.ts',
  ])
    hash.update(readFileSync(resolve(repo, file)))
  return hash.digest('hex')
}
async function buildFrontend(force = false) {
  return locked(
    () => buildFrontendLocked(force),
    resolve(stateDir, 'frontend-build.lock'),
  )
}
export function managedFrontendPaths(frontend) {
  const legacy = validateFrontendDirectory(frontend)
  return { legacy, buildRoot: dirname(legacy), pointer: frontendPointer }
}
async function buildFrontendLocked(force = false) {
  const state = load(),
    fingerprint = sourceFingerprint()
  if (
    !force &&
    state.frontendFingerprint === fingerprint &&
    existsSync(resolve(readFrontendLocation(), 'index.html'))
  )
    return
  const vite = resolve(repo, 'node_modules/vite/bin/vite.js')
  if (!existsSync(vite))
    throw new Error(
      'Frontend dependencies are missing. Choose Repair dependencies, then start again.',
    )
  console.log(
    'Building the local interface before changing any running service...',
  )
  const frontend = resolve(stateDir, 'frontend')
  const paths = managedFrontendPaths(
    existsSync(frontend) ? realpathSync(frontend) : frontend,
  )
  const staging = validateFrontendDirectory(
    resolve(
      paths.buildRoot,
      `basis-frontend-${Date.now().toString(36)}-${process.pid}`,
    ),
  )
  await new Promise((done, reject) => {
    const child = spawn(
      process.execPath,
      [vite, 'build', '--outDir', staging],
      { cwd: repo, windowsHide: true, stdio: 'inherit' },
    )
    child.once('error', reject)
    child.once('exit', (code) =>
      code === 0
        ? done()
        : reject(
            new Error(
              'Frontend build failed. The existing backend was left running.',
            ),
          ),
    )
  })
  publishFrontend(staging, fingerprint)
  save({ ...load(), frontendFingerprint: fingerprint })
}
async function localModelReady() {
  const url = new URL(config.ollamaUrl)
  if (
    !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
    url.protocol !== 'http:'
  )
    throw new Error('The local review profile requires a loopback Ollama URL.')
  let tags = await probe(config.ollamaUrl, '/api/tags')
  if (!tags && url.port === '11435') {
    const exe = resolve(homedir(), 'AppData/Local/Programs/Ollama/ollama.exe')
    if (existsSync(exe)) {
      const state = load()
      state.processes.ollama = spawnLogged('ollama', exe, ['serve'], {
        OLLAMA_HOST: '127.0.0.1:11435',
        OLLAMA_MODELS: resolve(stateDir, 'models'),
        OLLAMA_NUM_PARALLEL: '1',
        OLLAMA_MAX_LOADED_MODELS: '1',
      })
      save(state)
      for (let i = 0; i < 15 && !tags; i++) {
        await wait(300)
        tags = await probe(config.ollamaUrl, '/api/tags')
      }
    }
  }
  return tags?.models?.some((m) => m.name === config.model) || false
}
async function ensureGateway(upgrade = false) {
  const owner = await portOwner(gatewayPort)
  if (owner) {
    if (!isBasisProcess(owner, 'gateway'))
      throw new Error(`Port ${gatewayPort} is occupied by another application.`)
    const version = await probe(gatewayBase, '/_basis/gateway')
    if (
      version?.service === 'basis-gateway' &&
      version.version >= 9 &&
      version.targetPort === apiPort
    )
      return
    if (!upgrade) {
      console.log(
        'Keeping the existing gateway online. Choose Restart to load the updated local interface and gateway.',
      )
      return
    }
    console.log('Updating the basis gateway; the existing API stays running.')
    await stopRole('gateway', gatewayPort)
  }
  const state = load()
  state.processes.gateway = spawnLogged(
    'gateway',
    process.execPath,
    [resolve(root, 'demo-gateway.mjs')],
    {
      BASIS_GATEWAY_TARGET: apiBase,
      BASIS_GATEWAY_PORT: String(gatewayPort),
    },
  )
  save(state)
}
async function start(restart = false) {
  return locked(async () => {
    if (Number(process.versions.node.split('.')[0]) < 24)
      throw new Error('Node.js 24 or newer is required.')
    if (!existsSync(resolve(root, 'node_modules/pdfjs-dist/package.json')))
      throw new Error(
        'Backend dependencies missing. Choose Repair dependencies.',
      )
    const existing = await probe(apiBase)
    if (existing?.service === 'basis-backend-matvey' && !restart) {
      const owner = await portOwner(apiPort)
      if (!isBasisProcess(owner, 'api'))
        throw new Error(
          'The existing service is not a recognized basis process; it was left untouched.',
        )
      const state = load()
      state.processes.api = {
        pid: owner.ProcessId,
        startedAt: state.processes.api?.startedAt || new Date().toISOString(),
        adopted: true,
      }
      state.stopped = false
      save(state)
      await ensureGateway()
      console.log(
        'basis is already running. Restart loads the latest source and documents.',
      )
      return
    }
    const owner = await portOwner(apiPort)
    if (owner && !isBasisProcess(owner, 'api'))
      throw new Error(
        `Port ${apiPort} is used by another application. No process was stopped.`,
      )
    if (process.env.BASIS_CONTROL_SKIP_BUILD !== '1') await buildFrontend()
    // Import the backend dependency graph without starting a listening server.
    await run(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        "await import('./src/answer.mjs'); await import('./src/indexer.mjs')",
      ],
      { cwd: root, windowsHide: true },
    )
    const state = load()
    let provider = state.profile === 'local' ? 'ollama' : 'extractive'
    if (provider === 'ollama' && !(await localModelReady())) {
      console.log(
        'Local review model unavailable. Starting offline source search; no model is downloaded automatically.',
      )
      provider = 'extractive'
    }
    Object.assign(state, load())
    if (owner) await stopRole('api', apiPort)
    state.processes.api = spawnLogged(
      'api',
      process.execPath,
      [resolve(root, 'src/server.mjs')],
      {
        PORT: String(apiPort),
        GENERATION_PROVIDER: provider,
        LOCAL_SYNTHESIS: provider === 'ollama' ? '1' : '0',
        EXTRACTIVE_ONLY: provider === 'extractive' ? '1' : '0',
        BASIS_DEBUG_RETRIEVAL: '0',
        ENTAILMENT_MODEL_DIR: '',
        ENTAILMENT_PYTHON: '',
      },
    )
    state.stopped = false
    state.activeProvider = provider
    save(state)
    await ensureGateway(true)
    console.log(
      `Started ${provider === 'extractive' ? 'offline source search' : 'local model review'}. Indexing runs in the background.`,
    )
    console.log(`Local interface: ${localApp}`)
  })
}
async function stop() {
  return locked(async () => {
    const state = load()
    state.stopped = true
    save(state)
    await stopRole('gateway', gatewayPort)
    await stopRole('api', apiPort)
    console.log(
      'Backend and gateway stopped. The user Ollama service on 11434 was not touched.',
    )
  })
}
async function status() {
  const health = await probe(apiBase),
    gateway = await probe(gatewayBase)
  const record = load().processes?.api
  let starting = false
  if (
    !health &&
    record?.pid &&
    Date.now() - Date.parse(record.startedAt) < 120000
  ) {
    try {
      process.kill(record.pid, 0)
      starting = true
    } catch {}
  }
  console.log(
    `\nAPI ${apiPort}: ${health?.service === 'basis-backend-matvey' ? (health.ready ? (health.failures ? 'READY WITH INDEXING ERRORS' : 'READY') : 'INDEXING') : starting ? 'STARTING - check status again shortly' : 'OFFLINE'}`,
  )
  if (health)
    console.log(
      `${health.stage} | ${health.completed}/${health.total} documents | ${health.passages || 0} passages | ${health.failures || 0} failures | ${health.provider}`,
    )
  console.log(
    `Gateway ${gatewayPort}: ${gateway?.service === 'basis-backend-matvey' ? 'CONNECTED' : 'OFFLINE'}`,
  )
  console.log(`Selected profile: ${load().profile || 'offline'} | ${localApp}`)
  return { api: health, gateway }
}
function open(url) {
  spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url], {
    windowsHide: true,
    detached: true,
    stdio: 'ignore',
  }).unref()
}
async function diagnose() {
  await status()
  const disk = statfsSync(root),
    freeMB = Math.round((disk.bavail * disk.bsize) / 1048576)
  console.log(
    `\nFree workspace drive space: ${freeMB} MB${freeMB < 512 ? ' - low; keep model and PDF caches on E:' : ''}`,
  )
  console.log(
    `PDF extractor: ${existsSync(resolve(root, '.venv/Scripts/python.exe')) ? 'local Python available' : 'PDF.js fallback; OCR needs Python/Tesseract'}`,
  )
  console.log(
    `OCR: ${existsSync('C:/Program Files/Tesseract-OCR/tesseract.exe') ? 'Tesseract installed' : 'check TESSERACT_PATH or install Tesseract for scans'}`,
  )
  console.log(
    `Connection key file: ${existsSync(resolve(stateDir, 'session-token.txt')) ? 'present (value hidden)' : 'missing'}`,
  )
  console.log(`PDF cache: ${config.pdfCacheDir}`)
  console.log(`Logs: ${logsDir}`)
  const site = new URL(config.frontendUrl).origin
  const remote = await probe(site, '/local-api/health')
  console.log(
    `Public site: ${remote?.service === 'basis-backend-matvey' && remote.ready ? 'CONNECTED' : 'NOT VERIFIED - check HTTPS tunnel / Vercel rewrite'} (${site})`,
  )
  for (const role of ['api', 'gateway']) {
    const path = resolve(logsDir, `${role}-error.log`)
    if (existsSync(path)) {
      const lines = readFileSync(path, 'utf8')
        .split(/\r?\n/)
        .filter(Boolean)
        .slice(-6)
      if (lines.length)
        console.log(`\n${role} recent errors:\n${lines.join('\n')}`)
    }
  }
}
async function repairDependencies() {
  for (const cwd of [repo, root]) {
    console.log(`Installing locked dependencies in ${basename(cwd)}...`)
    await new Promise((done, reject) => {
      const child = spawn('cmd.exe', ['/d', '/c', 'npm ci'], {
        cwd,
        windowsHide: true,
        stdio: 'inherit',
      })
      child.once('error', reject)
      child.once('exit', (code) =>
        code === 0
          ? done()
          : reject(
              new Error(
                'Dependency repair failed. Existing services were not stopped.',
              ),
            ),
      )
    })
  }
}
async function publicConnection() {
  const script = `$p=Get-CimInstance Win32_Process -Filter "Name='cloudflared.exe'" | Where-Object { $_.CommandLine -like '*--url*${gatewayBase}*' }; @($p | Select-Object -ExpandProperty ProcessId) | ConvertTo-Json -Compress`
  const { stdout } = await run(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', script],
    { windowsHide: true },
  )
  if (JSON.parse(stdout.trim() || '[]')?.length || Number(stdout) > 0) {
    console.log(
      'An HTTPS tunnel already targets this gateway. Keeping it running. Use Diagnostics to verify Vercel.',
    )
    return
  }
  const exe =
    process.env.CLOUDFLARED_PATH ||
    'C:/Program Files (x86)/cloudflared/cloudflared.exe'
  if (!existsSync(exe))
    throw new Error(
      'cloudflared is missing. Local basis still works; set CLOUDFLARED_PATH to enable HTTPS.',
    )
  const state = load()
  const log = resolve(logsDir, 'tunnel-error.log')
  const logOffset = existsSync(log) ? readFileSync(log, 'utf8').length : 0
  state.processes.tunnel = spawnLogged('tunnel', exe, [
    'tunnel',
    '--url',
    gatewayBase,
    '--no-autoupdate',
    '--protocol',
    'http2',
  ])
  save(state)
  console.log('Starting HTTPS. Waiting for its public address...')
  const since = Date.now()
  for (let i = 0; i < 45; i++) {
    await wait(1000)
    const urls = existsSync(log)
      ? [
          ...readFileSync(log, 'utf8')
            .slice(logOffset)
            .matchAll(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/g),
        ]
      : []
    const url = urls.at(-1)?.[0]
    if (url) {
      save({ ...load(), publicUrl: url, tunnelStartedAt: since })
      console.log(
        `HTTPS gateway: ${url}\nThe Vercel rewrite must target this hostname. Choose Publish site connection to update it.`,
      )
      return
    }
  }
  throw new Error(
    'HTTPS address not received yet. Local basis still works. Inspect tunnel-error.log, then try again.',
  )
}
async function publishConnection() {
  const url = load().publicUrl
  if (!/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(url || ''))
    throw new Error(
      'Start an HTTPS connection first; no verified new hostname is recorded.',
    )
  const health = await probe(url)
  if (health?.service !== 'basis-backend-matvey' || !health.ready)
    throw new Error(
      'The new HTTPS backend is not ready. The Vercel configuration was not changed.',
    )
  const file = resolve(repo, 'vercel.json'),
    original = readFileSync(file, 'utf8'),
    value = JSON.parse(original)
  const rewrite = value.rewrites?.find((r) => r.source === '/local-api/:path*')
  if (!rewrite)
    throw new Error(
      'No existing local-api rewrite found. Refusing to overwrite the Vercel configuration.',
    )
  rewrite.destination = url + '/:path*'
  writeFileSync(file, JSON.stringify(value, null, 2) + '\n')
  try {
    await new Promise((done, reject) => {
      const child = spawn('cmd.exe', ['/d', '/c', 'vercel --prod --yes'], {
        cwd: repo,
        windowsHide: true,
        stdio: 'inherit',
      })
      child.once('error', reject)
      child.once('exit', (code) =>
        code === 0
          ? done()
          : reject(
              new Error(
                'Vercel deployment failed. Check CLI login and deployment logs.',
              ),
            ),
      )
    })
  } catch (error) {
    writeFileSync(file, original)
    throw error
  }
  console.log(
    'Published the HTTPS connection. Commit the vercel.json update with the next source checkpoint.',
  )
}
async function checkPresentation() {
  console.log(
    'Checking the local presentation without resetting project state...',
  )
  await new Promise((done, reject) => {
    const child = spawn(process.execPath, ['tests/presentation.smoke.mjs'], {
      cwd: root,
      env: { ...process.env, BASIS_FRONTEND_URL: gatewayBase + '/app' },
      windowsHide: true,
      stdio: 'inherit',
    })
    child.once('error', reject)
    child.once('exit', (code) =>
      code === 0
        ? done()
        : reject(
            new Error(
              'Presentation check failed. Use Troubleshoot and Open logs.',
            ),
          ),
    )
  })
}
export async function main() {
  const command = process.argv[2]
  if (command) {
    const commands = {
      '--start': () => start(),
      '--restart': () => start(true),
      '--reindex': () => start(true),
      '--stop': stop,
      '--status': status,
      '--diagnose': diagnose,
      '--build': () => buildFrontend(true),
      '--https': publicConnection,
      '--publish': publishConnection,
      '--check-demo': checkPresentation,
    }
    if (!commands[command]) throw new Error('Unknown control command.')
    await commands[command]()
    return
  }
  console.log(
    '\nBASIS BACKEND CONTROLS\nClosing these controls leaves the backend running. Stop explicitly when finished.\n',
  )
  try {
    await start()
  } catch (error) {
    console.error(error.message)
  }
  await status()
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  let misses = 0,
    recoveries = [],
    recovering = false
  const watchdog = setInterval(async () => {
    const state = load()
    if (state.stopped || !state.processes.api || recovering) return
    const [api, gateway] = await Promise.all([
      probe(apiBase),
      probe(gatewayBase, '/_basis/gateway'),
    ])
    if (
      api?.service === 'basis-backend-matvey' &&
      gateway?.service === 'basis-gateway' &&
      gateway.targetPort === apiPort
    ) {
      misses = 0
      return
    }
    if (++misses < 3) return
    if (load().stopped) return
    recoveries = recoveries.filter((t) => Date.now() - t < 600000)
    if (recoveries.length >= 3) return
    recovering = true
    recoveries.push(Date.now())
    try {
      console.log(
        '\nBackend or gateway unavailable; attempting automatic recovery...',
      )
      await start()
      misses = 0
    } catch (error) {
      console.error(error.message)
    } finally {
      recovering = false
    }
  }, 10000)
  try {
    for (;;) {
      console.log(
        '\n1 start   2 restart / index new documents   3 stop   4 status\n5 open basis   6 troubleshoot   7 open logs   8 rebuild interface\n9 switch offline / local review   D repair dependencies\nT check demo readiness   H HTTPS connection   P publish site connection   Q close controls',
      )
      const choice = (await rl.question('\nBasis > ')).trim().toLowerCase()
      try {
        if (choice === 'q') break
        if (choice === '1') await start()
        else if (choice === '2') await start(true)
        else if (choice === '3') await stop()
        else if (choice === '4' || !choice) await status()
        else if (choice === '5') {
          const gateway = await probe(gatewayBase, '/_basis/gateway')
          open(
            gateway?.version >= 3
              ? localApp
              : new URL(config.frontendUrl).origin + '/#home',
          )
        } else if (choice === '6') await diagnose()
        else if (choice === '7')
          spawn('explorer.exe', [logsDir], {
            windowsHide: true,
            stdio: 'ignore',
          }).unref()
        else if (choice === '8') await buildFrontend(true)
        else if (choice === '9') {
          const state = load()
          state.profile = state.profile === 'local' ? 'offline' : 'local'
          save(state)
          console.log(`Selected ${state.profile}. Restarting...`)
          await start(true)
        } else if (choice === 'd') await repairDependencies()
        else if (choice === 'h') await publicConnection()
        else if (choice === 'p') await publishConnection()
        else if (choice === 't') await checkPresentation()
        else console.log('Choose one of the displayed controls.')
      } catch (error) {
        console.error(
          `\n${error.message}\nUse Troubleshoot or Open logs for details.`,
        )
      }
    }
  } finally {
    clearInterval(watchdog)
    rl.close()
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })

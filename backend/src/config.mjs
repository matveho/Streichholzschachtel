import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { randomBytes } from 'node:crypto'

export const root = fileURLToPath(new URL('../', import.meta.url))
if (existsSync(resolve(root, '.env'))) {
  for (const line of readFileSync(resolve(root, '.env'), 'utf8').split(
    /\r?\n/,
  )) {
    const match = line.match(/^([A-Z_]+)\s*=\s*(.*)$/)
    if (match && process.env[match[1]] === undefined)
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
  }
}
export const stateDir = resolve(process.env.BASIS_STATE_DIR || resolve(root, 'state'))
mkdirSync(stateDir, { recursive: true })
const tokenFile = resolve(stateDir, 'session-token.txt')
if (!existsSync(tokenFile))
  writeFileSync(tokenFile, randomBytes(32).toString('base64url'), {
    mode: 0o600,
  })
export const config = {
  pdfCacheDir: resolve(process.env.PDF_CACHE_DIR || stateDir),
  port: Number(process.env.PORT || 8787),
  token: process.env.BASIS_TOKEN || readFileSync(tokenFile, 'utf8').trim(),
  ollamaUrl: process.env.OLLAMA_URL || 'http://127.0.0.1:11435',
  model: process.env.OLLAMA_MODEL || 'qwen3.5:35b-a3b-q4_K_M',
  maxFindingsPerCheck: Number(process.env.LOCAL_MAX_FINDINGS_PER_CHECK || 6),
  localReasoning: process.env.LOCAL_REASONING === '1',
  localReasoningTokens: Number(process.env.LOCAL_REASONING_TOKENS || 4096),
  localContextTokens: Number(process.env.LOCAL_CONTEXT_TOKENS || 16384),
  provider: process.env.GENERATION_PROVIDER || 'ollama',
  llamaUrl: process.env.LOCAL_MODEL_URL || 'http://127.0.0.1:11436',
  llamaModel: process.env.LOCAL_MODEL_NAME || 'basis-qwen35',
  llamaKeyFile: process.env.LOCAL_MODEL_KEY_FILE || '',
  llamaManifest: process.env.LOCAL_MODEL_MANIFEST || '',
  releaseForVerifier: process.env.LOCAL_MODEL_RELEASE_FOR_VERIFIER === '1',
  gatewayModel: process.env.AI_GATEWAY_MODEL || 'google/gemini-4-argon',
  extractiveOnly: process.env.EXTRACTIVE_ONLY === '1',
  localSynthesis: process.env.LOCAL_SYNTHESIS === '1',
  localSynthesisPolicy: process.env.LOCAL_SYNTHESIS_POLICY || 'all',
  entailmentDir: process.env.ENTAILMENT_MODEL_DIR || '',
  entailmentPython: process.env.ENTAILMENT_PYTHON || '',
  frontendUrl:
    process.env.FRONTEND_URL || 'https://streichholzschachtel.vercel.app',
  extraOrigins: (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
}
if (
  !['extractive', 'ollama', 'llamacpp', 'gateway'].includes(
    config.provider,
  )
)
  throw new Error('Unknown GENERATION_PROVIDER.')
if (config.extractiveOnly) config.provider = 'extractive'

export const knownFiles = {
  'design-guidelines.pdf': {
    label: 'Vol. 3-03',
    title: 'Design Guidelines',
    edition: 'May 2025',
    source:
      'https://www.epcor.com/content/dam/epcor/documents/supporting-documents/volume-3-03-design-guidelines%E2%80%8B%E2%80%8B.pdf',
  },
  'stormwater-manual.pdf': {
    label: 'Vol. 3-02',
    title: 'Stormwater Management & Design Manual',
    edition: 'April 2025',
    source:
      'https://www.epcor.com/content/dam/epcor/documents/supporting-documents/volume-3-02-stormwater-management-and-design-manual.pdf',
  },
  'lid-infill-guidelines.pdf': {
    label: 'Infill LID',
    title: 'Corner Lot Infill LID Guidelines',
    edition: 'May 2024',
    source:
      'https://www.edmonton.ca/sites/default/files/public-files/LID-Guidelines-for-Corner-Lot-Infill-Developments.pdf',
  },
  'lid-construction-guide.pdf': {
    label: 'LID CIM',
    title: 'LID Construction, Inspection & Maintenance',
    edition: 'May 2016',
    source:
      'https://www.edmonton.ca/sites/default/files/public-files/assets/LID%20CIM%20Guide.pdf',
  },
  'drainage-connection-guide.pdf': {
    label: 'Servicing',
    title: 'Drainage Customer Connection Guide',
    edition: 'May 2023',
    source:
      'https://www.epcor.com/content/dam/epcor/documents/supporting-documents/water-drainage_customer-connection-guide.pdf',
  },
}

for (const [name, min, max] of [['maxFindingsPerCheck', 2, 8],
  ['localReasoningTokens', 256, 16384], ['localContextTokens', 4096, 65536]]) {
  if (!Number.isInteger(config[name]) || config[name] < min || config[name] > max)
    throw new Error(`Invalid ${name}; expected an integer between ${min} and ${max}.`)
}

if (!['all', 'comparisons', 'demo'].includes(config.localSynthesisPolicy))
  throw new Error('LOCAL_SYNTHESIS_POLICY must be all, comparisons or demo.')

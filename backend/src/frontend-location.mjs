import { existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const state = fileURLToPath(new URL('../state/', import.meta.url))
export const frontendPointer = resolve(state, 'frontend-current.json')
export function validateFrontendDirectory(value) {
  const directory = resolve(value)
  const allowed = [
    state,
    resolve(process.env.BASIS_ASSET_CACHE_DIR || 'E:/Basis-model-cache'),
  ]
  if (
    !allowed.some((base) =>
      directory.toLowerCase().startsWith((resolve(base) + sep).toLowerCase()),
    )
  )
    throw new Error(
      'Frontend output is outside the managed state/cache folders. Set BASIS_ASSET_CACHE_DIR to its intended cache root.',
    )
  return directory
}
export function readFrontendLocation() {
  try {
    const pointer = JSON.parse(readFileSync(frontendPointer, 'utf8'))
    const directory = validateFrontendDirectory(pointer.directory)
    if (existsSync(resolve(directory, 'index.html'))) return directory
  } catch {
    /* A missing pointer retains the known existing bundle. */
  }
  return resolve(state, 'frontend')
}
export function publishFrontend(directory, fingerprint) {
  validateFrontendDirectory(directory)
  if (!existsSync(resolve(directory, 'index.html')))
    throw new Error('The new frontend bundle is incomplete.')
  const previous = readFrontendLocation()
  const temporary = frontendPointer + '.tmp-' + process.pid
  writeFileSync(temporary, JSON.stringify({ directory, previous, fingerprint }))
  renameSync(temporary, frontendPointer)
}

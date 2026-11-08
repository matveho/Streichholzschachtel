import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  renameSync,
  rmSync,
} from 'node:fs'
import { resolve, basename, sep } from 'node:path'
import { randomUUID } from 'node:crypto'
import { stateDir } from './config.mjs'

const root = resolve(stateDir, 'project-documents')
export function importFolder(id) {
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(id)) throw new Error('Invalid project ID')
  const folder = resolve(root, id)
  if (!folder.startsWith(root + sep))
    throw new Error('Unsafe project directory')
  return folder
}
function manifest(id) {
  const file = resolve(importFolder(id), 'imports.json')
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : []
}
function save(id, rows) {
  const file = resolve(importFolder(id), 'imports.json')
  writeFileSync(file + '.tmp', JSON.stringify(rows, null, 2))
  renameSync(file + '.tmp', file)
}
export function importedDocuments() {
  const files = new Map()
  if (!existsSync(root)) return files
  for (const id of readdirSync(root).filter((id) =>
    /^[a-zA-Z0-9-]{1,80}$/.test(id),
  )) {
    for (const row of manifest(id)) {
      if (!/^[a-f0-9-]+\.pdf$/.test(row.file)) continue
      const path = resolve(importFolder(id), row.file)
      if (existsSync(path)) files.set(path, { ...row, ownerProjectId: id })
    }
  }
  return files
}
export function stageImport(id, input) {
  if (
    typeof input.name !== 'string' ||
    !input.name.toLowerCase().endsWith('.pdf') ||
    typeof input.content !== 'string'
  )
    throw Object.assign(new Error('Choose a PDF document.'), { status: 400 })
  if (input.content.length > 16 * 1024 * 1024)
    throw Object.assign(new Error('PDF files must be 12 MB or smaller.'), {
      status: 413,
    })
  const bytes = Buffer.from(input.content, 'base64')
  if (
    bytes.length > 12 * 1024 * 1024 ||
    bytes.subarray(0, 5).toString() !== '%PDF-'
  )
    throw Object.assign(new Error('The file is not a supported PDF.'), {
      status: 400,
    })
  const folder = importFolder(id)
  mkdirSync(folder, { recursive: true })
  const row = {
    file: randomUUID() + '.pdf',
    name: basename(input.name.replaceAll('\\', '/')).slice(0, 180),
    category: guessCategory(input.name),
    pending: true,
  }
  writeFileSync(resolve(folder, row.file), bytes)
  save(id, [...manifest(id), row])
  return resolve(folder, row.file)
}
export function discardImport(id, path) {
  if (!existsSync(importFolder(id))) return
  const rows = manifest(id).filter(
    (r) => resolve(importFolder(id), r.file) !== path,
  )
  save(id, rows)
  rmSync(path, { force: true })
}
export function finishImport(id, path) {
  save(
    id,
    manifest(id).map((r) =>
      resolve(importFolder(id), r.file) === path ? { ...r, pending: false } : r,
    ),
  )
}
export function removeProjectImports(id) {
  rmSync(importFolder(id), { recursive: true, force: true })
}
function guessCategory(name) {
  if (/client|brief|requirement/i.test(name)) return 'client'
  if (/design|drawing|layout|plan\b/i.test(name)) return 'design'
  if (/report|calculat|geotech|survey|assessment/i.test(name)) return 'report'
  return 'supporting'
}

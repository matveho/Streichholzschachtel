import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
} from 'node:fs'
import { resolve } from 'node:path'
import { root, stateDir } from './config.mjs'
import { demoProjects } from '../demo/manifest.mjs'

export const demoDocumentDirectory = resolve(stateDir, 'demo-documents')

// Tracked originals remain immutable; rebuild disposable runtime copies on start/reset.
export function restoreDemoDocuments(
  directory = demoDocumentDirectory,
  projectId,
) {
  mkdirSync(directory, { recursive: true })
  for (const project of demoProjects.filter(
    (p) => !projectId || p.id === projectId,
  )) {
    for (const document of project.documents) {
      const original = readFileSync(resolve(root, 'output/pdf', document.file))
      const target = resolve(directory, document.file)
      if (existsSync(target) && readFileSync(target).equals(original)) continue
      writeFileSync(target + '.tmp', original)
      renameSync(target + '.tmp', target)
    }
  }
  return directory
}

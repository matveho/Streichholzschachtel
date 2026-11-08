import test from 'node:test'
import assert from 'node:assert/strict'
import { writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { stateDir } from '../src/config.mjs'
import {
  readPdfCache,
  writePdfCache,
  pdfCacheVersion,
  reusablePdfCache,
} from '../src/indexer.mjs'
import { validPort, isBasisProcess, managedFrontendPaths } from '../control.mjs'

test('control ports reject invalid values and protect model service ports', () => {
  for (const value of ['not-a-port', 0, -1, 65536, 11434, 11435, 11436])
    assert.throws(() => validPort(value))
  assert.equal(validPort('8787'), 8787)
})
test('restart controls recognize basis servers and reject unrelated processes', () => {
  assert.equal(
    isBasisProcess(
      {
        Name: 'node.exe',
        CommandLine: 'node state/demo-engine/src/server.mjs',
      },
      'api',
    ),
    true,
  )
  assert.equal(
    isBasisProcess(
      { Name: 'node.exe', CommandLine: 'node demo-gateway.mjs' },
      'gateway',
    ),
    true,
  )
  assert.equal(
    isBasisProcess({ Name: 'ollama.exe', CommandLine: 'ollama serve' }, 'api'),
    false,
  )
  assert.equal(
    isBasisProcess(
      { Name: 'node.exe', CommandLine: 'node another-app/server.mjs' },
      'api',
    ),
    false,
  )
  assert.equal(
    isBasisProcess(
      { Name: 'node.exe', CommandLine: 'node demo-gateway.mjs' },
      'api',
    ),
    false,
  )
})
test('frontend rebuilds stage separately and reject unowned output paths', () => {
  const paths = managedFrontendPaths('E:/Basis-model-cache/generated-frontend')
  assert.notEqual(paths.pointer, paths.legacy)
  assert.equal(paths.buildRoot, resolve('E:/Basis-model-cache'))
  assert.throws(() => managedFrontendPaths('C:/Windows/System32'))
  assert.throws(() =>
    managedFrontendPaths('E:/Basis-model-cache-not-owned/documents'),
  )
})
test('an interrupted PDF cache can be repaired without leaving a partial published file', (t) => {
  const file = resolve(stateDir, `cache-check-${randomUUID()}.json`)
  t.after(() => {
    for (const path of [file, file + '.tmp-' + process.pid])
      if (existsSync(path)) unlinkSync(path)
  })
  writeFileSync(file, '{"pages":[')
  assert.equal(readPdfCache(file), null)
  const repaired = { pages: [{ width: 612, height: 792, words: [] }] }
  writePdfCache(file, repaired)
  assert.deepEqual(readPdfCache(file), repaired)
  assert.equal(existsSync(file + '.tmp-' + process.pid), false)
})

test('native PDF extraction never reuses fallback extraction caches', () => {
  assert.notEqual(pdfCacheVersion(true), pdfCacheVersion(false))
  assert.match(pdfCacheVersion(true), /pymupdf/)
  assert.match(pdfCacheVersion(false), /pdfjs/)
})

test('installing OCR refreshes unreadable page caches while preserving usable caches', () => {
  const unreadable = { pages: [{ extraction: 'ocr-unavailable', words: [] }] }
  assert.equal(reusablePdfCache(unreadable, false), true)
  assert.equal(reusablePdfCache(unreadable, true), false)
  assert.equal(
    reusablePdfCache({ pages: [{ extraction: 'text' }] }, true),
    true,
  )
  assert.equal(reusablePdfCache(null, true), false)
})

// Publishes the 3D code-city presentation with the site build: docs/architecture is copied to
// dist/architecture, so it is served at /architecture/ next to the app. The page refers to the
// logo in public/ by a repository path, which is rewritten to where the build puts it.
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const src = 'docs/architecture'
const out = 'dist/architecture'
mkdirSync(`${out}/vendor`, { recursive: true })
cpSync(`${src}/vendor`, `${out}/vendor`, { recursive: true })
cpSync(`${src}/code-city-data.js`, `${out}/code-city-data.js`)
const html = readFileSync(`${src}/code-city-3d.html`, 'utf8').replaceAll('../../public/basis-logo.png', '../basis-logo.png')
writeFileSync(`${out}/index.html`, html)
console.log('architecture page copied to dist/architecture/')

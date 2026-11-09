import assert from 'node:assert/strict'
import {cpSync,existsSync,readFileSync,mkdirSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {publishFrontend} from '../../backend/src/frontend-location.mjs'

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..')
const source=resolve(root,'dist')
assert.ok(existsSync(resolve(source,'index.html')),'Build the current frontend before publishing')
const fingerprint=createHash('sha256').update(readFileSync(resolve(source,'index.html'))).digest('hex')
const directory=resolve(root,'backend/state/frontend-releases',Date.now()+'-'+fingerprint.slice(0,12))
mkdirSync(directory,{recursive:true});cpSync(source,directory,{recursive:true})
publishFrontend(directory,fingerprint)
console.log(JSON.stringify({published:true,directory,fingerprint}))

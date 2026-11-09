import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs'
import {resolve,dirname} from 'node:path'
import {frontendPointer,readFrontendLocation} from '../src/frontend-location.mjs'

test('an explicit isolated frontend uses its actual build and cannot silently fall back to an old interface',t=>{
 const previous=process.env.BASIS_FRONTEND_DIR
 const verification=resolve(dirname(frontendPointer),'verification')
 mkdirSync(verification,{recursive:true})
 const directory=mkdtempSync(resolve(verification,'frontend-test-'))
 t.after(()=>{if(previous===undefined)delete process.env.BASIS_FRONTEND_DIR;else process.env.BASIS_FRONTEND_DIR=previous;rmSync(directory,{recursive:true,force:true})})
 writeFileSync(resolve(directory,'index.html'),'<main>Current frontend</main>')
 process.env.BASIS_FRONTEND_DIR=directory
 assert.equal(readFrontendLocation(),directory)
 rmSync(resolve(directory,'index.html'))
 assert.throws(()=>readFrontendLocation(),/incomplete/)
 process.env.BASIS_FRONTEND_DIR='/'
 assert.throws(()=>readFrontendLocation(),/outside the managed/)
})

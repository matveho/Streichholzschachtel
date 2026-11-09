import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {randomUUID} from 'node:crypto'
import {stageImport,finishImport,importedDocuments,importFolder,setImportCategory,removeProjectImports,importCategories} from '../src/project-imports.mjs'

test('optional categories persist with legacy and repeated uploads, while omitted values retain filename guessing',t=>{
 const a='category-'+randomUUID(),b='category-'+randomUUID()
 t.after(()=>{removeProjectImports(a);removeProjectImports(b)})
 const content=Buffer.from('%PDF-1.7 category metadata fixture').toString('base64')
 const file=stageImport(a,{name:'client-brief.pdf',content,category:'reference'})
 finishImport(a,file)
 let record=importedDocuments().get(file)
 assert.equal(record.category,'reference')
 const documentId=record.documentId
 const path=resolve(importFolder(a),'imports.json')
 const legacy=JSON.parse(readFileSync(path,'utf8'));delete legacy[0].documentId
 writeFileSync(path,JSON.stringify(legacy))
 const duplicate=stageImport(a,{name:'other-design.pdf',content,category:'design'})
 finishImport(a,duplicate)
 assert.ok(JSON.parse(readFileSync(path,'utf8')).every(row=>row.category==='design'))
 for(const category of importCategories){
  setImportCategory(a,documentId,category)
  assert.equal(importedDocuments().get(file).category,category)
  assert.equal(importedDocuments().get(duplicate).category,category)
 }
 const guessed=stageImport(b,{name:'client-brief.pdf',content})
 finishImport(b,guessed)
 assert.equal(importedDocuments().get(guessed).category,'client')
 assert.notEqual(importedDocuments().get(guessed).documentId,documentId)
 assert.throws(()=>setImportCategory(b,documentId,'design'),error=>error.status===404)
 for(const category of [null,'Reference','invalid',{},0,'']){
  assert.throws(()=>stageImport(a,{name:'new.pdf',content,category}),error=>error.status===400)
  assert.throws(()=>setImportCategory(a,documentId,category),error=>error.status===400)
 }
 assert.equal(JSON.parse(readFileSync(path,'utf8')).length,2)
})

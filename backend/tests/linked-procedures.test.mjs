import test from 'node:test'
import assert from 'node:assert/strict'
import { linkedProcedureEvidence as linked } from '../src/linked-procedures.mjs'
const unit = (excerpt, extra = {}) => ({ excerpt, heading: '5.16.2 LID Soil Compaction and Infiltration · Guelph Permeameter testing', scope: ['5.16.2 LID Soil Compaction and Infiltration'], passage: { doc: 'manual', page: 97 }, ...extra })
const selected = unit('Testing must be conducted at a minimum of two locations.')
test('testing selection retains bounded companion clauses from the actual procedure', () => {
 const qc = unit('A QA/QC test must be completed adjacent to an aforementioned test, within 3 m.')
 const depth = unit('It is preferred that shallow facilities be tested at halfway depth.')
 assert.deepEqual(linked([selected], [selected,qc,depth], 'What testing is needed for acceptance?'), [qc,depth])
 assert.deepEqual(linked([selected], [qc,depth], 'What testing is needed?',1), [qc])
 assert.deepEqual(linked([selected], [qc], 'What testing is needed?',0), [])
})
test('procedure linking never crosses documents, sections, distant pages or unrelated tasks', () => {
 const otherDoc=unit('QA/QC is required.',{passage:{doc:'foreign',page:97}})
 const otherSection=unit('QA/QC is required.',{scope:['6.2 Another asset']})
 const otherMethod=unit('QA/QC is required.',{heading:'Another sampling method'})
 const remote=unit('QA/QC is required.',{passage:{doc:'manual',page:103}})
 assert.deepEqual(linked([selected],[otherDoc,otherSection,otherMethod,remote],'Review testing requirements.'),[])
 assert.deepEqual(linked([selected],[unit('QA/QC is required.')],'What is the minimum pipe diameter?'),[])
})

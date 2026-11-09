import test from 'node:test'
import assert from 'node:assert/strict'
import {
  loadFixture,
  scanFixture,
  verifyFixture,
} from './fixtures/ifc-contradictions/run.mjs'
import { compareIfcDocuments } from '../src/ifc-comparison.mjs'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fixtureRoot } from './fixtures/ifc-contradictions/run.mjs'
import { readIfcProperties } from '../src/ifc-comparison.mjs'
import {ifcFindingEvidence} from '../src/project-evidence.mjs'

const corpus = await loadFixture()
test('actual IFC and PDF folder finds all five planted contradictions and no compliant-control discrepancies', () => {
  const contradictory = scanFixture(corpus, 'contradictory.ifc')
  verifyFixture(contradictory, scanFixture(corpus, 'compliant.ifc'))
  for (const issue of contradictory.issues) {
    assert.match(issue.globalId, /^[0-3][0-9A-Za-z_$]{21}$/)
    assert.match(issue.elementId, /^#\d+$/)
    assert.ok(issue.citations[0].excerpt.length > 20)
    assert.ok(corpus.documents.some((doc) => doc.id === issue.citations[0].doc))
    const evidence=ifcFindingEvidence(issue,corpus,'fixture-project')
    assert.ok(evidence,'A real PDF contradiction needs an anchored evidence view')
    assert.ok(evidence.references.every(reference=>reference.regions.length&&reference.regions.every(rect=>rect.every(Number.isFinite)&&rect[2]>0&&rect[3]>0)))
  }
})
test('repairing the road speed resolves its contradictions in two independent documents', () => {
  const model = {
    name: 'repaired.ifc',
    elements: readIfcProperties(
      readFileSync(resolve(fixtureRoot, 'models', 'contradictory.ifc'), 'utf8'),
    ),
  }
  model.elements
    .find((element) => element.name === 'R1')
    .properties.find((property) => property.name === 'DesignSpeed_kph').value =
    40
  const result = compareIfcDocuments([model], corpus.documents, corpus.passages)
  assert.equal(result.issues.length, 3)
  assert.ok(
    result.issues.every((issue) => issue.property !== 'DesignSpeed_kph'),
  )
})

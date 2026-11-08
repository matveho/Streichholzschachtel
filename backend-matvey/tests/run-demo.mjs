// Runs the demo questions through the offline engine and prints each answer.
// Usage: node tests/run-demo.mjs [--quiet] [question number...]
import { buildIndex } from '../src/indexer.mjs'
import { UnitIndex, lookup } from '../src/lookup.mjs'
import { demoQuestions } from './demo-questions.mjs'

const args = process.argv.slice(2)
const quiet = args.includes('--quiet')
const only = args.filter((a) => /^\d+$/.test(a)).map(Number)
const corpus = await buildIndex()
const index = new UnitIndex(corpus)
let passed = 0
demoQuestions.forEach((item, i) => {
  if (only.length && !only.includes(i + 1)) return
  const result = lookup(item.q, index)
  const text = result.sections
    .flatMap((s) => [s.heading, ...s.sentences.map((x) => x.text)])
    .join('\n')
  const cited = result.sections
    .flatMap((s) => s.sentences.flatMap((x) => x.units || []))
    .map((u) => {
      const d = index.docs.get(u.doc)
      return `${d.label} ${d.edition}`
    })
  const missing = item.expect.filter(
    (e) => !text.toLowerCase().includes(e.toLowerCase()),
  )
  const docMissing = (item.docs || []).filter(
    (d) => !cited.some((c) => c.includes(d)),
  )
  const modeOk = !item.mode || item.mode === result.mode
  const ok = !missing.length && !docMissing.length && modeOk
  if (ok) passed++
  console.log(`\n${ok ? 'PASS' : 'FAIL'} ${i + 1}. ${item.q}  [${result.mode}]`)
  if (!ok)
    console.log(
      `  missing: ${JSON.stringify(missing)} docs: ${JSON.stringify(docMissing)} mode ok: ${modeOk}`,
    )
  if (!quiet || !ok)
    for (const s of result.sections) {
      console.log(`  ## ${s.heading}`)
      for (const x of s.sentences)
        console.log(
          `   - ${x.text.slice(0, 260)}${x.units?.length ? `  <${x.units.map((u) => `${index.docs.get(u.doc).label} p${u.page}`).join(', ')}>` : ''}`,
        )
    }
  if (!ok && result.candidates?.length)
    for (const c of result.candidates.slice(0, 5))
      console.log(
        `   ? ${c.score.toFixed(2)} ${index.docs.get(c.unit.doc).label} p${c.unit.page}: ${c.unit.text.slice(0, 140)}`,
      )
})
console.log(
  `\n${passed}/${only.length || demoQuestions.length} demo questions pass`,
)
process.exitCode = passed === (only.length || demoQuestions.length) ? 0 : 1

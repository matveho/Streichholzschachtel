import { buildIndex } from './indexer.mjs'
const corpus = await buildIndex((message) => console.log(message))
console.log(
  `${corpus.documents.length} documents; ${corpus.passages.length} searchable passages; ${corpus.failures.length} failures`,
)
if (corpus.failures.length) console.log(corpus.failures)

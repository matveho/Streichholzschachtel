import { generate } from './model.mjs'
export async function expandRetrieval(question, baseline, index, signal) {
  const fallback = {
    passages: baseline,
    topics: [
      { heading: 'Governing provisions', query: question, passages: baseline },
    ],
  }
  if (question.length < 80) return fallback
  const plan = await generate(
    'Decompose this engineering query into 2 to 5 focused document searches covering every requested check. Use technical keywords and synonyms for governing requirements, not project figures. Separate different assets, design methods, construction impacts and testing. Each heading must be a short readable topic label. Do not answer, invent facts or choose precedence. Return {queries:[{heading:"Topic",query:"technical keywords"}]}.',
    { question, documents: index.corpus.documents.map((d) => d.title) },
    {
      type: 'object',
      properties: {
        queries: {
          type: 'array',
          maxItems: 5,
          items: {
            type: 'object',
            properties: {
              heading: { type: 'string', maxLength: 60 },
              query: { type: 'string', maxLength: 180 },
            },
            required: ['heading', 'query'],
          },
        },
      },
      required: ['queries'],
    },
    signal,
    800,
    { temperature: 0.7, top_p: 0.8, top_k: 20, min_p: 0, seed: 42 },
  )
  const topics = (plan.queries || [])
    .filter((t) => typeof t.query === 'string')
    .map((t) => ({
      ...t,
      passages: index.withReferencedSections(
        index.searchSingle(t.query).slice(0, 4),
      ),
    }))
  if (!topics.length) return fallback
  const passages = [...baseline]
  for (const topic of topics)
    for (const p of topic.passages)
      if (!passages.some((s) => s.id === p.id)) passages.push(p)
  return { passages, topics }
}

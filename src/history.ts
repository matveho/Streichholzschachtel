import { queryCases } from './data'

export type HistoryEntry = {
  id: string
  title: string
  prompt: string
  caseId: string
  sourceOnly?: boolean
}
const storageKey = 'basis.query-history.v1'
export function readHistory(): HistoryEntry[] {
  const seeds = queryCases.map((c) => ({
    id: c.id,
    title: c.title,
    prompt: c.prompt,
    caseId: c.id,
  }))
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]')
    if (!Array.isArray(saved)) return seeds
    const valid = saved.filter(
      (entry): entry is HistoryEntry =>
        entry &&
        typeof entry.id === 'string' &&
        entry.id !== 'new' &&
        typeof entry.title === 'string' &&
        typeof entry.prompt === 'string' &&
        entry.prompt.trim() &&
        (entry.sourceOnly === undefined ||
          typeof entry.sourceOnly === 'boolean') &&
        queryCases.some((c) => c.id === entry.caseId),
    )
    return [
      ...valid,
      ...seeds.filter((seed) => !valid.some((entry) => entry.id === seed.id)),
    ]
  } catch {
    return seeds
  }
}
export function saveHistory(entries: HistoryEntry[]) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(entries))
  } catch {
    /* Browsing remains available when storage is disabled. */
  }
}

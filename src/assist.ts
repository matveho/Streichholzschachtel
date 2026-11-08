import type { QueryAssist, QueryOutcome } from './backend'

/** One earlier step of the conversation held by a query tab. */
export type ThreadTurn = { question: string; choice?: string }

/** After this many clarification rounds, stop asking and point to uploads. */
export const maxRounds = 2

export function outcomeOf(mode: string, assist?: QueryAssist): QueryOutcome {
  if (assist) return assist.outcome
  if (mode === 'no_evidence') return 'not_found'
  if (['insufficient_evidence', 'related_evidence'].includes(mode))
    return 'partial'
  return 'answered'
}

/** Consecutive clarification choices at the end of the thread. */
export function clarificationRounds(thread: ThreadTurn[]) {
  let rounds = 0
  for (let i = thread.length - 1; i >= 0 && thread[i].choice; i--) rounds++
  return rounds
}

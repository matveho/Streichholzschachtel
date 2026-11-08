import { useEffect, useState } from 'react'
import type { ThreadTurn } from './assist'

/** `target` is 'new' for an unsent query, otherwise the query id it shows. */
export type QueryTab = {
  key: string
  target: string
  name: string
  /** Text typed into an unsent tab, kept per tab. */
  draft?: string
  /** Earlier questions in this tab, oldest first. */
  thread?: ThreadTurn[]
}
type TabState = {
  tabs: QueryTab[]
  active: string | null
  next: number
  /**
   * Set just before a search navigates, so the active tab follows it. `turn`
   * is the question being left behind, added to the tab's thread.
   */
  retarget: null | { turn?: ThreadTurn; reset?: boolean }
}

const empty: TabState = { tabs: [], active: null, next: 1, retarget: null }
const storageKey = (scope: string) => 'basis.query-tabs.v1:' + scope

function load(scope: string): TabState {
  try {
    const saved: unknown = JSON.parse(
      sessionStorage.getItem(storageKey(scope)) ?? 'null',
    )
    if (!saved || typeof saved !== 'object') return empty
    const { tabs, active, next } = saved as Partial<TabState>
    if (!Array.isArray(tabs)) return empty
    const valid = tabs.filter(
      (tab): tab is QueryTab =>
        !!tab &&
        typeof tab.key === 'string' &&
        typeof tab.target === 'string' &&
        typeof tab.name === 'string' &&
        (tab.draft === undefined || typeof tab.draft === 'string') &&
        (tab.thread === undefined ||
          (Array.isArray(tab.thread) &&
            tab.thread.every(
              (turn: ThreadTurn) =>
                !!turn &&
                typeof turn.question === 'string' &&
                (turn.choice === undefined || typeof turn.choice === 'string'),
            ))),
    )
    return {
      tabs: valid,
      active: valid.some((tab) => tab.key === active) ? active! : null,
      next: typeof next === 'number' && next > 0 ? next : valid.length + 1,
      retarget: null,
    }
  } catch {
    return empty
  }
}

function create(state: TabState, target: string): TabState {
  const tab = { key: crypto.randomUUID(), target, name: `Query ${state.next}` }
  return {
    tabs: [...state.tabs, tab],
    active: tab.key,
    next: state.next + 1,
    retarget: null,
  }
}

/** Brings the tab state in line with the query the route is showing. */
function reconcile(
  state: TabState,
  target: string | null,
  scope: string,
): TabState {
  // Drafts share /new. The history entry identifies the draft to restore on Back.
  const remembered = history.state?.basisDraft
  if (
    target === 'new' &&
    remembered?.scope === scope &&
    state.tabs.some((tab) => tab.key === remembered.key && tab.target === 'new')
  )
    return { ...state, active: remembered.key, retarget: null }
  if (target === null)
    return state.retarget ? { ...state, retarget: null } : state
  const active = state.tabs.find((tab) => tab.key === state.active)
  if (active?.target === target)
    return state.retarget ? { ...state, retarget: null } : state
  const existing = state.tabs.find((tab) => tab.target === target)
  if (state.retarget && active) {
    if (existing)
      return {
        ...state,
        // An unsent tab that resolved to an already open query is redundant.
        tabs:
          active.target === 'new'
            ? state.tabs.filter((tab) => tab !== active)
            : state.tabs,
        active: existing.key,
        retarget: null,
      }
    const { turn, reset } = state.retarget
    return {
      ...state,
      tabs: state.tabs.map((tab) =>
        tab === active
          ? {
              ...tab,
              target,
              draft: undefined,
              thread: reset
                ? undefined
                : turn && active.target !== 'new'
                  ? [...(tab.thread ?? []), turn].slice(-20)
                  : tab.thread,
            }
          : tab,
      ),
      retarget: null,
    }
  }
  if (existing) return { ...state, active: existing.key, retarget: null }
  return create(state, target)
}

/**
 * Open-query tabs for one workspace scope. `target` is the query the current
 * route shows ('new', a query id, or null when no query is on screen).
 */
export function useQueryTabs({
  scope,
  target,
  open,
  onEmpty,
}: {
  scope: string
  target: string | null
  open: (target: string) => void
  onEmpty: () => void
}) {
  const [state, setState] = useState(() =>
    reconcile(load(scope), target, scope),
  )
  const [seen, setSeen] = useState(target)
  if (target !== seen) {
    setSeen(target)
    setState((current) => reconcile(current, target, scope))
  }
  useEffect(() => {
    try {
      const savedDraft = history.state?.basisDraft
      if (
        target === 'new' &&
        (savedDraft?.scope !== scope || savedDraft?.key !== state.active)
      )
        history.replaceState(
          { ...history.state, basisDraft: { scope, key: state.active } },
          '',
        )
      sessionStorage.setItem(
        storageKey(scope),
        JSON.stringify({
          tabs: state.tabs,
          active: state.active,
          next: state.next,
        }),
      )
    } catch {
      /* Tabs still work for this page view when storage is unavailable. */
    }
  }, [scope, target, state.tabs, state.active, state.next])

  return {
    tabs: state.tabs,
    active: state.active,
    activeTab: state.tabs.find((t) => t.key === state.active),
    setDraft(key: string, draft: string) {
      setState((current) => ({
        ...current,
        tabs: current.tabs.map((t) => (t.key === key ? { ...t, draft } : t)),
      }))
    },
    openNew() {
      setState((current) => create(current, 'new'))
      open('new')
    },
    select(key: string) {
      const tab = state.tabs.find((t) => t.key === key)
      if (!tab) return
      setState((current) => ({ ...current, active: key, retarget: null }))
      open(tab.target)
    },
    close(key: string) {
      const index = state.tabs.findIndex((t) => t.key === key)
      if (index < 0) return
      const tabs = state.tabs.filter((t) => t.key !== key)
      if (key !== state.active) {
        setState((current) => ({
          ...current,
          tabs: current.tabs.filter((t) => t.key !== key),
        }))
        return
      }
      const neighbour = tabs[index] ?? tabs[index - 1]
      setState((current) => ({
        tabs: current.tabs.filter((t) => t.key !== key),
        active: neighbour?.key ?? null,
        next: tabs.length ? current.next : 1,
        retarget: null,
      }))
      if (neighbour) open(neighbour.target)
      else onEmpty()
    },
    rename(key: string, name: string) {
      setState((current) => ({
        ...current,
        tabs: current.tabs.map((t) => (t.key === key ? { ...t, name } : t)),
      }))
    },
    /**
     * Call right before a search navigates to its result. `from` is the
     * question on screen; `choice` is the clarification that led onward.
     */
    markRun(context?: {
      from: string
      to: string
      choice?: string
      fresh?: boolean
    }) {
      // A rephrased question stands alone: it starts a new thread.
      if (context?.fresh) {
        setState((current) => ({ ...current, retarget: { reset: true } }))
        return
      }
      const turn =
        context?.from.trim() && context.from.trim() !== context.to.trim()
          ? { question: context.from.trim(), choice: context.choice }
          : undefined
      setState((current) => ({ ...current, retarget: { turn } }))
    },
  }
}

export type QueryTabsApi = ReturnType<typeof useQueryTabs>

import { defineStore } from 'pinia'
import { ref } from 'vue'

export type SidebarMode = 'blueprint' | 'live'
export interface SidebarModeState { collapsed: boolean; expandedWidth: number }
export interface SidebarContextState {
  collapsedGroupKeys: string[]
  scrollTop: number
  pinnedStationIds: string[]
  groupOrder: string[]
  stationOrderByGroup: Record<string, string[]>
}
export interface SidebarState {
  version: 1
  modes: Record<SidebarMode, SidebarModeState>
  contexts: Record<string, SidebarContextState>
}
const STORAGE_KEY = 'x4_production_sidebar'
export const boundSidebarWidth = (value: number) => Math.min(400, Math.max(200, value))
export function emptySidebarContext(): SidebarContextState {
  return { collapsedGroupKeys: [], scrollTop: 0, pinnedStationIds: [], groupOrder: [], stationOrderByGroup: {} }
}
function object(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}
function ids(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((id): id is string => typeof id === 'string' && id.length > 0))]
}
function normalizeContext(value: unknown): SidebarContextState {
  const raw = object(value)
  const stationOrderByGroup: Record<string, string[]> = {}
  for (const [key, order] of Object.entries(object(raw.stationOrderByGroup))) {
    if (key.length > 0) stationOrderByGroup[key] = ids(order)
  }
  return {
    collapsedGroupKeys: ids(raw.collapsedGroupKeys),
    scrollTop: typeof raw.scrollTop === 'number' && Number.isFinite(raw.scrollTop) ? Math.max(0, raw.scrollTop) : 0,
    pinnedStationIds: ids(raw.pinnedStationIds), groupOrder: ids(raw.groupOrder), stationOrderByGroup
  }
}
export function normalizeSidebarState(value: unknown): SidebarState {
  const raw = object(value)
  const modes = object(raw.modes)
  function mode(key: SidebarMode): SidebarModeState {
    const item = object(modes[key])
    return {
      collapsed: item.collapsed === true,
      expandedWidth: typeof item.expandedWidth === 'number' && Number.isFinite(item.expandedWidth) ? boundSidebarWidth(item.expandedWidth) : 240
    }
  }
  const contexts: Record<string, SidebarContextState> = {}
  for (const [key, item] of Object.entries(object(raw.contexts))) {
    if (/^(blueprint|live):.+/.test(key)) contexts[key] = normalizeContext(item)
  }
  return { version: 1, modes: { blueprint: mode('blueprint'), live: mode('live') }, contexts }
}
export const useProductionSidebarStateStore = defineStore('productionSidebarState', () => {
  function load(): SidebarState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw === null) return normalizeSidebarState(null)
      return normalizeSidebarState(JSON.parse(raw))
    } catch { return normalizeSidebarState(null) }
  }
  const state = ref(load())
  function persist() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.value)) }
  function context(mode: SidebarMode, id: string | null) {
    if (id === null) return undefined
    return state.value.contexts[`${mode}:${id}`]
  }
  function setMode(mode: SidebarMode, patch: Partial<SidebarModeState>) {
    state.value = normalizeSidebarState({ ...state.value, modes: { ...state.value.modes, [mode]: { ...state.value.modes[mode], ...patch } } })
    persist()
  }
  function setContext(mode: SidebarMode, id: string | null, patch: Partial<SidebarContextState>) {
    if (id === null) return
    const key = `${mode}:${id}`
    const existing = state.value.contexts[key]
    const base = existing === undefined ? emptySidebarContext() : existing
    state.value.contexts[key] = normalizeContext({ ...base, ...patch })
    persist()
  }
  function reconcile(mode: SidebarMode, id: string | null, loaded: boolean, groups: { id: string; stationIds: string[] }[], stationIds: string[]) {
    if (!loaded || id === null) return
    const current = context(mode, id)
    if (current === undefined) return
    const groupIds = groups.map(group => group.id)
    const groupSet = new Set(groupIds)
    const stationSet = new Set(stationIds)
    const groupOrder = [...current.groupOrder.filter(key => groupSet.has(key)), ...groupIds.filter(key => !current.groupOrder.includes(key))]
    const stationOrderByGroup: Record<string, string[]> = {}
    for (const group of groups) {
      const previous = current.stationOrderByGroup[group.id]
      const order = previous === undefined ? [] : previous
      const members = new Set(group.stationIds)
      stationOrderByGroup[group.id] = [...order.filter(key => members.has(key)), ...group.stationIds.filter(key => !order.includes(key))]
    }
    const next = {
      ...current,
      collapsedGroupKeys: current.collapsedGroupKeys.filter(key => groupSet.has(key)),
      pinnedStationIds: current.pinnedStationIds.filter(key => stationSet.has(key)), groupOrder, stationOrderByGroup
    }
    if (JSON.stringify(next) !== JSON.stringify(current)) setContext(mode, id, next)
  }
  return { state, context, setMode, setContext, reconcile }
})

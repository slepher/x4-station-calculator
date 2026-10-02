import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { normalizeSidebarState, useProductionSidebarStateStore } from '@/store/useProductionSidebarStateStore'

const memory = new Map<string, string>()
beforeEach(() => {
  memory.clear()
  vi.stubGlobal('localStorage', { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => memory.set(key, value) })
})

describe('sidebar preferences', () => {
  it('normalizes missing fields, bounded widths, invalid values and duplicate IDs', () => {
    const state = normalizeSidebarState({ modes: { blueprint: { expandedWidth: 900 }, live: { expandedWidth: '250' } }, contexts: {
      'live:a': { collapsedGroupKeys: ['a', 'a', 4], pinnedStationIds: ['s', 's'], scrollTop: -2, groupOrder: ['b', 'b'], stationOrderByGroup: { b: ['s', 's'] } }
    } })
    expect(state.version).toBe(1)
    expect(state.modes.blueprint).toEqual({ collapsed: false, expandedWidth: 400 })
    expect(state.modes.live).toEqual({ collapsed: false, expandedWidth: 240 })
    expect(state.contexts['live:a']).toEqual({ collapsedGroupKeys: ['a'], pinnedStationIds: ['s'], scrollTop: 0, groupOrder: ['b'], stationOrderByGroup: { b: ['s'] } })
  })

  it('keeps mode/context preferences separate and restores persistence', () => {
    const store = useProductionSidebarStateStore()
    store.setMode('blueprint', { collapsed: true, expandedWidth: 310 })
    store.setContext('blueprint', 'a', { pinnedStationIds: ['s'], scrollTop: 70 })
    expect(store.context('live', 'a')).toBeUndefined()
    expect(store.state.modes.live.expandedWidth).toBe(240)
    setActivePinia(createPinia())
    const restored = useProductionSidebarStateStore()
    expect(restored.state.modes.blueprint).toEqual({ collapsed: true, expandedWidth: 310 })
    expect(restored.context('blueprint', 'a')?.pinnedStationIds).toEqual(['s'])
    restored.setContext('live', null, { pinnedStationIds: ['temporary'] })
    expect(Object.keys(restored.state.contexts)).toEqual(['blueprint:a'])
  })

  it('only reconciles after loading, removing missing and moved members while appending new entities', () => {
    const store = useProductionSidebarStateStore()
    store.setContext('live', 'a', { collapsedGroupKeys: ['g', 'gone'], pinnedStationIds: ['s', 'gone'], groupOrder: ['gone', 'g'], stationOrderByGroup: { g: ['moved', 's'], gone: ['gone'] } })
    store.reconcile('live', 'a', false, [], [])
    expect(store.context('live', 'a')?.pinnedStationIds).toEqual(['s', 'gone'])
    store.reconcile('live', 'a', true, [{ id: 'g', stationIds: ['s', 'new'] }, { id: 'h', stationIds: ['moved'] }], ['s', 'new', 'moved'])
    expect(store.context('live', 'a')).toEqual({ collapsedGroupKeys: ['g'], pinnedStationIds: ['s'], scrollTop: 0, groupOrder: ['g', 'h'], stationOrderByGroup: { g: ['s', 'new'], h: ['moved'] } })
  })
})

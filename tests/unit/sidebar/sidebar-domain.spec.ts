// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, defineStore, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { useSaveBindingStore } from '@/store/useSaveBindingStore'
import { useActiveViewStore } from '@/store/useActiveViewStore'
import { useLiveProductionStore } from '@/store/useLiveProductionStore'

const mocks = vi.hoisted(() => ({ save: null as any, read: vi.fn() }))
vi.mock('@/store/useGameDataStore', () => ({ useGameDataStore: () => ({
  maps: { sectors: {}, clusters: {} }, isReady: false, modulesMap: {}, waresMap: {}, modulesByMacroId: {}, sectorReachability: {}, getStorageKey: (key: string) => `sidebar-test-${key}`
}) }))
vi.mock('@/store/useSaveStore', () => ({ useSaveStore: () => mocks.save }))
vi.mock('@/db/saveArchiveDB', async importOriginal => ({ ...await importOriginal<typeof import('@/db/saveArchiveDB')>(), loadPlayerStationsFlatByArchiveId: mocks.read }))
vi.mock('@/i18n', () => ({ default: { global: { t: (key: string) => key, te: () => false } } }))
const useTestSave = defineStore('sidebar-test-save', {
  state: () => ({ selectedArchive: null as any, savedArchivesState: { list: [] }, archives: new Map(), archiveGroups: [] })
})
beforeEach(() => {
  localStorage.removeItem('sidebar-test-save_bindings')
  localStorage.removeItem('x4_station_active_view')
  mocks.save = useTestSave()
  mocks.read.mockReset(); mocks.read.mockResolvedValue([])
})
function loadBinding() {
  const active = useActiveViewStore()
  active.switchToBinding('game-a')
  const binding = useSaveBindingStore()
  binding.loadData({ version: 2, list: [{ gameGuid: 'game-a', selectedArchiveTime: null, groups: [
    { id: 'legacy-id', name: 'Alpha', order: 0, sectorMacro: 'sector-a', color: '#123456', jumpRange: 3, coverageSectorMacros: [{ ref: 'sector-a', jump: 0 }], connectedGroupIds: [] },
    { name: 'Beta', order: 1, sectorMacro: 'sector-b', jumpRange: 3, coverageSectorMacros: [{ ref: 'sector-b', jump: 0 }], connectedGroupIds: [] }
  ], stationPlans: [{ id: 'plan-a', groupId: 'legacy-id', name: 'Plan', type: 'industrial', modules: [] }, { id: 'plan-bound', groupId: 'sector-a', saveStationCode: 'ABC-001', name: 'Bound', type: 'industrial', modules: [] }], updatedAt: 1 }] } as any)
  return { active, binding }
}

describe('group domain metadata (task 5)', () => {
  it('normalizes legacy group references, writes canonical metadata only and preserves the saved/draft boundary', () => {
    const { binding } = loadBinding()
    expect(binding.activeBinding!.stationPlans[0]!.groupId).toBe('sector-a')
    expect(binding.updateGroupMetadata('game-a', 'legacy-id', { name: 'Alpha', color: '#123456' }, { name: 'Ignored', color: '#fff' })).toBe(false)
    expect(binding.updateGroupMetadata('game-a', 'sector-a', { name: 'Alpha', color: '#123456' }, { name: '  Updated  ', color: '#abcdef' })).toBe(true)
    expect(binding.activeBinding!.groups[0]!.name).toBe('Updated')
    expect(binding.isDirty).toBe(true)
    expect(binding.savedBindings.list[0]!.groups[0]!.name).toBe('Alpha')
    binding.discardChanges()
    expect(binding.activeBinding!.groups[0]!.name).toBe('Alpha')
    binding.updateGroupMetadata('game-a', 'sector-a', { name: 'Alpha', color: '#123456' }, { name: 'Saved', color: '#abcdef' })
    binding.saveBinding()
    expect(binding.isDirty).toBe(false)
    setActivePinia(createPinia())
    useActiveViewStore().switchToBinding('game-a')
    const restored = useSaveBindingStore(); restored.initialize()
    expect(restored.activeBinding!.groups[0]!.name).toBe('Saved')
    expect(restored.activeBinding!.groups[0]!.color).toBe('#abcdef')
  })
  it('rejects context invalidation/blank names/concurrent metadata and permits concurrent unrelated fields', () => {
    const { binding } = loadBinding()
    const original = { name: 'Alpha', color: '#123456' }
    expect(binding.updateGroupMetadata('game-a', 'sector-a', original, { name: '  ', color: '#fff' })).toBe(false)
    expect(binding.updateGroupMetadata('game-b', 'sector-a', original, { name: 'Changed', color: '#fff' })).toBe(false)
    binding.updateGroup('game-a', 'sector-a', { name: 'Other' })
    expect(binding.updateGroupMetadata('game-a', 'sector-a', original, { name: 'Changed', color: '#fff' })).toBe(false)
    binding.discardChanges(); binding.updateGroup('game-a', 'sector-a', { color: '#999999' })
    expect(binding.updateGroupMetadata('game-a', 'sector-a', original, { name: 'Changed', color: '#fff' })).toBe(false)
    binding.discardChanges(); binding.updateGroup('game-a', 'sector-a', { jumpRange: 7 })
    expect(binding.updateGroupMetadata('game-a', 'sector-a', original, { name: 'Changed', color: '#123456' })).toBe(true)
    expect(binding.activeBinding!.groups[0]!.jumpRange).toBe(7)
  })
})

describe('live binding menu navigation (task 2)', () => {
  it('ignores binding management without a valid binding', () => {
    const live = useLiveProductionStore(); const active = useActiveViewStore(); const binding = useSaveBindingStore()
    const create = vi.spyOn(live, 'createStation')
    const originalView = active.activeView
    live.jumpToMapBinding('missing-station', 'station')
    expect(active.activeView).toBe(originalView)
    expect(create).not.toHaveBeenCalled()
    expect(binding.savedBindings.list).toEqual([])
  })
  it('routes station/transit management to their exact group without modifying plans', () => {
    const { active, binding } = loadBinding()
    const live = useLiveProductionStore(); const original = JSON.stringify(binding.activeBinding)
    live.playerStationRecords = [{ type: 'station', code: 'ABC-001', sectorMacro: 'sector-a', data: { code: 'ABC-001', modules: [] } }] as any
    live.jumpToMapBinding('transit:sector-b', 'transit')
    expect([active.mapBindingStage, active.mapSavePanelLayer, active.mapSavePanelSectorGroupId]).toEqual(['select-station', 'binding-station', 'sector-b'])
    live.jumpToMapBinding('plan-a', 'station')
    expect(active.mapSavePanelSectorGroupId).toBe('sector-a')
    active.isSavePanelOpen = false
    expect(JSON.stringify(binding.activeBinding)).toBe(original)
    expect(live.canDeleteStation('plan-a')).toBe(true)
    expect(live.canDeleteStation('plan-bound')).toBe(false)
    expect(live.canDeleteStation('ABC-001')).toBe(false)
  })
})

describe('async loading and explicit navigation (tasks 3, 6)', () => {
  it('marks only the current successfully loaded binding as ready for preference cleanup', async () => {
    const { binding } = loadBinding()
    const live = useLiveProductionStore()
    let finish!: (value: unknown[]) => void
    mocks.read.mockReturnValue(new Promise(resolve => { finish = resolve }))
    mocks.save.selectedArchive = { isValid: true, sectors: {}, meta: { guid: 'game-a', time: 1 } }
    await nextTick()
    expect(live.loadedBindingGameGuid).toBeNull()
    binding.clearDraft(); finish([])
    await nextTick(); await nextTick()
    expect(live.loadedBindingGameGuid).toBeNull()
    binding.setActiveBinding('game-a')
    mocks.read.mockResolvedValue([])
    mocks.save.selectedArchive = { isValid: true, sectors: {}, meta: { guid: 'game-a', time: 2 } }
    await nextTick(); await nextTick()
    expect(live.loadedBindingGameGuid).toBe('game-a')
  })
  it('generates new tokens for repeated explicit navigation while ordinary selection produces none', () => {
    const active = useActiveViewStore()
    active.navigateToProduction('blueprint', 'empire-a', 's1')
    const token = active.productionNavigation!.token
    active.navigateToProduction('blueprint', 'empire-a', 's1')
    expect(active.productionNavigation!.token).toBeGreaterThan(token)
    active.consumeProductionNavigation(token)
    expect(active.productionNavigation).not.toBeNull()
    active.consumeProductionNavigation(active.productionNavigation!.token)
    active.activeEmpireStation = 's2'
    expect(active.productionNavigation).toBeNull()
  })
})

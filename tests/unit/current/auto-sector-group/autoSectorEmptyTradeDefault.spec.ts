// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { createPinia, defineStore } from 'pinia'
import { defineComponent, h } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { useAutoSectorGroupPresenter } from '@/components/empire/presenters/useAutoSectorGroupPresenter'
import type { AutoGroupResult, GroupDraftInfo } from '@/store/logic/autoGroup'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key, te: () => false }) }))
vi.mock('@/store/useSaveStore', () => ({ useSaveStore: () => ({ selectedArchive: null }) }))
vi.mock('@/store/useGameDataStore', () => ({ useGameDataStore: () => ({ maps: null, sectorReachability: {}, modulesByMacroId: {} }) }))
vi.mock('@/store/useActiveViewStore', () => ({ useActiveViewStore: () => ({ activeBinding: null }) }))
vi.mock('@/store/useBlueprintProductionStore', () => ({ useBlueprintProductionStore: () => ({ savedEmpires: { list: [] } }) }))
vi.mock('@/store/useSaveBindingStore', () => ({ useSaveBindingStore: () => useBinding() }))
vi.mock('@/store/useLiveProductionStore', () => ({ useLiveProductionStore: () => useLive() }))

const useBinding = defineStore('empty-trade-binding', {
  state: () => ({ activeBinding: null, stationPlans: [] }),
  actions: { createAutoGroups: vi.fn() }
})
const useLive = defineStore('empty-trade-live', {
  state: () => ({
    autoGroupResult: { groups: [], assignments: [], bridgePlans: [], playerSectorMacros: [], sectorStationCandidates: {} } as AutoGroupResult,
    virtualStationDrafts: [], calculationMode: 'result', prefJumpRange: 2,
    bridgeSearchJumpRange: 5, prefThreshold: 5000000, needsAutoGroupRecalc: false, calcBaselinePillState: null
  })
})
function group(id: string, extra: Partial<GroupDraftInfo> = {}): GroupDraftInfo {
  return { id, name: id, sectorMacro: id, jumpRange: 2, originalJumpRange: 2,
    coverageSectorMacros: [], connectedGroupIds: [], isNew: false, ...extra } as GroupDraftInfo
}
function setup(groups: GroupDraftInfo[] = []) {
  const pinia = createPinia()
  const live = useLive(pinia)
  const binding = useBinding(pinia)
  live.autoGroupResult.groups = groups
  let presenter!: ReturnType<typeof useAutoSectorGroupPresenter>
  const wrapper = mount(defineComponent({ setup() {
    presenter = useAutoSectorGroupPresenter()
    return () => h('div')
  } }), { global: { plugins: [pinia] } })
  return { presenter, live, binding, wrapper }
}

describe('auto sector empty trade defaults', () => {
  it('selects a virtual station for a newly added non-player hub without creating station plans', () => {
    const { presenter, live, binding, wrapper } = setup()
    const createAutoGroups = vi.spyOn(binding, 'createAutoGroups')
    presenter.handleAddHubDraft('empty-sector')
    expect(live.autoGroupResult.groups).toHaveLength(1)
    expect(live.autoGroupResult.groups[0]!.selectedTradeStation).toEqual({ type: 'virtual', stationCode: '__virtual__' })
    expect(presenter.tradeStationCandidates.value['empty-sector']).toEqual([])
    expect(presenter.selectedTradeStations.value['empty-sector']).toEqual({ type: 'virtual', stationCode: '__virtual__' })
    expect(binding.stationPlans).toEqual([])
    expect(live.virtualStationDrafts).toEqual([])
    expect(createAutoGroups).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('preserves explicit and retained player selections while defaulting an empty new hub', () => {
    const { presenter, live, wrapper } = setup([
      group('explicit', { selectedTradeStation: { type: 'player', stationCode: 'selected-player' } }),
      group('retained', { tradeStationRetainEnabled: true, savedTradeStationCode: 'saved-player' })
    ])
    presenter.handleAddHubDraft('empty-sector')
    expect(live.autoGroupResult.groups.map(group => [group.id, group.selectedTradeStation])).toEqual([
      ['explicit', { type: 'player', stationCode: 'selected-player' }],
      ['retained', { type: 'player', stationCode: 'saved-player' }],
      ['empty-sector', { type: 'virtual', stationCode: '__virtual__' }]
    ])
    wrapper.unmount()
  })

  it('keeps normal player candidate scoring and reset defaults', () => {
    const { presenter, live, wrapper } = setup([group('player-sector')])
    live.autoGroupResult.sectorStationCandidates = {
      'player-sector': [{ stationCode: 'player-a', macro: 'station-a', score: 100,
        containerCap: 10000000, prodLines: 0, hasProduction: false, hasVolume: true, isPureHub: true, qualified: true }]
    }
    presenter.handleAddHubDraft('empty-sector')
    expect(presenter.selectedTradeStations.value['player-sector']).toEqual({ type: 'player', stationCode: 'player-a' })
    presenter.handleResetTradeStations()
    expect(presenter.selectedTradeStations.value['empty-sector']).toEqual({ type: 'virtual', stationCode: '__virtual__' })
    expect(presenter.selectedTradeStations.value['player-sector']).toEqual({ type: 'player', stationCode: 'player-a' })
    wrapper.unmount()
  })
})

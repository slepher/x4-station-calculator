// @vitest-environment jsdom

import { shallowMount } from '@vue/test-utils'
import { computed, ref, nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import AutoSectorGroupPanel from '@/components/map/AutoSectorGroupPanel.vue'

const mocks = vi.hoisted(() => {
  const state = { hasPendingBridgeDecision: false }
  const hasPendingBridgeDecision = {
    get value() {
      return state.hasPendingBridgeDecision
    },
    set value(value: boolean) {
      state.hasPendingBridgeDecision = value
    }
  }
  const handleResetAssignments = vi.fn(() => {
    hasPendingBridgeDecision.value = true
  })
  return { hasPendingBridgeDecision, handleResetAssignments }
})

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/store/useActiveViewStore', () => ({
  useActiveViewStore: () => ({})
}))

vi.mock('@/store/useLiveProductionStore', () => ({
  useLiveProductionStore: () => ({
    activateBinding: vi.fn(),
    getVirtualTradeStationDefaultPosition: () => ({ x: 0, y: 0, z: 0 })
  })
}))

vi.mock('@/store/useGameDataStore', () => ({
  useGameDataStore: () => ({
    modulesMap: {},
    gameData: {}
  })
}))

vi.mock('@/utils/UseX4I18n', () => ({
  useX4I18n: () => ({
    translateSector: () => 'Sector'
  })
}))

vi.mock('@/components/empire/presenters/useAutoSectorGroupPresenter', () => ({
  useAutoSectorGroupPresenter: () => ({
    prefJumpRange: ref(2),
    bridgeSearchJumpRange: ref(5),
    prefThreshold: ref(5000000),
    nodeEnabled: ref(true),
    bridgeRetainEnabled: computed(() => false),
    coverageRetainEnabled: computed(() => false),
    tradeStationRetainEnabled: computed(() => false),
    showHubAddMenu: ref(false),
    autoGroupResult: ref({
      groups: [],
      assignments: [],
      bridgePlans: [
        { id: 'p1', selected: false },
        { id: 'p2', selected: false }
      ],
      playerSectorMacros: []
    }),
    canDragGroups: computed(() => false),
    calculationMode: ref('result'),
    calcBaselinePillState: ref(null),
    gameDataMaps: computed(() => ({ sectors: {}, clusters: {} })),
    sectorReachability: computed(() => ({})),
    sectorGraphInfo: computed(() => ({ sectorGraph: {}, sectorClusterMap: {} })),
    tradeStationCandidates: computed(() => ({})),
    selectedTradeStations: computed(() => ({})),
    tradeStationCaps: computed(() => ({})),
    blueprintEmpires: computed(() => []),
    selectedBlueprintEmpireId: ref(''),
    blueprintStationSources: computed(() => []),
    virtualStationGroups: computed(() => ({ grouped: [], ungrouped: [] })),
    activeVirtualStationDragKey: computed(() => null),
    formatCoordKm: (value: number) => `${value}`,
    startVirtualStationDrag: vi.fn(),
    updateVirtualStationDrag: vi.fn(),
    finishVirtualStationDrag: vi.fn(),
    handleDeleteVirtualStationDraft: vi.fn(),
    runCalculationFromEditInput: vi.fn(),
    handleEnterEdit: vi.fn(),
    handleExitEdit: vi.fn(),
    handleUpdatePrefJumpRange: vi.fn(),
    handleUpdateBridgeSearchJumpRange: vi.fn(),
    handleSelectOption: vi.fn(),
    handleCycleRecalcState: vi.fn(),
    handleUpdateJumpRange: vi.fn(),
    handleToggleCoverageInput: vi.fn(),
    handleToggleConnectedInput: vi.fn(),
    handleAddCandidateCoverage: vi.fn(),
    handleDeleteGroup: vi.fn(),
    handleSelectBridgeCenter: vi.fn(),
    handleSelectBridgePlan: vi.fn(),
    handleResetAssignments: mocks.handleResetAssignments,
    handleAddHubClick: vi.fn(),
    handleAddHubDraft: vi.fn(),
    getExistingAnchorSectors: () => [],
    handleToggleRetainCoverage: vi.fn(),
    handleToggleRetainConnection: vi.fn(),
    handleToggleTradeStationRetain: vi.fn(),
    handleMasterBridgeRetain: vi.fn(),
    handleMasterCoverageRetain: vi.fn(),
    handleMasterTradeStationRetain: vi.fn(),
    handleSelectTradeStation: vi.fn(),
    handleConfirm: vi.fn(),
    handleQuickCalculate: vi.fn(),
    hasUncertainAssignments: computed(() => false),
    hasPendingBridgeDecision: mocks.hasPendingBridgeDecision,
    hasUnresolvedTradeStations: computed(() => false),
    showConfirmPopup: ref(false),
    hasChanges: ref(true),
    hasAutoResult: computed(() => true),
    stationCounts: computed(() => ({})),
    canDisableNode: computed(() => true),
    bridgeRetainIndeterminate: computed(() => false),
    coverageRetainIndeterminate: computed(() => false),
    tradeStationRetainIndeterminate: computed(() => false),
    handleColorChange: vi.fn(),
    sectorGroupColorMap: computed(() => ({})),
    handleReorderGroups: vi.fn()
  })
}))

describe('AutoSectorGroupPanel reset behavior', () => {
  it('switches to allocation when reset result has pending bridge plans', async () => {
    mocks.hasPendingBridgeDecision.value = false
    mocks.handleResetAssignments.mockClear()

    const wrapper = shallowMount(AutoSectorGroupPanel, {
      global: {
        stubs: {
          AutoSectorBar: {
            emits: ['reset'],
            template: '<button data-testid="reset" @click="$emit(\'reset\')">reset</button>'
          }
        }
      }
    })

    expect(wrapper.find('.tab-btn.active').text()).toBe('auto_sector.hub_tab')
    await wrapper.get('[data-testid="reset"]').trigger('click')
    await nextTick()

    expect(mocks.handleResetAssignments).toHaveBeenCalledTimes(1)
    expect(wrapper.find('.tab-btn.active').text()).toBe('auto_sector.allocation_tab')
  })
})

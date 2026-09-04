// @vitest-environment jsdom

import { shallowMount } from '@vue/test-utils'
import { computed, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import AutoSectorGroupPanel from '@/components/map/AutoSectorGroupPanel.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/store/useActiveViewStore', () => ({
  useActiveViewStore: () => ({})
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
      assignments: [
        {
          sectorMacro: 'cluster_26_sector001_macro',
          status: 'uncertain_extend',
          selectedOptionIndex: null,
          options: []
        }
      ],
      bridgePlans: [],
      playerSectorMacros: []
    }),
    canDragGroups: computed(() => false),
    calculationMode: ref('result'),
    calcBaselinePillState: ref(null),
    gameDataMaps: computed(() => ({
      sectors: {
        sectorA: {
          id: 'cluster_26_sector001_macro',
          macro: 'cluster_26_sector001_macro',
          nameId: '{20101,101}'
        }
      },
      clusters: {
        clusterA: {
          sectors: ['sectorA']
        }
      }
    })),
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
    handleResetAssignments: vi.fn(),
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
    hasUncertainAssignments: computed(() => true),
    hasPendingBridgeDecision: computed(() => false),
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

vi.mock('@/store/useLiveProductionStore', () => ({
  useLiveProductionStore: () => ({
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
    translateSector: () => '阿提亚的不幸 I'
  })
}))

describe('AutoSectorGroupPanel unresolved tooltip', () => {
  it('uses translated sector names instead of macros for unresolved allocations', () => {
    const wrapper = shallowMount(AutoSectorGroupPanel, {
      global: {
        stubs: {
          AutoSectorBar: {
            props: ['unresolvedTitle'],
            template: '<div data-testid="bar">{{ unresolvedTitle }}</div>'
          }
        }
      }
    })

    const title = wrapper.get('[data-testid="bar"]').text()
    expect(title).toContain('阿提亚的不幸 I')
    expect(title).not.toContain('cluster_26_sector001_macro')
  })
})

/**
 * @vitest-environment jsdom
 */
import { defineComponent, h, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import SectorOverviewPanel from '@/components/empire/sector-overview/SectorOverviewPanel.vue'

vi.mock('@/store/useSaveBindingStore', () => ({
  useSaveBindingStore: () => ({
    activeBinding: null
  })
}))

vi.mock('@/store/useActiveViewStore', () => ({
  useActiveViewStore: () => ({
    activeBinding: 'game-1',
    isSavePanelOpen: false,
    mapBindingGameGuid: null,
    mapSavePanelLayer: 'list',
    setActiveView: vi.fn()
  })
}))

vi.mock('@/components/empire/presenters/useAutoSectorGroupPresenter', () => ({
  useAutoSectorGroupPresenter: () => ({
    t: (key: string) => key,
    autoGroupResult: ref({
      groups: [
        {
          id: 'A',
          name: 'A',
          sectorMacro: 'A',
          jumpRange: 2,
          originalJumpRange: 2,
          coverageSectorMacros: [],
          connectedGroupIds: [],
          excludedDefaultAssignmentSectorMacros: [],
          isNew: false,
          isPinned: true,
          coverageRetainEnabled: true,
          connectionRetainEnabled: true
        }
      ],
      assignments: [],
      playerSectorMacros: []
    }),
    gameDataMaps: ref(null),
    sectorReachability: ref({}),
    sectorGraphInfo: ref({ sectorGraph: {}, sectorClusterMap: {} }),
    triggerAutoGroup: vi.fn(),
    handleUploadComplete: vi.fn(),
    handleColorChange: vi.fn(),
    tradeStationCaps: ref({}),
    empireDerivedProductionFlows: ref([]),
    overviewBuyMultiplier: ref(1),
    overviewSellMultiplier: ref(1)
  })
}))

const SectorGroupListStub = defineComponent({
  name: 'SectorGroupList',
  props: {
    draggable: { type: Boolean, default: false },
    showDragHandle: { type: Boolean, default: true }
  },
  setup(props) {
    return () => h('div', {
      class: 'sector-group-list-stub',
      'data-draggable': props.draggable ? 'true' : 'false',
      'data-show-drag-handle': props.showDragHandle ? 'true' : 'false'
    })
  }
})

describe('SectorOverviewPanel drag handles', () => {
  it('hides drag handles in the display overview group list', () => {
    const wrapper = mount(SectorOverviewPanel, {
      global: {
        stubs: {
          SaveUploadPanel: true,
          SaveList: true,
          EmpireWareFlowsDashboard: true,
          AutoSectorGroupPanel: true,
          SectorGroupList: SectorGroupListStub
        }
      }
    })

    const list = wrapper.find('.sector-group-list-stub')
    expect(list.attributes('data-draggable')).toBe('false')
    expect(list.attributes('data-show-drag-handle')).toBe('false')
  })
})

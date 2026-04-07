/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import MapBindingSectorGroup from '@/components/map/MapBindingSectorGroup.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    te: () => false,
    locale: ref('en')
  })
}))

vi.mock('vuedraggable', () => ({
  default: {
    name: 'DraggableStub',
    props: ['modelValue', 'itemKey'],
    template: `
      <div>
        <template v-for="item in modelValue" :key="item[itemKey]">
          <slot name="item" :element="item" />
        </template>
      </div>
    `
  }
}))

vi.mock('@/components/common/JumpInput.vue', () => ({
  default: {
    name: 'JumpInput',
    props: ['modelValue'],
    emits: ['update:modelValue', 'change'],
    template: '<input :value="modelValue" />'
  }
}))

vi.mock('./savePoiSearch', () => ({
  getLocalizedSectorQueryMatch: vi.fn(() => ({ matched: true, matchedRawName: false, matchedDisplayName: true }))
}))

vi.mock('@/components/map/savePoiSearch', () => ({
  getLocalizedSectorQueryMatch: vi.fn(() => ({ matched: true, matchedRawName: false, matchedDisplayName: true }))
}))

vi.mock('@/components/map/mapSectorMacro', () => ({
  resolveMapSectorByMacro: vi.fn((_maps, sectorMacro: string) => ({ sectorId: sectorMacro }))
}))

vi.mock('@/composables/useSectorNameFilter', () => ({
  useSectorNameFilter: vi.fn(() => ({
    normalizedQuery: ref(''),
    getSectorDisplayName: (_sectorMacro: string, fallbackName: string) => ({
      rawSectorName: fallbackName,
      sectorName: fallbackName,
      showRawSectorName: false
    })
  }))
}))

vi.mock('@/store/useSaveStore', () => ({
  useSaveStore: vi.fn()
}))

vi.mock('@/store/useEmpireStore', () => ({
  useEmpireStore: vi.fn()
}))

vi.mock('@/store/useGameDataStore', () => ({
  useGameDataStore: vi.fn()
}))

import { useSaveStore } from '@/store/useSaveStore'
import { useEmpireStore } from '@/store/useEmpireStore'
import { useGameDataStore } from '@/store/useGameDataStore'

describe('MapBindingSectorGroup', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(useSaveStore).mockReturnValue({
      selectedArchive: {
        meta: { guid: 'g-1', time: 1000 },
        sectors: {}
      },
      archives: new Map()
    } as any)

    vi.mocked(useEmpireStore).mockReturnValue({
      activeEmpire: {
        sectors: [
          { id: 'group-a', name: 'Alpha', order: 0 },
          { id: 'group-b', name: 'Beta', order: 1 }
        ],
        saveBindings: [
          {
            gameGuid: 'g-1',
            selectedArchiveTime: 1000,
            groupBindings: [
              {
                sectorGroupId: 'group-a',
                sectorMacro: 'anchor_a',
                jumpRange: 2,
                coverageSectorMacros: [
                  { ref: 'coverage_a1', jump: 1 },
                  { ref: 'coverage_a2', jump: 2 }
                ],
                connectedSectorGroupIds: ['group-b'],
                stationBindings: []
              },
              {
                sectorGroupId: 'group-b',
                sectorMacro: 'anchor_b',
                jumpRange: 2,
                coverageSectorMacros: [],
                connectedSectorGroupIds: ['group-a'],
                stationBindings: []
              }
            ]
          }
        ]
      },
      createSector: vi.fn(),
      reorderSectors: vi.fn(),
      renameSector: vi.fn(),
      bindSectorGroup: vi.fn(),
      setGroupConnection: vi.fn(),
      clearSectorGroupBinding: vi.fn()
    } as any)

    vi.mocked(useGameDataStore).mockReturnValue({
      maps: {
        clusters: {},
        sectors: {
          anchor_a: { name: 'Anchor A' },
          coverage_a1: { name: 'Coverage A1' },
          coverage_a2: { name: 'Coverage A2' },
          anchor_b: { name: 'Anchor B' }
        }
      }
    } as any)
  })

  it('keeps collapsed anchor and coverage display for a bound empire sector', () => {
    const wrapper = mount(MapBindingSectorGroup, {
      props: { gameGuid: 'g-1' },
      global: {
        stubs: {
          Teleport: true
        }
      }
    })

    const firstItem = wrapper.findAll('.empire-sector-item')[0]

    expect(firstItem.text()).toContain('Anchor A')
    expect(firstItem.text()).toContain('Coverage A1')
    expect(firstItem.text()).toContain('Coverage A2')
  })
})

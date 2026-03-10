/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'

let mockStore: any

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key === 'sector.new_station_name' ? 'New Station' : key
  })
}))

vi.mock('@/store/useEmpireStore', () => ({
  useEmpireStore: () => mockStore
}))

import SectorManagementPanel from '@/components/empire/SectorManagementPanel.vue'

const DraggableStub = defineComponent({
  name: 'DraggableStub',
  props: {
    modelValue: {
      type: Array,
      default: () => []
    }
  },
  template: `
    <div>
      <slot
        v-for="el in modelValue"
        name="item"
        :key="el.id"
        :element="el"
      />
    </div>
  `
})

describe('SectorManagementPanel unassigned create naming', () => {
  beforeEach(() => {
    const stations: any[] = []
    const createStation = vi.fn((name: string) => {
      stations.push({
        id: `st-${stations.length + 1}`,
        name,
        sectorId: null,
        modules: []
      })
      return stations[stations.length - 1]
    })

    mockStore = {
      sectors: [{ id: 'sec-1', name: 'Sector 1', order: 0 }],
      activeEmpire: { stations },
      moveStationToSector: vi.fn(),
      setSectorStationOrder: vi.fn(),
      reorderSectors: vi.fn(),
      createSector: vi.fn(),
      renameSector: vi.fn(),
      deleteSector: vi.fn(),
      getLinkedSectors: vi.fn(() => []),
      createSectorLink: vi.fn(() => ({ ok: true })),
      removeSectorLink: vi.fn(() => true),
      createStation,
      deleteStation: vi.fn()
    }
  })

  it('auto-appends index from 2 when adding duplicate names continuously', async () => {
    const wrapper = mount(SectorManagementPanel, {
      global: {
        stubs: { draggable: DraggableStub },
        mocks: { $t: (key: string) => key }
      }
    })

    const input = wrapper.find('.unassigned-station-input')
    const addBtn = wrapper.find('[aria-label=\"create-unassigned-station\"]')
    expect(input.exists()).toBe(true)
    expect(addBtn.exists()).toBe(true)

    await input.setValue('Alpha')
    await addBtn.trigger('click')
    await addBtn.trigger('click')
    await addBtn.trigger('click')

    expect(mockStore.createStation).toHaveBeenNthCalledWith(1, 'Alpha', 'industrial', false)
    expect(mockStore.createStation).toHaveBeenNthCalledWith(2, 'Alpha 2', 'industrial', false)
    expect(mockStore.createStation).toHaveBeenNthCalledWith(3, 'Alpha 3', 'industrial', false)
  })
})

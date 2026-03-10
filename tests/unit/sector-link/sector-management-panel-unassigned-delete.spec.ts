/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'

const deleteStation = vi.fn()

let mockStore: any

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
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

function mountPanel() {
  return mount(SectorManagementPanel, {
    global: {
      stubs: { draggable: DraggableStub },
      mocks: { $t: (key: string) => key }
    }
  })
}

describe('SectorManagementPanel unassigned delete flow', () => {
  beforeEach(() => {
    deleteStation.mockClear()
  })

  it('deletes unassigned station directly when it has no modules', async () => {
    mockStore = {
      sectors: [{ id: 'sec-1', name: 'Sector 1', order: 0 }],
      activeEmpire: {
        stations: [
          { id: 'st-1', name: 'U-1', sectorId: null, modules: [] }
        ]
      },
      moveStationToSector: vi.fn(),
      setSectorStationOrder: vi.fn(),
      reorderSectors: vi.fn(),
      createSector: vi.fn(),
      renameSector: vi.fn(),
      deleteSector: vi.fn(),
      getLinkedSectors: vi.fn(() => []),
      createSectorLink: vi.fn(() => ({ ok: true })),
      removeSectorLink: vi.fn(() => true),
      createStation: vi.fn(),
      deleteStation
    }

    const wrapper = mountPanel()
    const btn = wrapper.find('.sector-unassigned .station-chip .icon-btn.subtle-delete')
    expect(btn.exists()).toBe(true)
    await btn.trigger('click')

    expect(deleteStation).toHaveBeenCalledTimes(1)
    expect(deleteStation).toHaveBeenCalledWith('st-1')
    expect(wrapper.find('.modal-backdrop').exists()).toBe(false)
  })

  it('opens confirmation for unassigned station with modules, then deletes on confirm', async () => {
    mockStore = {
      sectors: [{ id: 'sec-1', name: 'Sector 1', order: 0 }],
      activeEmpire: {
        stations: [
          { id: 'st-2', name: 'U-2', sectorId: null, modules: [{ id: 'm1', count: 2 }] }
        ]
      },
      moveStationToSector: vi.fn(),
      setSectorStationOrder: vi.fn(),
      reorderSectors: vi.fn(),
      createSector: vi.fn(),
      renameSector: vi.fn(),
      deleteSector: vi.fn(),
      getLinkedSectors: vi.fn(() => []),
      createSectorLink: vi.fn(() => ({ ok: true })),
      removeSectorLink: vi.fn(() => true),
      createStation: vi.fn(),
      deleteStation
    }

    const wrapper = mountPanel()
    const btn = wrapper.find('.sector-unassigned .station-chip .icon-btn.subtle-delete')
    await btn.trigger('click')

    expect(deleteStation).not.toHaveBeenCalled()
    expect(wrapper.find('.modal-backdrop').exists()).toBe(true)

    const confirmBtn = wrapper.find('.btn-danger')
    await confirmBtn.trigger('click')
    expect(deleteStation).toHaveBeenCalledTimes(1)
    expect(deleteStation).toHaveBeenCalledWith('st-2')
  })
})

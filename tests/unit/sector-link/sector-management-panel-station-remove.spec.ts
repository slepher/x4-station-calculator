/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'

const moveStationToSector = vi.fn()

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/store/useEmpireStore', () => ({
  useEmpireStore: () => ({
    sectors: [{ id: 'sec-1', name: 'Sector 1', order: 0 }],
    activeEmpire: {
      stations: [
        { id: 'st-1', name: 'Station 1', sectorId: 'sec-1' }
      ]
    },
    moveStationToSector,
    setSectorStationOrder: vi.fn(),
    reorderSectors: vi.fn(),
    createSector: vi.fn(),
    renameSector: vi.fn(),
    deleteSector: vi.fn(),
    getLinkedSectors: vi.fn(() => []),
    createSectorLink: vi.fn(() => ({ ok: true })),
    removeSectorLink: vi.fn(() => true)
  })
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

describe('SectorManagementPanel station remove-to-unassigned', () => {
  it('shows x button on sector station chip and moves station to unassigned on click', async () => {
    moveStationToSector.mockClear()
    const wrapper = mount(SectorManagementPanel, {
      global: {
        stubs: {
          draggable: DraggableStub
        },
        mocks: {
          $t: (key: string) => key
        }
      }
    })

    const buttons = wrapper.findAll('.sector-stations .station-chip .icon-btn.subtle-delete')
    expect(buttons.length).toBe(1)
    await buttons[0]!.trigger('click')

    expect(moveStationToSector).toHaveBeenCalledWith('st-1', null)
  })
})

/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'

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

describe('SectorManagementPanel sector create naming', () => {
  beforeEach(() => {
    const sectors: any[] = []
    const createSector = vi.fn((name: string) => {
      sectors.push({
        id: `sec-${sectors.length + 1}`,
        name,
        order: sectors.length
      })
      return sectors[sectors.length - 1]
    })

    mockStore = {
      sectors,
      activeEmpire: { stations: [] },
      moveStationToSector: vi.fn(),
      setSectorStationOrder: vi.fn(),
      reorderSectors: vi.fn(),
      createSector,
      renameSector: vi.fn(),
      deleteSector: vi.fn(),
      getLinkedSectors: vi.fn(() => []),
      createSectorLink: vi.fn(() => ({ ok: true })),
      removeSectorLink: vi.fn(() => true),
      createStation: vi.fn(),
      deleteStation: vi.fn()
    }
  })

  it('auto-appends index from 2 for duplicate sector names', async () => {
    const wrapper = mount(SectorManagementPanel, {
      global: {
        stubs: { draggable: DraggableStub },
        mocks: { $t: (key: string) => key }
      }
    })

    const input = wrapper.find('.sector-panel-header .sector-input')
    const btn = wrapper.find('[aria-label=\"create-sector\"]')
    expect(input.exists()).toBe(true)
    expect(btn.exists()).toBe(true)

    await input.setValue('Trade Hub')
    await btn.trigger('click')
    expect((input.element as HTMLInputElement).value).toBe('Trade Hub')

    await input.setValue('Trade Hub')
    await btn.trigger('click')

    await input.setValue('Trade Hub')
    await btn.trigger('click')

    expect(mockStore.createSector).toHaveBeenNthCalledWith(1, 'Trade Hub')
    expect(mockStore.createSector).toHaveBeenNthCalledWith(2, 'Trade Hub 2')
    expect(mockStore.createSector).toHaveBeenNthCalledWith(3, 'Trade Hub 3')
  })
})

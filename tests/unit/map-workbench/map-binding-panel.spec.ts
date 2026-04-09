/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import MapBindingPanel from '@/components/map/MapBindingPanel.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    te: () => false
  })
}))

vi.mock('@/components/map/utils/mapSectorMacro', () => ({
  resolveMapSectorByMacro: vi.fn(() => null)
}))

vi.mock('@/components/map/MapBindingSelectArchive.vue', () => ({
  default: {
    name: 'MapBindingSelectArchive',
    emits: ['preview', 'bind'],
    template: `
      <div>
        <button data-testid="preview-time" @click="$emit('preview', { gameGuid: 'g-1', time: 7200 })">preview</button>
        <button data-testid="bind-time" @click="$emit('bind', { gameGuid: 'g-1', time: 7200 })">bind</button>
      </div>
    `
  }
}))

vi.mock('@/components/map/MapBindingSectorGroup.vue', () => ({
  default: {
    name: 'MapBindingSectorGroup',
    template: '<div data-testid="binding-sector-group" />'
  }
}))

vi.mock('@/components/map/MapBindingStation.vue', () => ({
  default: {
    name: 'MapBindingStation',
    template: '<div data-testid="binding-station" />'
  }
}))

vi.mock('@/store/useEmpireStore', () => ({
  useEmpireStore: vi.fn()
}))

vi.mock('@/store/useSaveStore', () => ({
  useSaveStore: vi.fn()
}))

vi.mock('@/store/useGameDataStore', () => ({
  useGameDataStore: vi.fn()
}))

import { useEmpireStore } from '@/store/useEmpireStore'
import { useSaveStore } from '@/store/useSaveStore'
import { useGameDataStore } from '@/store/useGameDataStore'

describe('MapBindingPanel step 1 interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('previewing a time selects archive but stays on step 1', async () => {
    const selectedArchive = ref({ meta: { guid: 'prev', time: 1000 } })
    const selectArchive = vi.fn()

    vi.mocked(useEmpireStore).mockReturnValue({
      activeEmpire: { saveBindings: [], sectors: [] },
      createBinding: vi.fn(),
      setSelectedArchiveTime: vi.fn()
    } as any)
    vi.mocked(useSaveStore).mockReturnValue({
      selectedArchive,
      selectArchive,
      archives: new Map(),
      archiveGroups: [
        {
          guid: 'g-1',
          playerName: 'slepher',
          saves: []
        }
      ]
    } as any)
    vi.mocked(useGameDataStore).mockReturnValue({ maps: null } as any)

    const wrapper = mount(MapBindingPanel, {
      props: { open: true }
    })

    await wrapper.get('[data-testid="preview-time"]').trigger('click')

    expect(selectArchive).toHaveBeenCalledWith('g-1', 7200)
    expect(wrapper.find('[data-testid="binding-sector-group"]').exists()).toBe(false)
  })

  it('binding a time creates or updates binding and navigates to step 2', async () => {
    const selectedArchive = ref({ meta: { guid: 'prev', time: 1000 } })
    const selectArchive = vi.fn()
    const createBinding = vi.fn()
    const setSelectedArchiveTime = vi.fn()

    vi.mocked(useEmpireStore).mockReturnValue({
      activeEmpire: { saveBindings: [], sectors: [] },
      createBinding,
      setSelectedArchiveTime
    } as any)
    vi.mocked(useSaveStore).mockReturnValue({
      selectedArchive,
      selectArchive,
      archives: new Map(),
      archiveGroups: [
        {
          guid: 'g-1',
          playerName: 'slepher',
          saves: []
        }
      ]
    } as any)
    vi.mocked(useGameDataStore).mockReturnValue({ maps: null } as any)

    const wrapper = mount(MapBindingPanel, {
      props: { open: true }
    })

    await wrapper.get('[data-testid="bind-time"]').trigger('click')

    expect(createBinding).toHaveBeenCalledWith('g-1')
    expect(setSelectedArchiveTime).toHaveBeenCalledWith('g-1', 7200)
    expect(selectArchive).toHaveBeenCalledWith('g-1', 7200)
    expect(wrapper.find('[data-testid="binding-sector-group"]').exists()).toBe(true)
  })
})

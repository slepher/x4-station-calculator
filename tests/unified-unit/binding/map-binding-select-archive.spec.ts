/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import MapBindingSelectArchive from '@/components/map/MapBindingSelectArchive.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (key === 'map.binding_station_count') return `${params?.count} stations`
      return key
    }
  })
}))

vi.mock('@/store/useSaveStore', () => ({
  useSaveStore: vi.fn()
}))

vi.mock('@/store/useEmpireStore', () => ({
  useEmpireStore: vi.fn()
}))

import { useSaveStore } from '@/store/useSaveStore'
import { useEmpireStore } from '@/store/useEmpireStore'

const createSaveStore = () => ({
  archiveGroups: [
    {
      guid: 'g-1',
      playerName: 'slepher',
      saves: [
        {
          meta: {
            guid: 'g-1',
            time: 7200,
            filename: 'save_002'
          }
        },
        {
          meta: {
            guid: 'g-1',
            time: 3600,
            filename: 'save_001'
          }
        }
      ]
    }
  ]
})

describe('MapBindingSelectArchive', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('clicking a time previews that time instead of binding immediately', async () => {
    vi.mocked(useSaveStore).mockReturnValue(createSaveStore() as any)
    vi.mocked(useEmpireStore).mockReturnValue({
      activeEmpire: {
        saveBindings: []
      }
    } as any)

    const wrapper = mount(MapBindingSelectArchive, {
      props: {
        previewGameGuid: null,
        previewTime: null
      }
    })

    const archiveItems = wrapper.findAll('[data-testid="binding-archive-time"]')
    await archiveItems[0]!.trigger('click')

    expect(wrapper.emitted('preview')).toEqual([[{ gameGuid: 'g-1', time: 7200 }]])
    expect(wrapper.emitted('bind')).toBeUndefined()
  })

  it('clicking a time bind button emits a bind event for that specific time', async () => {
    vi.mocked(useSaveStore).mockReturnValue(createSaveStore() as any)
    vi.mocked(useEmpireStore).mockReturnValue({
      activeEmpire: {
        saveBindings: []
      }
    } as any)

    const wrapper = mount(MapBindingSelectArchive, {
      props: {
        previewGameGuid: null,
        previewTime: null
      }
    })

    const bindButtons = wrapper.findAll('[data-testid="binding-archive-bind-time"]')
    await bindButtons[0]!.trigger('click')

    expect(wrapper.emitted('bind')).toEqual([[{ gameGuid: 'g-1', time: 7200 }]])
    expect(wrapper.emitted('preview')).toBeUndefined()
  })

  it('shows solid latest binding on title and dashed binding on latest time when binding tracks latest', () => {
    vi.mocked(useSaveStore).mockReturnValue(createSaveStore() as any)
    vi.mocked(useEmpireStore).mockReturnValue({
      activeEmpire: {
        saveBindings: [
          {
            gameGuid: 'g-1',
            selectedArchiveTime: null
          }
        ]
      }
    } as any)

    const wrapper = mount(MapBindingSelectArchive, {
      props: {
        previewGameGuid: 'g-1',
        previewTime: 3600
      }
    })

    expect(wrapper.get('[data-testid="binding-archive-title-bound"]').classes()).toContain('bound-badge--solid')
    expect(wrapper.get('[data-testid="binding-archive-time-bound"]').classes()).toContain('bound-tag--dashed')
  })
})

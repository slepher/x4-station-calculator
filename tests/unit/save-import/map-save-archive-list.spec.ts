/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import MapSaveArchiveList from '@/components/map/MapSaveArchiveList.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/components/save/SaveUploadPanel.vue', () => ({
  default: {
    name: 'SaveUploadPanel',
    template: '<div data-testid="save-upload-panel" />'
  }
}))

const createMockStore = (overrides = {}) => ({
  archiveGroups: [],
  totalArchiveCount: 0,
  savedArchivesState: {
    activeArchiveId: null as string | null,
    list: [],
    settings: {
      visibility: {
        playerStation: false,
        npcStation: false,
        xenonStation: false,
        khaakStation: false,
        abandonedShip: false,
        datavault: false,
        erlkingVault: false
      },
      excludeConditionalSmallStations: false
    }
  },
  ...overrides
})

vi.mock('@/store/useSaveStore', () => ({
  useSaveStore: vi.fn()
}))

import { useSaveStore } from '@/store/useSaveStore'

describe('MapSaveArchiveList invalid archive behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not emit select when clicking an invalid archive', async () => {
    const mockStore = createMockStore({
      archiveGroups: [
        {
          guid: 'g1',
          playerName: 'Tester',
          saves: [
            {
              meta: {
                guid: 'g1',
                seed: 1,
                time: 10,
                playerName: 'Tester',
                version: '8.0',
                filename: 'invalid-save.xml',
                parser_version: 'v1',
                post_processor_version: 'v1',
                source: 'original'
              },
              sectors: {},
              isCompatible: true,
              isValid: false
            }
          ]
        }
      ],
      totalArchiveCount: 1
    })
    
    vi.mocked(useSaveStore).mockReturnValue(mockStore as any)

    const wrapper = mount(MapSaveArchiveList)

    // There should be 2 save-items: default map + 1 invalid archive
    const saveItems = wrapper.findAll('.save-item')
    expect(saveItems.length).toBe(2)

    // First item is default map
    expect(saveItems[0]?.text()).toContain('map.save_default_map')

    // Second item is invalid archive
    const invalidItem = saveItems[1]
    expect(invalidItem?.classes()).toContain('save-item-disabled')
    expect(invalidItem?.attributes('title')).toBe('map.save_invalid_archive_hint')

    // Click disabled archive should not emit
    await invalidItem?.trigger('click')
    expect(wrapper.emitted('select')).toBeUndefined()
  })

  it('emits select with null when clicking default map', async () => {
    const mockStore = createMockStore()
    vi.mocked(useSaveStore).mockReturnValue(mockStore as any)

    const wrapper = mount(MapSaveArchiveList)

    const saveItems = wrapper.findAll('.save-item')
    const defaultMapItem = saveItems[0]

    await defaultMapItem?.trigger('click')

    expect(wrapper.emitted('select')).toHaveLength(1)
    expect(wrapper.emitted('select')![0]).toEqual([null])
  })
})

describe('MapSaveArchiveList active archive highlighting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('highlights default map when no archive is active', async () => {
    const mockStore = createMockStore()
    vi.mocked(useSaveStore).mockReturnValue(mockStore as any)

    const wrapper = mount(MapSaveArchiveList)

    const saveItems = wrapper.findAll('.save-item')
    const defaultMapItem = saveItems[0]

    expect(defaultMapItem?.classes()).toContain('save-item-active')
  })

  it('highlights active archive with .save-item-active class', async () => {
    const mockStore = createMockStore({
      archiveGroups: [
        {
          guid: 'g1',
          playerName: 'Tester',
          saves: [
            {
              meta: {
                guid: 'g1',
                seed: 1,
                time: 10,
                playerName: 'Tester',
                version: '8.0',
                filename: 'save.xml',
                parser_version: 'v2',
                post_processor_version: 'v7',
                source: 'original'
              },
              sectors: {},
              isCompatible: true,
              isValid: true
            }
          ]
        }
      ],
      totalArchiveCount: 1,
      savedArchivesState: {
        activeArchiveId: 'g1_10' as string | null,
        list: [],
        settings: {
          visibility: {
            playerStation: false,
            npcStation: false,
            xenonStation: false,
            khaakStation: false,
            abandonedShip: false,
            datavault: false,
            erlkingVault: false
          },
          excludeConditionalSmallStations: false
        }
      }
    })
    
    vi.mocked(useSaveStore).mockReturnValue(mockStore as any)

    const wrapper = mount(MapSaveArchiveList)

    const saveItems = wrapper.findAll('.save-item')
    const archiveItem = saveItems[1]

    expect(archiveItem?.classes()).toContain('save-item-active')
    expect(saveItems[0]?.classes()).not.toContain('save-item-active')
  })
})

describe('MapSaveArchiveList navigation behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('clicks archive body emits select event', async () => {
    const mockStore = createMockStore({
      archiveGroups: [
        {
          guid: 'g1',
          playerName: 'Tester',
          saves: [
            {
              meta: {
                guid: 'g1',
                seed: 1,
                time: 10,
                playerName: 'Tester',
                version: '8.0',
                filename: 'valid-save.xml',
                parser_version: 'v2',
                post_processor_version: 'v7',
                source: 'original'
              },
              sectors: {},
              isCompatible: true,
              isValid: true
            }
          ]
        }
      ],
      totalArchiveCount: 1
    })

    vi.mocked(useSaveStore).mockReturnValue(mockStore as any)

    const wrapper = mount(MapSaveArchiveList)

    const saveItems = wrapper.findAll('.save-item')
    expect(saveItems.length).toBe(2) // default map + 1 valid archive

    const archiveItem = saveItems[1]

    // Click on .save-info (archive body)
    await archiveItem?.find('.save-info').trigger('click')

    expect(wrapper.emitted('select')).toHaveLength(1)
    expect(wrapper.emitted('select')![0]).toEqual([{ guid: 'g1', time: 10 }])
  })

  it('clicks arrow button emits select-and-navigate event', async () => {
    const mockStore = createMockStore({
      archiveGroups: [
        {
          guid: 'g1',
          playerName: 'Tester',
          saves: [
            {
              meta: {
                guid: 'g1',
                seed: 1,
                time: 10,
                playerName: 'Tester',
                version: '8.0',
                filename: 'valid-save.xml',
                parser_version: 'v2',
                post_processor_version: 'v7',
                source: 'original'
              },
              sectors: {},
              isCompatible: true,
              isValid: true
            }
          ]
        }
      ],
      totalArchiveCount: 1
    })

    vi.mocked(useSaveStore).mockReturnValue(mockStore as any)

    const wrapper = mount(MapSaveArchiveList)

    const saveItems = wrapper.findAll('.save-item')
    const archiveItem = saveItems[1]

    // Verify arrow button exists
    expect(archiveItem?.find('.save-arrow').exists()).toBe(true)

    // Click on arrow button
    await archiveItem?.find('.save-arrow').trigger('click')

    expect(wrapper.emitted('select-and-navigate')).toHaveLength(1)
    expect(wrapper.emitted('select-and-navigate')![0]).toEqual([{ guid: 'g1', time: 10 }])
  })
})

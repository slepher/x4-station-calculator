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
      }
    }
  },
  ...overrides
})

const createEmpireStore = (overrides = {}) => ({
  activeEmpire: {
    saveBindings: [],
    ...overrides
  }
})

vi.mock('@/store/useSaveStore', () => ({
  useSaveStore: vi.fn()
}))

vi.mock('@/store/useEmpireStore', () => ({
  useEmpireStore: vi.fn()
}))

import { useSaveStore } from '@/store/useSaveStore'
import { useEmpireStore } from '@/store/useEmpireStore'

describe('MapSaveArchiveList invalid archive behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useEmpireStore).mockReturnValue(createEmpireStore() as any)
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
    vi.mocked(useEmpireStore).mockReturnValue(createEmpireStore() as any)
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
          }
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
    vi.mocked(useEmpireStore).mockReturnValue(createEmpireStore() as any)
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

  it('clicks poi icon emits navigate event for that specific time', async () => {
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

    expect(archiveItem?.find('[data-testid="save-time-poi"]').exists()).toBe(true)

    await archiveItem?.find('[data-testid="save-time-poi"]').trigger('click')

    expect(wrapper.emitted('navigate')).toHaveLength(1)
    expect(wrapper.emitted('navigate')![0]).toEqual([{ guid: 'g1', time: 10 }])
  })

  it('clicking group container emits guid-level selection event', async () => {
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

    await wrapper.get('[data-testid="save-group"]').trigger('click')

    expect(wrapper.emitted('select-group')).toHaveLength(1)
    expect(wrapper.emitted('select-group')![0]).toEqual([{ guid: 'g1' }])
    expect(wrapper.emitted('navigate')).toBeUndefined()
  })

  it('clicking archive body does not bubble to guid-level selection', async () => {
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

    await wrapper.findAll('.save-item')[1]?.find('.save-info').trigger('click')

    expect(wrapper.emitted('select')).toHaveLength(1)
    expect(wrapper.emitted('select')![0]).toEqual([{ guid: 'g1', time: 10 }])
    expect(wrapper.emitted('select-group')).toBeUndefined()
  })
})

describe('MapSaveArchiveList step 1 icon projection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows binding and poi state on title and latest time when both are guid-level', () => {
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
                time: 20,
                playerName: 'Tester',
                version: '8.0',
                filename: 'save_latest.xml',
                parser_version: 'v2',
                post_processor_version: 'v7',
                source: 'original'
              },
              sectors: {},
              isCompatible: true,
              isValid: true
            },
            {
              meta: {
                guid: 'g1',
                seed: 1,
                time: 10,
                playerName: 'Tester',
                version: '8.0',
                filename: 'save_old.xml',
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
      totalArchiveCount: 2,
      savedArchivesState: {
        activeArchiveId: 'g1',
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
          }
        }
      }
    })

    vi.mocked(useSaveStore).mockReturnValue(mockStore as any)
    vi.mocked(useEmpireStore).mockReturnValue(createEmpireStore({
      saveBindings: [{ gameGuid: 'g1', selectedArchiveTime: null }]
    }) as any)

    const wrapper = mount(MapSaveArchiveList)

    expect(wrapper.find('[data-testid="save-group-poi-active"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="save-group-bind-active"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="save-group-active"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="save-time-poi-active"]')).toHaveLength(1)
    expect(wrapper.findAll('[data-testid="save-time-bind-active"]')).toHaveLength(1)
    expect(wrapper.findAll('.save-item-active')).toHaveLength(1)
  })

  it('shows binding and poi state only on the specific time when both are time-level', () => {
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
                time: 20,
                playerName: 'Tester',
                version: '8.0',
                filename: 'save_latest.xml',
                parser_version: 'v2',
                post_processor_version: 'v7',
                source: 'original'
              },
              sectors: {},
              isCompatible: true,
              isValid: true
            },
            {
              meta: {
                guid: 'g1',
                seed: 1,
                time: 10,
                playerName: 'Tester',
                version: '8.0',
                filename: 'save_old.xml',
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
      totalArchiveCount: 2,
      savedArchivesState: {
        activeArchiveId: 'g1_10',
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
          }
        }
      }
    })

    vi.mocked(useSaveStore).mockReturnValue(mockStore as any)
    vi.mocked(useEmpireStore).mockReturnValue(createEmpireStore({
      saveBindings: [{ gameGuid: 'g1', selectedArchiveTime: 10 }]
    }) as any)

    const wrapper = mount(MapSaveArchiveList)

    expect(wrapper.find('[data-testid="save-group-poi-active"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="save-group-bind-active"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="save-group-active"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid="save-time-poi-active"]')).toHaveLength(1)
    expect(wrapper.findAll('[data-testid="save-time-bind-active"]')).toHaveLength(1)
  })

  it('does not highlight the group container for guid-level binding without guid-level poi active', () => {
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
                time: 20,
                playerName: 'Tester',
                version: '8.0',
                filename: 'save_latest.xml',
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
        activeArchiveId: 'g1_20',
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
          }
        }
      }
    })

    vi.mocked(useSaveStore).mockReturnValue(mockStore as any)
    vi.mocked(useEmpireStore).mockReturnValue(createEmpireStore({
      saveBindings: [{ gameGuid: 'g1', selectedArchiveTime: null }]
    }) as any)

    const wrapper = mount(MapSaveArchiveList)

    expect(wrapper.find('[data-testid="save-group-bind-active"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="save-group-active"]').exists()).toBe(false)
    expect(wrapper.findAll('.save-item-active')).toHaveLength(1)
  })
})

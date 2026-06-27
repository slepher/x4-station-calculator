/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import MapSavePanel from '@/components/map/MapSavePanel.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => {
      if (key === 'map.binding_title') return '绑定'
      if (key === 'map.save_breadcrumb_root') return '存档'
      return key
    }
  })
}))

vi.mock('@/components/map/MapSaveBreadcrumb.vue', () => ({
  default: {
    name: 'MapSaveBreadcrumb',
    props: ['items'],
    template: '<div data-testid="save-breadcrumb">{{ items.map((item) => item.label).join(" / ") }}</div>'
  }
}))

vi.mock('@/components/map/MapSaveArchiveList.vue', () => ({
  default: {
    name: 'MapSaveArchiveList',
    emits: ['select', 'select-group', 'navigate', 'bind'],
    template: '<div data-testid="save-archive-list" />'
  }
}))

vi.mock('@/components/map/MapSaveCategoryMenu.vue', () => ({
  default: {
    name: 'MapSaveCategoryMenu',
    template: '<div data-testid="save-category-menu" />'
  }
}))

vi.mock('@/components/map/MapSaveCoordList.vue', () => ({
  default: {
    name: 'MapSaveCoordList',
    template: '<div data-testid="save-coord-list" />'
  }
}))

vi.mock('@/components/map/AutoSectorGroupPanel.vue', () => ({
  default: {
    name: 'AutoSectorGroupPanel',
    emits: ['select-group'],
    template: '<div data-testid="auto-sector-group-panel" />'
  }
}))

vi.mock('@/components/map/MapBindingStation.vue', () => ({
  default: {
    name: 'MapBindingStation',
    template: '<div data-testid="binding-station" />'
  }
}))

vi.mock('@/store/useSaveStore', () => ({
  useSaveStore: vi.fn()
}))

vi.mock('@/store/useSaveBindingStore', () => ({
  useSaveBindingStore: vi.fn()
}))

vi.mock('@/store/useActiveViewStore', () => ({
  useActiveViewStore: vi.fn()
}))

import { useSaveStore } from '@/store/useSaveStore'
import { useSaveBindingStore } from '@/store/useSaveBindingStore'
import { useActiveViewStore } from '@/store/useActiveViewStore'

let mockedSaveStore: any
let mockedSaveBindingStore: any
let mockedActiveViewStore: any
const testerArchive = {
  meta: {
    guid: 'g-1',
    seed: 1,
    time: 10,
    playerName: 'Tester',
    version: '8.0',
    filename: 'save_001.xml',
    parser_version: 'v2',
    post_processor_version: 'v7',
    source: 'original'
  },
  sectors: {},
  isCompatible: true,
  isValid: true
}

describe('MapSavePanel open behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedSaveStore = {
      archiveGroups: [
        { guid: 'g-1', playerName: 'Tester', saves: [{ meta: testerArchive.meta }] }
      ],
      selectedArchive: null,
      archives: new Map([
        ['g-1', { guid: 'g-1', playerName: 'Tester', saves: [testerArchive] }]
      ]),
      selectArchive: vi.fn(),
      selectArchiveGroup: vi.fn()
    }
    mockedSaveBindingStore = {
      activeBinding: {
        groups: [
          { id: 'sector-1', name: 'Sector 1' }
        ]
      },
      bindings: [],
      createOrOpenBinding: vi.fn()
    }
    mockedActiveViewStore = {
      mapSavePanelLayer: ref('list'),
      mapBindingGameGuid: ref(null),
      mapSavePanelSectorGroupId: ref(null)
    }
    vi.mocked(useSaveStore).mockReturnValue(mockedSaveStore as any)
    vi.mocked(useSaveBindingStore).mockReturnValue(mockedSaveBindingStore as any)
    vi.mocked(useActiveViewStore).mockReturnValue(mockedActiveViewStore as any)
  })
  it('stays on archive list when opened with an already selected archive', () => {
    const wrapper = mount(MapSavePanel, {
      props: {
        open: true,
        archive: {
          meta: testerArchive.meta,
          sectors: {}
        },
        visibility: {
          playerStation: true,
          npcStation: true,
          xenonStation: true,
          khaakStation: true,
          abandonedShip: true,
          datavault: true,
          erlkingVault: true
        }
      }
    })

    expect(wrapper.find('[data-testid="save-archive-list"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="save-category-menu"]').exists()).toBe(false)
  })

  it('switches breadcrumb to save name + binding when bind is started from archive list', async () => {
    const wrapper = mount(MapSavePanel, {
      props: {
        open: true,
        archive: testerArchive
      }
    })

    await wrapper.getComponent({ name: 'MapSaveArchiveList' }).vm.$emit('bind', { guid: 'g-1', time: null })
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[data-testid="save-breadcrumb"]').text()).toContain('Tester 绑定')
    expect(wrapper.find('[data-testid="auto-sector-group-panel"]').exists()).toBe(true)
    expect(mockedSaveStore.selectArchiveGroup).toHaveBeenCalledWith('g-1')
    expect(mockedSaveStore.selectArchive).not.toHaveBeenCalled()
  })

  it('keeps archive list open when guid-level title selection is triggered', async () => {
    const wrapper = mount(MapSavePanel, {
      props: {
        open: true,
        archive: null
      }
    })

    await wrapper.getComponent({ name: 'MapSaveArchiveList' }).vm.$emit('select-group', { guid: 'g-1' })

    expect(mockedSaveStore.selectArchiveGroup).toHaveBeenCalledWith('g-1')
    expect(wrapper.emitted('select-archive')?.[0]).toEqual([{ guid: 'g-1', time: 10 }])
    expect(wrapper.find('[data-testid="save-archive-list"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="save-category-menu"]').exists()).toBe(false)
  })

  it('uses the latest valid archive when opening guid-level archive details', async () => {
    const wrapper = mount(MapSavePanel, {
      props: {
        open: true,
        archive: testerArchive
      }
    })

    await wrapper.getComponent({ name: 'MapSaveArchiveList' }).vm.$emit('navigate', { guid: 'g-1', time: null })
    await wrapper.vm.$nextTick()

    expect(mockedSaveStore.selectArchiveGroup).toHaveBeenCalledWith('g-1')
    expect(wrapper.emitted('select-archive')?.[0]).toEqual([{ guid: 'g-1', time: 10 }])
    expect(wrapper.find('[data-testid="save-category-menu"]').exists()).toBe(true)
  })

  it('updates active archive in savePanel when a specific time is selected from the archive list', async () => {
    const wrapper = mount(MapSavePanel, {
      props: {
        open: true,
        archive: testerArchive
      }
    })

    await wrapper.getComponent({ name: 'MapSaveArchiveList' }).vm.$emit('select', { guid: 'g-1', time: 10 })

    expect(mockedSaveStore.selectArchive).toHaveBeenCalledWith('g-1', 10)
    expect(wrapper.emitted('select-archive')?.[0]).toEqual([{ guid: 'g-1', time: 10 }])
  })

  it('shows third breadcrumb level when entering binding step 3', async () => {
    const wrapper = mount(MapSavePanel, {
      props: {
        open: true,
        archive: testerArchive
      }
    })

    await wrapper.getComponent({ name: 'MapSaveArchiveList' }).vm.$emit('bind', { guid: 'g-1', time: null })
    await wrapper.vm.$nextTick()
    await wrapper.getComponent({ name: 'AutoSectorGroupPanel' }).vm.$emit('select-group', 'sector-1')
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[data-testid="save-breadcrumb"]').text()).toContain('Sector 1')
    expect(wrapper.find('[data-testid="binding-station"]').exists()).toBe(true)
  })

  it('navigates root breadcrumb back to archive list without restoring archive selection', async () => {
    const wrapper = mount(MapSavePanel, {
      props: {
        open: true,
        archive: testerArchive
      }
    })

    await wrapper.getComponent({ name: 'MapSaveArchiveList' }).vm.$emit('bind', { guid: 'g-1', time: null })
    await wrapper.vm.$nextTick()
    await wrapper.getComponent({ name: 'MapSaveBreadcrumb' }).vm.$emit('navigate', 'root')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="save-archive-list"]').exists()).toBe(true)
    expect(mockedSaveStore.selectArchive).not.toHaveBeenCalled()
  })
})

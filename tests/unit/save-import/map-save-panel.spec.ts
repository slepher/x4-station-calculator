/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import MapSavePanel from '@/components/map/MapSavePanel.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
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

describe('MapSavePanel open behavior', () => {
  it('stays on archive list when opened with an already selected archive', () => {
    const wrapper = mount(MapSavePanel, {
      props: {
        open: true,
        archive: {
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
})

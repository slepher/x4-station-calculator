/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import MapSaveArchiveList from '@/components/empire/MapSaveArchiveList.vue'

const saveStore = {
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
}

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/store/useSaveStore', () => ({
  useSaveStore: () => saveStore
}))

vi.mock('@/components/save/SaveUploadPanel.vue', () => ({
  default: {
    name: 'SaveUploadPanel',
    template: '<div data-testid="save-upload-panel" />'
  }
}))

describe('MapSaveArchiveList invalid archive behavior', () => {
  it('does not emit select when clicking an invalid archive', async () => {
    const wrapper = mount(MapSaveArchiveList)

    await wrapper.get('.save-item').trigger('click')

    expect(wrapper.emitted('select')).toBeUndefined()
    expect(wrapper.get('.save-item').attributes('title')).toBe('map.save_invalid_archive_hint')
    expect(wrapper.get('.save-item').classes()).toContain('save-item-disabled')
  })
})

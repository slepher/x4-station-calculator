/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import SaveDetailPanel from '@/components/save/SaveDetailPanel.vue'
import type { SaveArchive } from '@/types/saveArchive'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/components/common/ViewTabUI.vue', () => ({
  default: {
    name: 'ViewTabUI',
    template: '<div data-testid="view-tab-ui" />'
  }
}))

describe('SaveDetailPanel invalid badge', () => {
  it('shows invalid badge when archive is invalid', () => {
    const archive: SaveArchive = {
      meta: {
        guid: 'g',
        seed: 1,
        time: 1,
        playerName: 'Tester',
        version: '8.0',
        filename: 'save.xml',
        parser_version: 'v1',
        post_processor_version: 'v1',
        source: 'original'
      },
      sectors: {},
      isCompatible: true,
      isValid: false
    }

    const wrapper = mount(SaveDetailPanel, {
      props: { archive }
    })

    expect(wrapper.text()).toContain('save_import.invalid_archive')
  })
})

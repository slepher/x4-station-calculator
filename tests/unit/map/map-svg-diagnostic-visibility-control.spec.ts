/**
 * @vitest-environment jsdom
 */
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import MapSvgDiagnosticVisibilityControl from '@/components/map/MapSvgDiagnosticVisibilityControl.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

describe('MapSvgDiagnosticVisibilityControl', () => {
  it('does not expose sector group color or route toggles', () => {
    const wrapper = mount(MapSvgDiagnosticVisibilityControl, {
      props: {
        expanded: true,
        visibility: {
          sectorLabels: true,
          sectorLinks: true,
          sectorFactionFill: true
        }
      }
    })

    expect(wrapper.text()).not.toContain('map.debug_visibility_sector_group_colors')
    expect(wrapper.text()).not.toContain('map.debug_visibility_sector_routes')
    expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(3)
  })
})

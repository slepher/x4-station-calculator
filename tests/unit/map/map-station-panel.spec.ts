/**
 * @vitest-environment jsdom
 */
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import MapStationPanel from '@/components/map/MapStationPanel.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

describe('MapStationPanel custom drag', () => {
  it('starts dragging after pointer movement exceeds the threshold and ends on mouseup', async () => {
    const wrapper = mount(MapStationPanel, {
      props: {
        open: true,
        items: [{
          id: 'station-1',
          kind: 'station',
          name: 'Alpha Station',
          icon: 'factory',
          groupId: 'g1',
          groupName: 'Group 1'
        }]
      }
    })

    const item = wrapper.get('[data-testid="station-item-station-1"]')
    await item.trigger('mousedown', {
      button: 0,
      clientX: 100,
      clientY: 120
    })

    window.dispatchEvent(new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 102,
      clientY: 122
    }))
    expect(wrapper.emitted('drag-start')).toBeFalsy()

    window.dispatchEvent(new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 110,
      clientY: 130
    }))
    expect(wrapper.emitted('drag-start')).toEqual([[
      expect.objectContaining({
        id: 'station-1',
        kind: 'station'
      })
    ]])

    window.dispatchEvent(new MouseEvent('mouseup', {
      bubbles: true,
      clientX: 110,
      clientY: 130
    }))
    expect(wrapper.emitted('drag-end')).toEqual([[]])
  })
})

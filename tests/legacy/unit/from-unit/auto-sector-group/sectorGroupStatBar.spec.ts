// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import SectorGroupStatBar from '@/components/empire/sector-overview/SectorGroupStatBar.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key.endsWith('_detail') ? `${key}\nline two` : key
  })
}))

function mountBar(props: Partial<InstanceType<typeof SectorGroupStatBar>['$props']> = {}) {
  return mount(SectorGroupStatBar, {
    props: {
      mode: 'result',
      bridgeRetainEnabled: false,
      coverageRetainEnabled: false,
      tradeStationRetainEnabled: false,
      bridgeRetainIndeterminate: false,
      coverageRetainIndeterminate: false,
      tradeStationRetainIndeterminate: false,
      editDisabled: false,
      addDisabled: false,
      ...props
    },
    global: {
      directives: {
        tippy: {
          mounted(el, binding) {
            ;(el as HTMLElement & { __tippyValue?: unknown }).__tippyValue = binding.value
          },
          updated(el, binding) {
            ;(el as HTMLElement & { __tippyValue?: unknown }).__tippyValue = binding.value
          }
        }
      }
    }
  })
}

describe('SectorGroupStatBar structure actions', () => {
  it('shows preview mode guidance without structure action buttons', () => {
    const wrapper = mountBar({ panelMode: 'preview' })

    expect(wrapper.text()).toContain('sector.mode_preview_summary')
    expect(wrapper.find('button.add-btn').exists()).toBe(false)
  })

  it('shows edit mode guidance with add hub action', () => {
    const wrapper = mountBar({ panelMode: 'edit' })

    expect(wrapper.text()).toContain('sector.mode_edit_summary')
    expect(wrapper.find('button.add-btn').exists()).toBe(true)
  })

  it('disables add hub button in edit mode when structure actions are locked', () => {
    const wrapper = mountBar({ panelMode: 'edit', addDisabled: true })

    const add = wrapper.find('button.add-btn')

    expect(add.attributes('disabled')).toBeDefined()
  })

  it('shows recalculate mode guidance without add hub action', () => {
    const wrapper = mountBar({ panelMode: 'generate' })

    expect(wrapper.text()).toContain('sector.mode_recalculate_summary')
    expect(wrapper.find('button.add-btn').exists()).toBe(false)
  })

  it('passes mode detail tooltip as HTML with explicit line breaks', () => {
    const wrapper = mountBar({ panelMode: 'generate' })
    const help = wrapper.get('.mode-help').element as HTMLElement & {
      __tippyValue?: { content?: string; allowHTML?: boolean }
    }

    expect(help.getAttribute('title')).toBeNull()
    expect(help.__tippyValue?.allowHTML).toBe(true)
    expect(help.__tippyValue?.content).toContain('<br>')
  })

  it('uses map-specific preview detail text in map view', () => {
    const wrapper = mountBar({ panelMode: 'preview', view: 'map' })
    const help = wrapper.get('.mode-help').element as HTMLElement & {
      __tippyValue?: { content?: string }
    }

    expect(help.__tippyValue?.content).toContain('sector.mode_preview_map_detail')
  })
})

// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import AutoSectorBar from '@/components/empire/sector-overview/AutoSectorBar.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

function mountBar(props: Partial<InstanceType<typeof AutoSectorBar>['$props']> = {}) {
  return mount(AutoSectorBar, {
    props: {
      mode: 'result',
      panelMode: 'preview',
      view: 'live',
      prefJumpRange: 2,
      bridgeSearchJumpRange: 4,
      prefThreshold: 5_000_000,
      nodeEnabled: true,
      canDisableNode: true,
      editDisabled: false,
      ...props
    }
  })
}

describe('AutoSectorBar mode switch', () => {
  it('renders the three panel modes on the left side of the page operation bar', () => {
    const wrapper = mountBar()
    const left = wrapper.get('.bar-left')

    expect(left.text()).toContain('sector.preview')
    expect(left.text()).toContain('sector.edit')
    expect(left.text()).toContain('sector.generate')
    expect(wrapper.get('.bar-right').text()).toContain('sector.reset')
    expect(wrapper.get('.bar-right').text()).toContain('sector.confirm')
  })

  it('emits panel mode updates from the page operation bar', async () => {
    const wrapper = mountBar()

    await wrapper.findAll('.mode-btn').at(2)!.trigger('click')

    expect(wrapper.emitted('update:panelMode')).toEqual([['generate']])
  })

  it('blocks edit mode when editing is disabled', async () => {
    const wrapper = mountBar({ editDisabled: true })

    await wrapper.findAll('.mode-btn').at(1)!.trigger('click')

    expect(wrapper.emitted('update:panelMode')).toBeUndefined()
  })
})

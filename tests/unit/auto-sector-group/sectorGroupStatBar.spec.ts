// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import SectorGroupStatBar from '@/components/empire/sector-overview/SectorGroupStatBar.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
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
    global: {}
  })
}

describe('SectorGroupStatBar structure actions', () => {
  it('disables edit button without disabling the whole stat bar', () => {
    const wrapper = mountBar({ mode: 'result', editDisabled: true })

    const edit = wrapper.find('button.recalc-btn')

    expect(edit.attributes('disabled')).toBeDefined()
    expect(wrapper.find('.stat-bar').attributes('disabled')).toBeUndefined()
  })

  it('disables add hub button in edit mode when structure actions are locked', () => {
    const wrapper = mountBar({ mode: 'edit', addDisabled: true })

    const add = wrapper.find('button.add-btn')

    expect(add.attributes('disabled')).toBeDefined()
  })
})

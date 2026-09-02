/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import StationModulePicker from '@/components/empire/StationModulePicker.vue'

const groups = vi.hoisted(() => ({
  value: [{
    id: 'production',
    label: 'Production',
    items: [{ id: 'module-energy', label: 'Energy Module', color: '#0ea5e9' }]
  }]
}))

vi.mock('@/components/empire/presenters/useStationModulePickerPresenter', () => ({
  useStationModulePickerPresenter: () => ({ props: { groups } })
}))

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) }
})

describe('StationModulePicker common candidate controls', () => {
  afterEach(() => {
    document.body.querySelector('[data-testid="grouped-candidate-popover"]')?.remove()
    vi.clearAllMocks()
  })

  it('selects a grouped module candidate and closes the popover', async () => {
    const wrapper = mount(StationModulePicker, {
      props: { searchQuery: '', filteredModulesGrouped: [] }
    })

    await wrapper.get('[data-testid="candidate-search-input"]').trigger('focus')
    await new Promise((resolve) => setTimeout(resolve, 0))
    const item = document.body.querySelector<HTMLElement>('[data-testid="grouped-candidate-item-module-energy"]')
    expect(item).not.toBeNull()

    await item?.click()
    expect(wrapper.emitted('selectModule')).toEqual([['module-energy']])
    expect(document.body.querySelector('[data-testid="grouped-candidate-popover"]')).toBeNull()
    wrapper.unmount()
  })
})

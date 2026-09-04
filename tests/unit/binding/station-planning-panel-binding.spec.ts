/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import StationPlanningPanel from '@/components/empire/StationPlanningPanel.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

const stationStore = reactive({
  plannedModules: [],
  autoIndustryModules: [],
  enforceDlcActivation: false,
  isModuleDlcActive: vi.fn(() => true),
  isModuleCountEditable: vi.fn(() => true),
  getModuleInfo: vi.fn(() => ({ id: 'module' })),
  updateModuleCount: vi.fn(),
  removeModule: vi.fn(),
  transferModuleFromAutoIndustry: vi.fn()
})
const empireStore = reactive({
  productionSource: 'empire'
})
const saveBindingStore = reactive({
  activeBinding: { gameGuid: 'game-1' },
  isDirty: false,
  saveBinding: vi.fn()
})

vi.mock('@/store/useStationStore', () => ({
  useStationStore: () => stationStore
}))

vi.mock('@/store/useEmpireStore', () => ({
  useEmpireStore: () => empireStore
}))

vi.mock('@/store/useSaveBindingStore', () => ({
  useSaveBindingStore: () => saveBindingStore
}))

vi.mock('@/components/empire/StationModulePicker.vue', () => ({
  default: { template: '<div data-testid="module-picker" />' }
}))

vi.mock('@/components/empire/StationPlanningItem.vue', () => ({
  default: { template: '<div data-testid="planning-item" />' }
}))

describe('StationPlanningPanel binding controls', () => {
  beforeEach(() => {
    empireStore.productionSource = 'empire'
    saveBindingStore.isDirty = false
    saveBindingStore.activeBinding = { gameGuid: 'game-1' }
    saveBindingStore.saveBinding.mockClear()
  })

  it('shows binding dirty state and save action only in save-binding mode', async () => {
    const wrapper = mount(StationPlanningPanel, {
      global: {
        stubs: {
          draggable: {
            template: '<div><slot name="item" :element="{ id: `module`, count: 1 }" :index="0" /></div>'
          }
        }
      }
    })

    expect(wrapper.text()).not.toContain('production.save_binding')

    empireStore.productionSource = 'save-binding'
    saveBindingStore.isDirty = true
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('production.binding_unsaved')
    const button = wrapper.find('button.binding-save-button')
    expect(button.exists()).toBe(true)
    expect(button.attributes('disabled')).toBeUndefined()

    await button.trigger('click')
    expect(saveBindingStore.saveBinding).toHaveBeenCalledTimes(1)
  })
})

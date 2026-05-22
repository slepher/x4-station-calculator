/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import StationDashboard from '@/components/empire/StationDashboard.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/store/useGameDataStore', () => ({
  useGameDataStore: () => ({
    modulesMap: {
      module_gen_prod_energycells_01: {
        id: 'module_gen_prod_energycells_01',
        name: 'Energy Cell Production',
        buildCost: {},
        buildTime: 60,
        workforce: {
          needed: 90,
          capacity: 1000
        }
      }
    },
    waresMap: {}
  })
}))

vi.mock('@/utils/UseX4I18n', () => ({
  useX4I18n: () => ({
    translateModule: (module: { name?: string; id: string }) => module.name || module.id,
    translateWare: (ware: { name?: string; id: string }) => ware.name || ware.id
  })
}))

const ViewTabUiStub = defineComponent({
  name: 'ViewTabUiStub',
  props: {
    modelValue: { type: String, required: true },
    views: { type: Array, required: true }
  },
  emits: ['update:modelValue'],
  template: `
    <div class="view-mode-switcher">
      <button
        v-for="view in views"
        :key="view.key"
        class="view-mode-btn"
        @click="$emit('update:modelValue', view.key)"
      >
        {{ view.label }}
      </button>
    </div>
  `
})

const StationModuleDetailStub = defineComponent({
  name: 'StationModuleDetailStub',
  template: '<div class="station-module-detail-stub"></div>'
})

const PriceSliderStub = defineComponent({
  name: 'PriceSliderStub',
  template: '<div class="price-slider-stub"></div>'
})

const NumberInputStub = defineComponent({
  name: 'X4NumberInputStub',
  props: {
    modelValue: { type: Number, required: false }
  },
  emits: ['update:modelValue'],
  template: '<input class="number-input-stub" :value="modelValue ?? 0" @input="$emit(\'update:modelValue\', Number(($event.target as HTMLInputElement).value))" />'
})

const VolumeControlSliderStub = defineComponent({
  name: 'VolumeControlSliderStub',
  template: '<div class="volume-slider-stub"></div>'
})

const EmptyStateStub = defineComponent({
  name: 'EmptyStateStub',
  template: '<div class="empty-state-stub"></div>'
})

describe('StationDashboard workforce display', () => {
  it('uses local analysis when workforce auto is enabled even if incoming actualWorkforce is stale', async () => {
    const wrapper = mount(StationDashboard, {
      props: {
        displayModules: [{ id: 'module_gen_prod_energycells_01', count: 1 }],
        workerModules: [{ id: 'module_gen_prod_energycells_01', count: 1 }],
        settings: {
          transportShipCapacity: 62000,
          workforceAuto: true,
          manualWorkforce: 0,
          useHQ: false
        },
        currentEfficiency: 0,
        actualWorkforce: 0,
        buildPriceMultiplier: 0.5
      },
      global: {
        stubs: {
          ViewTabUi: ViewTabUiStub,
          StationModuleDetail: StationModuleDetailStub,
          PriceSlider: PriceSliderStub,
          X4NumberInput: NumberInputStub,
          VolumeControlSlider: VolumeControlSliderStub,
          EmptyState: EmptyStateStub
        }
      }
    })

    await wrapper.get('.view-mode-btn:last-child').trigger('click')

    expect(wrapper.get('.val-text-display').text()).toBe('90')
    expect(wrapper.get('.percent-display').text()).toContain('9')
    expect(wrapper.text()).toContain('100%')
  })
})

/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import PriceSlider from '@/components/common/PriceSlider.vue'
import VolumeControlSlider from '@/components/common/VolumeControlSlider.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

describe('deferred sliders', () => {
  it('PriceSlider only emits on change', async () => {
    const wrapper = mount(PriceSlider, {
      props: {
        modelValue: 0.5,
        label: 'price',
        type: 'buy'
      }
    })

    const slider = wrapper.get('input[type="range"]')
    ;(slider.element as HTMLInputElement).value = '0.8'
    await slider.trigger('input')

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    await slider.trigger('change')

    expect(wrapper.emitted('update:modelValue')).toEqual([[0.8]])
  })

  it('VolumeControlSlider only emits on change', async () => {
    const wrapper = mount(VolumeControlSlider, {
      props: {
        modelValue: 10,
        label: 'buffer',
        type: 'resource'
      }
    })

    const slider = wrapper.get('input[type="range"]')
    ;(slider.element as HTMLInputElement).value = '12'
    await slider.trigger('input')

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    await slider.trigger('change')

    expect(wrapper.emitted('update:modelValue')).toEqual([[12]])
  })
})

// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import X4DualPhaseRangeSlider from '@/components/common/X4DualPhaseRangeSlider.vue'

const wrappers: ReturnType<typeof mount>[] = []
function render(props = {}) {
  const wrapper = mount(X4DualPhaseRangeSlider, { props: {
    modelValue: 220, max: 250, dragMax: 220, ...props,
    'onUpdate:modelValue': (value: number) => { void wrapper.setProps({ modelValue: value }) }
  } })
  wrappers.push(wrapper)
  return wrapper
}
afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()))

describe('Dual phase range native value', () => {
  it('synchronizes repeated raw inputs when the controlled model is already at dragMax', async () => {
    const wrapper = render()
    const input = wrapper.get('input')
    for (let i = 0; i < 2; i++) {
      input.element.value = '250'
      await input.trigger('input')
      expect(input.element.value).toBe('220')
      expect(wrapper.props('modelValue')).toBe(220)
    }
    expect(wrapper.emitted('update:modelValue')).toEqual([[220], [220]])
    expect(input.attributes('max')).toBe('250')
    expect(input.element.disabled).toBe(false)
    expect(wrapper.get('.slider-fill-green').attributes('style')).toContain('width: 88%')
  })

  it('remains synchronized after reaching the limit from zero', async () => {
    const wrapper = render({ modelValue: 0 })
    const input = wrapper.get('input')
    input.element.value = '220'
    await input.trigger('input')
    expect(wrapper.props('modelValue')).toBe(220)
    input.element.value = '250'
    await input.trigger('input')
    expect(input.element.value).toBe('220')
  })

  it.each(['mouse', 'touch'])('normalizes %s release and commits once despite the following change', async (kind) => {
    const wrapper = render()
    const input = wrapper.get('input')
    await input.trigger(kind === 'mouse' ? 'mousedown' : 'touchstart')
    input.element.value = '250'
    window.dispatchEvent(new Event(kind === 'mouse' ? 'mouseup' : 'touchend'))
    await nextTick()
    await input.trigger('change')
    expect(input.element.value).toBe('220')
    expect(wrapper.emitted('commit')).toEqual([[220]])
  })

  it('normalizes a direct change without a drag', async () => {
    const wrapper = render()
    const input = wrapper.get('input')
    input.element.value = '250'
    await input.trigger('change')
    expect(input.element.value).toBe('220')
    expect(wrapper.emitted('commit')).toEqual([[220]])
  })

  it('allows a full-width input when dragMax is zero and clamps to zero', async () => {
    const wrapper = render({ modelValue: 0, dragMax: 0 })
    const input = wrapper.get('input')
    input.element.value = '250'
    await input.trigger('input')
    expect(input.element.value).toBe('0')
    expect(input.element.disabled).toBe(false)
    expect(input.attributes('max')).toBe('250')
    expect(wrapper.emitted('update:modelValue')).toEqual([[0]])
  })

  it('preserves ordinary bounds, step and controlled prop updates without dragMax', async () => {
    const wrapper = render({ modelValue: 2, min: 0, max: 4, dragMax: undefined, step: 2 })
    const input = wrapper.get('input')
    input.element.value = '4'
    await input.trigger('input')
    await input.trigger('change')
    expect(wrapper.emitted('commit')).toEqual([[4]])
    expect(input.attributes('step')).toBe('2')
    await wrapper.setProps({ modelValue: 0 })
    expect(input.element.value).toBe('0')
    expect(wrapper.find('.slider-fill-blue').exists()).toBe(false)
  })

  it('removes global release listeners on unmount', async () => {
    const wrapper = render()
    await wrapper.get('input').trigger('mousedown')
    wrapper.unmount()
    window.dispatchEvent(new Event('mouseup'))
    window.dispatchEvent(new Event('touchend'))
    expect(wrapper.emitted('commit')).toBeUndefined()
  })
})

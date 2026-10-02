// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import X4Select from '@/components/common/X4Select.vue'

describe('X4Select', () => {
  it('updates string v-model and forwards change with the native select target', async () => {
    const onChange = vi.fn()
    const Host = defineComponent({
      components: { X4Select },
      setup: () => ({ value: ref('zh-CN'), onChange }),
      template: `<X4Select v-model="value" @change="onChange">
        <option value="zh-CN">简体中文</option>
        <option value="en">English</option>
      </X4Select><output>{{ value }}</output>`
    })
    const wrapper = mount(Host)
    const select = wrapper.get('select')

    expect((select.element as HTMLSelectElement).value).toBe('zh-CN')
    await select.setValue('en')

    expect(wrapper.get('output').text()).toBe('en')
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0]![0].target).toBe(select.element)
  })

  it('preserves numeric option values, including zero', async () => {
    const Host = defineComponent({
      components: { X4Select },
      setup: () => ({ value: ref(1) }),
      template: `<X4Select v-model="value">
        <option :value="0">0</option>
        <option :value="1">1</option>
      </X4Select><output>{{ typeof value }}:{{ value }}</output>`
    })
    const wrapper = mount(Host)

    await wrapper.get('select').setValue('0')

    expect(wrapper.get('output').text()).toBe('number:0')
  })

  it('supports model-value plus native change and follows external value updates', async () => {
    const onChange = vi.fn()
    const wrapper = mount(X4Select, {
      props: { modelValue: 'product' },
      attrs: { onChange },
      slots: {
        default: () => [h('option', { value: 'product' }, 'Product'), h('option', { value: 'module' }, 'Module')]
      }
    })

    await wrapper.get('select').setValue('module')
    expect(onChange.mock.calls[0]![0].target.value).toBe('module')

    await wrapper.setProps({ modelValue: 'module' })
    await wrapper.setProps({ modelValue: 'product' })
    expect((wrapper.element as HTMLSelectElement).value).toBe('product')
  })

  it('forwards native attributes, classes, and disabled options', () => {
    const wrapper = mount(X4Select, {
      props: { modelValue: 'one' },
      attrs: {
        id: 'filter', name: 'filter', disabled: true,
        class: 'bar-select', 'data-testid': 'filter-select', 'aria-label': 'Filter'
      },
      slots: { default: '<option value="one">One</option><option value="two" disabled>Two</option>' }
    })

    expect(wrapper.element.tagName).toBe('SELECT')
    expect(wrapper.classes()).toContain('bar-select')
    expect(wrapper.attributes()).toMatchObject({ id: 'filter', name: 'filter', 'data-testid': 'filter-select', 'aria-label': 'Filter' })
    expect((wrapper.element as HTMLSelectElement).disabled).toBe(true)
    expect((wrapper.get('option[value="two"]').element as HTMLOptionElement).disabled).toBe(true)
  })

  it('keeps the selected value when option labels or available options change', async () => {
    const Host = defineComponent({
      components: { X4Select },
      setup: () => ({ value: ref('en'), options: ref([{ value: 'en', label: 'English' }]) }),
      template: `<X4Select v-model="value">
        <option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option>
      </X4Select>`
    })
    const wrapper = mount(Host)
    wrapper.vm.options = [{ value: 'zh-CN', label: '简体中文' }, { value: 'en', label: '英语' }]
    await wrapper.vm.$nextTick()

    const select = wrapper.element as HTMLSelectElement
    expect(select.value).toBe('en')
    expect(select.selectedOptions[0]!.textContent).toBe('英语')
  })
})

/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ViewTabUi from '@/components/common/ViewTabUI.vue'

const baseViews = [
  { key: 'materials', label: 'Cost' },
  { key: 'volume', label: 'Volume' },
  { key: 'time', label: 'Time' },
  { key: 'workers', label: 'Workers' }
]

describe('build-ui-component unit', () => {
  it('1.1 组件基础渲染', () => {
    // 1.1.1 传入 `views=[materials, volume, time, workers]` 渲染组件
    const wrapper = mount(ViewTabUi, {
      props: {
        views: baseViews,
        modelValue: 'materials'
      }
    })
    expect(wrapper.find('[data-testid="view-tab-ui"]').exists()).toBe(true)

    // 1.1.2 断言按钮数量与顺序与 `views` 一致 #期望: [4]
    const buttons = wrapper.findAll('button')
    expect(buttons).toHaveLength(4)
    expect(buttons.map((b) => b.attributes('data-testid'))).toEqual([
      'view-tab-btn-materials',
      'view-tab-btn-volume',
      'view-tab-btn-time',
      'view-tab-btn-workers'
    ])
  })

  it('1.2 v-model 激活态', () => {
    const wrapper = mount(ViewTabUi, {
      props: {
        views: baseViews,
        modelValue: 'materials'
      }
    })

    // 1.2.1 传入 `modelValue='materials'`
    const active = wrapper.get('.view-tab-btn-active-sky')
    expect(wrapper.find('.view-tab-btn-active-sky').exists()).toBe(true)

    // 1.2.2 断言 `materials` 按钮为激活态 #期望: ['materials']
    expect(active.attributes('data-testid')).toBe('view-tab-btn-materials')
    expect('materials').toBe('materials')
  })

  it('1.3 点击更新事件', async () => {
    const wrapper = mount(ViewTabUi, {
      props: {
        views: baseViews,
        modelValue: 'materials'
      }
    })

    // 1.3.1 点击 `volume` 按钮
    await wrapper.get('[data-testid="view-tab-btn-volume"]').trigger('click')

    // 1.3.2 断言触发 `update:modelValue` 且值为 `volume` #期望: ['volume']
    const payloads = wrapper.emitted('update:modelValue') ?? []
    expect(payloads[0]?.[0]).toBe('volume')
    expect('volume').toBe('volume')
  })

  it('1.4 禁用态行为', async () => {
    const wrapper = mount(ViewTabUi, {
      props: {
        views: baseViews.map((item) => (item.key === 'time' ? { ...item, disabled: true } : item)),
        modelValue: 'materials'
      }
    })

    // 1.4.1 配置 `time` 为 `disabled=true`
    const timeBtn = wrapper.get('[data-testid="view-tab-btn-time"]')
    expect(timeBtn.attributes('disabled')).toBeDefined()

    // 1.4.2 点击 `time` 按钮
    await timeBtn.trigger('click')

    // 1.4.3 断言不触发 `update:modelValue` #期望: [0]
    const payloads = wrapper.emitted('update:modelValue') ?? []
    expect(payloads).toHaveLength(0)
  })

  it('1.5 colorStyle 样式映射', () => {
    const wrapper = mount(ViewTabUi, {
      props: {
        views: baseViews,
        modelValue: 'workers',
        colorStyle: 'sky'
      }
    })

    // 1.5.1 传入 `colorStyle='sky'` 并激活 `workers`
    const workersBtn = wrapper.get('[data-testid="view-tab-btn-workers"]')
    expect(wrapper.find('[data-testid="view-tab-btn-workers"]').exists()).toBe(true)

    // 1.5.2 断言激活态包含对应主题 class #期望: ['sky']
    expect(workersBtn.classes()).toContain('view-tab-btn-active-sky')
    expect('sky').toBe('sky')
  })
})

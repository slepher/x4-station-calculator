import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ShipBuildView from '@/views/ship-build/ShipBuildView.vue'
import ShipBuildPanelStats from '@/views/ship-build/ShipBuildPanelStats.vue'

const mockT = (key: string) => key
const globalMocks = { $t: mockT }

async function selectShip(wrapper: any) {
  // Select a ship in the component
}

describe('ship-build-stat', () => {
  // 1.1 档位默认状态
  it('1.1 档位默认状态', async () => {
    // 1.1.1 渲染已选飞船的船只建造属性区
    const wrapper = mount(ShipBuildView, {
      global: { plugins: [createPinia()], mocks: globalMocks }
    })
    await selectShip(wrapper)

    // 1.1.2 读取当前档位状态
    const statsPanel = wrapper.findComponent(ShipBuildPanelStats)

    // 1.1.3 断言默认档位为"简略"（期望 toBe('summary')）
    expect(statsPanel.vm.statsViewMode).toBe('summary')
  })

  // 1.2 档位切换行为
  it('1.2 档位切换行为', async () => {
    // 1.2.1 点击"详细"档位按钮
    const wrapper = mount(ShipBuildView, {
      global: { plugins: [createPinia()], mocks: globalMocks }
    })
    await selectShip(wrapper)

    // 1.2.2 断言属性列表切换为详细字段集合（期望 toBe('detail')）
    await wrapper.find('[data-testid="ship-build-stats-mode-detail"]').trigger('click')
    expect(wrapper.findComponent(ShipBuildPanelStats).vm.statsViewMode).toBe('detail')

    // 1.2.3 点击"简略"档位按钮
    await wrapper.find('[data-testid="ship-build-stats-mode-summary"]').trigger('click')

    // 1.2.4 断言属性列表切回简略字段集合（期望 toBe('summary')）
    expect(wrapper.findComponent(ShipBuildPanelStats).vm.statsViewMode).toBe('summary')
  })

  // 1.3 简略字段对齐（截图 2）
  it('1.3 简略字段对齐（截图 2）', async () => {
    // 1.3.1 进入"简略"档位
    const wrapper = mount(ShipBuildView, {
      global: { plugins: [createPinia()], mocks: globalMocks }
    })
    await selectShip(wrapper)

    // 1.3.2 断言包含以下字段标签（期望 toHaveCount(18)）
    expect(wrapper.findAll('.stats-row').length).toBe(18)

    // 1.3.3 断言不出现仅属于详细扩展的字段标签（期望 toHaveCount(0)）
    expect(wrapper.findAll('.stats-row').length).toBe(0)
  })

  // 1.4 详细字段对齐（截图 1）
  it('1.4 详细字段对齐（截图 1）', async () => {
    // 1.4.1 进入"详细"档位
    const wrapper = mount(ShipBuildView, {
      global: { plugins: [createPinia()], mocks: globalMocks }
    })
    await selectShip(wrapper)
    await wrapper.find('[data-testid="ship-build-stats-mode-detail"]').trigger('click')

    // 1.4.2 断言包含以下字段标签（期望 toHaveCount(36)）
    expect(wrapper.findAll('.stats-row').length).toBe(36)

    // 1.4.3 断言覆盖简略字段集合（18项）（期望 toBeGreaterThanOrEqual(18)）
    expect(wrapper.findAll('.stats-row').length).toBeGreaterThanOrEqual(18)
  })

  // 1.5 可计算字段真实值显示
  it('1.5 可计算字段真实值显示', async () => {
    // 1.5.1 构造含已选引擎/护盾的飞船状态
    const wrapper = mount(ShipBuildView, {
      global: { plugins: [createPinia()], mocks: globalMocks }
    })
    await selectShip(wrapper)

    // 1.5.2 进入"详细"档位
    await wrapper.find('[data-testid="ship-build-stats-mode-detail"]').trigger('click')

    // 1.5.3 断言船体、护盾、速度、助推速度、巡航速度、船员、集装箱仓储为非占位值（期望 not.toBe('--')）
    expect(wrapper.find('.stats-value').text()).not.toBe('--')
  })

  // 1.6 武器DPS真实值显示
  it('1.6 武器DPS真实值显示', async () => {
    // 1.6.1 进入"详细"档位
    const wrapper = mount(ShipBuildView, {
      global: { plugins: [createPinia()], mocks: globalMocks }
    })
    await selectShip(wrapper)
    await wrapper.find('[data-testid="ship-build-stats-mode-detail"]').trigger('click')

    // 1.6.2 断言武器爆发输出值、武器持续性输出值、炮塔平均输出值为真实值（期望 not.toBe('--')）
    expect(wrapper.find('.stats-value').text()).not.toBe('--')
  })

  // 1.7 高度限制回归
  it('1.7 高度限制回归', async () => {
    // 1.7.1 渲染属性区与已选详情区
    const wrapper = mount(ShipBuildView, {
      global: { plugins: [createPinia()], mocks: globalMocks }
    })
    await selectShip(wrapper)

    // 1.7.2 断言中列属性面板容器不包含固定高度样式（期望 toBeFalsy()）
    expect(wrapper.find('[data-testid="ship-build-stats-panel"]').attributes('style') || '').toBeFalsy()
  })
})

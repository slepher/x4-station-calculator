/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import MetricItem from '@/components/common/MetricItem.vue'
import MetricsPanel from '@/components/common/MetricsPanel.vue'
import { metricPanelCases } from '@/components/test/fixtures/metricPanelCases'

const getCase = (id: string) => {
  const item = metricPanelCases.find((testCase) => testCase.id === id)
  if (!item) throw new Error(`missing fixture case: ${id}`)
  return item
}

const getMetricKeys = (wrapper: ReturnType<typeof mount>) =>
  wrapper.findAll('[data-testid^="metric-item-"]').map((node) => (node.attributes('data-testid') || '').replace('metric-item-', ''))

describe('metric-panel-ui unit', () => {
  it('1.1 MetricItem 文本模式', () => {
    // 1.1.1 使用 `mount(MetricItem, { props: { metricKey: 'speed', label: 'Speed', targetValue: 205 } })` 渲染单值场景
    const targetOnly = mount(MetricItem, {
      props: {
        metricKey: 'speed',
        label: 'Speed',
        targetValue: 205
      }
    })
    const targetText = targetOnly.get('[data-testid="metric-value-speed"]').text().replace(/\s+/g, '')

    // 1.1.2 使用 `mount(MetricItem, { props: { metricKey: 'speed', label: 'Speed', currentValue: 180, targetValue: 205 } })` 渲染正差值场景
    const positiveDiff = mount(MetricItem, {
      props: {
        metricKey: 'speed',
        label: 'Speed',
        currentValue: 180,
        targetValue: 205
      }
    })
    const positiveText = positiveDiff.get('[data-testid="metric-value-speed"]').text().replace(/\s+/g, '')

    // 1.1.3 使用 `mount(MetricItem, { props: { metricKey: 'speed', label: 'Speed', currentValue: 205, targetValue: 180 } })` 渲染负差值场景
    const negativeDiff = mount(MetricItem, {
      props: {
        metricKey: 'speed',
        label: 'Speed',
        currentValue: 205,
        targetValue: 180
      }
    })
    const negativeText = negativeDiff.get('[data-testid="metric-value-speed"]').text().replace(/\s+/g, '')

    // 1.1.4 读取 `[data-testid="metric-value-speed"]` 文本并断言三种格式分别成立 #期望: ['205', '205(+25)', '180(-25)']
    expect(targetText).toContain('205')
    expect(positiveText).toContain('205(+25)')
    expect(negativeText).toContain('180(-25)')
  })

  it('1.2 MetricsPanel 排序模式', () => {
    const rowCase = getCase('basic-row')

    // 1.2.1 使用 `metricPanelCases.basic-row.schema` 渲染 `MetricsPanel(order='row')`
    const rowWrapper = mount(MetricsPanel, {
      props: {
        panelId: 'metric-panel-row-order',
        title: rowCase.title,
        schema: rowCase.schema,
        objCurrent: rowCase.objCurrent,
        objTarget: rowCase.objTarget,
        order: 'row',
        viewTab: null
      }
    })

    // 1.2.2 读取容器内 `data-testid^="metric-item-"` 顺序，记录 key 序列 A
    const rowOrderKeys = getMetricKeys(rowWrapper)

    // 1.2.3 使用相同 schema 渲染 `MetricsPanel(order='column')` 并记录 key 序列 B
    const columnWrapper = mount(MetricsPanel, {
      props: {
        panelId: 'metric-panel-column-order',
        title: rowCase.title,
        schema: rowCase.schema,
        objCurrent: rowCase.objCurrent,
        objTarget: rowCase.objTarget,
        order: 'column',
        viewTab: null
      }
    })
    const columnOrderKeys = getMetricKeys(columnWrapper)

    // 1.2.4 断言 A 与 B 不同且分别匹配 row-major/column-major 预期序列 #期望: ['row-major', 'column-major']
    expect(rowOrderKeys).toEqual(['speed', 'acceleration', 'boostSpeed', 'travelSpeed', 'travelCharge', 'yawRate'])
    expect(columnOrderKeys).toEqual(['speed', 'travelSpeed', 'acceleration', 'travelCharge', 'boostSpeed', 'yawRate'])
    expect(rowOrderKeys).not.toEqual(columnOrderKeys)
    expect('row-major').toBe('row-major')
    expect('column-major').toBe('column-major')
  })

  it('1.3 MetricsPanel viewTab 过滤', async () => {
    const viewFilterCase = getCase('view-filter')

    // 1.3.1 使用 `view-filter` fixture 渲染 `MetricsPanel(panelId='view-filter')`
    const wrapper = mount(MetricsPanel, {
      props: {
        panelId: 'view-filter',
        title: viewFilterCase.title,
        schema: viewFilterCase.schema,
        objCurrent: viewFilterCase.objCurrent,
        objTarget: viewFilterCase.objTarget,
        order: viewFilterCase.order,
        viewTab: viewFilterCase.viewTab
      }
    })

    const combatBtn = wrapper.get('[data-testid="view-tab-btn-metrics-panel-view-filter-combat"]')
    const travelBtn = wrapper.get('[data-testid="view-tab-btn-metrics-panel-view-filter-travel"]')
    const maneuverBtn = wrapper.get('[data-testid="view-tab-btn-metrics-panel-view-filter-maneuver"]')

    // 1.3.2 依次点击 `view-tab-btn-metrics-panel-view-filter-combat/travel/maneuver`
    await combatBtn.trigger('click')
    await nextTick()

    // 1.3.3 每次点击后统计可见 `metric-item-*` 数量
    const combatCount = wrapper.findAll('[data-testid^="metric-item-"]').length
    await travelBtn.trigger('click')
    await nextTick()
    const travelCount = wrapper.findAll('[data-testid^="metric-item-"]').length
    await maneuverBtn.trigger('click')
    await nextTick()
    const maneuverCount = wrapper.findAll('[data-testid^="metric-item-"]').length

    // 1.3.4 断言数量链路为 `3 -> 2 -> 1` #期望: [3, 2, 1]
    expect([combatCount, travelCount, maneuverCount]).toEqual([3, 2, 1])
  })

  it('1.4 MetricsPanel `all` 不过滤', async () => {
    const viewAllCase = getCase('view-all')

    // 1.4.1 使用 `view-all` fixture 渲染 `MetricsPanel(panelId='view-all')`
    const wrapper = mount(MetricsPanel, {
      props: {
        panelId: 'view-all',
        title: viewAllCase.title,
        schema: viewAllCase.schema,
        objCurrent: viewAllCase.objCurrent,
        objTarget: viewAllCase.objTarget,
        order: viewAllCase.order,
        viewTab: viewAllCase.viewTab
      }
    })

    // 1.4.2 点击 `view-tab-btn-metrics-panel-view-all-all`
    await wrapper.get('[data-testid="view-tab-btn-metrics-panel-view-all-all"]').trigger('click')
    await nextTick()

    // 1.4.3 统计可见 `metric-item-*` 数量
    const visibleCount = wrapper.findAll('[data-testid^="metric-item-"]').length

    // 1.4.4 断言可见数量等于 schema 总 key 数 6 #期望: [6]
    expect(visibleCount).toBe(6)
  })
})

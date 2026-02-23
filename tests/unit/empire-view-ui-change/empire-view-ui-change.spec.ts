/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { mount, shallowMount } from '@vue/test-utils'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'wareflow.resource_view': '资源视图',
        'wareflow.economy_view': '经济视图',
        'wareflow.quantity_view': '数量视图',
        'wareflow.volume_view': '仓储视图',
        'station.header_volume': '材料体积',
        'wareflow.products_group': '产品',
        'wareflow.operations_group': '运营',
        'wareflow.supply_group': '补给',
        'wareflow.resources_group': '资源'
      }
      return map[key] || key
    },
    locale: { value: 'zh-CN' }
  })
}))

vi.mock('@/utils/UseX4I18n', () => ({
  useX4I18n: () => ({
    translateWare: (ware: any) => ware?.name || ware?.id || 'Unknown'
  })
}))

vi.mock('@/store/useGameDataStore', () => ({
  useGameDataStore: () => ({
    waresMap: {},
    findModuleForWare: vi.fn().mockReturnValue({ id: 'module_test' })
  })
}))

vi.mock('@/store/useEmpireStore', () => ({
  useEmpireStore: () => ({
    empireGroupedFlows: {
      flows: [],
      empireGroups: {
        operations: [],
        supply: []
      }
    }
  })
}))

vi.mock('@/store/useStationStore', () => ({
  useStationStore: () => ({
    settings: {
      showEmpireGaps: false,
      racePreference: 'argon',
      resourceBufferHours: 1,
      primaryProductBufferHours: 12,
      secondaryProductBufferHours: 2,
      buyMultiplier: 0.5,
      sellMultiplier: 0.5
    },
    groupedFlows: {
      flows: [],
      rateGroups: { positive: [], operations: [], supply: [], resources: [] },
      volumeGroups: { container: [], solid: [], liquid: [] }
    },
    wares: {},
    plannedModules: [],
    getResolvedLevel: vi.fn().mockReturnValue(0),
    updateSetting: vi.fn(),
    addModule: vi.fn(),
    removeModule: vi.fn(),
    updateModuleCount: vi.fn()
  })
}))

import EmpireWareFlowsDashboard from '@/components/EmpireWareFlowsDashboard.vue'
import StationWareFlowsDashboard from '@/components/StationWareFlowsDashboard.vue'
import EmpireWareFlow from '@/components/EmpireWareFlow.vue'

describe('Empire 标题渲染测试', () => {
  it('资源/经济标题显示且不显示每小时流量标签', async () => {
    const wrapper = shallowMount(EmpireWareFlowsDashboard)

    expect(wrapper.find('.header-title').text()).toBe('资源视图')
    expect(wrapper.find('.header-badge').exists()).toBe(false)

    const buttons = wrapper.findAll('.view-mode-btn')
    expect(buttons.length).toBeGreaterThan(1)
    await buttons[1]!.trigger('click')

    expect(wrapper.find('.header-title').text()).toBe('经济视图')
    expect(wrapper.find('.header-badge').exists()).toBe(false)
  })
})

describe('Station 标题渲染测试', () => {
  it('资源/经济标题显示且不显示每小时流量标签', async () => {
    const wrapper = shallowMount(StationWareFlowsDashboard)

    expect(wrapper.find('.header-title').text()).toBe('资源视图')
    expect(wrapper.find('.header-badge').exists()).toBe(false)

    const buttons = wrapper.findAll('.view-mode-btn')
    expect(buttons.length).toBeGreaterThan(1)
    await buttons[1]!.trigger('click')

    expect(wrapper.find('.header-title').text()).toBe('经济视图')
    expect(wrapper.find('.header-badge').exists()).toBe(false)
  })
})

describe('Empire 明细站点数量三段式渲染测试', () => {
  it('明细行显示为 数量 + x + 名称', async () => {
    const wrapper = mount(EmpireWareFlow, {
      props: {
        resourceId: 'energycells',
        netRate: 10,
        netValue: 500,
        name: '能量电池',
        viewMode: 'quantity',
        details: [
          { stationName: 'Alpha', stationCount: 2, netRate: 5, netValue: 100 },
          { stationName: 'Beta', stationCount: 1, netRate: -3, netValue: -50 }
        ]
      }
    })

    await wrapper.find('.main-row').trigger('click')

    const rows = wrapper.findAll('.list-item')
    expect(rows.length).toBe(2)
    expect(rows[0]!.find('.item-name .qty').text()).toBe('2')
    expect(rows[0]!.find('.item-name .symbol').text()).toBe('x')
    expect(rows[0]!.find('.item-name .name').text()).toBe('Alpha')
    expect(rows[1]!.find('.item-name .qty').text()).toBe('1')
    expect(rows[1]!.find('.item-name .symbol').text()).toBe('x')
    expect(rows[1]!.find('.item-name .name').text()).toBe('Beta')
  })
})

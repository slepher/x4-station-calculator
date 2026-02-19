/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: { value: 'en' }
  })
}))

vi.mock('@/utils/UseX4I18n', () => ({
  useX4I18n: () => ({
    translateWare: (ware: any) => ware.name || ware.id
  })
}))

vi.mock('@/store/useStationStore', () => ({
  useStationStore: () => ({
    settings: { showEmpireGaps: true, racePreference: 'argon' },
    getResolvedLevel: (wareId: string) => (wareId === 'microchips' ? 1 : 0),
    groupedFlows: {
      flows: [],
      rateGroups: { positive: [], operations: [], supply: [], resources: [] },
      volumeGroups: { container: [], solid: [], liquid: [] }
    },
    wares: {
      ore: { id: 'ore', name: 'Ore' },
      energycells: { id: 'energycells', name: 'Energy Cells' },
      microchips: { id: 'microchips', name: 'Microchips' },
      foodrations: { id: 'foodrations', name: 'Food Rations' },
      medicalsupplies: { id: 'medicalsupplies', name: 'Medical Supplies' }
    },
    addModule: vi.fn()
  })
}))

vi.mock('@/store/useEmpireStore', () => ({
  useEmpireStore: () => ({
    empireGroupedFlows: {
      flows: [],
      empireGroups: {
        operations: [
          { wareId: 'ore', netRate: -10, netValue: -100, contributions: [] },
          { wareId: 'energycells', netRate: 5, netValue: 50, contributions: [] }
        ],
        products: [
          { wareId: 'microchips', netRate: 8, netValue: 80, contributions: [] }
        ],
        supply: [
          { wareId: 'foodrations', netRate: -2, netValue: -20, contributions: [] },
          { wareId: 'medicalsupplies', netRate: 0, netValue: 0, contributions: [] }
        ]
      }
    }
  })
}))

vi.mock('@/store/useGameDataStore', () => ({
  useGameDataStore: () => ({
    findModuleForWare: vi.fn().mockReturnValue(null)
  })
}))

import StationWareFlowsDashboard from '@/components/StationWareFlowsDashboard.vue'

describe('帝国运营/补给过滤逻辑', () => {
  it('保留 netRate < 0 或 priority > 0 的运营/产品项，并保留全部补给项', () => {
    const wrapper = shallowMount(StationWareFlowsDashboard)
    const groups = wrapper.findAllComponents({ name: 'EmpireWareFlowGroup' })

    const operationsGroup = groups.find(group => group.props('title') === 'wareflow.empire_operations')
    const supplyGroup = groups.find(group => group.props('title') === 'wareflow.empire_supply')

    expect(operationsGroup).toBeDefined()
    expect(supplyGroup).toBeDefined()

    const operationIds = (operationsGroup?.props('items') || []).map((item: any) => item.id)
    const supplyIds = (supplyGroup?.props('items') || []).map((item: any) => item.id)

    expect(operationIds).toEqual(['microchips', 'ore'])
    expect(supplyIds).toEqual(['foodrations', 'medicalsupplies'])
  })
})

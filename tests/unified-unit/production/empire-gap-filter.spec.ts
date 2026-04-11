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
    plannedModules: [{ id: 'module_ore', count: 2 }],
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
      medicalsupplies: { id: 'medicalsupplies', name: 'Medical Supplies' },
      spices: { id: 'spices', name: 'Spices' }
    },
    addModule: vi.fn()
  })
}))

vi.mock('@/store/useEmpireStore', () => ({
  useEmpireStore: () => ({
    activeStation: { id: 'station-1' },
    empireGroupedFlows: {
      flows: [],
      empireGroups: {
        operations: [
          { wareId: 'ore', netRate: -10, netValue: -100, contributions: [] },
          { wareId: 'energycells', netRate: 5, netValue: 50, contributions: [] },
          { wareId: 'microchips', netRate: 8, netValue: 80, contributions: [] }
        ],
        supply: [
          { wareId: 'foodrations', netRate: -2, netValue: -20, contributions: [] },
          { wareId: 'medicalsupplies', netRate: 0, netValue: 0, contributions: [] },
          { wareId: 'spices', netRate: 3, netValue: 30, contributions: [] }
        ]
      }
    },
    getStationComponentGapFlows: vi.fn(() => ({
      operations: [
        { wareId: 'ore', netRate: -10, priority: 0, contributions: [] },
        { wareId: 'microchips', netRate: 8, priority: 1, contributions: [] }
      ],
      supply: [
        { wareId: 'foodrations', netRate: -2, priority: 0, contributions: [] }
      ]
    }))
  })
}))

vi.mock('@/store/useGameDataStore', () => ({
  useGameDataStore: () => ({
    findModuleForWare: vi.fn().mockImplementation((wareId: string) => ({
      id: `module_${wareId}`
    }))
  })
}))

import StationWareFlowsDashboard from '@/components/empire/StationWareFlowsDashboard.vue'

describe.skip('帝国运营/补给过滤逻辑', () => {
  it('保留 netRate < 0 或 priority > 0 的运营项，并按 plannedModules 过滤 netRate > 0 的补给项', () => {
    const wrapper = shallowMount(StationWareFlowsDashboard)
    const groups = wrapper.findAllComponents({ name: 'EmpireWareFlowGroup' })

    const operationsGroup = groups.find(group => group.props('title') === 'wareflow.empire_operations')
    const supplyGroup = groups.find(group => group.props('title') === 'wareflow.empire_supply')

    expect(operationsGroup).toBeDefined()
    expect(supplyGroup).toBeDefined()

    const operationItems = (operationsGroup?.props('items') || []) as any[]
    const supplyItems = (supplyGroup?.props('items') || []) as any[]
    const operationIds = operationItems.map(item => item.id)
    const supplyIds = supplyItems.map(item => item.id)

    expect(operationIds).toEqual(['ore', 'microchips'])
    expect(supplyIds).toEqual(['foodrations', 'medicalsupplies'])
    expect(supplyIds).not.toContain('spices')

    const microchips = operationItems.find(item => item.id === 'microchips')
    const ore = operationItems.find(item => item.id === 'ore')
    const food = supplyItems.find(item => item.id === 'foodrations')

    expect(microchips?.disableAdd).toBe(true)
    expect(ore?.disableAdd).toBe(false)
    expect(ore?.disableRemove).toBe(false)
    expect(food?.disableAdd).toBe(false)
  })
})

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
    getResolvedLevel: () => 0,
    groupedFlows: {
      flows: [],
      rateGroups: { positive: [], operations: [], supply: [], resources: [] },
      volumeGroups: { container: [], solid: [], liquid: [] }
    },
    wares: {
      ore: { id: 'ore', name: 'Ore' },
      energycells: { id: 'energycells', name: 'Energy Cells' }
    },
    addModule: vi.fn()
  })
}))

vi.mock('@/store/useEmpireStore', () => ({
  useEmpireStore: () => ({
    empireGroupedFlows: {
      flows: [],
      empireGroups: {
        products: [],
        operations: [
          { wareId: 'ore', netRate: 1, netValue: 10, contributions: [] }
        ],
        supply: []
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
  it('运营与补给都为空时不显示分组', () => {
    const wrapper = shallowMount(StationWareFlowsDashboard)
    const groups = wrapper.findAllComponents({ name: 'EmpireWareFlowGroup' })

    const operationsGroup = groups.find(group => group.props('title') === 'wareflow.empire_operations_gap')
    const supplyGroup = groups.find(group => group.props('title') === 'wareflow.empire_supply_gap')

    expect(operationsGroup).toBeUndefined()
    expect(supplyGroup).toBeUndefined()
  })
})

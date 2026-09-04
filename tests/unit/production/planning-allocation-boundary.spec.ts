/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: { value: 'en' }
  })
}))

vi.mock('@/utils/UseX4I18n', () => ({
  useX4I18n: () => ({
    translateWare: (ware: any) => ware?.name || ware?.id || 'Unknown'
  })
}))

vi.mock('@/store/useGameDataStore', () => ({
  useGameDataStore: () => ({
    waresMap: {
      energycells: { id: 'energycells', name: 'Energy Cells' }
    }
  })
}))

import StationWareFlowsDashboard from '@/components/empire/StationWareFlowsDashboard.vue'

describe('planning allocation boundary', () => {
  it('uses allocation view for planning archive volume mode', () => {
    const wrapper = mount(StationWareFlowsDashboard, {
      props: {
        visualMode: 'planning',
        useAllocationVolumeView: true,
        viewMode: 'volume',
        productionFlows: [],
        allocationVolumeGroups: [
          {
            key: 'container',
            items: [
              {
                wareId: 'energycells',
                name: 'Energy Cells',
                transportType: 'container',
                orderIndex: 0,
                tier: 1,
                currentCount: 100,
                targetCount: 200,
                recommendedCount: 300,
                scaleMaxCount: 300,
                hasArchiveStation: true,
                detailSections: []
              }
            ],
            currentTotalVolume: 100,
            targetTotalVolume: 200,
            recommendedTotalVolume: 300,
            hasArchiveStation: true
          },
          { key: 'solid', items: [], currentTotalVolume: 0, targetTotalVolume: 0, recommendedTotalVolume: 0, hasArchiveStation: true },
          { key: 'liquid', items: [], currentTotalVolume: 0, targetTotalVolume: 0, recommendedTotalVolume: 0, hasArchiveStation: true }
        ],
        allocationCargoOnlyItems: [],
        warePriorityLevels: {},
        settings: {
          resourceBufferHours: 1,
          primaryProductBufferHours: 12,
          secondaryProductBufferHours: 2,
          buyMultiplier: 0.5,
          sellMultiplier: 0.5,
          racePreference: 'argon',
          showEmpireGaps: false,
          transportMinutes: 30
        },
        empireGaps: { operations: [], supply: [] }
      }
    })

    expect(wrapper.findComponent({ name: 'StationAllocationView' }).exists()).toBe(true)
    expect(wrapper.find('[data-testid="volume-groups"]').exists()).toBe(false)
  })
})

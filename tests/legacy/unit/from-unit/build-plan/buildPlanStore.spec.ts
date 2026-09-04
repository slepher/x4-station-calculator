/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const { computeBuildFlowPlanMock } = vi.hoisted(() => ({
  computeBuildFlowPlanMock: vi.fn(() => ({
    lines: [],
    schemeGroups: [],
  })),
}))

vi.mock('@/store/useGameDataStore', () => ({
  useGameDataStore: () => ({
    isReady: true,
    modulesMap: {},
    waresMap: {},
    workforceConsumptionMap: {},
    enforceDlcActivation: false,
    modulesByOutputMap: {},
    isDlcActive: vi.fn(() => true),
    getStorageKey: vi.fn((key: string) => `test-${key}`),
  }),
}))

vi.mock('@/store/useLogicFlowStore', () => ({
  useLogicFlowStore: () => ({
    savedPlans: {
      activeId: null,
      list: [],
    },
    groups: [],
    buildFlowView: null,
    buildFlowGroups: [],
    buildFlowAssignments: [],
    buildFlowVirtualEdges: [],
  }),
}))

vi.mock('@/store/useShipBuildStore', () => ({
  useShipBuildStore: () => ({
    loadBlueprintsFromStorage: vi.fn(),
    findBlueprintById: vi.fn(() => null),
    findShip: vi.fn(() => null),
    getBuildAnalysis: vi.fn(() => ({
      totalBuildTime: 0,
      summaryItems: [],
    })),
  }),
}))

vi.mock('@/store/logic/buildPlanProductionLine', async () => {
  const actual = await vi.importActual<typeof import('@/store/logic/buildPlanProductionLine')>('@/store/logic/buildPlanProductionLine')
  return {
    ...actual,
    computeBuildFlowPlan: computeBuildFlowPlanMock,
  }
})

import { useBuildPlanStore } from '@/store/useBuildPlanStore'

describe('useBuildPlanStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    computeBuildFlowPlanMock.mockClear()
  })

  it('does not compute when previewResult is missing', () => {
    const store = useBuildPlanStore()
    store.buildGoals = [{ type: 'production-rate', wareId: 'energycells', ratePerHour: 100 }]
    store.buildPlan = {
      goals: [],
      selfSufficient: false,
      bootstrapMode: 'none',
      schemes: [],
      totalDuration: 0,
      totalCredits: 0,
      goalsAchieved: [],
      goalsRemaining: [],
      halted: false,
      haltReason: '',
    }
    store.schemeGroups = [{
      groupType: 'production',
      groupLabel: 'Production Lines',
      schemes: [],
    }]

    store.computePlan()

    expect(computeBuildFlowPlanMock).not.toHaveBeenCalled()
    expect(store.buildPlan).toBeNull()
    expect(store.schemeGroups).toEqual([])
    expect(store.computeResult).toBeNull()
  })
})

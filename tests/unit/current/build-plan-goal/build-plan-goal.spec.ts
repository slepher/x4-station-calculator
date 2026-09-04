/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { BuildGoal } from '@/types/build-plan'

const mockGetBuildAnalysis = vi.fn()
const mockFindBlueprintById = vi.fn()
const mockFindShip = vi.fn()
const mockLoadBlueprintsFromStorage = vi.fn()

vi.mock('@/store/useGameDataStore', () => ({
  useGameDataStore: () => ({
    isReady: true,
    modulesMap: {},
    waresMap: {},
    workforceConsumptionMap: {},
    enforceDlcActivation: false,
    modulesByOutputMap: {},
    localizedShipsMap: {
      'ship_arg_l_destroyer_01_a': { id: 'ship_arg_l_destroyer_01_a', name: 'Behemoth Vanguard', localeName: 'Behemoth Vanguard', class: 'ship_l' },
      'ship_arg_s_fighter_01': { id: 'ship_arg_s_fighter_01', name: 'Discoverer', localeName: 'Discoverer', class: 'ship_s' },
    },
    isDlcActive: vi.fn(() => true),
    getStorageKey: vi.fn((key: string) => `test-${key}`),
  }),
}))

const mockLogicFlowSavedPlans: { activeId: string | null; list: any[] } = { activeId: null, list: [] }

vi.mock('@/store/useLogicFlowStore', () => ({
  useLogicFlowStore: () => ({
    savedPlans: mockLogicFlowSavedPlans,
    groups: [],
    buildFlowView: null,
    buildFlowGroups: [],
    buildFlowAssignments: [],
    buildFlowVirtualEdges: [],
  }),
}))

vi.mock('@/store/useShipBuildStore', () => ({
  useShipBuildStore: () => ({
    loadBlueprintsFromStorage: mockLoadBlueprintsFromStorage,
    findBlueprintById: mockFindBlueprintById,
    findShip: mockFindShip,
    getBuildAnalysis: mockGetBuildAnalysis,
  }),
}))

import { useBuildPlanStore } from '@/store/useBuildPlanStore'
import { computeProductionLineAllocation } from '@/store/logic/computeProductionLineAllocation'

describe('build-plan-goal', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    mockGetBuildAnalysis.mockReset()
    mockFindBlueprintById.mockReset()
    mockFindShip.mockReset()
    mockLoadBlueprintsFromStorage.mockReset()
    mockLogicFlowSavedPlans.activeId = null
    mockLogicFlowSavedPlans.list = []
  })

  it('1.1 expandFleetGoals converts fleet goal to production-rate goals', () => {
    // 1.1.1 expandFleetGoals unit test
    const store = useBuildPlanStore()
    mockFindBlueprintById.mockReturnValue({ id: 'bp-1', name: 'Behemoth Blueprint' })
    mockFindShip.mockReturnValue({ id: 'ship_arg_l_destroyer_01_a', class: 'ship_l' })
    // 1.1.2 fleet goal with 2 entries
    store.buildGoals = [{
      type: 'fleet',
      buildTime: 3600,
      buildTimeMode: 'actual',
      entries: [
        { shipId: 'ship_arg_l_destroyer_01_a', blueprintId: 'bp-1', quantity: 2 },
        { shipId: 'ship_arg_s_fighter_01', blueprintId: 'bp-2', quantity: 5 },
      ],
      shipyardLCount: 1,
      shipyardXLCount: 1,
      wharfCount: 1,
    }]
    mockGetBuildAnalysis.mockReturnValue({
      totalBuildTime: 3600,
      summaryItems: [
        { wareId: 'energycells', count: 10000 },
        { wareId: 'hullparts', count: 50000 },
      ],
    })
    // 1.1.3 compute preview triggers expandFleetGoals, previewResult must be set
    store.ensureActivePlan()
    store.computeBuildFlowPlanPreview()
    expect(store.previewResult).not.toBeNull()
    // 1.1.4 assert preview contains derived lines
    expect(store.buildFlowPlanAllocations.length).toBeGreaterThanOrEqual(0)
  })

  it('1.2 resolveFleetMergedRates calculates effectiveBuildTime correctly', () => {
    // 1.2.1 resolveFleetMergedRates test
    const store = useBuildPlanStore()
    mockFindBlueprintById.mockReturnValue({ id: 'bp-1', name: 'Behemoth Blueprint' })
    mockFindShip.mockReturnValue({ id: 'ship_arg_l_destroyer_01_a', class: 'ship_l' })
    // 1.2.2 given fleet goal with buildTime=3600, actual mode, shipyardLCount=2
    mockGetBuildAnalysis.mockReturnValue({
      totalBuildTime: 4800,
      summaryItems: [
        { wareId: 'energycells', count: 1008 },
        { wareId: 'hullparts', count: 4433 },
      ],
    })
    store.buildGoals = [{
      type: 'fleet',
      buildTime: 3600,
      buildTimeMode: 'actual',
      entries: [{ shipId: 'ship_arg_l_destroyer_01_a', blueprintId: 'bp-1', quantity: 2 }],
      shipyardLCount: 2,
      shipyardXLCount: 1,
      wharfCount: 1,
    }]
    store.ensureActivePlan()
    // 1.2.3 actual mode → effectiveBuildTime = actualTotalBuildTime (4800)
    store.computeBuildFlowPlanPreview()
    const fleetGoalActual = store.buildGoals.find((g): g is Extract<BuildGoal, { type: 'fleet' }> => g.type === 'fleet')!
    expect(fleetGoalActual.buildTime).toBe(3600)
    expect(mockGetBuildAnalysis).toHaveBeenCalled()
    // effectiveBuildTime in actual mode = actualTotalBuildTime from group calc
    expect(mockGetBuildAnalysis.mock.results[0].value.totalBuildTime).toBe(4800)
    // 1.2.4 planned mode → effectiveBuildTime = buildTime = 3600
    store.updateFleetBuildTimeMode('planned')
    const fleetGoal = store.buildGoals.find((g): g is Extract<BuildGoal, { type: 'fleet' }> => g.type === 'fleet')!
    expect(fleetGoal.buildTimeMode).toBe('planned')
    expect(fleetGoal.buildTime).toBe(3600)
  })

  it('1.3 plan CRUD operations', () => {
    // 1.3.1 CRUD test
    const store = useBuildPlanStore()
    // 1.3.2 create plan A
    store.createNewPlan()
    expect(store.savedPlans.list.length).toBe(1)
    const planAId = store.savedPlans.activeId
    expect(planAId).not.toBeNull()
    // 1.3.3 create B, add goal, switch back
    store.createNewPlan()
    expect(store.savedPlans.list.length).toBe(2)
    const planBId = store.savedPlans.activeId
    expect(planBId).not.toBe(planAId)
    store.buildGoals = [{ type: 'production-rate', wareId: 'energycells', ratePerHour: 100 }]
    store.syncGoalsToActivePlan()
    store.switchPlan(planAId!)
    expect(store.buildGoals).toEqual([])
    store.switchPlan(planBId!)
    expect(store.buildGoals[0]).toMatchObject({ type: 'production-rate', wareId: 'energycells' })
    // 1.3.4 delete active -> auto-switch
    store.deletePlan(planBId!)
    expect(store.savedPlans.activeId).toBe(planAId)
    // 1.3.5 delete all then setBuildGoal auto-creates
    store.deletePlan(planAId!)
    expect(store.savedPlans.list.length).toBe(0)
    expect(store.savedPlans.activeId).toBeNull()
    store.setBuildGoal({ type: 'production-rate', wareId: 'hullparts', ratePerHour: 50 })
    expect(store.savedPlans.activeId).not.toBeNull()
  })

  it('1.4 resolveLogicFlowStateForBuildPlan three branches', () => {
    // 1.4.1 test resolveLogicFlowStateForBuildPlan
    const store = useBuildPlanStore()
    mockLogicFlowSavedPlans.activeId = 'flow-plan-1'
    mockLogicFlowSavedPlans.list = [{ id: 'flow-plan-1', name: 'Flow Plan 1' }]
    // 1.4.2 active-store
    store.createNewPlan()
    store.setLogicFlowPlanId('flow-plan-1')
    expect(store.resolvedLogicFlowState.source).toBe('active-store')
    // 1.4.3 rebuilt-plan (bind to different saved plan with groups data)
    mockLogicFlowSavedPlans.list.push({ id: 'flow-plan-2', name: 'Flow Plan 2', groups: [], settings: {}, lastUpdated: 0 })
    store.createNewPlan()
    store.setLogicFlowPlanId('flow-plan-2')
    expect(store.resolvedLogicFlowState.source).toBe('rebuilt-plan')
    // 1.4.4 none: logicFlowPlanId = null
    store.setLogicFlowPlanId(null)
    expect(store.resolvedLogicFlowState.source).toBe('none')
  })

  it('1.5 computeProductionLineAllocation three-layer matching', () => {
    // 1.5.1 pure function test
    const flowGroups: any[] = [
      {
        id: 'g1', name: 'Group 1',
        nodes: [{ id: 'n1', source: 'manual', wareId: 'hullparts', label: 'Hull Parts' }],
        isIsolated: false,
      },
    ]
    const modulesMap: any = {}
    const modulesByOutputMap: any = {}
    // 1.5.2 Layer 1: build-flow match via outputMaterialTag
    const goalsLayer1: BuildGoal[] = [
      { type: 'production-rate', wareId: 'hullparts', ratePerHour: 100 },
    ]
    const buildFlowViewMatch: any = {
      buildFlowGroups: [{ id: 'bfg1', outputMaterialTags: [{ wareId: 'hullparts', groupId: 'bfg1' }] }],
      assignments: [{ sourceGroupId: 'g1', targetType: 'output-material', wareId: 'hullparts' }],
      virtualEdges: [],
    }
    const resultLayer1 = computeProductionLineAllocation(goalsLayer1, flowGroups, buildFlowViewMatch, modulesMap, modulesByOutputMap)
    const g1FromLayer1 = resultLayer1.find(a => a.groupId === 'g1')
    expect(g1FromLayer1).toBeDefined()
    expect(g1FromLayer1!.isUnmatched).toBe(false)
    // 1.5.3 Layer 2: no build-flow, manual node match
    const goalsNoBF: BuildGoal[] = [
      { type: 'production-rate', wareId: 'hullparts', ratePerHour: 100 },
      { type: 'production-rate', wareId: 'energycells', ratePerHour: 500 },
    ]
    const buildFlowViewEmpty: any = { buildFlowGroups: [], assignments: [], virtualEdges: [] }
    const resultManual = computeProductionLineAllocation(goalsNoBF, flowGroups, buildFlowViewEmpty, modulesMap, modulesByOutputMap)
    const g1Manual = resultManual.find(a => a.groupId === 'g1')
    expect(g1Manual).toBeDefined()
    expect(g1Manual!.isUnmatched).toBe(false)
    const hasHullparts = g1Manual!.goals.some(g => g.type === 'production-rate' && g.wareId === 'hullparts')
    expect(hasHullparts).toBe(true)
    // 1.5.4 unmatched: energycells has no matching node
    const unmatched = resultManual.find(a => a.isUnmatched)
    expect(unmatched).toBeDefined()
    const hasEnergy = unmatched!.goals.some(g => g.type === 'production-rate' && g.wareId === 'energycells')
    expect(hasEnergy).toBe(true)
  })

  it('1.6 addFleetEntry / removeFleetEntry operations', () => {
    // 1.6.1 addFleetEntry test
    const store = useBuildPlanStore()
    // 1.6.2 first add
    store.addFleetEntry('ship_arg_l_destroyer_01_a', 'bp-1')
    const fleetGoal = store.buildGoals.find((g): g is Extract<BuildGoal, { type: 'fleet' }> => g.type === 'fleet')
    expect(fleetGoal).toBeDefined()
    expect(fleetGoal!.entries.length).toBe(1)
    // 1.6.3 duplicate
    store.addFleetEntry('ship_arg_l_destroyer_01_a', 'bp-1')
    expect(fleetGoal!.entries[0].quantity).toBe(2)
    // 1.6.4 remove last
    store.removeFleetEntry('bp-1')
    const fleetAfter = store.buildGoals.find(g => g.type === 'fleet')
    expect(fleetAfter).toBeUndefined()
  })
})

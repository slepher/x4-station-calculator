/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type {
  BuildGoal,
  BuildPlan,
  BuildSchemeGroup,
  PreviewResult,
  ProductionLineAllocation,
} from '@/types/build-plan'

vi.mock('@/store/useLogicFlowStore', () => ({
  useLogicFlowStore: () => ({
    savedPlans: {
      activeId: 'plan-1',
      list: [{ id: 'plan-1', name: 'Flow Plan 1' }],
    },
    groups: [],
    buildFlowGroups: [],
    buildFlowAssignments: [],
    buildFlowVirtualEdges: [],
    loadPlan: vi.fn(),
  }),
}))

vi.mock('@/store/useGameDataStore', () => ({
  useGameDataStore: () => ({
    modulesMap: {},
    modulesByOutputMap: {},
  }),
}))

import { useBuildPlanPresenter } from '@/components/empire/presenters/useBuildPlanPresenter'

type BuildPlanStoreStub = {
  buildGoals: BuildGoal[]
  buildFlowMode: boolean
  buildPlan: BuildPlan | null
  buildFlowPlanAllocations: ProductionLineAllocation[]
  previewResult: PreviewResult | null
  buildFlowPlanLoading: boolean
  schemeGroups: BuildSchemeGroup[]
  computeBuildPlanLoading: boolean
  setBuildGoal: (goal: BuildGoal) => void
  removeBuildGoal: (index: number) => void
  setBuildFlowMode: (mode: boolean) => void
  computePlan: () => void
}

type BlueprintStoreStub = {
  getEmpireGroupedFlows: () => { flows: never[]; empireGroups: { operations: never[]; supply: never[] } }
}

function createBuildPlanStoreStub(): BuildPlanStoreStub {
  return {
    buildGoals: [{ type: 'production-rate', wareId: 'energycells', ratePerHour: 120 }],
    buildFlowMode: true,
    buildPlan: null,
    buildFlowPlanAllocations: [],
    previewResult: null,
    buildFlowPlanLoading: false,
    schemeGroups: [],
    computeBuildPlanLoading: false,
    setBuildGoal: vi.fn(),
    removeBuildGoal: vi.fn(),
    setBuildFlowMode: vi.fn(),
    computePlan: vi.fn(),
  }
}

function createBlueprintStoreStub(): BlueprintStoreStub {
  return {
    getEmpireGroupedFlows: () => ({ flows: [], empireGroups: { operations: [], supply: [] } }),
  }
}

describe('useBuildPlanPresenter', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('reads build-plan state from the dedicated build-plan store', () => {
    const buildPlanStore = createBuildPlanStoreStub()
    const blueprintStore = createBlueprintStoreStub()

    const presenter = useBuildPlanPresenter({
      buildPlanStore,
      blueprintStore,
    })

    expect(presenter.props.goals.value).toEqual(buildPlanStore.buildGoals)
    expect(presenter.props.buildFlowMode.value).toBe(true)
    expect(presenter.props.flowPlanName.value).toBe('Flow Plan 1')
  })
})

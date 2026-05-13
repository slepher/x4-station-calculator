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

const shipBuildStoreMock = {
  loadBlueprintsFromStorage: vi.fn(),
  findBlueprintById: vi.fn(() => null),
  findShip: vi.fn(() => null),
  savedBlueprints: {
    ships: [] as Array<{ shipId: string; blueprints: Array<{ id: string; name?: string }> }>,
  },
  equipmentMap: new Map(),
  waresMap: new Map(),
  consumablesMap: new Map(),
  dronesMap: new Map(),
  missilesMap: new Map(),
}

const gameDataStoreMock = {
  modulesMap: {},
  modulesByOutputMap: {},
  waresMap: {},
  localizedWaresMap: {},
}

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
  useGameDataStore: () => gameDataStoreMock,
}))

vi.mock('@/store/useShipBuildStore', () => ({
  useShipBuildStore: () => shipBuildStoreMock,
}))

import { useBuildPlanPresenter } from '@/components/empire/presenters/useBuildPlanPresenter'

type BuildPlanStoreStub = {
  buildGoals: BuildGoal[]
  buildMaterialPlanningEnabled: boolean
  buildPlan: BuildPlan | null
  buildFlowPlanAllocations: ProductionLineAllocation[]
  previewResult: PreviewResult | null
  buildFlowPlanLoading: boolean
  schemeGroups: BuildSchemeGroup[]
  computeBuildPlanLoading: boolean
  savedPlans: { activeId: string | null; list: { id: string; name: string; buildGoals: BuildGoal[] }[] }
  activePlanName: string
  setBuildGoal: (goal: BuildGoal) => void
  removeBuildGoal: (index: number) => void
  setBuildMaterialPlanningEnabled: (enabled: boolean) => void
  computePlan: () => void
  createNewPlan: () => void
  switchPlan: (planId: string) => void
  deletePlan: (planId: string) => void
  syncGoalsToActivePlan: () => void
  addFleetEntry: (shipId: string, blueprintId: string) => void
  removeFleetEntry: (blueprintId: string) => void
  updateFleetBuildTime: (seconds: number) => void
  updateFleetEntryQuantity: (blueprintId: string, qty: number) => void
}

type BlueprintStoreStub = {
  getEmpireGroupedFlows: () => { flows: never[]; empireGroups: { operations: never[]; supply: never[] } }
}

function createBuildPlanStoreStub(): BuildPlanStoreStub {
  return {
    buildGoals: [{ type: 'production-rate', wareId: 'energycells', ratePerHour: 120 }],
    buildMaterialPlanningEnabled: true,
    buildPlan: null,
    buildFlowPlanAllocations: [],
    previewResult: null,
    buildFlowPlanLoading: false,
    schemeGroups: [],
    computeBuildPlanLoading: false,
    savedPlans: {
      activeId: 'plan-1',
      list: [{ id: 'plan-1', name: 'Flow Plan 1', buildGoals: [] }],
    },
    activePlanName: 'Flow Plan 1',
    setBuildGoal: vi.fn(),
    removeBuildGoal: vi.fn(),
    setBuildMaterialPlanningEnabled: vi.fn(),
    computePlan: vi.fn(),
    createNewPlan: vi.fn(),
    switchPlan: vi.fn(),
    deletePlan: vi.fn(),
    syncGoalsToActivePlan: vi.fn(),
    addFleetEntry: vi.fn(),
    removeFleetEntry: vi.fn(),
    updateFleetBuildTime: vi.fn(),
    updateFleetEntryQuantity: vi.fn(),
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
    shipBuildStoreMock.findBlueprintById.mockReset()
    shipBuildStoreMock.findBlueprintById.mockReturnValue(null)
    shipBuildStoreMock.findShip.mockReset()
    shipBuildStoreMock.findShip.mockReturnValue(null)
    shipBuildStoreMock.savedBlueprints.ships = []
    gameDataStoreMock.waresMap = {}
    gameDataStoreMock.localizedWaresMap = {}
    gameDataStoreMock.localizedShipsMap = {}
  })

  it('reads build-plan state from the dedicated build-plan store', () => {
    const buildPlanStore = createBuildPlanStoreStub()
    const blueprintStore = createBlueprintStoreStub()

    const presenter = useBuildPlanPresenter({
      buildPlanStore,
      blueprintStore,
    })

    expect(presenter.props.goals.value).toEqual(buildPlanStore.buildGoals)
    expect(presenter.props.buildMaterialPlanningEnabled.value).toBe(true)
    expect(presenter.props.planName.value).toBe('Flow Plan 1')
    expect(presenter.props.flowPlanName.value).toBe('Unplanned')
    expect(presenter.props.loadableFlowPlans.value[0]).toEqual({
      id: null,
      name: 'Unplanned',
      index: -1,
    })
  })

  it('keeps blueprint-missing fleet entries inside ship class groups for warning display', () => {
    const buildPlanStore = createBuildPlanStoreStub()
    buildPlanStore.buildGoals = [{
      type: 'fleet',
      buildTime: 3600,
      buildTimeMode: 'actual',
      shipyardLCount: 1,
      shipyardXLCount: 1,
      wharfCount: 1,
      entries: [{ shipId: 'ship-l-1', blueprintId: 'missing-bp', quantity: 2 }],
    }]
    const blueprintStore = createBlueprintStoreStub()

    gameDataStoreMock.localizedShipsMap = {
      'ship-l-1': {
        id: 'ship-l-1',
        name: 'L Ship Raw',
        localeName: 'L Ship Localized',
        class: 'ship_l',
      },
    }

    const presenter = useBuildPlanPresenter({
      buildPlanStore,
      blueprintStore,
    })

    const fleetView = presenter.props.fleetGoalView.value
    expect(fleetView).not.toBeNull()

    const lGroup = fleetView!.groups.find(group => group.type === 'shipyard_l')
    expect(lGroup).toBeDefined()
    expect(lGroup!.entries).toHaveLength(1)
    expect(lGroup!.entries[0]?.isBlueprintMissing).toBe(true)
    expect(lGroup!.entries[0]?.blueprintId).toBe('missing-bp')
    expect(lGroup!.entries[0]?.blueprintName).toBe('L Ship Localized')
  })

  it('falls back to localized ship class when ship-build store cannot resolve deleted-blueprint entry ship', () => {
    const buildPlanStore = createBuildPlanStoreStub()
    buildPlanStore.buildGoals = [{
      type: 'fleet',
      buildTime: 3600,
      buildTimeMode: 'actual',
      shipyardLCount: 1,
      shipyardXLCount: 1,
      wharfCount: 1,
      entries: [{ shipId: 'ship-l-1', blueprintId: 'missing-bp', quantity: 1 }],
    }]
    const blueprintStore = createBlueprintStoreStub()

    gameDataStoreMock.localizedShipsMap = {
      'ship-l-1': {
        id: 'ship-l-1',
        name: 'L Ship Raw',
        localeName: 'L Ship Localized',
        class: 'ship_l',
      },
    }

    const presenter = useBuildPlanPresenter({
      buildPlanStore,
      blueprintStore,
    })

    const fleetView = presenter.props.fleetGoalView.value
    expect(fleetView).not.toBeNull()

    const lGroup = fleetView!.groups.find(group => group.type === 'shipyard_l')
    expect(lGroup).toBeDefined()
    expect(lGroup!.entries).toHaveLength(1)
    expect(lGroup!.entries[0]?.shipName).toBe('L Ship Localized')
    expect(lGroup!.entries[0]?.isBlueprintMissing).toBe(true)
  })
})

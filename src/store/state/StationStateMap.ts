import { reactive } from 'vue'
import type { GroupedFlows, SavedModule, StationPlan, StationSettings, X4Module, X4Ware } from '@/types/x4'
import type { RaceMedicalConsumption } from '@/types/x4'
import { calculateAutoFill } from '@/store/logic/moduleDiffCalculator'
import { calculateWorkforceBreakdown, calculateActualWorkforce, calculateEfficiencySaturation } from '@/store/logic/workforceCalculator'
import { buildResolvedWarePriority } from '@/store/logic/warePriorityResolver'
import { analyzeWareFlow } from '@/store/logic/analyzeWareFlow'
import { analyzeStation } from '@/store/logic/analyzeStation'

export const DEFAULT_STATION_SETTINGS: StationSettings = {
  sunlight: 100,
  useHQ: false,
  manualWorkforce: 0,
  workforcePercent: 100,
  workforceAuto: true,
  considerWorkforceForAutoFill: false,
  supplyWorkforceBonus: false,
  buyMultiplier: 0.5,
  sellMultiplier: 0.5,
  minersEnabled: false,
  internalSupply: false,
  showEmpireGaps: false,
  racePreference: 'argon',
  resourceBufferHours: 1.0,
  primaryProductBufferHours: 12.0,
  secondaryProductBufferHours: 2.0,
  transportMinutes: 30,
  transportShipCapacity: 62000
}

export interface StationComputeDeps {
  modulesMap: Record<string, X4Module>
  waresMap: Record<string, X4Ware>
  medicalConsumptionMap: RaceMedicalConsumption
  buildPriceMultiplier?: number
}

export interface StationState {
  stationId: string
  plannedModules: SavedModule[]
  lockedWares: string[]
  warePriority: Record<string, number>
  settings: StationSettings
  autoIndustryModules: SavedModule[]
  actualWorkforce: number
  currentEfficiency: number
  groupedFlows: GroupedFlows | null
  groupedFlowsForEmpire: GroupedFlows | null
  stationAnalysis: ReturnType<typeof analyzeStation> | null
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function createEmptyGroupedFlows(): GroupedFlows {
  return {
    flows: [],
    rateGroups: {
      positive: [],
      operations: [],
      supply: [],
      resources: []
    },
    volumeGroups: {
      solid: [],
      liquid: [],
      container: []
    }
  }
}

export function migrateStationSettings(raw: Partial<StationSettings> | null | undefined): StationSettings {
  const source = deepClone(raw || {}) as any
  source.racePreference = source.racePreference || 'argon'
  if ('productBufferHours' in source) {
    const oldValue = source.productBufferHours
    source.primaryProductBufferHours = oldValue
    delete source.productBufferHours
  }
  source.primaryProductBufferHours = source.primaryProductBufferHours ?? 12.0
  source.secondaryProductBufferHours = source.secondaryProductBufferHours ?? 2.0
  source.resourceBufferHours = source.resourceBufferHours !== undefined ? source.resourceBufferHours : 2
  source.transportMinutes = source.transportMinutes ?? 30
  source.transportShipCapacity = source.transportShipCapacity ?? 62000
  source.showEmpireGaps = source.showEmpireGaps ?? false
  return { ...DEFAULT_STATION_SETTINGS, ...source }
}

function filterGroupedFlowsByPriority(
  flows: GroupedFlows,
  priorityLevels: Record<string, number>
): GroupedFlows {
  return {
    flows: flows.flows.filter(f => {
      if (f.netRate <= 0) return true
      return (priorityLevels[f.wareId] ?? 0) > 0
    }),
    rateGroups: {
      positive: flows.rateGroups.positive.filter(f =>
        (priorityLevels[f.wareId] ?? 0) > 0
      ),
      operations: flows.rateGroups.operations,
      supply: flows.rateGroups.supply,
      resources: flows.rateGroups.resources
    },
    volumeGroups: flows.volumeGroups
  }
}

function createDefaultState(stationId: string): StationState {
  return reactive({
    stationId,
    plannedModules: [],
    lockedWares: [],
    warePriority: {},
    settings: { ...DEFAULT_STATION_SETTINGS },
    autoIndustryModules: [],
    actualWorkforce: 0,
    currentEfficiency: 0,
    groupedFlows: null,
    groupedFlowsForEmpire: null,
    stationAnalysis: null
  })
}

export class StationStateMap {
  private states = reactive(new Map<string, StationState>())

  ensure(stationId: string, seed?: Partial<Pick<StationState, 'plannedModules' | 'lockedWares' | 'warePriority' | 'settings'>>): StationState {
    let state = this.states.get(stationId)
    if (!state) {
      state = createDefaultState(stationId)
      this.states.set(stationId, state)
    }
    if (seed) {
      if (seed.plannedModules) state.plannedModules = deepClone(seed.plannedModules)
      if (seed.lockedWares) state.lockedWares = deepClone(seed.lockedWares)
      if (seed.warePriority) state.warePriority = deepClone(seed.warePriority)
      if (seed.settings) state.settings = migrateStationSettings(seed.settings)
    }
    return state
  }

  get(stationId: string): StationState | null {
    return this.states.get(stationId) || null
  }

  list(): StationState[] {
    return Array.from(this.states.values())
  }

  patch(stationId: string, partial: Partial<Pick<StationState, 'plannedModules' | 'lockedWares' | 'warePriority' | 'settings'>>): StationState {
    const state = this.ensure(stationId)
    if (partial.plannedModules !== undefined) state.plannedModules = deepClone(partial.plannedModules)
    if (partial.lockedWares !== undefined) state.lockedWares = deepClone(partial.lockedWares)
    if (partial.warePriority !== undefined) state.warePriority = deepClone(partial.warePriority)
    if (partial.settings !== undefined) state.settings = migrateStationSettings(partial.settings)
    return state
  }

  mutate(stationId: string, updater: (state: StationState) => void): StationState {
    const state = this.ensure(stationId)
    updater(state)
    return state
  }

  remove(stationId: string) {
    this.states.delete(stationId)
  }

  clone(fromId: string, toId: string): StationState | null {
    const source = this.get(fromId)
    if (!source) return null
    const cloned = this.ensure(toId)
    cloned.plannedModules = deepClone(source.plannedModules)
    cloned.lockedWares = deepClone(source.lockedWares)
    cloned.warePriority = deepClone(source.warePriority)
    cloned.settings = deepClone(source.settings)
    return cloned
  }

  fromPersisted(stationId: string, plan: StationPlan): StationState {
    return this.patch(stationId, {
      plannedModules: plan.modules || [],
      lockedWares: plan.lockedWares || [],
      warePriority: plan.warePriority || {},
      settings: plan.settings
    })
  }

  toPersisted(stationId: string): Pick<StationPlan, 'modules' | 'lockedWares' | 'warePriority' | 'settings'> | null {
    const state = this.get(stationId)
    if (!state) return null
    return {
      modules: deepClone(state.plannedModules),
      lockedWares: deepClone(state.lockedWares),
      warePriority: deepClone(state.warePriority),
      settings: deepClone(state.settings)
    }
  }

  recompute(stationId: string, deps: StationComputeDeps): StationState {
    const state = this.ensure(stationId)

    const autoFillResult = calculateAutoFill(
      state.plannedModules,
      state.settings,
      deps.modulesMap,
      deps.waresMap,
      state.lockedWares,
      deps.medicalConsumptionMap,
      state.warePriority
    )

    state.autoIndustryModules = autoFillResult.autoIndustry
    const allIndustryModules = [...state.plannedModules, ...state.autoIndustryModules]

    const workforceBreakdown = calculateWorkforceBreakdown(
      allIndustryModules,
      deps.modulesMap,
      state.settings
    )
    const actualWorkforce = calculateActualWorkforce(workforceBreakdown, state.settings)
    const currentEfficiency = calculateEfficiencySaturation(workforceBreakdown.needed.total, actualWorkforce)

    const warePriorityLevels = buildResolvedWarePriority(
      {
        plannedModules: state.plannedModules,
        autoIndustryModules: state.autoIndustryModules,
        modulesMap: deps.modulesMap,
        userPriorityOverride: state.warePriority
      },
      Object.keys(deps.waresMap)
    )

    const groupedFlows = analyzeWareFlow(
      allIndustryModules,
      deps.modulesMap,
      deps.waresMap,
      deps.medicalConsumptionMap,
      state.settings,
      actualWorkforce,
      currentEfficiency,
      state.settings.resourceBufferHours,
      state.settings.primaryProductBufferHours,
      state.settings.secondaryProductBufferHours,
      warePriorityLevels
    )

    state.actualWorkforce = actualWorkforce
    state.currentEfficiency = currentEfficiency
    state.groupedFlows = groupedFlows
    state.groupedFlowsForEmpire = filterGroupedFlowsByPriority(groupedFlows, warePriorityLevels)

    state.stationAnalysis = analyzeStation(
      allIndustryModules,
      deps.modulesMap,
      deps.waresMap,
      deps.buildPriceMultiplier ?? 0.5,
      state.settings.useHQ
    )

    return state
  }

  getGroupedFlows(stationId: string): GroupedFlows {
    return this.get(stationId)?.groupedFlows || createEmptyGroupedFlows()
  }

  getFilteredGroupedFlows(stationId: string): GroupedFlows {
    return this.get(stationId)?.groupedFlowsForEmpire || createEmptyGroupedFlows()
  }
}

export const stationStateMap = new StationStateMap()

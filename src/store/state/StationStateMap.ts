import { reactive } from 'vue'
import type { SavedModule, StationPlan, StationSettings, X4Module, X4Ware } from '@/types/x4'
import type { RaceMedicalConsumption } from '@/types/x4'
import { calculateProductionFlows } from '@/store/logic/calculateProductionFlows'
import { buildResolvedWarePriority } from '@/store/logic/warePriorityResolver'
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
  enforceDlcActivation?: boolean
  isModuleDlcActive?: (moduleId: string) => boolean
}

export interface StationState {
  stationId: string
  plannedModules: SavedModule[]
  lockedWares: string[]
  warePriority: Record<string, number>
  settings: StationSettings
  autoIndustryModules: SavedModule[]
  autoInfrastructureModules: SavedModule[]
  actualWorkforce: number
  currentEfficiency: number
  warePriorityLevels: Record<string, number> | null
  stationAnalysis: ReturnType<typeof analyzeStation> | null
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
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

function createDefaultState(stationId: string): StationState {
  return reactive({
    stationId,
    plannedModules: [],
    lockedWares: [],
    warePriority: {},
    settings: { ...DEFAULT_STATION_SETTINGS },
    autoIndustryModules: [],
    autoInfrastructureModules: [],
    actualWorkforce: 0,
    currentEfficiency: 0,
    warePriorityLevels: null,
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
    const shouldFilterInactiveDlc = deps.enforceDlcActivation === true && typeof deps.isModuleDlcActive === 'function'
    const computeModulesMap = shouldFilterInactiveDlc
      ? Object.fromEntries(
          Object.entries(deps.modulesMap).filter(([id]) => deps.isModuleDlcActive?.(id) !== false)
        )
      : deps.modulesMap
    const plannedModulesForCompute = shouldFilterInactiveDlc
      ? state.plannedModules.filter(module => deps.isModuleDlcActive?.(module.id) !== false)
      : state.plannedModules

    const result = calculateProductionFlows({
      plannedModules: plannedModulesForCompute,
      settings: state.settings,
      modulesMap: computeModulesMap,
      waresMap: deps.waresMap,
      lockedWares: state.lockedWares,
      medicalConsumptionMap: deps.medicalConsumptionMap,
      warePriority: state.warePriority
    })

    state.autoIndustryModules = result.autoIndustryModules
    state.actualWorkforce = result.actualWorkforce
    state.currentEfficiency = result.currentEfficiency

    const allIndustryModules = [...plannedModulesForCompute, ...state.autoIndustryModules]

    const warePriorityLevels = buildResolvedWarePriority(
      {
        plannedModules: plannedModulesForCompute,
        autoIndustryModules: state.autoIndustryModules,
        modulesMap: computeModulesMap,
        userPriorityOverride: state.warePriority
      },
      Object.keys(deps.waresMap)
    )
    state.warePriorityLevels = warePriorityLevels

    state.stationAnalysis = analyzeStation(
      allIndustryModules,
      computeModulesMap,
      deps.waresMap,
      deps.buildPriceMultiplier ?? 0.5,
      state.settings.useHQ
    )

    return state
  }

  getWarePriorityLevels(stationId: string): Record<string, number> {
    return this.get(stationId)?.warePriorityLevels || {}
  }
}

export const stationStateMap = new StationStateMap()
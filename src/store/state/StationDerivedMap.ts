import { reactive, type Ref } from 'vue'
import type { GroupedFlows, SavedModule, StationSettings, X4Module, WareFlow } from '@/types/x4'
import type { WareProductionFlow } from '@/types/production-flow'
import type { WorkforceEntry } from '@/types/saveArchive'
import { calculateProductionFlows, calculateProductionFlowsCore } from '@/store/logic/calculateProductionFlows'
import { calculateInfrastructureModules } from '@/store/logic/calculateInfrastructureModules'
import { buildResolvedWarePriority } from '@/store/logic/warePriorityResolver'
import { buildAggregatedModulesFromStationPlan, classifyPlayerStationPoi } from '@/store/logic/stationPoiSemantics'
import { solveMultiWareByLink } from '@/store/logic/sectorLinkFlow'
import { parseSectorLinkKey } from '@/store/logic/sectorLinks'

export interface StationDerivedStaticDeps {
  modulesMap: Record<string, X4Module>
  waresMap: Record<string, any>
  medicalConsumptionMap: Record<string, any>
}

export interface ComputeInfrastructureModulesInput {
  productionFlows: WareProductionFlow[]
  plannedModules: SavedModule[]
  autoIndustryModules: SavedModule[]
  settings: Pick<
    StationSettings,
    | 'racePreference'
    | 'resourceBufferHours'
    | 'primaryProductBufferHours'
    | 'secondaryProductBufferHours'
    | 'transportShipCapacity'
  >
  warePriorityLevels: Record<string, number>
  deps: StationDerivedStaticDeps
}

export interface DeriveInfrastructureModulesInput extends ComputeInfrastructureModulesInput {}

export function computeInfrastructureModulesFromFlows(input: ComputeInfrastructureModulesInput): SavedModule[] {
  return calculateInfrastructureModules({
    productionFlows: input.productionFlows,
    plannedModules: input.plannedModules,
    autoIndustryModules: input.autoIndustryModules,
    modulesMap: input.deps.modulesMap,
    settings: input.settings,
    warePriorityLevels: input.warePriorityLevels
  })
}

export function deriveInfrastructureModules(input: DeriveInfrastructureModulesInput): SavedModule[] {
  return computeInfrastructureModulesFromFlows(input)
}

export interface StationSemanticDerived {
  tag?: string
  factoryGroup?: string
  productionProfile?: string
  profileName?: string
}

export interface StationSemanticDerivedSource {
  tag?: string
  factoryGroup?: string
  productionProfile?: string
  profileName?: string
}

export interface StationDerivedSettings {
  racePreference: string
  considerWorkforceForAutoFill: boolean
  sunlight: number
  useHQ: boolean
  workforceAuto: boolean
  manualWorkforce: number
}

export interface StationDerivedCache {
  autoIndustryModules: SavedModule[]
  autoHabitationModules: SavedModule[]
  productionFlows: WareProductionFlow[]
  warePriorityLevels: Record<string, number>
  actualWorkforce: number
  currentEfficiency: number
  semantics?: StationSemanticDerived
}

export interface StationDerivedSnapshot {
  modulesMode: 'plan' | 'full'
  sectorId: string | null
  count: number
  inputModules: SavedModule[]
  fullModules: SavedModule[]
  settings: StationDerivedSettings
  lockedWares: string[]
  warePriority: Record<string, number>
  workforcesOverride?: WorkforceEntry[]
  archiveSemanticsSource?: StationSemanticDerivedSource
}

export interface StationDerivedSettingsInput {
  racePreference?: string
  considerWorkforceForAutoFill?: boolean
  sunlight?: number
  useHQ?: boolean
  workforceAuto?: boolean
  manualWorkforce?: number
}

export interface StationDerivedSeed {
  modulesMode: 'plan' | 'full'
  sectorId?: string | null
  modules: SavedModule[]
  settings: StationDerivedSettingsInput
  lockedWares?: string[]
  warePriority?: Record<string, number>
  workforces?: WorkforceEntry[]
  archiveSemanticsSource?: StationSemanticDerivedSource
  count?: number
}

const DEFAULT_DERIVED_SETTINGS: StationDerivedSettings = {
  racePreference: 'argon',
  considerWorkforceForAutoFill: true,
  sunlight: 100,
  useHQ: false,
  workforceAuto: true,
  manualWorkforce: 0
}

function truncateSettings(input: StationDerivedSettingsInput | Record<string, any>): StationDerivedSettings {
  return {
    racePreference: input.racePreference ?? DEFAULT_DERIVED_SETTINGS.racePreference,
    considerWorkforceForAutoFill: input.considerWorkforceForAutoFill ?? DEFAULT_DERIVED_SETTINGS.considerWorkforceForAutoFill,
    sunlight: input.sunlight ?? DEFAULT_DERIVED_SETTINGS.sunlight,
    useHQ: input.useHQ ?? DEFAULT_DERIVED_SETTINGS.useHQ,
    workforceAuto: input.workforceAuto ?? DEFAULT_DERIVED_SETTINGS.workforceAuto,
    manualWorkforce: input.manualWorkforce ?? DEFAULT_DERIVED_SETTINGS.manualWorkforce
  }
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function normalizeModules(modules: SavedModule[]): SavedModule[] {
  return modules.map(m => ({ id: m.id, count: m.count }))
}

function normalizeLockedWares(lockedWares: string[] | undefined): string[] {
  return lockedWares ? [...lockedWares] : []
}

function normalizeWarePriority(warePriority: Record<string, number> | undefined): Record<string, number> {
  return warePriority ? { ...warePriority } : {}
}

function modulesEqual(a: SavedModule[], b: SavedModule[]): boolean {
  if (a.length !== b.length) return false
  const aMap = new Map(a.map(m => [m.id, m.count]))
  for (const m of b) {
    const countA = aMap.get(m.id)
    if (countA === undefined || countA !== m.count) return false
  }
  return true
}

function settingsEqual(a: StationDerivedSettings, b: StationDerivedSettings): boolean {
  return (
    a.racePreference === b.racePreference &&
    a.considerWorkforceForAutoFill === b.considerWorkforceForAutoFill &&
    a.sunlight === b.sunlight &&
    a.useHQ === b.useHQ &&
    a.workforceAuto === b.workforceAuto &&
    a.manualWorkforce === b.manualWorkforce
  )
}

function lockedWaresEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const setA = new Set(a)
  for (const w of b) {
    if (!setA.has(w)) return false
  }
  return true
}

function warePriorityEqual(a: Record<string, number>, b: Record<string, number>): boolean {
  const keysA = Object.keys(a)
  const keysB = Object.keys(b)
  if (keysA.length !== keysB.length) return false
  for (const key of keysA) {
    if (a[key] !== b[key]) return false
  }
  return true
}

function createEmptyGroupedFlows(): GroupedFlows {
  return {
    flows: [],
    rateGroups: { positive: [], operations: [], supply: [], resources: [] },
    volumeGroups: { solid: [], liquid: [], container: [] }
  }
}

function filterProductionFlowsByPriority(
  flows: WareProductionFlow[],
  priorityLevels: Record<string, number>
): WareProductionFlow[] {
  return flows.filter(f => {
    if (f.netRate <= 0) return true
    return (priorityLevels[f.wareId] ?? 0) > 0
  })
}

function convertProductionFlowToWareFlow(prod: WareProductionFlow): WareFlow {
  const productionVolume = prod.production * prod.unitVolume
  const consumptionVolume = prod.consumption * prod.unitVolume
  const netVolume = prod.netRate * prod.unitVolume

  return {
    wareId: prod.wareId,
    orderIndex: prod.orderIndex,
    tier: prod.tier,
    transportType: prod.transportType,
    unitVolume: prod.unitVolume,
    production: prod.production,
    consumption: prod.consumption,
    netRate: prod.netRate,
    productionVolume,
    consumptionVolume,
    netVolume,
    transportDemand: 0,
    totalOccupiedCount: 0,
    totalOccupiedConsumptionCount: 0,
    totalOccupiedVolume: 0,
    unitPrice: 0,
    netValue: 0,
    contributions: prod.contributions.map((atom) => ({ ...atom }))
  }
}

function groupProductionFlows(flows: WareProductionFlow[]): GroupedFlows {
  const wareFlows = flows.map(convertProductionFlowToWareFlow)

  const result: GroupedFlows = {
    flows: wareFlows,
    rateGroups: { positive: [], operations: [], supply: [], resources: [] },
    volumeGroups: { solid: [], liquid: [], container: [] }
  }

  wareFlows.forEach(flow => {
    if (flow.netRate > 0) result.rateGroups.positive.push(flow)
    else if (flow.contributions.some(c => c.class === 'workforce')) result.rateGroups.supply.push(flow)
    else if (flow.transportType === 'container') result.rateGroups.operations.push(flow)
    else result.rateGroups.resources.push(flow)

    if (flow.transportType === 'solid') result.volumeGroups.solid.push(flow)
    else if (flow.transportType === 'liquid') result.volumeGroups.liquid.push(flow)
    else result.volumeGroups.container.push(flow)
  })

  return result
}

function mergeFlows(flowsArray: WareProductionFlow[][]): WareProductionFlow[] {
  const mergedMap: Record<string, WareProductionFlow> = {}

  for (const flows of flowsArray) {
    for (const flow of flows) {
      let entry = mergedMap[flow.wareId]
      if (!entry) {
        entry = {
          wareId: flow.wareId,
          orderIndex: flow.orderIndex,
          tier: flow.tier,
          transportType: flow.transportType,
          unitVolume: flow.unitVolume,
          production: 0,
          consumption: 0,
          netRate: 0,
          contributions: []
        }
        mergedMap[flow.wareId] = entry
      }
      const currentEntry = entry
      currentEntry.production += flow.production
      currentEntry.consumption += flow.consumption
      currentEntry.netRate += flow.netRate
      currentEntry.contributions.push(...deepClone(flow.contributions))
    }
  }

  const merged = Object.values(mergedMap)
  merged.sort((a, b) => {
    if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex
    if (a.tier !== b.tier) return b.tier - a.tier
    return Math.abs(b.netRate) - Math.abs(a.netRate)
  })

  return merged
}

function toFullSettingsForCompute(settings: StationDerivedSettings): StationSettings {
  return {
    racePreference: settings.racePreference,
    considerWorkforceForAutoFill: settings.considerWorkforceForAutoFill,
    sunlight: settings.sunlight,
    useHQ: settings.useHQ,
    workforceAuto: settings.workforceAuto,
    manualWorkforce: settings.manualWorkforce,
    workforcePercent: 100,
    resourceBufferHours: 2,
    primaryProductBufferHours: 2,
    secondaryProductBufferHours: 2,
    transportShipCapacity: 20000,
    buyMultiplier: 1,
    sellMultiplier: 1,
    minersEnabled: false,
    internalSupply: true,
    transportMinutes: 30
  }
}

function buildSemanticsFromModules(
  modules: SavedModule[],
  deps: StationDerivedStaticDeps
): StationSemanticDerived {
  const aggregatedModules = buildAggregatedModulesFromStationPlan({ modules }, deps.modulesMap)
  const classification = classifyPlayerStationPoi({
    modules: aggregatedModules,
    modulesMap: deps.modulesMap,
    isHeadquarter: false
  })

  return {
    tag: classification.tag,
    factoryGroup: classification.factoryGroup,
    productionProfile: classification.productionProfile,
    profileName: classification.profileName
  }
}

export interface StationDerivedMapOptions {
  hasSector?: boolean
  sectorLinks?: string[]
  refreshKey?: Ref<number>
}

export class StationDerivedMap {
  private cacheMap = reactive(new Map<string, StationDerivedCache>())
  private snapshotMap = new Map<string, StationDerivedSnapshot>()
  private empireFlowsCache: WareProductionFlow[] = []
  private sectorFlowsCache: Map<string, WareProductionFlow[]> = new Map()
  private sectorExternalCache: Map<string, WareProductionFlow[]> = new Map()
  private staticDeps: StationDerivedStaticDeps
  private hasSector: boolean
  private sectorLinks: string[]
  private refreshKey?: Ref<number>

  constructor(staticDeps: StationDerivedStaticDeps, options?: StationDerivedMapOptions) {
    this.staticDeps = staticDeps
    this.hasSector = options?.hasSector ?? false
    this.sectorLinks = options?.sectorLinks ?? []
    this.refreshKey = options?.refreshKey
  }

  upsertStation(stationId: string, seed: StationDerivedSeed): void {
    const deps = this.staticDeps

    const settings = truncateSettings(seed.settings)
    const inputModules = normalizeModules(seed.modules)
    const lockedWares = normalizeLockedWares(seed.lockedWares)
    const warePriority = normalizeWarePriority(seed.warePriority)

    let fullModules: SavedModule[]
    let workforcesOverride: WorkforceEntry[] | undefined
    let archiveSemanticsSource: StationSemanticDerivedSource | undefined

    if (seed.modulesMode === 'plan') {
      fullModules = this.deriveFullModules(inputModules, settings, lockedWares, warePriority, deps)
      workforcesOverride = undefined
      archiveSemanticsSource = undefined
    } else {
      fullModules = inputModules
      workforcesOverride = seed.workforces ? normalizeWorkforces(seed.workforces) : undefined
      archiveSemanticsSource = seed.archiveSemanticsSource
    }

    const snapshot: StationDerivedSnapshot = {
      modulesMode: seed.modulesMode,
      sectorId: seed.sectorId ?? null,
      count: seed.count ?? 1,
      inputModules,
      fullModules,
      settings,
      lockedWares,
      warePriority,
      workforcesOverride,
      archiveSemanticsSource
    }

    this.snapshotMap.set(stationId, snapshot)
    this.computeInternal(stationId, snapshot, deps, true)
  }

  updateModules(stationId: string, modules: SavedModule[]): void {
    const snapshot = this.snapshotMap.get(stationId)
    if (!snapshot) return
    const deps = this.staticDeps

    const newInputModules = normalizeModules(modules)
    if (modulesEqual(newInputModules, snapshot.inputModules)) return

    let newFullModules: SavedModule[]
    if (snapshot.modulesMode === 'plan') {
      newFullModules = this.deriveFullModules(newInputModules, snapshot.settings, snapshot.lockedWares, snapshot.warePriority, deps)
    } else {
      newFullModules = newInputModules
    }

    const newSnapshot: StationDerivedSnapshot = {
      ...snapshot,
      inputModules: newInputModules,
      fullModules: newFullModules
    }

    this.snapshotMap.set(stationId, newSnapshot)
    this.computeInternal(stationId, newSnapshot, deps, true)
  }

  updateSettings(stationId: string, settings: StationDerivedSettingsInput): void {
    const snapshot = this.snapshotMap.get(stationId)
    if (!snapshot) return
    const deps = this.staticDeps

    const newSettings = truncateSettings(settings)
    if (settingsEqual(newSettings, snapshot.settings)) return

    const newSnapshot: StationDerivedSnapshot = {
      ...snapshot,
      settings: newSettings,
      fullModules: snapshot.modulesMode === 'plan'
        ? this.deriveFullModules(snapshot.inputModules, newSettings, snapshot.lockedWares, snapshot.warePriority, deps)
        : snapshot.fullModules
    }

    this.snapshotMap.set(stationId, newSnapshot)
    this.computeInternal(stationId, newSnapshot, deps, false)
  }

  updateLockedWares(stationId: string, lockedWares: string[]): void {
    const snapshot = this.snapshotMap.get(stationId)
    if (!snapshot) return
    const deps = this.staticDeps

    const newLockedWares = normalizeLockedWares(lockedWares)
    if (lockedWaresEqual(newLockedWares, snapshot.lockedWares)) return

    const newSnapshot: StationDerivedSnapshot = {
      ...snapshot,
      lockedWares: newLockedWares,
      fullModules: snapshot.modulesMode === 'plan'
        ? this.deriveFullModules(snapshot.inputModules, snapshot.settings, newLockedWares, snapshot.warePriority, deps)
        : snapshot.fullModules
    }

    this.snapshotMap.set(stationId, newSnapshot)
    this.computeInternal(stationId, newSnapshot, deps, false)
  }

  updateWarePriority(stationId: string, warePriority: Record<string, number>): void {
    const snapshot = this.snapshotMap.get(stationId)
    if (!snapshot) return
    const deps = this.staticDeps

    const newWarePriority = normalizeWarePriority(warePriority)
    if (warePriorityEqual(newWarePriority, snapshot.warePriority)) return

    const newSnapshot: StationDerivedSnapshot = {
      ...snapshot,
      warePriority: newWarePriority,
      fullModules: snapshot.modulesMode === 'plan'
        ? this.deriveFullModules(snapshot.inputModules, snapshot.settings, snapshot.lockedWares, newWarePriority, deps)
        : snapshot.fullModules
    }

    this.snapshotMap.set(stationId, newSnapshot)
    this.computeInternal(stationId, newSnapshot, deps, false)
  }

  refreshStation(stationId: string): void {
    const snapshot = this.snapshotMap.get(stationId)
    if (!snapshot) return
    const deps = this.staticDeps

    this.computeInternal(stationId, snapshot, deps, true)
  }

  refreshAll(): void {
    const deps = this.staticDeps

    this.snapshotMap.forEach((snapshot, stationId) => {
      this.computeInternal(stationId, snapshot, deps, true, true)
    })
    
    this.updateAggregation()
  }

  removeStation(stationId: string): void {
    this.cacheMap.delete(stationId)
    this.snapshotMap.delete(stationId)
    this.empireFlowsCache = []
    this.sectorFlowsCache.clear()
  }

  remove(stationId: string): void {
    this.removeStation(stationId)
  }

  clear(): void {
    this.cacheMap.clear()
    this.snapshotMap.clear()
    this.empireFlowsCache = []
    this.sectorFlowsCache.clear()
    this.sectorExternalCache.clear()
  }

  private deriveFullModules(
    inputModules: SavedModule[],
    settings: StationDerivedSettings,
    lockedWares: string[],
    warePriority: Record<string, number>,
    deps: StationDerivedStaticDeps
  ): SavedModule[] {
    const fullSettings = toFullSettingsForCompute(settings)
    const result = calculateProductionFlows({
      plannedModules: inputModules,
      settings: fullSettings,
      modulesMap: deps.modulesMap,
      waresMap: deps.waresMap,
      lockedWares,
      medicalConsumptionMap: deps.medicalConsumptionMap,
      warePriority
    })
    
    const fullModules = [...inputModules]
    for (const autoMod of result.autoIndustryModules) {
      const existing = fullModules.find(m => m.id === autoMod.id)
      if (existing) {
        existing.count += autoMod.count
      } else {
        fullModules.push({ id: autoMod.id, count: autoMod.count })
      }
    }
    for (const autoMod of result.autoHabitationModules) {
      const existing = fullModules.find(m => m.id === autoMod.id)
      if (existing) {
        existing.count += autoMod.count
      } else {
        fullModules.push({ id: autoMod.id, count: autoMod.count })
      }
    }
    return fullModules
  }

  private computeInternal(
    stationId: string,
    snapshot: StationDerivedSnapshot,
    deps: StationDerivedStaticDeps,
    recomputeSemantics: boolean,
    skipAggregation: boolean = false
  ): void {
    const fullSettings = toFullSettingsForCompute(snapshot.settings)
    
    let autoIndustryModules: SavedModule[] = []
    let autoHabitationModules: SavedModule[] = []
    let productionFlows: WareProductionFlow[]
    let actualWorkforce: number
    let currentEfficiency: number

    if (snapshot.modulesMode === 'full') {
      const coreResult = calculateProductionFlowsCore({
        plannedModules: snapshot.fullModules,
        autoIndustryModules: [],
        autoHabitationModules: [],
        modulesMap: deps.modulesMap,
        waresMap: deps.waresMap,
        medicalConsumptionMap: deps.medicalConsumptionMap,
        settings: fullSettings,
        warePriority: snapshot.warePriority,
        workforceOverride: snapshot.workforcesOverride,
        actualWorkforceOverride: snapshot.workforcesOverride
          ? snapshot.workforcesOverride.reduce((sum, w) => sum + w.amount, 0)
          : undefined
      })
      productionFlows = coreResult.productionFlows
      actualWorkforce = coreResult.actualWorkforce
      currentEfficiency = coreResult.currentEfficiency
    } else {
      const result = calculateProductionFlows({
        plannedModules: snapshot.inputModules,
        settings: fullSettings,
        modulesMap: deps.modulesMap,
        waresMap: deps.waresMap,
        lockedWares: snapshot.lockedWares,
        medicalConsumptionMap: deps.medicalConsumptionMap,
        warePriority: snapshot.warePriority
      })
      autoIndustryModules = result.autoIndustryModules
      autoHabitationModules = result.autoHabitationModules
      productionFlows = result.productionFlows
      actualWorkforce = result.actualWorkforce
      currentEfficiency = result.currentEfficiency
    }

    const allWareIds = productionFlows.map(f => f.wareId)
    const warePriorityLevels = buildResolvedWarePriority({
      plannedModules: snapshot.inputModules,
      autoIndustryModules,
      modulesMap: deps.modulesMap,
      userPriorityOverride: snapshot.warePriority || {}
    }, allWareIds)

    const existingCache = this.cacheMap.get(stationId)
    const semantics = recomputeSemantics
      ? this.buildSemantics(snapshot, deps)
      : existingCache?.semantics

    this.cacheMap.set(stationId, {
      autoIndustryModules,
      autoHabitationModules,
      productionFlows,
      warePriorityLevels,
      actualWorkforce,
      currentEfficiency,
      semantics
    })
    
    if (!skipAggregation) {
      this.updateAggregation()
    }
  }

  private buildSemantics(snapshot: StationDerivedSnapshot, deps: StationDerivedStaticDeps): StationSemanticDerived {
    if (snapshot.modulesMode === 'plan') {
      return buildSemanticsFromModules(snapshot.inputModules, deps)
    }

    const fallback = buildSemanticsFromModules(snapshot.fullModules, deps)
    const source = snapshot.archiveSemanticsSource

    if (!source) return fallback

    return {
      tag: source.tag ?? fallback.tag,
      factoryGroup: source.factoryGroup ?? fallback.factoryGroup,
      productionProfile: source.productionProfile ?? fallback.productionProfile,
      profileName: source.profileName ?? fallback.profileName
    }
  }

  updateAggregation(): void {
    const allFilteredFlows: WareProductionFlow[][] = []
    const sectorMap = new Map<string, WareProductionFlow[]>()
    
    this.snapshotMap.forEach((snapshot, stationId) => {
      const cache = this.cacheMap.get(stationId)
      if (!cache) return
      
      const count = snapshot.count ?? 1
      const filteredFlows = filterProductionFlowsByPriority(cache.productionFlows, cache.warePriorityLevels)
      const scaledFlows = filteredFlows
        .filter(f => !(f.netRate < 0 && !f.contributions.some(c => c.class === 'workforce') && f.transportType !== 'container'))
        .map(flow => {
          const netRate = flow.netRate * count
          return {
            ...flow,
            production: flow.production * count,
            consumption: flow.consumption * count,
            netRate,
            contributions: [{
              id: stationId,
              class: 'station' as const,
              type: netRate > 0 ? ('production' as const) : ('consumption' as const),
              count,
              amount: netRate,
              bonusPercent: 0
            }]
          } as WareProductionFlow
        })
      
      allFilteredFlows.push(scaledFlows)
      
      if (this.hasSector) {
        const sectorId = snapshot.sectorId || '__no_sector__'
        if (!sectorMap.has(sectorId)) {
          sectorMap.set(sectorId, [])
        }
        const existing = sectorMap.get(sectorId)!
        sectorMap.set(sectorId, mergeFlows([existing, scaledFlows]))
      }
    })
    
    this.empireFlowsCache = mergeFlows(allFilteredFlows)
    
    if (this.hasSector) {
      this.sectorFlowsCache = sectorMap
      this.buildExternalCache()
    }

    if (this.refreshKey) this.refreshKey.value++
  }

  private buildExternalCache(): void {
    const sectorExternalCache = new Map<string, WareProductionFlow[]>()
    const links = this.sectorLinks
      .map(key => parseSectorLinkKey(key))
      .filter((item): item is { a: string; b: string } => !!item)
      .map(item => ({
        linkId: `${item.a}|${item.b}`,
        a: item.a,
        b: item.b,
        distance: 1
      }))

    if (links.length === 0) {
      this.sectorExternalCache = sectorExternalCache
      return
    }

    const sectorsInput: Array<{ sectorId: string; netByWare: Record<string, number> }> = []
    this.sectorFlowsCache.forEach((flows, sectorId) => {
      const netByWare: Record<string, number> = {}
      for (const flow of flows) {
        if (flow.transportType === 'container') {
          netByWare[flow.wareId] = Number(flow.netRate || 0)
        }
      }
      sectorsInput.push({ sectorId, netByWare })
    })

    if (sectorsInput.length === 0) {
      this.sectorExternalCache = sectorExternalCache
      return
    }

    const solverOutput = solveMultiWareByLink({ sectors: sectorsInput, links, epsilon: 1e-9 })
    const waresMap = this.staticDeps.waresMap || {}

    for (const sector of sectorsInput) {
      const perSectorExternal: WareProductionFlow[] = []
      const externalByWare = new Map<string, WareProductionFlow>()

      for (const linkFlow of solverOutput.linkWareFlows) {
        const isFrom = linkFlow.from === sector.sectorId
        const isTo = linkFlow.to === sector.sectorId
        if (!isFrom && !isTo) continue

        const peerSectorId = isFrom ? linkFlow.to : linkFlow.from
        const flowAmount = linkFlow.amount || 0
        const contribution = {
          id: peerSectorId,
          class: 'sector' as const,
          type: isTo ? 'production' as const : 'consumption' as const,
          count: 1,
          amount: isTo ? flowAmount : -flowAmount,
          bonusPercent: 0
        }

        const existingFlow = externalByWare.get(linkFlow.wareId)
        if (existingFlow) {
          existingFlow.contributions.push(contribution)
          existingFlow.production += Math.max(contribution.amount, 0)
          existingFlow.consumption += Math.max(-contribution.amount, 0)
          existingFlow.netRate += contribution.amount
        } else {
          const ware = waresMap[linkFlow.wareId]
          externalByWare.set(linkFlow.wareId, {
            wareId: linkFlow.wareId,
            orderIndex: Number.MAX_SAFE_INTEGER,
            tier: ware?.tier || 0,
            transportType: ware?.transport || 'container',
            unitVolume: ware?.volume || 1,
            production: Math.max(contribution.amount, 0),
            consumption: Math.max(-contribution.amount, 0),
            netRate: contribution.amount,
            contributions: [contribution]
          })
        }
      }

      for (const flow of externalByWare.values()) {
        perSectorExternal.push(flow)
      }
      perSectorExternal.sort((a, b) => {
        if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex
        if (a.tier !== b.tier) return b.tier - a.tier
        return Math.abs(b.netRate) - Math.abs(a.netRate)
      })
      sectorExternalCache.set(sector.sectorId, perSectorExternal)
    }

    this.sectorExternalCache = sectorExternalCache
  }

  getCache(stationId: string): StationDerivedCache | null {
    return this.cacheMap.get(stationId) || null
  }

  getSnapshot(stationId: string): StationDerivedSnapshot | null {
    return this.snapshotMap.get(stationId) || null
  }

  getAutoIndustryModules(stationId: string): SavedModule[] {
    return this.cacheMap.get(stationId)?.autoIndustryModules || []
  }

  getAutoHabitationModules(stationId: string): SavedModule[] {
    return this.cacheMap.get(stationId)?.autoHabitationModules || []
  }

  getProductionFlows(stationId: string): WareProductionFlow[] {
    return this.cacheMap.get(stationId)?.productionFlows || []
  }

  getSectorFlows(sectorId: string): WareProductionFlow[] {
    return this.sectorFlowsCache.get(sectorId) || []
  }

  getSectorExternalFlows(sectorId: string): WareProductionFlow[] {
    return this.sectorExternalCache.get(sectorId) || []
  }

  getSectorCombinedFlows(sectorId: string): WareProductionFlow[] {
    return mergeFlows([this.getSectorFlows(sectorId), this.getSectorExternalFlows(sectorId)])
  }

  getEmpireFlows(): WareProductionFlow[] {
    return this.empireFlowsCache
  }

  getGrouped(stationId: string): GroupedFlows {
    const flows = this.getProductionFlows(stationId)
    if (flows.length === 0) return createEmptyGroupedFlows()
    return groupProductionFlows(flows)
  }

  getFilteredGrouped(stationId: string, priorityLevels: Record<string, number>): GroupedFlows {
    const flows = this.getProductionFlows(stationId)
    const filtered = filterProductionFlowsByPriority(flows, priorityLevels)
    if (filtered.length === 0) return createEmptyGroupedFlows()
    return groupProductionFlows(filtered)
  }

  getModulesMode(stationId: string): 'plan' | 'full' | null {
    return this.snapshotMap.get(stationId)?.modulesMode || null
  }
}

function normalizeWorkforces(workforces: WorkforceEntry[]): WorkforceEntry[] {
  return workforces.map(w => ({ race: w.race, amount: w.amount }))
}

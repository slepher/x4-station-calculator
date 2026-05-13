import { computed, type ComputedRef } from 'vue'
import i18n from '@/i18n'
import type {
  BuildGoal,
  BuildPlan,
  BuildScheme,
  BuildSchemeGroup,
  FleetGoalView,
  FleetEntryView,
  FleetMergedRate,
  FleetMaterialItem,
  FleetShipyardGroup,
  PreviewLinePlan,
  PreviewResult,
  ProductionLineAllocation,
} from '@/types/build-plan'
import type { EmpireGroupedFlows, SavedModule, StationType } from '@/types/x4'
import { useLogicFlowStore } from '@/store/useLogicFlowStore'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useShipBuildStore } from '@/store/useShipBuildStore'
import { computeProductionLineAllocation } from '@/store/logic/computeProductionLineAllocation'

export interface FlowPlanItem {
  id: string | null
  name: string
  index: number
}

export interface PlanItem {
  id: string
  name: string
  index: number
}

export interface BuildPlanPresenterProps {
  goals: ComputedRef<BuildGoal[]>
  buildMaterialPlanningEnabled: ComputedRef<boolean>
  racePreference: ComputedRef<string>
  buildPlan: ComputedRef<BuildPlan | null>
  loading: ComputedRef<boolean>
  schemes: ComputedRef<BuildScheme[]>
  schemeGroups: ComputedRef<BuildSchemeGroup[]>
  warnings: ComputedRef<string[]>
  currentFlows: ComputedRef<EmpireGroupedFlows>
  allocations: ComputedRef<ProductionLineAllocation[]>
  buildFlowPlanAllocations: ComputedRef<ProductionLineAllocation[]>
  buildMaterialPreviewLines: ComputedRef<PreviewLinePlan[]>
  productionPreviewLines: ComputedRef<PreviewLinePlan[]>
  buildFlowPlanLoading: ComputedRef<boolean>
  planName: ComputedRef<string>
  activePlanId: ComputedRef<string | null>
  loadablePlanItems: ComputedRef<PlanItem[]>
  flowPlanName: ComputedRef<string>
  selectedFlowPlanId: ComputedRef<string | null>
  loadableFlowPlans: ComputedRef<FlowPlanItem[]>
  fleetGoalView: ComputedRef<FleetGoalView | null>
}

export interface BuildPlanPresenterEmits {
  addGoal: (goal: BuildGoal) => void
  removeGoal: (index: number) => void
  updateGoal: (index: number, value: number) => void
  setBuildMaterialPlanningEnabled: (enabled: boolean) => void
  computePlan: () => void
  createNewPlan: () => void
  switchPlan: (planId: string) => void
  deletePlan: (planId: string) => void
  setPlanName: (name: string) => void
  loadFlowPlan: (planId: string | null) => void
  addFleetEntry: (shipId: string, blueprintId: string) => void
  removeFleetEntry: (blueprintId: string) => void
  updateFleetBuildTime: (seconds: number) => void
  updateFleetBuildTimeMode: (mode: 'actual' | 'planned') => void
  updateFleetEntryQuantity: (blueprintId: string, qty: number) => void
  clearFleetGroup: (groupType: 'shipyard_l' | 'shipyard_xl' | 'wharf') => void
  updateFleetShipyardCount: (groupType: 'shipyard_l' | 'shipyard_xl' | 'wharf', count: number) => void
  exportToStations: (mode: 'overwrite' | 'direct') => void
}

export interface UseBuildPlanPresenterReturn {
  props: BuildPlanPresenterProps
  emits: BuildPlanPresenterEmits
}

interface ExportStationSnapshot {
  id: string
  modules: SavedModule[]
  lockedWares?: string[]
  warePriority?: Record<string, number>
  settings?: {
    racePreference?: string
  }
}

export interface BuildPlanPresenterStore {
  getEmpireGroupedFlows(): EmpireGroupedFlows
  createStation(name?: string, type?: StationType): string | null
  updateStationModules(stationId: string, modules: SavedModule[]): void
  findStationByName(name: string): ExportStationSnapshot | null
  getStationById(stationId: string): ExportStationSnapshot | null
  applyImportedStationPayload(stationId: string, payload: {
    modules: SavedModule[]
    lockedWares: string[]
    warePriority: Record<string, number>
  }): void
}

export interface BuildPlanPresenterBuildPlanStore {
  buildGoals: BuildGoal[]
  buildMaterialPlanningEnabled: boolean
  buildPlan: BuildPlan | null
  buildFlowPlanAllocations: ProductionLineAllocation[]
  previewResult: PreviewResult | null
  buildFlowPlanLoading: boolean
  schemeGroups: BuildSchemeGroup[]
  computeBuildPlanLoading: boolean
  savedPlans: { activeId: string | null; list: { id: string; name: string; buildGoals: BuildGoal[]; logicFlowPlanId?: string | null }[] }
  activePlanName: string
  setLogicFlowPlanId(planId: string | null): void
  setBuildGoal(goal: BuildGoal): void
  removeBuildGoal(index: number): void
  setBuildMaterialPlanningEnabled(enabled: boolean): void
  computePlan(): void
  createNewPlan(): void
  switchPlan(planId: string): void
  deletePlan(planId: string): void
  syncGoalsToActivePlan(): void
  addFleetEntry(shipId: string, blueprintId: string): void
  removeFleetEntry(blueprintId: string): void
  updateFleetBuildTime(seconds: number): void
  updateFleetBuildTimeMode(mode: 'actual' | 'planned'): void
  updateFleetEntryQuantity(blueprintId: string, qty: number): void
  clearFleetGroup(groupType: 'shipyard_l' | 'shipyard_xl' | 'wharf'): void
  updateFleetShipyardCount(groupType: 'shipyard_l' | 'shipyard_xl' | 'wharf', count: number): void
}

export interface BuildPlanPresenterInput {
  buildPlanStore: BuildPlanPresenterBuildPlanStore
  blueprintStore: BuildPlanPresenterStore
}

export function useBuildPlanPresenter({ buildPlanStore, blueprintStore }: BuildPlanPresenterInput): UseBuildPlanPresenterReturn {
  const logicFlow = useLogicFlowStore()
  const gameData = useGameDataStore()
  const shipBuildStore = useShipBuildStore()

  function collectIsolatedLockedWaresForScheme(scheme: BuildScheme): string[] {
    const groupId = (scheme as any)._groupId
    if (typeof groupId !== 'string' || groupId.length === 0) return []

    const group = logicFlow.groups.find(item => item.id === groupId)
    if (!group) return []

    return [...new Set(
      group.nodes
        .filter(node => node.isIsolated)
        .map(node => node.wareId),
    )]
  }

  const fleetGoalView = computed<FleetGoalView | null>(() => {
    const fleetGoal = buildPlanStore.buildGoals.find((g): g is Extract<BuildGoal, { type: 'fleet' }> => g.type === 'fleet')
    if (!fleetGoal) return null
    const savedBlueprintBuckets = shipBuildStore.savedBlueprints.ships
    const savedBlueprintIds = new Set(
      savedBlueprintBuckets.flatMap(bucket => bucket.blueprints.map(bp => bp.id)),
    )

    const entries: FleetEntryView[] = fleetGoal.entries.map(entry => {
      const blueprint = savedBlueprintIds.has(entry.blueprintId)
        ? shipBuildStore.findBlueprintById(entry.blueprintId)
        : null
      const localizedShip = gameData.localizedShipsMap[entry.shipId]
      const isBlueprintMissing = !blueprint

      if (isBlueprintMissing) {
        console.warn('[BuildPlan][FleetGoalView] Missing blueprint for fleet entry', {
          blueprintId: entry.blueprintId,
          shipId: entry.shipId,
          hasShipData: !!localizedShip,
          savedBlueprintShipBuckets: savedBlueprintBuckets.length,
        })
      }

      let buildTime = 0
      const materials: FleetMaterialItem[] = []
      if (blueprint && localizedShip) {
        const analysis = shipBuildStore.getBuildAnalysis(blueprint)
        buildTime = analysis.totalBuildTime

        for (const item of analysis.summaryItems) {
          const totalQty = item.count * entry.quantity
          materials.push({
            wareId: item.wareId,
            wareName: gameData.localizedWaresMap[item.wareId]?.localeName || item.wareId,
            totalQty,
          })
        }
        materials.sort((a, b) => {
          const tierA = gameData.waresMap[a.wareId]?.tier ?? 0
          const tierB = gameData.waresMap[b.wareId]?.tier ?? 0
          if (tierB !== tierA) return tierB - tierA
          return a.wareName.localeCompare(b.wareName)
        })
      }

      return {
        shipId: entry.shipId,
        shipName: localizedShip?.localeName || localizedShip?.name || entry.shipId,
        blueprintId: entry.blueprintId,
        blueprintName: blueprint?.name || localizedShip?.localeName || localizedShip?.name || entry.blueprintId,
        quantity: entry.quantity,
        buildTime,
        totalBuildTime: buildTime * entry.quantity,
        materials,
        isBlueprintMissing,
      }
    })

    const groupDefinitions: { type: 'shipyard_l' | 'shipyard_xl' | 'wharf'; label: string; count: number }[] = [
      { type: 'shipyard_xl', label: i18n.global.t('build_plan.fleet_shipyard_xl'), count: fleetGoal.shipyardXLCount },
      { type: 'shipyard_l', label: i18n.global.t('build_plan.fleet_shipyard_l'), count: fleetGoal.shipyardLCount },
      { type: 'wharf', label: i18n.global.t('build_plan.fleet_wharf'), count: fleetGoal.wharfCount },
    ]

    const groups: FleetShipyardGroup[] = groupDefinitions.map(def => {
      const groupEntries = entries.filter(e => {
        const shipClass = gameData.localizedShipsMap[e.shipId]?.class
        if (!shipClass) return false
        if (def.type === 'shipyard_l') return shipClass === 'ship_l'
        if (def.type === 'shipyard_xl') return shipClass === 'ship_xl'
        return shipClass === 'ship_m' || shipClass === 'ship_s'
      })
      const totalShipTime = groupEntries.reduce((sum, e) => sum + e.buildTime * e.quantity, 0)
      const maxSingleBuildTime = groupEntries.reduce((max, e) => Math.max(max, e.buildTime), 0)
      return {
        type: def.type,
        label: def.label,
        shipyardCount: def.count,
        entries: groupEntries,
        groupTotalBuildTime: Math.max(maxSingleBuildTime, Math.ceil(totalShipTime / Math.max(1, def.count))),
      }
    })

    const ungroupedEntries = entries.filter(entry => !groups.some(group => group.entries.includes(entry)))
    if (ungroupedEntries.length > 0) {
      console.warn('[BuildPlan][FleetGoalView] Fleet entries could not be grouped', {
        entries: ungroupedEntries.map(entry => ({
          blueprintId: entry.blueprintId,
          shipId: entry.shipId,
          shipClass: gameData.localizedShipsMap[entry.shipId]?.class || null,
          isBlueprintMissing: entry.isBlueprintMissing,
        })),
      })
    }

    const actualTotalBuildTime = Math.max(0, ...groups.map(g => g.groupTotalBuildTime))
    const effectiveBuildTime = (fleetGoal.buildTimeMode ?? 'actual') === 'planned'
      ? fleetGoal.buildTime
      : actualTotalBuildTime || fleetGoal.buildTime

    const totalByWare: Record<string, number> = {}
    for (const entry of entries) {
      for (const mat of entry.materials) {
        totalByWare[mat.wareId] = (totalByWare[mat.wareId] || 0) + mat.totalQty
      }
    }

    const mergedRates: FleetMergedRate[] = Object.entries(totalByWare)
      .map(([wareId, totalQty]) => ({
        wareId,
        wareName: gameData.localizedWaresMap[wareId]?.localeName || wareId,
        totalQty,
        ratePerHour: Math.ceil(totalQty / effectiveBuildTime * 3600),
      }))
      .sort((a, b) => {
        const tierA = gameData.waresMap[a.wareId]?.tier ?? 0
        const tierB = gameData.waresMap[b.wareId]?.tier ?? 0
        if (tierB !== tierA) return tierB - tierA
        return a.wareName.localeCompare(b.wareName)
      })

    return {
      buildTime: fleetGoal.buildTime,
      buildTimeMode: fleetGoal.buildTimeMode ?? 'actual',
      shipyardLCount: fleetGoal.shipyardLCount,
      shipyardXLCount: fleetGoal.shipyardXLCount,
      wharfCount: fleetGoal.wharfCount,
      groups,
      actualTotalBuildTime,
      effectiveBuildTime,
      entries,
      mergedRates,
    }
  })

  const allocations = computed<ProductionLineAllocation[]>(() => {
    const activePlanId = logicFlow.savedPlans.activeId
    if (!activePlanId) {
      const unmatched: ProductionLineAllocation = {
        groupId: undefined,
        groupName: '',
        isUnmatched: true,
        lineage: 'default',
        goals: [...buildPlanStore.buildGoals],
      }
      return buildPlanStore.buildGoals.length > 0 ? [unmatched] : []
    }

    const groups = logicFlow.groups
    const buildFlowView = {
      buildFlowGroups: logicFlow.buildFlowGroups,
      assignments: logicFlow.buildFlowAssignments,
      virtualEdges: logicFlow.buildFlowVirtualEdges,
    }

    return computeProductionLineAllocation(
      buildPlanStore.buildGoals,
      groups,
      buildFlowView,
      gameData.modulesMap,
      gameData.modulesByOutputMap || {},
    )
  })

  const buildMaterialPreviewLines = computed<PreviewLinePlan[]>(() => {
    if (!buildPlanStore.previewResult || !buildPlanStore.previewResult.buildMaterialPlanningEnabled) return []
    return buildPlanStore.previewResult.lines
      .filter((line: PreviewLinePlan) => line.items.some((item) =>
        (item.kind === 'derived' && item.derived.includes('build-material'))
        || (item.kind === 'required' && item.required.includes('build-material'))
      ))
  })

  const productionPreviewLines = computed<PreviewLinePlan[]>(() => {
    if (!buildPlanStore.previewResult) return []
    return buildPlanStore.previewResult.lines
      .filter((line: PreviewLinePlan) => !line.items.some((item) =>
        (item.kind === 'derived' && item.derived.includes('build-material'))
        || (item.kind === 'required' && item.required.includes('build-material'))
      ))
  })

  const selectedFlowPlanId = computed<string | null>(() => {
    const activePlan = buildPlanStore.savedPlans.list.find(plan => plan.id === buildPlanStore.savedPlans.activeId)
    return activePlan?.logicFlowPlanId || null
  })

  const flowPlanName = computed(() => {
    const selectedId = selectedFlowPlanId.value
    if (!selectedId) return i18n.global.t('build_plan.import_flow_unplanned')
    const plan = logicFlow.savedPlans.list.find(item => item.id === selectedId)
    return plan?.name || i18n.global.t('build_plan.import_flow_unplanned')
  })

  const loadableFlowPlans = computed<FlowPlanItem[]>(() => {
    return [{
      id: null,
      name: i18n.global.t('build_plan.import_flow_unplanned'),
      index: -1,
    }, ...logicFlow.savedPlans.list.map((plan, index) => ({
      id: plan.id,
      name: plan.name,
      index,
    }))]
  })

  const props: BuildPlanPresenterProps = {
    goals: computed(() => buildPlanStore.buildGoals),
    buildMaterialPlanningEnabled: computed(() => buildPlanStore.buildMaterialPlanningEnabled),
    racePreference: computed(() => 'argon'),
    buildPlan: computed(() => buildPlanStore.buildPlan),
    loading: computed(() => buildPlanStore.computeBuildPlanLoading),
    schemes: computed(() => buildPlanStore.buildPlan?.schemes || []),
    schemeGroups: computed(() => buildPlanStore.schemeGroups),
    warnings: computed(() => {
      const plan = buildPlanStore.buildPlan
      if (!plan) return []
      const w: string[] = []
      if (plan.halted) w.push(plan.haltReason)
      if (plan.goalsRemaining.length > 0) {
        w.push(`${plan.goalsRemaining.length} goal(s) not achieved`)
      }
      return w
    }),
    currentFlows: computed(() => blueprintStore.getEmpireGroupedFlows()),
    allocations,
    buildFlowPlanAllocations: computed(() => buildPlanStore.buildFlowPlanAllocations),
    buildMaterialPreviewLines,
    productionPreviewLines,
    buildFlowPlanLoading: computed(() => buildPlanStore.buildFlowPlanLoading),
    planName: computed(() => buildPlanStore.activePlanName),
    activePlanId: computed(() => buildPlanStore.savedPlans.activeId),
    loadablePlanItems: computed(() => {
      return buildPlanStore.savedPlans.list.map((plan, index) => ({
        id: plan.id,
        name: plan.name,
        index
      }))
    }),
    flowPlanName,
    selectedFlowPlanId,
    loadableFlowPlans,
    fleetGoalView,
  }

  const emits: BuildPlanPresenterEmits = {
    addGoal: (goal) => buildPlanStore.setBuildGoal(goal),
    removeGoal: (index) => buildPlanStore.removeBuildGoal(index),
    updateGoal: (index, value) => {
      const goal = buildPlanStore.buildGoals[index]
      if (!goal) return
      if (goal.type === 'target-production' || goal.type === 'derived-rate' || goal.type === 'derived-production' || goal.type === 'derived-build-material' || goal.type === 'required-production') return
      const updated = [...buildPlanStore.buildGoals]
      if (goal.type === 'production-rate') {
        updated[index] = { ...goal, ratePerHour: value }
      } else if (goal.type === 'build-module') {
        updated[index] = { ...goal, count: value }
      }
      buildPlanStore.buildGoals = updated
      buildPlanStore.syncGoalsToActivePlan()
    },
    setBuildMaterialPlanningEnabled: (enabled) => buildPlanStore.setBuildMaterialPlanningEnabled(enabled),
    computePlan: () => buildPlanStore.computePlan(),
    createNewPlan: () => buildPlanStore.createNewPlan(),
    switchPlan: (planId) => buildPlanStore.switchPlan(planId),
    deletePlan: (planId) => buildPlanStore.deletePlan(planId),
    setPlanName: (name) => { buildPlanStore.activePlanName = name },
    loadFlowPlan: (planId) => buildPlanStore.setLogicFlowPlanId(planId),
    addFleetEntry: (shipId, blueprintId) => buildPlanStore.addFleetEntry(shipId, blueprintId),
    removeFleetEntry: (blueprintId) => buildPlanStore.removeFleetEntry(blueprintId),
    updateFleetBuildTime: (seconds) => buildPlanStore.updateFleetBuildTime(seconds),
    updateFleetBuildTimeMode: (mode) => buildPlanStore.updateFleetBuildTimeMode(mode),
    updateFleetEntryQuantity: (blueprintId, qty) => buildPlanStore.updateFleetEntryQuantity(blueprintId, qty),
    clearFleetGroup: (groupType) => buildPlanStore.clearFleetGroup(groupType),
    updateFleetShipyardCount: (groupType, count) => buildPlanStore.updateFleetShipyardCount(groupType, count),
    exportToStations: (mode) => {
      const lineageToRace = (lineage: string) => lineage === 'default' ? 'argon' : lineage
      const schemeGroups = buildPlanStore.schemeGroups
      const allSchemes: BuildScheme[] = []
      
      for (const group of schemeGroups) {
        allSchemes.push(...group.schemes)
      }
      
      for (const scheme of allSchemes) {
        const stationName = scheme.label
        const racePreference = lineageToRace(scheme.lineage || 'default')
        
        const primaryModuleIds = scheme.primaryModuleIds || []
        const modules = scheme.modules || []
        
        const primaryModules = primaryModuleIds.length > 0
          ? modules.filter(m => primaryModuleIds.includes(m.id))
          : modules
        const lockedWares = collectIsolatedLockedWaresForScheme(scheme)
        
        if (mode === 'overwrite') {
          const existing = blueprintStore.findStationByName(stationName)
          if (existing) {
            blueprintStore.applyImportedStationPayload(existing.id, {
              modules: primaryModules,
              lockedWares,
              warePriority: existing.warePriority || {},
            })
            if (existing.settings) {
              existing.settings.racePreference = racePreference
            }
          } else {
            const stationId = blueprintStore.createStation(stationName, 'industrial')
            const station = stationId ? blueprintStore.getStationById(stationId) : null
            if (station) {
              blueprintStore.applyImportedStationPayload(station.id, {
                modules: primaryModules,
                lockedWares,
                warePriority: station.warePriority || {},
              })
              if (station.settings) {
                station.settings.racePreference = racePreference
              }
            }
          }
        } else {
          const stationId = blueprintStore.createStation(stationName, 'industrial')
          const station = stationId ? blueprintStore.getStationById(stationId) : null
          if (station) {
            blueprintStore.applyImportedStationPayload(station.id, {
              modules: primaryModules,
              lockedWares,
              warePriority: station.warePriority || {},
            })
            if (station.settings) {
              station.settings.racePreference = racePreference
            }
          }
        }
      }
    },
  }

  return { props, emits }
}

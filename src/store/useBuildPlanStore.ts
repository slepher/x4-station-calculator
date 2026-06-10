import { defineStore } from 'pinia'
import { ref, shallowRef, watch, computed } from 'vue'
import i18n from '@/i18n'
import type { ProductionLineGroup } from '@/types/x4'
import type {
  BuildGoal,
  BuildPlan,
  BuildFlowPlanGraph,
  BuildFlowPlanView,
  BuildSchemeGroup,
  ComputeResult,
  LogicFlowPlanSnapshot,
  PreviewResult,
  ProductionLineAllocation,
  ResolvedBuildPlanLogicFlowState,
  SavedBuildPlanGoalsState,
  BuildPlanGoalSnapshot,
} from '@/types/build-plan'
import { BootstrapMode } from '@/types/build-plan'
import { CURRENT_BUILD_PLAN_GOALS_VERSION } from './logic/storageVersions'
import { useGameDataStore } from './useGameDataStore'
import { useLogicFlowStore } from './useLogicFlowStore'
import { useShipBuildStore } from './useShipBuildStore'
import type { StationComputeDeps } from './state/stationSettings'
import { mergeIntoExistingPlan, rebuildSchemeGroups } from '@/store/logic/mergeIntoExistingPlan'
import {
  createActiveLogicFlowSnapshot,
  rebuildLogicFlowSnapshotFromPlan,
} from '@/store/logic/buildPlanLogicFlowSource'
import {
  computeBuildFlowPlan,
  createBuildFlowPlanPreview,
  DEFAULT_BUILD_PLAN_SETTINGS,
} from '@/store/logic/buildPlanProductionLine'

export const useBuildPlanStore = defineStore('buildPlan', () => {
  const gameData = useGameDataStore()
  const logicFlowStore = useLogicFlowStore()

  const buildGoals = ref<BuildGoal[]>([])
  const buildMaterialPlanningEnabled = ref<boolean>(false)
  const buildPlan = ref<BuildPlan | null>(null)

  const savedPlans = ref<SavedBuildPlanGoalsState>({
    version: CURRENT_BUILD_PLAN_GOALS_VERSION,
    activeId: null,
    list: []
  })

  const buildFlowPlanGraphResult = shallowRef<BuildFlowPlanGraph | null>(null)
  const buildFlowPlanAllocations = ref<ProductionLineAllocation[]>([])
  const previewResult = shallowRef<PreviewResult | null>(null)
  const computeResult = shallowRef<ComputeResult | null>(null)
  const buildFlowPlanLoading = ref(false)
  const schemeGroups = ref<BuildSchemeGroup[]>([])
  const computeBuildPlanLoading = ref(false)
  const resolvedLogicFlowState = shallowRef<ResolvedBuildPlanLogicFlowState>({
    requestedPlanId: null,
    resolvedPlanId: null,
    source: 'none',
    snapshot: null,
  })

  function getDefaultPlanName(): string {
    const n = savedPlans.value.list.length + 1
    return i18n.global.t('build_plan.default_plan_name') + ' ' + n
  }

  function savePlansToStorage() {
    localStorage.setItem(gameData.getStorageKey('build_plan_goals'), JSON.stringify(savedPlans.value))
  }

  function loadPlansFromStorage() {
    const raw = localStorage.getItem(gameData.getStorageKey('build_plan_goals'))
    if (!raw) return
    try {
      const data = JSON.parse(raw) as SavedBuildPlanGoalsState
      if (data && typeof data.version === 'number') {
        if (data.version < 2) {
          for (const plan of data.list) {
            for (const goal of plan.buildGoals) {
              if (goal.type === 'fleet' && !('buildTimeMode' in goal)) {
                ;(goal as Extract<BuildGoal, { type: 'fleet' }>).buildTimeMode = 'actual'
              }
            }
          }
          data.version = CURRENT_BUILD_PLAN_GOALS_VERSION
        }
        savedPlans.value = data
        if (data.activeId) {
          const plan = data.list.find(p => p.id === data.activeId)
          if (plan) {
            buildGoals.value = plan.buildGoals
          }
        }
      }
    } catch {
      // ignore corrupt data
    }
  }

  function getActivePlanSnapshot(): BuildPlanGoalSnapshot | null {
    const id = savedPlans.value.activeId
    if (!id) return null
    return savedPlans.value.list.find(plan => plan.id === id) || null
  }

  function syncGoalsToActivePlan() {
    const id = savedPlans.value.activeId
    if (!id) return
    const plan = savedPlans.value.list.find(p => p.id === id)
    if (!plan) return
    plan.buildGoals = [...buildGoals.value]
    plan.lastUpdated = Date.now()
    savePlansToStorage()
  }

  function ensureActivePlan() {
    if (savedPlans.value.activeId) return
    const newPlan: BuildPlanGoalSnapshot = {
      id: crypto.randomUUID(),
      name: getDefaultPlanName(),
      buildGoals: [...buildGoals.value],
      logicFlowPlanId: logicFlowStore.savedPlans.activeId,
      lastUpdated: Date.now(),
    }
    savedPlans.value.list.push(newPlan)
    savedPlans.value.activeId = newPlan.id
    savePlansToStorage()
  }

  function createNewPlan() {
    const newPlan: BuildPlanGoalSnapshot = {
      id: crypto.randomUUID(),
      name: getDefaultPlanName(),
      buildGoals: [],
      logicFlowPlanId: logicFlowStore.savedPlans.activeId,
      lastUpdated: Date.now(),
    }
    savedPlans.value.list.push(newPlan)
    savedPlans.value.activeId = newPlan.id
    buildGoals.value = []
    savePlansToStorage()
    resolveLogicFlowStateForBuildPlan()
  }

  function switchPlan(planId: string) {
    const plan = savedPlans.value.list.find(p => p.id === planId)
    if (!plan) return
    buildGoals.value = [...plan.buildGoals]
    savedPlans.value.activeId = planId
    savePlansToStorage()
    resolveLogicFlowStateForBuildPlan()
  }

  function deletePlan(planId: string) {
    const idx = savedPlans.value.list.findIndex(p => p.id === planId)
    if (idx < 0) return
    savedPlans.value.list.splice(idx, 1)

    if (savedPlans.value.activeId === planId) {
      if (savedPlans.value.list.length > 0) {
        const nextPlan = savedPlans.value.list[0]!
        savedPlans.value.activeId = nextPlan.id
        buildGoals.value = [...nextPlan.buildGoals]
      } else {
        savedPlans.value.activeId = null
        buildGoals.value = []
      }
    }

    savePlansToStorage()
    resolveLogicFlowStateForBuildPlan()
  }

  function setLogicFlowPlanId(planId: string | null) {
    ensureActivePlan()
    const plan = getActivePlanSnapshot()
    if (!plan) return
    plan.logicFlowPlanId = planId
    plan.lastUpdated = Date.now()
    savePlansToStorage()
    resolveLogicFlowStateForBuildPlan()
  }

  function getSelectedLogicFlowPlanId(): string | null {
    return getActivePlanSnapshot()?.logicFlowPlanId || null
  }

  function resolveLogicFlowStateForBuildPlan(): ResolvedBuildPlanLogicFlowState {
    const requestedPlanId = getSelectedLogicFlowPlanId()
    if (!requestedPlanId) {
      const nextState: ResolvedBuildPlanLogicFlowState = {
        requestedPlanId: null,
        resolvedPlanId: null,
        source: 'none',
        snapshot: null,
      }
      resolvedLogicFlowState.value = nextState
      return nextState
    }

    if (requestedPlanId === logicFlowStore.savedPlans.activeId) {
      const snapshot: LogicFlowPlanSnapshot = createActiveLogicFlowSnapshot({
        activePlanId: logicFlowStore.savedPlans.activeId,
        groups: logicFlowStore.groups || [],
        buildFlowView: logicFlowStore.buildFlowView,
        buildFlowAssignments: logicFlowStore.buildFlowAssignments || [],
        buildFlowVirtualEdges: logicFlowStore.buildFlowVirtualEdges || [],
      })
      const nextState: ResolvedBuildPlanLogicFlowState = {
        requestedPlanId,
        resolvedPlanId: requestedPlanId,
        source: 'active-store',
        snapshot,
      }
      resolvedLogicFlowState.value = nextState
      return nextState
    }

    const plan = logicFlowStore.savedPlans.list.find(item => item.id === requestedPlanId)
    if (!plan) {
      const nextState: ResolvedBuildPlanLogicFlowState = {
        requestedPlanId,
        resolvedPlanId: null,
        source: 'none',
        snapshot: null,
      }
      resolvedLogicFlowState.value = nextState
      return nextState
    }

    const snapshot = rebuildLogicFlowSnapshotFromPlan(plan, {
      modulesMap: gameData.modulesMap,
      waresMap: gameData.waresMap,
      modulesByOutputMap: gameData.modulesByOutputMap || {},
      getWareDisplayName: (wareId: string) => gameData.getWareDisplayName(wareId),
    })
    const nextState: ResolvedBuildPlanLogicFlowState = {
      requestedPlanId,
      resolvedPlanId: plan.id,
      source: 'rebuilt-plan',
      snapshot,
    }
    resolvedLogicFlowState.value = nextState
    return nextState
  }

  function getResolvedSnapshot(): LogicFlowPlanSnapshot | null {
    return resolveLogicFlowStateForBuildPlan().snapshot
  }

  const activePlanName = computed({
    get: () => {
      const id = savedPlans.value.activeId
      if (!id) return ''
      const plan = savedPlans.value.list.find(p => p.id === id)
      return plan?.name || ''
    },
    set: (name: string) => {
      const id = savedPlans.value.activeId
      if (!id) return
      const plan = savedPlans.value.list.find(p => p.id === id)
      if (!plan) return
      plan.name = name
      plan.lastUpdated = Date.now()
      savePlansToStorage()
    }
  })

  function getComputeDeps(): StationComputeDeps | null {
    const { modulesMap, waresMap, workforceConsumptionMap, enforceDlcActivation } = gameData
    if (!gameData.isReady || !modulesMap || !waresMap || !workforceConsumptionMap) return null
    return {
      modulesMap,
      waresMap,
      workforceConsumptionMap,
      enforceDlcActivation,
      isModuleDlcActive: (moduleId: string) => gameData.isDlcActive(modulesMap[moduleId]?.dlc_tag),
    }
  }

  function setBuildGoal(goal: BuildGoal) {
    ensureActivePlan()
    buildGoals.value = [...buildGoals.value, goal]
    syncGoalsToActivePlan()
  }

  function addFleetEntry(shipId: string, blueprintId: string) {
    ensureActivePlan()
    const existing = buildGoals.value.find((g): g is Extract<BuildGoal, { type: 'fleet' }> => g.type === 'fleet')
    if (existing) {
      const entry = existing.entries.find(e => e.blueprintId === blueprintId)
      if (entry) {
        entry.quantity++
      } else {
        existing.entries.push({ shipId, blueprintId, quantity: 1 })
      }
    } else {
      buildGoals.value = [...buildGoals.value, {
        type: 'fleet' as const,
        buildTime: 3600,
        buildTimeMode: 'actual',
        entries: [{ shipId, blueprintId, quantity: 1 }],
        shipyardLCount: 1,
        shipyardXLCount: 1,
        wharfCount: 1,
      }]
    }
    syncGoalsToActivePlan()
  }

  function removeFleetEntry(blueprintId: string) {
    const fleetGoal = buildGoals.value.find((g): g is Extract<BuildGoal, { type: 'fleet' }> => g.type === 'fleet')
    if (!fleetGoal) return
    fleetGoal.entries = fleetGoal.entries.filter(e => e.blueprintId !== blueprintId)
    if (fleetGoal.entries.length === 0) {
      buildGoals.value = buildGoals.value.filter(g => g.type !== 'fleet')
    }
    syncGoalsToActivePlan()
  }

  function updateFleetBuildTime(seconds: number) {
    const fleetGoal = buildGoals.value.find((g): g is Extract<BuildGoal, { type: 'fleet' }> => g.type === 'fleet')
    if (!fleetGoal) return
    fleetGoal.buildTime = Math.max(600, seconds)
    syncGoalsToActivePlan()
  }

  function updateFleetBuildTimeMode(mode: 'actual' | 'planned') {
    const fleetGoal = buildGoals.value.find((g): g is Extract<BuildGoal, { type: 'fleet' }> => g.type === 'fleet')
    if (!fleetGoal) return
    fleetGoal.buildTimeMode = mode ?? 'actual'
    syncGoalsToActivePlan()
  }

  function updateFleetEntryQuantity(blueprintId: string, qty: number) {
    const fleetGoal = buildGoals.value.find((g): g is Extract<BuildGoal, { type: 'fleet' }> => g.type === 'fleet')
    if (!fleetGoal) return
    const entry = fleetGoal.entries.find(e => e.blueprintId === blueprintId)
    if (!entry) return
    entry.quantity = qty
    syncGoalsToActivePlan()
  }

  function updateFleetShipyardCount(groupType: 'shipyard_l' | 'shipyard_xl' | 'wharf', count: number) {
    const fleetGoal = buildGoals.value.find((g): g is Extract<BuildGoal, { type: 'fleet' }> => g.type === 'fleet')
    if (!fleetGoal) return
    const clamped = Math.max(1, count)
    if (groupType === 'shipyard_l') fleetGoal.shipyardLCount = clamped
    else if (groupType === 'shipyard_xl') fleetGoal.shipyardXLCount = clamped
    else fleetGoal.wharfCount = clamped
    syncGoalsToActivePlan()
  }

  function clearFleetGroup(groupType: 'shipyard_l' | 'shipyard_xl' | 'wharf') {
    const fleetGoal = buildGoals.value.find((g): g is Extract<BuildGoal, { type: 'fleet' }> => g.type === 'fleet')
    if (!fleetGoal) return
    const classFilter = groupType === 'shipyard_l' ? 'ship_l' : groupType === 'shipyard_xl' ? 'ship_xl' : undefined
    fleetGoal.entries = fleetGoal.entries.filter(entry => {
      const shipClass = gameData.localizedShipsMap[entry.shipId]?.class
      if (classFilter === undefined) {
        return shipClass !== 'ship_m' && shipClass !== 'ship_s'
      }
      return shipClass !== classFilter
    })
    if (fleetGoal.entries.length === 0) {
      buildGoals.value = buildGoals.value.filter(g => g.type !== 'fleet')
    }
    syncGoalsToActivePlan()
  }

  function removeBuildGoal(index: number) {
    buildGoals.value = buildGoals.value.filter((_, i) => i !== index)
    syncGoalsToActivePlan()
  }

  function setBuildMaterialPlanningEnabled(enabled: boolean) {
    buildMaterialPlanningEnabled.value = enabled
  }

  function resolveFleetMergedRates(fleetGoal: Extract<BuildGoal, { type: 'fleet' }>): { wareId: string; ratePerHour: number }[] {
    const shipBuildStore = useShipBuildStore()
    shipBuildStore.loadBlueprintsFromStorage()

    const totalByWare: Record<string, number> = {}
    const groupTotalTimes: [number, number, number] = [0, 0, 0]
    const groupMaxSingleTimes: [number, number, number] = [0, 0, 0]
    const groupKeys = ['shipyard_xl', 'shipyard_l', 'wharf'] as const
    const groupCounts: [number, number, number] = [fleetGoal.shipyardXLCount, fleetGoal.shipyardLCount, fleetGoal.wharfCount]

    for (const entry of fleetGoal.entries) {
      const blueprint = shipBuildStore.findBlueprintById(entry.blueprintId)
      const ship = shipBuildStore.findShip(entry.shipId)
      if (!blueprint || !ship) {
        console.warn('[BuildPlan][FleetRates] Skipping fleet entry during merged-rate expansion', {
          blueprintId: entry.blueprintId,
          shipId: entry.shipId,
          hasBlueprint: !!blueprint,
          hasShip: !!ship,
        })
        continue
      }

      const analysis = shipBuildStore.getBuildAnalysis(blueprint)
      const materials = Object.fromEntries(
        analysis.summaryItems.map((item) => [item.wareId, item.count]),
      )

      for (const [wareId, qty] of Object.entries(materials)) {
        totalByWare[wareId] = (totalByWare[wareId] || 0) + qty * entry.quantity
      }

      const buildTime = analysis.totalBuildTime

      const groupIdx = ship.class === 'ship_xl' ? 0 : ship.class === 'ship_l' ? 1 : 2
      groupTotalTimes[groupIdx] += buildTime * entry.quantity
      if (buildTime > groupMaxSingleTimes[groupIdx]) {
        groupMaxSingleTimes[groupIdx] = buildTime
      }
    }

    const groupBuildTimes = groupKeys.map((_, i) =>
      Math.max(groupMaxSingleTimes[i]!, Math.ceil(groupTotalTimes[i]! / Math.max(1, groupCounts[i]!)))
    )
    const actualTotalBuildTime = Math.max(0, ...groupBuildTimes)
    const effectiveBuildTime = (fleetGoal.buildTimeMode ?? 'actual') === 'planned'
      ? fleetGoal.buildTime
      : actualTotalBuildTime || fleetGoal.buildTime

    return Object.entries(totalByWare).map(([wareId, totalQty]) => ({
      wareId,
      ratePerHour: Math.ceil(totalQty / effectiveBuildTime * 3600),
    }))
  }

  function expandFleetGoals(goals: BuildGoal[]): BuildGoal[] {
    const expanded: BuildGoal[] = []
    for (const goal of goals) {
      if (goal.type === 'fleet') {
        const rates = resolveFleetMergedRates(goal)
        for (const rate of rates) {
          expanded.push({
            type: 'production-rate',
            wareId: rate.wareId,
            ratePerHour: rate.ratePerHour,
          })
        }
      } else {
        expanded.push(goal)
      }
    }
    return expanded
  }

  function computeBuildFlowPlanPreview() {
    const deps = getComputeDeps()
    if (!deps) return

    buildFlowPlanLoading.value = true
    try {
      const goals = buildGoals.value
      if (goals.length === 0) {
        resolveLogicFlowStateForBuildPlan()
        buildFlowPlanGraphResult.value = null
        buildFlowPlanAllocations.value = []
        previewResult.value = null
        return
      }

      const expandedGoals = expandFleetGoals(goals)
      const resolvedSnapshot = getResolvedSnapshot()
      const groups: ProductionLineGroup[] = resolvedSnapshot?.groups || []
      const buildFlowView: BuildFlowPlanView | null = resolvedSnapshot?.buildFlowView || null

      const preview = createBuildFlowPlanPreview(
        expandedGoals,
        groups,
        buildFlowView,
        deps.modulesMap,
        deps.waresMap,
        DEFAULT_BUILD_PLAN_SETTINGS,
        buildMaterialPlanningEnabled.value,
      )

      if (!preview) {
        buildFlowPlanGraphResult.value = null
        buildFlowPlanAllocations.value = []
        previewResult.value = null
        return
      }

      previewResult.value = preview
      buildFlowPlanGraphResult.value = preview.graph
      buildFlowPlanAllocations.value = preview.lines.map((line) => ({
        groupId: line.groupId,
        groupName: line.groupName,
        isUnmatched: line.isUnmatched,
        lineage: line.lineage,
        goals: line.items.flatMap((item): BuildGoal[] => {
          if (item.kind === 'derived') {
            const targetGoals = (item.targets || []).flatMap((target): BuildGoal[] => {
              if (target.type === 'build-module') {
                return [{
                  type: 'build-module',
                  moduleId: item.moduleId,
                  count: target.count || 1,
                }]
              }
              if (item.wareId) {
                return [{
                  type: 'production-rate',
                  wareId: item.wareId,
                  ratePerHour: target.ratePerHour || 0,
                }]
              }
              return []
            })
            if (targetGoals.length > 0) return targetGoals
            if (item.wareId && item.derived.includes('production')) {
              return [{
                type: 'derived-production',
                wareId: item.wareId,
                ratePerHour: 0,
              }]
            }
            if (item.wareId && item.derived.includes('build-material')) {
              return [{
                type: 'derived-build-material',
                wareId: item.wareId,
                ratePerHour: 0,
              }]
            }
            return []
          }
          if (!item.required.includes('production') && !item.required.includes('build-material')) return []
          return [{
            type: 'required-production',
            wareId: item.wareId,
            ratePerHour: 0,
          }]
        }),
      }))
    } finally {
      buildFlowPlanLoading.value = false
    }
  }

  function computePlan() {
    const deps = getComputeDeps()
    if (!deps) return

    const goals = buildGoals.value
    computeBuildPlanLoading.value = true

    try {
      if (!previewResult.value) {
        computeResult.value = null
        schemeGroups.value = []
        buildPlan.value = null
        return
      }

      const result = computeBuildFlowPlan({
        preview: previewResult.value,
        modulesMap: deps.modulesMap,
        waresMap: deps.waresMap,
        modulesByOutputMap: gameData.modulesByOutputMap || {},
        settings: DEFAULT_BUILD_PLAN_SETTINGS,
      })
      computeResult.value = result

      const flatIncoming = result.schemeGroups.flatMap((group) => group.schemes)
      const mergedSchemes = mergeIntoExistingPlan(flatIncoming, buildPlan.value)
      schemeGroups.value = rebuildSchemeGroups(result.schemeGroups, mergedSchemes)
      buildPlan.value = {
        goals,
        selfSufficient: false,
        bootstrapMode: BootstrapMode.None,
        schemes: mergedSchemes,
        totalDuration: 0,
        totalCredits: 0,
        goalsAchieved: goals,
        goalsRemaining: [],
        halted: false,
        haltReason: '',
      }
    } finally {
      computeBuildPlanLoading.value = false
    }
  }

  watch([buildMaterialPlanningEnabled, buildGoals], () => {
    computeBuildFlowPlanPreview()
  }, { deep: true })

  watch(
    [
      () => getSelectedLogicFlowPlanId(),
      () => logicFlowStore.savedPlans.list,
      () => logicFlowStore.savedPlans.activeId,
    ],
    () => {
      computeBuildFlowPlanPreview()
    },
    { deep: true },
  )

  watch(
    [
      () => logicFlowStore.groups,
      () => logicFlowStore.buildFlowGroups,
      () => logicFlowStore.buildFlowAssignments,
      () => logicFlowStore.buildFlowVirtualEdges,
    ],
    () => {
      if (resolvedLogicFlowState.value.source !== 'active-store') return
      computeBuildFlowPlanPreview()
    },
    { deep: true },
  )

  async function init() {
    if (!gameData.isReady) {
      await gameData.initialize()
    }
    loadPlansFromStorage()
    resolveLogicFlowStateForBuildPlan()
  }

  return {
    buildGoals,
    buildMaterialPlanningEnabled,
    buildPlan,
    buildFlowPlanGraphResult,
    buildFlowPlanAllocations,
    previewResult,
    computeResult,
    buildFlowPlanLoading,
    schemeGroups,
    computeBuildPlanLoading,
    resolvedLogicFlowState,
    savedPlans,
    activePlanName,
    setBuildGoal,
    removeBuildGoal,
    setBuildMaterialPlanningEnabled,
    setLogicFlowPlanId,
    computePlan,
    computeBuildFlowPlanPreview,
    createNewPlan,
    switchPlan,
    deletePlan,
    ensureActivePlan,
    syncGoalsToActivePlan,
    loadPlansFromStorage,
    savePlansToStorage,
    addFleetEntry,
    removeFleetEntry,
    updateFleetBuildTime,
    updateFleetBuildTimeMode,
    updateFleetEntryQuantity,
    updateFleetShipyardCount,
    clearFleetGroup,
    init,
  }
})

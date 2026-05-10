import { defineStore } from 'pinia'
import { ref, shallowRef, watch, computed } from 'vue'
import i18n from '@/i18n'
import type { ProductionLineGroup, StationSettings } from '@/types/x4'
import type {
  BuildGoal,
  BuildPlan,
  BuildFlowPlanGraph,
  BuildFlowPlanView,
  BuildSchemeGroup,
  ComputeResult,
  PreviewResult,
  ProductionLineAllocation,
  SavedBuildPlanGoalsState,
  BuildPlanGoalSnapshot,
} from '@/types/build-plan'
import { BootstrapMode } from '@/types/build-plan'
import { CURRENT_BUILD_PLAN_GOALS_VERSION } from './logic/storageVersions'
import { useGameDataStore } from './useGameDataStore'
import { useLogicFlowStore } from './useLogicFlowStore'
import { useShipBuildStore } from './useShipBuildStore'
import { resolveBlueprintMaterialCost } from './logic/resolveBlueprintMaterialCost'
import type { StationComputeDeps } from './state/stationSettings'
import { calculateNetProduction } from '@/store/logic/calculateBuildPlan'
import { buildFlowPlanGraph } from '@/store/logic/buildFlowPlanGraph'
import { calculateAutoFillModules } from '@/store/logic/calculateProductionFlows'
import { computeFlowPlanLines, expandGoalDependencies, makeSchemes, mergeModules } from '@/store/logic/calculateBuildFlowPlan'
import { mergeIntoExistingPlan, rebuildSchemeGroups } from '@/store/logic/mergeIntoExistingPlan'
import {
  computeBuildFlowPlan,
  computeBuildFlowPlanSchemeGroups,
  createBuildFlowPlanPreview,
  DEFAULT_BUILD_PLAN_SETTINGS,
} from '@/store/logic/buildPlanProductionLine'

export const useBuildPlanStore = defineStore('buildPlan', () => {
  const gameData = useGameDataStore()
  const logicFlowStore = useLogicFlowStore()

  const buildGoals = ref<BuildGoal[]>([])
  const buildFlowMode = ref<boolean>(false)
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
  }

  function switchPlan(planId: string) {
    const plan = savedPlans.value.list.find(p => p.id === planId)
    if (!plan) return
    buildGoals.value = [...plan.buildGoals]
    savedPlans.value.activeId = planId

    if (plan.logicFlowPlanId) {
      const lfIndex = logicFlowStore.savedPlans.list.findIndex(p => p.id === plan.logicFlowPlanId)
      if (lfIndex >= 0) {
        logicFlowStore.loadPlan(lfIndex)
      }
    }

    savePlansToStorage()
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
  }

  function updateLogicFlowPlanId() {
    const id = savedPlans.value.activeId
    if (!id) return
    const plan = savedPlans.value.list.find(p => p.id === id)
    if (!plan) return
    plan.logicFlowPlanId = logicFlowStore.savedPlans.activeId
    plan.lastUpdated = Date.now()
    savePlansToStorage()
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
        entries: [{ shipId, blueprintId, quantity: 1 }],
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

  function updateFleetEntryQuantity(blueprintId: string, qty: number) {
    const fleetGoal = buildGoals.value.find((g): g is Extract<BuildGoal, { type: 'fleet' }> => g.type === 'fleet')
    if (!fleetGoal) return
    const entry = fleetGoal.entries.find(e => e.blueprintId === blueprintId)
    if (!entry) return
    entry.quantity = qty
    syncGoalsToActivePlan()
  }

  function removeBuildGoal(index: number) {
    buildGoals.value = buildGoals.value.filter((_, i) => i !== index)
    syncGoalsToActivePlan()
  }

  function setBuildFlowMode(mode: boolean) {
    buildFlowMode.value = mode
  }

  function calculateBuildFlowPlanInternal(goals: BuildGoal[], deps: StationComputeDeps): BuildPlan {
    const settings: StationSettings = {
      sunlight: 100, useHQ: false, manualWorkforce: 0, workforcePercent: 100,
      workforceAuto: true, considerWorkforceForAutoFill: false, supplyWorkforceBonus: false,
      buyMultiplier: 0.5, sellMultiplier: 0.5, minersEnabled: true, internalSupply: true,
      showEmpireGaps: false, racePreference: 'argon', resourceBufferHours: 1,
      primaryProductBufferHours: 12, secondaryProductBufferHours: 2, transportMinutes: 30,
      transportShipCapacity: 62000, enforceDlcActivation: false,
    }

    const baseModules = goals.flatMap((goal) => expandGoalDependencies(goal, deps.modulesMap, deps.waresMap, settings.racePreference))
    const mergedTargetModules = mergeModules(baseModules)
    const autoFillTargetModules = calculateAutoFillModules({
      plannedModules: mergedTargetModules,
      settings,
      modulesMap: deps.modulesMap,
      waresMap: deps.waresMap,
      lockedWares: [],
    })
    const targetModules = mergeModules([
      ...mergedTargetModules,
      ...autoFillTargetModules.autoIndustryModules,
      ...autoFillTargetModules.autoHabitationModules,
    ])

    if (!buildFlowMode.value) {
      const targetGoalWareIds: string[] = []
      for (const goal of goals) {
        if (goal.type === 'production-rate' || goal.type === 'derived-rate' || goal.type === 'derived-production' || goal.type === 'derived-build-material') {
          targetGoalWareIds.push(goal.wareId)
          continue
        }
        if (goal.type !== 'build-module') continue
        const module = deps.modulesMap[goal.moduleId]
        if (!module?.outputs) continue
        for (const wareId of Object.keys(module.outputs)) {
          if (!targetGoalWareIds.includes(wareId)) targetGoalWareIds.push(wareId)
        }
      }

      return {
        goals,
        selfSufficient: false,
        bootstrapMode: BootstrapMode.None,
        schemes: [{
          label: '目标产线',
          description: '目标产线',
          purposeModules: targetGoalWareIds,
          primaryModuleIds: targetModules.map((module) => module.id),
          modules: targetModules,
          targetRates: {},
          targetRateSources: [],
          netProduction: calculateNetProduction(targetModules, deps.modulesMap, false, 100),
          totalDuration: 0,
          totalCredits: 0,
          moduleSummaries: [],
          isFeasible: targetModules.length > 0,
          totalModuleBuildTime: 0,
          buildMaterialTotals: {},
        }],
        totalDuration: 0,
        totalCredits: 0,
        goalsAchieved: goals,
        goalsRemaining: [],
        halted: false,
        haltReason: '',
      }
    }

    let buildFlowView: BuildFlowPlanView | null = null
    const flowView = logicFlowStore.buildFlowView
    if (flowView && flowView.buildFlowGroups && flowView.buildFlowGroups.length > 0) {
      buildFlowView = {
        buildFlowGroups: flowView.buildFlowGroups,
        assignments: logicFlowStore.buildFlowAssignments,
        virtualEdges: logicFlowStore.buildFlowVirtualEdges,
      }
    }

    if (!buildFlowView) {
      const targetGoalWareIds: string[] = []
      for (const goal of goals) {
        if (goal.type === 'production-rate' || goal.type === 'derived-rate' || goal.type === 'derived-production' || goal.type === 'derived-build-material') {
          targetGoalWareIds.push(goal.wareId)
          continue
        }
        if (goal.type !== 'build-module') continue
        const module = deps.modulesMap[goal.moduleId]
        if (!module?.outputs) continue
        for (const wareId of Object.keys(module.outputs)) {
          if (!targetGoalWareIds.includes(wareId)) targetGoalWareIds.push(wareId)
        }
      }

      return {
        goals,
        selfSufficient: false,
        bootstrapMode: BootstrapMode.None,
        schemes: [{
          label: '目标产线',
          description: '目标产线',
          purposeModules: targetGoalWareIds,
          primaryModuleIds: targetModules.map((module) => module.id),
          modules: targetModules,
          targetRates: {},
          targetRateSources: [],
          netProduction: calculateNetProduction(targetModules, deps.modulesMap, false, 100),
          totalDuration: 0,
          totalCredits: 0,
          moduleSummaries: [],
          isFeasible: targetModules.length > 0,
          totalModuleBuildTime: 0,
          buildMaterialTotals: {},
        }],
        totalDuration: 0,
        totalCredits: 0,
        goalsAchieved: goals,
        goalsRemaining: [],
        halted: false,
        haltReason: '',
      }
    }

    const graph = buildFlowPlanGraph(targetModules, buildFlowView, deps.modulesMap)
    const goalWareIds: string[] = []
    for (const goal of goals) {
      if (goal.type === 'production-rate' || goal.type === 'derived-rate' || goal.type === 'derived-production' || goal.type === 'derived-build-material') {
        goalWareIds.push(goal.wareId)
        continue
      }
      if (goal.type !== 'build-module') continue
      const module = deps.modulesMap[goal.moduleId]
      if (!module?.outputs) continue
      for (const wareId of Object.keys(module.outputs)) {
        if (!goalWareIds.includes(wareId)) goalWareIds.push(wareId)
      }
    }
    graph.targetGoalWareIds = goalWareIds

    computeFlowPlanLines(graph, deps.modulesMap, deps.waresMap, settings, [])
    const schemes = makeSchemes(graph, deps.modulesMap, deps.waresMap, settings)

    return {
      goals,
      selfSufficient: false,
      bootstrapMode: BootstrapMode.None,
      schemes,
      totalDuration: 0,
      totalCredits: 0,
      goalsAchieved: goals,
      goalsRemaining: [],
      halted: false,
      haltReason: '',
    }
  }

  function resolveFleetMergedRates(fleetGoal: Extract<BuildGoal, { type: 'fleet' }>): { wareId: string; ratePerHour: number }[] {
    const shipBuildStore = useShipBuildStore()
    shipBuildStore.loadBlueprintsFromStorage()
    const totalByWare: Record<string, number> = {}

    for (const entry of fleetGoal.entries) {
      const blueprint = shipBuildStore.findBlueprintById(entry.blueprintId)
      const ship = shipBuildStore.findShip(entry.shipId)
      if (!blueprint || !ship) continue

      const materials = resolveBlueprintMaterialCost(
        blueprint,
        ship,
        shipBuildStore.equipmentMap,
        shipBuildStore.consumablesMap,
        shipBuildStore.dronesMap,
        shipBuildStore.missilesMap,
      )

      for (const [wareId, qty] of Object.entries(materials)) {
        totalByWare[wareId] = (totalByWare[wareId] || 0) + qty * entry.quantity
      }
    }

    return Object.entries(totalByWare).map(([wareId, totalQty]) => ({
      wareId,
      ratePerHour: Math.ceil(totalQty / fleetGoal.buildTime * 3600),
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
        buildFlowPlanGraphResult.value = null
        buildFlowPlanAllocations.value = []
        previewResult.value = null
        return
      }

      const expandedGoals = expandFleetGoals(goals)

      const groups: ProductionLineGroup[] = logicFlowStore.groups || []
      let buildFlowView: BuildFlowPlanView | null = null
      const flowView = logicFlowStore.buildFlowView
      if (flowView && flowView.buildFlowGroups && flowView.buildFlowGroups.length > 0) {
        buildFlowView = {
          buildFlowGroups: flowView.buildFlowGroups,
          assignments: logicFlowStore.buildFlowAssignments || [],
          virtualEdges: logicFlowStore.buildFlowVirtualEdges || [],
        }
      }

      const preview = createBuildFlowPlanPreview(
        expandedGoals,
        groups,
        buildFlowView,
        deps.modulesMap,
        deps.waresMap,
        DEFAULT_BUILD_PLAN_SETTINGS,
        buildFlowMode.value,
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
    const expandedGoals = expandFleetGoals(goals)
    computeBuildPlanLoading.value = true

    try {
      if (previewResult.value) {
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
        return
      }

      if (buildFlowMode.value && buildFlowPlanGraphResult.value) {
        const result = computeBuildFlowPlanSchemeGroups(
          buildFlowPlanGraphResult.value,
          expandedGoals,
          logicFlowStore.groups || [],
          logicFlowStore.buildFlowView
            ? {
              buildFlowGroups: logicFlowStore.buildFlowView.buildFlowGroups,
              assignments: logicFlowStore.buildFlowAssignments || [],
              virtualEdges: logicFlowStore.buildFlowVirtualEdges || [],
            }
            : null,
          deps.modulesMap,
          deps.waresMap,
          gameData.modulesByOutputMap || {},
          DEFAULT_BUILD_PLAN_SETTINGS,
          {
            buildMaterial: i18n.global.t('build_plan.group_build_material'),
            production: i18n.global.t('build_plan.group_production'),
          },
        )
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
        return
      }

      schemeGroups.value = []
      const result = calculateBuildFlowPlanInternal(expandedGoals, deps)
      buildPlan.value = {
        ...result,
        schemes: mergeIntoExistingPlan(result.schemes, buildPlan.value),
      }
    } finally {
      computeBuildPlanLoading.value = false
    }
  }

  watch([buildFlowMode, buildGoals], () => {
    computeBuildFlowPlanPreview()
  }, { deep: true })

  watch(
    [
      () => logicFlowStore.groups,
      () => logicFlowStore.buildFlowGroups,
      () => logicFlowStore.buildFlowAssignments,
      () => logicFlowStore.buildFlowVirtualEdges,
    ],
    () => {
      computeBuildFlowPlanPreview()
    },
    { deep: true },
  )

  watch(
    () => logicFlowStore.savedPlans.activeId,
    () => {
      updateLogicFlowPlanId()
    }
  )

  loadPlansFromStorage()

  return {
    buildGoals,
    buildFlowMode,
    buildPlan,
    buildFlowPlanGraphResult,
    buildFlowPlanAllocations,
    previewResult,
    computeResult,
    buildFlowPlanLoading,
    schemeGroups,
    computeBuildPlanLoading,
    savedPlans,
    activePlanName,
    setBuildGoal,
    removeBuildGoal,
    setBuildFlowMode,
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
    updateFleetEntryQuantity,
  }
})

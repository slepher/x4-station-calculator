import { computed, type ComputedRef } from 'vue'
import type {
  BuildGoal,
  BuildPlan,
  BuildScheme,
  BuildSchemeGroup,
  PreviewLinePlan,
  PreviewResult,
  ProductionLineAllocation,
} from '@/types/build-plan'
import type { EmpireGroupedFlows } from '@/types/x4'
import { useLogicFlowStore } from '@/store/useLogicFlowStore'
import { useGameDataStore } from '@/store/useGameDataStore'
import { computeProductionLineAllocation } from '@/store/logic/computeProductionLineAllocation'

export interface FlowPlanItem {
  id: string
  name: string
  index: number
}

export interface BuildPlanPresenterProps {
  goals: ComputedRef<BuildGoal[]>
  buildFlowMode: ComputedRef<boolean>
  racePreference: ComputedRef<string>
  buildPlan: ComputedRef<BuildPlan | null>
  loading: ComputedRef<boolean>
  schemes: ComputedRef<BuildScheme[]>
  schemeGroups: ComputedRef<BuildSchemeGroup[]>
  warnings: ComputedRef<string[]>
  currentFlows: ComputedRef<EmpireGroupedFlows>
  flowPlanName: ComputedRef<string>
  activeFlowPlanId: ComputedRef<string | null>
  loadableFlowPlans: ComputedRef<FlowPlanItem[]>
  allocations: ComputedRef<ProductionLineAllocation[]>
  buildFlowPlanAllocations: ComputedRef<ProductionLineAllocation[]>
  buildMaterialPreviewAllocations: ComputedRef<ProductionLineAllocation[]>
  productionPreviewAllocations: ComputedRef<ProductionLineAllocation[]>
  buildFlowPlanLoading: ComputedRef<boolean>
}

export interface BuildPlanPresenterEmits {
  addGoal: (goal: BuildGoal) => void
  removeGoal: (index: number) => void
  updateGoal: (index: number, value: number) => void
  setBuildFlowMode: (mode: boolean) => void
  computePlan: () => void
  loadFlowPlan: (planId: string) => void
}

export interface UseBuildPlanPresenterReturn {
  props: BuildPlanPresenterProps
  emits: BuildPlanPresenterEmits
}

export interface BuildPlanPresenterStore {
  activeEmpire: { stations: import('@/types/x4').StationPlan[] } | null
  buildGoals: BuildGoal[]
  buildFlowMode: boolean
  buildPlan: BuildPlan | null
  buildFlowPlanAllocations: ProductionLineAllocation[]
  previewResult: PreviewResult | null
  buildFlowPlanLoading: boolean
  schemeGroups: BuildSchemeGroup[]
  computeBuildPlanLoading: boolean
  getEmpireGroupedFlows(): EmpireGroupedFlows
  setBuildGoal(goal: BuildGoal): void
  removeBuildGoal(index: number): void
  setBuildFlowMode(mode: boolean): void
  computePlan(effectiveGoals?: BuildGoal[]): void
}

export function useBuildPlanPresenter(store: BuildPlanPresenterStore): UseBuildPlanPresenterReturn {
  const logicFlow = useLogicFlowStore()
  const gameData = useGameDataStore()

  const allocations = computed<ProductionLineAllocation[]>(() => {
    const activePlanId = logicFlow.savedPlans.activeId
    if (!activePlanId) {
      const unmatched: ProductionLineAllocation = {
        groupId: undefined,
        groupName: '',
        isUnmatched: true,
        goals: [...store.buildGoals],
      }
      return store.buildGoals.length > 0 ? [unmatched] : []
    }

    const groups = logicFlow.groups
    const buildFlowView = {
      buildFlowGroups: logicFlow.buildFlowGroups,
      assignments: logicFlow.buildFlowAssignments,
      virtualEdges: logicFlow.buildFlowVirtualEdges,
    }

    return computeProductionLineAllocation(
      store.buildGoals,
      groups,
      buildFlowView,
      gameData.modulesMap,
      gameData.modulesByOutputMap || {},
    )
  })

  /**
   * 建材产线 preview: 直接从 PreviewResult.lines 映射，不再与 allocations 二次合并。
   * 重叠产线（groupId 同时出现在 build-material 和 production 中）归入建材组。
   */
  const buildMaterialPreviewAllocations = computed<ProductionLineAllocation[]>(() => {
    if (!store.previewResult || !store.previewResult.buildMaterialPlanningEnabled) return []
    return store.previewResult.lines
      .filter(line => line.responsibilities.some(r => r.type === 'derived-build-material'))
      .map(previewLineToAllocation)
  })

  const productionPreviewAllocations = computed<ProductionLineAllocation[]>(() => {
    if (!store.previewResult) return []
    return store.previewResult.lines
      .filter(line => !line.responsibilities.some(r => r.type === 'derived-build-material'))
      .map(previewLineToAllocation)
  })

  const props: BuildPlanPresenterProps = {
    goals: computed(() => store.buildGoals),
    buildFlowMode: computed(() => store.buildFlowMode),
    racePreference: computed(() => 'argon'),
    buildPlan: computed(() => store.buildPlan),
    loading: computed(() => store.computeBuildPlanLoading),
    schemes: computed(() => store.buildPlan?.schemes || []),
    schemeGroups: computed(() => store.schemeGroups),
    warnings: computed(() => {
      const plan = store.buildPlan
      if (!plan) return []
      const w: string[] = []
      if (plan.halted) w.push(plan.haltReason)
      if (plan.goalsRemaining.length > 0) {
        w.push(`${plan.goalsRemaining.length} goal(s) not achieved`)
      }
      return w
    }),
    currentFlows: computed(() => store.getEmpireGroupedFlows()),
    flowPlanName: computed(() => {
      const activeId = logicFlow.savedPlans.activeId
      if (!activeId) return ''
      const plan = logicFlow.savedPlans.list.find(p => p.id === activeId)
      return plan?.name || ''
    }),
    activeFlowPlanId: computed(() => logicFlow.savedPlans.activeId),
    loadableFlowPlans: computed(() => {
      return logicFlow.savedPlans.list.map((plan, index) => ({
        id: plan.id,
        name: plan.name,
        index
      }))
    }),
    allocations,
    buildFlowPlanAllocations: computed(() => store.buildFlowPlanAllocations),
    buildMaterialPreviewAllocations,
    productionPreviewAllocations,
    buildFlowPlanLoading: computed(() => store.buildFlowPlanLoading),
  }

  const emits: BuildPlanPresenterEmits = {
    addGoal: (goal) => store.setBuildGoal(goal),
    removeGoal: (index) => store.removeBuildGoal(index),
    updateGoal: (index, value) => {
      const goal = store.buildGoals[index]
      if (!goal) return
      if (goal.type === 'target-production' || goal.type === 'derived-rate' || goal.type === 'derived-production' || goal.type === 'derived-build-material' || goal.type === 'required-production') return
      const updated = [...store.buildGoals]
      if (goal.type === 'production-rate') {
        updated[index] = { ...goal, ratePerHour: value }
      } else if (goal.type === 'build-module') {
        updated[index] = { ...goal, count: value }
      }
      store.buildGoals = updated
    },
    setBuildFlowMode: (mode) => store.setBuildFlowMode(mode),
    computePlan: () => {
      const effectiveGoals = allocations.value.flatMap(a => a.goals)
      store.computePlan(effectiveGoals)
    },
    loadFlowPlan: (planId) => {
      const index = logicFlow.savedPlans.list.findIndex(p => p.id === planId)
      if (index >= 0) logicFlow.loadPlan(index)
    }
  }

  return { props, emits }
}

function previewLineToAllocation(line: PreviewLinePlan): ProductionLineAllocation {
  return {
    groupId: line.groupId,
    groupName: line.groupName,
    isUnmatched: line.isUnmatched,
    goals: line.responsibilities.flatMap((responsibility): BuildGoal[] => {
      if (responsibility.type === 'target-production') {
        if (responsibility.moduleId) {
          return [{
            type: 'target-production',
            moduleId: responsibility.moduleId,
            count: responsibility.count || 1,
          }]
        }
        if (responsibility.wareId) {
          return [{
            type: 'target-production',
            wareId: responsibility.wareId,
            ratePerHour: responsibility.ratePerHour || 0,
          }]
        }
        return []
      }

      if (!responsibility.wareId) return []
      if (responsibility.type === 'derived-build-material') {
        return [{
          type: 'derived-build-material',
          wareId: responsibility.wareId,
          ratePerHour: responsibility.ratePerHour || 0,
        }]
      }
      if (responsibility.type === 'derived-production') {
        return [{
          type: 'derived-production',
          wareId: responsibility.wareId,
          ratePerHour: responsibility.ratePerHour || 0,
        }]
      }
      return [{
        type: 'required-production',
        wareId: responsibility.wareId,
        ratePerHour: responsibility.ratePerHour || 0,
      }]
    }),
  }
}

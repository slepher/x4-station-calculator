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

export interface PlanItem {
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
  allocations: ComputedRef<ProductionLineAllocation[]>
  buildFlowPlanAllocations: ComputedRef<ProductionLineAllocation[]>
  buildMaterialPreviewAllocations: ComputedRef<ProductionLineAllocation[]>
  productionPreviewAllocations: ComputedRef<ProductionLineAllocation[]>
  buildFlowPlanLoading: ComputedRef<boolean>
  planName: ComputedRef<string>
  activePlanId: ComputedRef<string | null>
  loadablePlanItems: ComputedRef<PlanItem[]>
}

export interface BuildPlanPresenterEmits {
  addGoal: (goal: BuildGoal) => void
  removeGoal: (index: number) => void
  updateGoal: (index: number, value: number) => void
  setBuildFlowMode: (mode: boolean) => void
  computePlan: () => void
  createNewPlan: () => void
  switchPlan: (planId: string) => void
  deletePlan: (planId: string) => void
  setPlanName: (name: string) => void
}

export interface UseBuildPlanPresenterReturn {
  props: BuildPlanPresenterProps
  emits: BuildPlanPresenterEmits
}

export interface BuildPlanPresenterStore {
  getEmpireGroupedFlows(): EmpireGroupedFlows
}

export interface BuildPlanPresenterBuildPlanStore {
  buildGoals: BuildGoal[]
  buildFlowMode: boolean
  buildPlan: BuildPlan | null
  buildFlowPlanAllocations: ProductionLineAllocation[]
  previewResult: PreviewResult | null
  buildFlowPlanLoading: boolean
  schemeGroups: BuildSchemeGroup[]
  computeBuildPlanLoading: boolean
  savedPlans: { activeId: string | null; list: { id: string; name: string; buildGoals: BuildGoal[] }[] }
  activePlanName: string
  setBuildGoal(goal: BuildGoal): void
  removeBuildGoal(index: number): void
  setBuildFlowMode(mode: boolean): void
  computePlan(): void
  createNewPlan(): void
  switchPlan(planId: string): void
  deletePlan(planId: string): void
  syncGoalsToActivePlan(): void
}

export interface BuildPlanPresenterInput {
  buildPlanStore: BuildPlanPresenterBuildPlanStore
  blueprintStore: BuildPlanPresenterStore
}

export function useBuildPlanPresenter({ buildPlanStore, blueprintStore }: BuildPlanPresenterInput): UseBuildPlanPresenterReturn {
  const logicFlow = useLogicFlowStore()
  const gameData = useGameDataStore()

  const allocations = computed<ProductionLineAllocation[]>(() => {
    const activePlanId = logicFlow.savedPlans.activeId
    if (!activePlanId) {
      const unmatched: ProductionLineAllocation = {
        groupId: undefined,
        groupName: '',
        isUnmatched: true,
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

  const buildMaterialPreviewAllocations = computed<ProductionLineAllocation[]>(() => {
    if (!buildPlanStore.previewResult || !buildPlanStore.previewResult.buildMaterialPlanningEnabled) return []
    return buildPlanStore.previewResult.lines
      .filter(line => line.responsibilities.some(r => r.type === 'derived-build-material'))
      .map(previewLineToAllocation)
  })

  const productionPreviewAllocations = computed<ProductionLineAllocation[]>(() => {
    if (!buildPlanStore.previewResult) return []
    return buildPlanStore.previewResult.lines
      .filter(line => !line.responsibilities.some(r => r.type === 'derived-build-material'))
      .map(previewLineToAllocation)
  })

  const props: BuildPlanPresenterProps = {
    goals: computed(() => buildPlanStore.buildGoals),
    buildFlowMode: computed(() => buildPlanStore.buildFlowMode),
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
    buildMaterialPreviewAllocations,
    productionPreviewAllocations,
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
    setBuildFlowMode: (mode) => buildPlanStore.setBuildFlowMode(mode),
    computePlan: () => buildPlanStore.computePlan(),
    createNewPlan: () => buildPlanStore.createNewPlan(),
    switchPlan: (planId) => buildPlanStore.switchPlan(planId),
    deletePlan: (planId) => buildPlanStore.deletePlan(planId),
    setPlanName: (name) => { buildPlanStore.activePlanName = name },
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

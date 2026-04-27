import { computed, type ComputedRef } from 'vue'
import type { BuildGoal, BuildPlan, BuildConstraints } from '@/types/build-plan'
import type { EmpireGroupedFlows } from '@/types/x4'

export interface BuildPlanPresenterProps {
  goals: ComputedRef<BuildGoal[]>
  constraints: ComputedRef<BuildConstraints>
  buildPlan: ComputedRef<BuildPlan | null>
  loading: ComputedRef<boolean>
  progress: ComputedRef<{ completed: number; total: number; percentage: number }>
  warnings: ComputedRef<string[]>
  currentFlows: ComputedRef<EmpireGroupedFlows>
}

export interface BuildPlanPresenterEmits {
  addGoal: (goal: BuildGoal) => void
  removeGoal: (index: number) => void
  setTimeBudget: (seconds: number) => void
  setCreditBudget: (credits: number) => void
  computePlan: () => void
}

export interface UseBuildPlanPresenterReturn {
  props: BuildPlanPresenterProps
  emits: BuildPlanPresenterEmits
}

export interface BuildPlanPresenterStore {
  buildConstraints: BuildConstraints
  buildPlan: BuildPlan | null
  computeBuildPlanLoading: boolean
  setBuildGoal(goal: BuildGoal): void
  removeBuildGoal(index: number): void
  setTimeBudget(seconds: number): void
  setCreditBudget(credits: number): void
  computePlan(): void
}

export function useBuildPlanPresenter(store: BuildPlanPresenterStore): UseBuildPlanPresenterReturn {
  const props: BuildPlanPresenterProps = {
    goals: computed(() => store.buildConstraints.goals),
    constraints: computed(() => ({
      timeBudget: store.buildConstraints.timeBudget,
      creditBudget: store.buildConstraints.creditBudget,
      goals: store.buildConstraints.goals
    })),
    buildPlan: computed(() => store.buildPlan),
    loading: computed(() => store.computeBuildPlanLoading),
    progress: computed(() => {
      const plan = store.buildPlan
      if (!plan) return { completed: 0, total: 0, percentage: 0 }
      const total = plan.steps.length
      return {
        completed: plan.steps.filter(s => s.estimatedDuration <= plan.totalDuration).length,
        total,
        percentage: total > 0 ? Math.round((plan.steps.filter(s => s.estimatedDuration <= plan.totalDuration).length / total) * 100) : 0
      }
    }),
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
    currentFlows: computed(() => {
      return { flows: [], empireGroups: { operations: [], supply: [] } }
    })
  }

  const emits: BuildPlanPresenterEmits = {
    addGoal: (goal) => store.setBuildGoal(goal),
    removeGoal: (index) => store.removeBuildGoal(index),
    setTimeBudget: (seconds) => store.setTimeBudget(seconds),
    setCreditBudget: (credits) => store.setCreditBudget(credits),
    computePlan: () => store.computePlan()
  }

  return { props, emits }
}

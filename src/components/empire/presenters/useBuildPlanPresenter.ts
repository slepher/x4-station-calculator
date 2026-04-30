import { computed, type ComputedRef } from 'vue'
import type { BuildGoal, BuildPlan, BuildScheme } from '@/types/build-plan'
import type { EmpireGroupedFlows } from '@/types/x4'

export interface BuildPlanPresenterProps {
  goals: ComputedRef<BuildGoal[]>
  selfSufficient: ComputedRef<boolean>
  racePreference: ComputedRef<string>
  buildPlan: ComputedRef<BuildPlan | null>
  loading: ComputedRef<boolean>
  schemes: ComputedRef<BuildScheme[]>
  warnings: ComputedRef<string[]>
  currentFlows: ComputedRef<EmpireGroupedFlows>
}

export interface BuildPlanPresenterEmits {
  addGoal: (goal: BuildGoal) => void
  removeGoal: (index: number) => void
  updateGoal: (index: number, value: number) => void
  setSelfSufficient: (val: boolean) => void
  computePlan: () => void
}

export interface UseBuildPlanPresenterReturn {
  props: BuildPlanPresenterProps
  emits: BuildPlanPresenterEmits
}

export interface BuildPlanPresenterStore {
  activeEmpire: { stations: import('@/types/x4').StationPlan[] } | null
  buildGoals: BuildGoal[]
  selfSufficient: boolean
  buildPlan: BuildPlan | null
  computeBuildPlanLoading: boolean
  getEmpireGroupedFlows(): EmpireGroupedFlows
  setBuildGoal(goal: BuildGoal): void
  removeBuildGoal(index: number): void
  setSelfSufficient(val: boolean): void
  computePlan(): void
}

export function useBuildPlanPresenter(store: BuildPlanPresenterStore): UseBuildPlanPresenterReturn {
  const props: BuildPlanPresenterProps = {
    goals: computed(() => store.buildGoals),
    selfSufficient: computed(() => store.selfSufficient),
    racePreference: computed(() => 'argon'),
    buildPlan: computed(() => store.buildPlan),
    loading: computed(() => store.computeBuildPlanLoading),
    schemes: computed(() => store.buildPlan?.schemes || []),
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
    currentFlows: computed(() => store.getEmpireGroupedFlows())
  }

  const emits: BuildPlanPresenterEmits = {
    addGoal: (goal) => store.setBuildGoal(goal),
    removeGoal: (index) => store.removeBuildGoal(index),
    updateGoal: (index, value) => {
      const goal = store.buildGoals[index]
      if (!goal) return
      if (goal.type === 'production-rate') {
        store.buildGoals[index] = { ...goal, ratePerHour: value }
      } else if (goal.type === 'build-module') {
        store.buildGoals[index] = { ...goal, count: value }
      }
    },
    setSelfSufficient: (val) => store.setSelfSufficient(val),
    computePlan: () => store.computePlan()
  }

  return { props, emits }
}
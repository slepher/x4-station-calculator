export type BuildGoal =
  | { type: 'self-sufficient' }
  | { type: 'production-rate'; wareId: string; ratePerHour: number }
  | { type: 'build-module'; moduleId: string; count: number }
  | { type: 'fleet'; shipId: string; quantity: number }

export interface BuildConstraints {
  timeBudget: number
  creditBudget: number
  goals: BuildGoal[]
}

export interface BuildMaterial {
  wareId: string
  quantity: number
  currentProdRate: number
  estimatedTime: number
  creditsNeeded: number
}

export interface BuildStep {
  order: number
  moduleId: string
  moduleCount: number
  moduleBuildTime: number
  materials: BuildMaterial[]
  estimatedDuration: number
  estimatedCredits: number
  reason: string
}

export interface BuildPlan {
  goals: BuildGoal[]
  constraints: BuildConstraints
  steps: BuildStep[]
  totalDuration: number
  totalCredits: number
  goalsAchieved: BuildGoal[]
  goalsRemaining: BuildGoal[]
  halted: boolean
  haltReason: string
}

import type { SavedModule, StationSettings, X4Module, X4Ware } from './x4'

export interface CalculateBuildPlanInput {
  goals: BuildGoal[]
  timeBudget: number
  creditBudget: number
  currentModules: SavedModule[]
  settings: StationSettings
  modulesMap: Record<string, X4Module>
  waresMap: Record<string, X4Ware>
  modulesByOutputMap: Record<string, X4Module[]>
}

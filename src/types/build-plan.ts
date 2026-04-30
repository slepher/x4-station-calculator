import type { SavedModule, StationSettings, X4Module, X4Ware } from './x4'

export const BootstrapMode = {
  None: 'none',
  Joint: 'joint',
  CoupledIterative: 'coupled',
  IsolatedSpecialized: 'isolated',
} as const

export type BootstrapMode = (typeof BootstrapMode)[keyof typeof BootstrapMode]

export interface BuildGroup {
  reason: string
  modules: SavedModule[]
}

export type BuildGoalType = 'production-rate' | 'build-module'

export type BuildGoal =
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
  stockBefore: number
  producedDuringBuild: number
  estimatedTime: number
  creditsNeeded: number
}

export interface BuildSchemeStep {
  order: number
  moduleId: string
  moduleCount: number
  moduleBuildTime: number
  materials: BuildMaterial[]
  estimatedDuration: number
  estimatedCredits: number
  reason: string
  groupIndex: number
}

export interface BuildRateSource {
  label: string
  rates: Record<string, number>
  materials?: Record<string, number>
}

export interface BuildScheme {
  label: string
  description: string
  purposeModules: string[]
  primaryModuleIds: string[]
  modules: SavedModule[]
  targetRates: Record<string, number>
  targetRateSources: BuildRateSource[]
  netProduction: Record<string, number>
  steps: BuildSchemeStep[]
  totalDuration: number
  totalCredits: number
  stepsCount: number
  isFeasible: boolean
  totalModuleBuildTime: number
  buildMaterialTotals: Record<string, number>
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
  selfSufficient: boolean
  bootstrapMode: BootstrapMode
  schemes: BuildScheme[]
  totalDuration: number
  totalCredits: number
  goalsAchieved: BuildGoal[]
  goalsRemaining: BuildGoal[]
  halted: boolean
  haltReason: string
}

export interface CalculateBuildPlanInput {
  goals: BuildGoal[]
  selfSufficient: boolean
  bootstrapMode: BootstrapMode
  currentModules: SavedModule[]
  settings: StationSettings
  modulesMap: Record<string, X4Module>
  waresMap: Record<string, X4Ware>
  modulesByOutputMap: Record<string, X4Module[]>
  currentNetProduction: Record<string, number>
}

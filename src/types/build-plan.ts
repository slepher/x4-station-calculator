import type { SavedModule, StationSettings, X4Module, X4Ware } from './x4'

export const BootstrapMode = {
  None: 'none',
  Joint: 'joint',
  CoupledIterative: 'coupled',
  IsolatedSpecialized: 'isolated',
  NestedJoint: 'nested',
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
  | { type: 'derived-rate'; wareId: string; ratePerHour: number }
  | { type: 'derived-production'; wareId: string; ratePerHour: number }
  | { type: 'derived-build-material'; wareId: string; ratePerHour: number }
  | { type: 'required-production'; wareId: string; ratePerHour: number }

export interface ProductionLineAllocation {
  groupId?: string
  groupName: string
  isUnmatched: boolean
  goals: BuildGoal[]
}

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
  manualWares?: BuildGoal[]
  manualModules?: SavedModule[]
  derivedWareIds?: string[]
  moduleBuildDetails?: { moduleId: string; count: number; buildTime: number; materials: Record<string, number> }[]
}

export interface BuildSchemeGroup {
  groupType: 'build-material' | 'production'
  groupLabel: string
  schemes: BuildScheme[]
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

// --- Build Flow Plan Types ---

/** 单条产线的需求分析数据 */
export interface DemandDetail {
  perWareSources: Record<string, { label: string; qty: number; seconds: number; rate: number }[]>
  aggregateRates: Record<string, number>
  totalSeconds: number
  totalMaterialQty: number
}

/** 依赖图中的产线节点 */
export interface BuildFlowPlanLine {
  lineGroupId: string
  lineName: string
  trackedWares: Set<string>
  isolatedWares: Set<string>
  modules: SavedModule[]
  moduleIds: string[]
  isSelfBootstrap: boolean
  netProduction: Record<string, number>
  buildGroups?: BuildGroup[]
  demandSources?: BuildRateSource[]
  demandAnalysis?: DemandDetail
}

/** 依赖图中的边 */
export interface BuildFlowPlanEdge {
  fromLineKey: string
  toLineKey: string
  wareId: string
  sourceLabel: string
}

/** 依赖图 */
export interface BuildFlowPlanGraph {
  nodes: Map<string, BuildFlowPlanLine>
  edges: BuildFlowPlanEdge[]
  sccGroups: string[][]
  cModules: SavedModule[]
  cBuildCostRates: Record<string, number>
  cGoalWareIds?: string[]
}

/** BuildFlow 视图数据（与 computeProductionLineAllocation.ts 中类型一致） */
export interface BuildFlowPlanView {
  buildFlowGroups: import('./x4').BuildFlowGroup[]
  assignments: import('./x4').BuildFlowAssignment[]
  virtualEdges: import('./x4').VirtualEdge[]
}

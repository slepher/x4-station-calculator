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

export interface FleetEntry {
  shipId: string
  blueprintId: string
  quantity: number
}

export interface FleetMaterialItem {
  wareId: string
  wareName: string
  totalQty: number
}

export interface FleetEntryView {
  shipId: string
  shipName: string
  blueprintId: string
  blueprintName: string
  quantity: number
  buildTime: number
  totalBuildTime: number
  materials: FleetMaterialItem[]
  isBlueprintMissing: boolean
}

export interface FleetMergedRate {
  wareId: string
  wareName: string
  totalQty: number
  ratePerHour: number
}

export type FleetShipyardGroupType = 'shipyard_l' | 'shipyard_xl' | 'wharf'

export interface FleetShipyardGroup {
  type: FleetShipyardGroupType
  label: string
  shipyardCount: number
  entries: FleetEntryView[]
  groupTotalBuildTime: number
}

export interface FleetGoalView {
  buildTime: number
  buildTimeMode: 'actual' | 'planned'
  shipyardLCount: number
  shipyardXLCount: number
  wharfCount: number
  groups: FleetShipyardGroup[]
  actualTotalBuildTime: number
  effectiveBuildTime: number
  entries: FleetEntryView[]
  mergedRates: FleetMergedRate[]
}

export type BuildGoal =
  | { type: 'production-rate'; wareId: string; ratePerHour: number }
  | { type: 'build-module'; moduleId: string; count: number }
  | { type: 'fleet'; buildTime: number; buildTimeMode: 'actual' | 'planned'; entries: FleetEntry[]; shipyardLCount: number; shipyardXLCount: number; wharfCount: number }
  | { type: 'target-production'; wareId?: string; moduleId?: string; ratePerHour?: number; count?: number }
  | { type: 'derived-rate'; wareId: string; ratePerHour: number }
  | { type: 'derived-production'; wareId: string; ratePerHour: number }
  | { type: 'derived-build-material'; wareId: string; ratePerHour: number }
  | { type: 'required-production'; wareId: string; ratePerHour: number }

export interface ProductionLineAllocation {
  groupId?: string
  groupName: string
  isUnmatched: boolean
  lineage: string
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

export interface BuildSchemeModuleMaterialSummary {
  wareId: string
  quantity: number
  totalCredits: number
  unitPrice: number
}

export interface BuildSchemeModuleSummary {
  moduleId: string
  moduleCount: number
  totalDuration: number
  totalCredits: number
  materials: BuildSchemeModuleMaterialSummary[]
}

export interface BuildScheme {
  label: string
  description?: string
  lineage?: string
  purposeModules: string[]
  primaryModuleIds: string[]
  modules: SavedModule[]
  targetRates: Record<string, number>
  targetRateSources: BuildRateSource[]
  netProduction: Record<string, number>
  totalDuration: number
  totalCredits: number
  moduleSummaries: BuildSchemeModuleSummary[]
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
  gapRates: Record<string, number>
  targetRates: Record<string, number>
  perWareTotals: Record<string, { seconds: number; qty: number }>
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
  targetModules: SavedModule[]
  targetBuildCostRates: Record<string, number>
  targetGoalWareIds?: string[]
}

/** BuildFlow 视图数据（与 computeProductionLineAllocation.ts 中类型一致） */
export interface BuildFlowPlanView {
  buildFlowGroups: import('./x4').BuildFlowGroup[]
  assignments: import('./x4').BuildFlowAssignment[]
  virtualEdges: import('./x4').VirtualEdge[]
}

// --- Preview / Compute truth types (build-plan-production-line design) ---

export type PreviewDerivedTag = 'target' | 'production' | 'build-material'

export type PreviewRequiredTag = 'production' | 'build-material'

export interface PreviewDerivedTarget {
  type: 'build-module' | 'production-rate' | 'fleet-rate'
  count?: number
  ratePerHour?: number
}

export interface PreviewDerivedItem {
  kind: 'derived'
  wareId?: string
  moduleId: string
  derived: PreviewDerivedTag[]
  targets?: PreviewDerivedTarget[]
  relatedLineGroupIds: string[]
  sourceRef: string
}

export interface PreviewRequiredItem {
  kind: 'required'
  wareId: string
  required: PreviewRequiredTag[]
  relatedLineGroupIds: string[]
  sourceRef: string
}

export type PreviewItem = PreviewDerivedItem | PreviewRequiredItem

/** 单条产线的 preview 责任分配 */
export interface PreviewLinePlan {
  groupId?: string
  groupName: string
  isUnmatched: boolean
  lineage: string
  items: PreviewItem[]
}

/** Preview 阶段结果 */
export interface PreviewResult {
  buildMaterialPlanningEnabled: boolean
  lines: PreviewLinePlan[]
  graph: BuildFlowPlanGraph | null
  sccGroups: string[][]
}

/** Compute 阶段输入 */
export interface ComputeInput {
  preview: PreviewResult
  modulesMap: Record<string, X4Module>
  waresMap: Record<string, X4Ware>
  modulesByOutputMap: Record<string, X4Module[]>
  settings: StationSettings
}

/** 单条产线的 compute 结果 */
export interface ComputeLineResult {
  groupId?: string
  groupName: string
  mergedItems: PreviewItem[]
  relatedLineGroupIds: string[]
  targetRates: Record<string, number>
  primaryModules: SavedModule[]
  auxiliaryModules: SavedModule[]
  allModules: SavedModule[]
}

/** Compute 阶段结果 */
export interface ComputeResult {
  lines: ComputeLineResult[]
  schemeGroups: BuildSchemeGroup[]
}

/** 主要模块快照（SCC 收敛判据） */
export type PrimaryModuleSnapshot = Map<string, string>
// key = lineGroupId
// value = "module_id:count;module_id:count"

export interface LogicFlowPlanSnapshot {
  planId: string | null
  groups: import('./x4').ProductionLineGroup[]
  buildFlowView: BuildFlowPlanView | null
  buildFlowAssignments: import('./x4').BuildFlowAssignment[]
  buildFlowVirtualEdges: import('./x4').VirtualEdge[]
}

export interface ResolvedBuildPlanLogicFlowState {
  requestedPlanId: string | null
  resolvedPlanId: string | null
  source: 'active-store' | 'rebuilt-plan' | 'none'
  snapshot: LogicFlowPlanSnapshot | null
}

// --- Build Plan Goals Persistence Types ---

export interface BuildPlanGoalSnapshot {
  id: string
  name: string
  buildGoals: BuildGoal[]
  logicFlowPlanId: string | null
  lastUpdated: number
}

export interface SavedBuildPlanGoalsState {
  version: number
  activeId: string | null
  list: BuildPlanGoalSnapshot[]
}

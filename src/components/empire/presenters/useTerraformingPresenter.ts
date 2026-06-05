import { computed, ref, type ComputedRef } from 'vue'
import type {
  ClusterObjective,
  DeliveryShip,
  DescriptionItem,
  StatEffect,
  StatCondition,
  TaskNode,
  TaskTree,
  TerraformingCluster,
  TerraformingData,
  TerraformingProject,
  TerraformingProjectDependency,
  TerraformingStat,
  TerraformingState,
} from '@/store/logic/terraformingTaskResolver'
import {
  getCurrentRange,
  getSortedRanges,
  resolveAvailableTasks,
  resolveTerraformingText,
  resolveWithReplaces,
  evaluateTerraformingProjectExecution,
  type I18nLookup
} from '@/store/logic/terraformingTaskResolver'
import {
  getRuntimeTerraformingProjectIds,
  replayExecutionLog,
  type DeductExecutionResult,
  type TerraformingExecutionEntry,
  type TerraformingArchiveRuntimeBaseState,
  type TerraformingExecutedDelta,
  type TerraformingCurrentQueueDisplayEntry as RuntimeCurrentQueueDisplayEntry,
  type TerraformingExecutedDisplaySource,
  type GoalEntry,
  type TerraformingReplayResult,
  type RebateKey,
} from '@/store/logic/terraformingRuntime'
import type { ArchiveStationData } from '@/types/saveArchive'
import type { SavedModule, X4MapCluster, X4MapSector, X4Module } from '@/types/x4'
import i18n from '@/i18n'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useX4I18n } from '@/utils/UseX4I18n'

export interface TerraformingToolbarProps {
  hqStationName: ComputedRef<string>
  stationCode: ComputedRef<string>
  sectorName: ComputedRef<string>
  sectorNameId: ComputedRef<string | undefined>
  position: ComputedRef<{ x: number; y: number; z: number } | undefined>
  sectorResources: ComputedRef<string[]>
  sectorSunlight: ComputedRef<number>
  singleBerthThroughput: ComputedRef<number>
  hasHqStation: ComputedRef<boolean>
}

export interface TerraformingRewardDisplayItem {
  milestone: string
  text: string
}

export interface TerraformingSectorPanelProps {
  clusters: ComputedRef<TerraformingCluster[]>
  selectedClusterId: ComputedRef<string | null>
  clusterDisplayNames: ComputedRef<Map<string, string>>
  clusterMatchesHq: ComputedRef<Record<string, boolean>>
  objectivesProgress: ComputedRef<Array<{
    step: number
    action: string
    text: string
    completed: boolean
    neutralizeScale?: TerraformingConditionScaleModel
  }>>
  statScaleModels: ComputedRef<Map<string, TerraformingStatScaleModel>>
  currentStats: ComputedRef<Record<string, number>>
  statDisplayNames: ComputedRef<Map<string, string>>
  activeRebates: ComputedRef<string[]>
  clusterRewardDisplays: ComputedRef<TerraformingRewardDisplayItem[]>
}

export interface TerraformingScaleRange {
  start: number
  end: number
  state: number
  rgb: string
  habitable?: boolean
}

export interface TerraformingStatScaleModel {
  statId: string
  statName: string
  currentValue: number
  currentState: number | null
  ranges: TerraformingScaleRange[]
}

export interface TerraformingConditionScaleModel extends TerraformingStatScaleModel {
  mode: 'state-range' | 'value-range'
  requirementLabel: string
  requiredStates: number[]
  requirementSegments: Array<{ startIndex: number; endIndex: number }>
}

export type TerraformingStatEffectDirection = 'none' | 'increase' | 'decrease'

export interface TerraformingStatLineModel extends TerraformingStatScaleModel {
  requirementLabel?: string
  requiredStates?: number[]
  requirementSegments?: Array<{ startIndex: number; endIndex: number }>
  effectDirection: TerraformingStatEffectDirection
  effectFromValue: number | null
  effectToValue: number | null
  effectLabel?: string
  numericText?: string | null
}

export interface TerraformingEffectItem {
  type: 'effect' | 'rebate' | 'sideEffect' | 'description'
  text: string
}

export interface TerraformingDependencyLineModel {
  label: string
  value: string
  blocked: boolean
}

export interface TerraformingTaskNodeDisplay {
  name: string
  effects: string
  blockedReasonLines: string[]
  dependencyLines: TerraformingDependencyLineModel[]
  statLines: TerraformingStatLineModel[]
  effectItems: TerraformingEffectItem[]
}

export interface TerraformingTaskListProps {
  taskTree: ComputedRef<TaskTree | null>
  groupNames: ComputedRef<Map<string, string>>
  taskNodeDisplays: ComputedRef<Map<string, TerraformingTaskNodeDisplay>>
  completedProjectCounts: ComputedRef<Map<string, number>>
  archiveCompletedProjectCounts: ComputedRef<Map<string, number>>
  projectMap: ComputedRef<Map<string, TerraformingProject>>
  projectDisplayNames: ComputedRef<Map<string, string>>
  wareNames: ComputedRef<Map<string, string>>
  moduleGroupNames: ComputedRef<Map<string, string>>
  goalFilteredTaskIds: ComputedRef<Set<string> | null>
}

export interface TerraformingTimelineStatSnapshot {
  statId: string
  statName: string
  beforeValue: number
  afterValue: number
}

export interface TerraformingCancelValidation {
  canCancel: boolean
  affectedEntryIds: string[]
  reasons: string[]
}

export interface TerraformingDeliveryEntry {
  macro: string
  amount: number
  shipName: string
  buildDuration: number
  totalTime: number
}

export interface TerraformingExecutionTimelineEntry {
  id: string
  order: number
  projectId: string
  projectName: string
  projectGroupId: string
  projectGroupName: string
  showGroupMarker: boolean
  wares: Array<{ ware: string; amount: number; actualAmount?: number }>
  deliveries: Array<{ macro: string; amount: number }>
  deliveryDetails: Array<{ macro: string; amount: number; shipName: string; buildDuration: number; totalTime: number }>
  dockModules: Array<{ name: string; count: number; slots: number }>
  totalSlots: number
  price: number
  discountAmount: number
  projectRebates: Array<{ name: string; value: number }>
  cumulativeRebates: Array<{ name: string; value: number }>
  rebateChanges: Array<{ name: string; before: number; after: number }>
  discountedWares: Array<{ wareId: string; name: string; original: number; discount: number; final: number }>
  statLines: TerraformingStatLineModel[]
  beforeStats: TerraformingTimelineStatSnapshot[]
  afterStats: TerraformingTimelineStatSnapshot[]
  availableBeforeExecution: boolean
  blockedReason: string | null
  projectDuration: number
}

export type TerraformingGoalKind = 'project' | 'stat' | 'cluster' | 'preventive'

export interface TerraformingDraftExecutionEntry extends TerraformingExecutionEntry {
  source: 'committed' | 'draft'
  systemDisabled: boolean
  systemDisabledReason?: string
  mutuallyExclusiveWith?: string
}

export type TerraformingDraftRepeatRole = 'single' | 'first' | 'duplicate'

export interface TerraformingDraftTimelineEntry {
  id: string
  order: number
  projectId: string
  projectName: string
  projectGroupName: string
  systemDisabled: boolean
  systemDisabledReason?: string
  mutuallyExclusiveWith?: string
  repeatRole: TerraformingDraftRepeatRole
  reasons: string[]
  dependencies: string[]
  statLines: TerraformingStatLineModel[]
  price: number
  wares: Array<{ name: string; amount: number }>
  discountAmount: number
  discountedWares: Array<{ wareId: string; name: string; original: number; discount: number; final: number }>
  isEvent: boolean
  source?: 'committed' | 'draft'
}

export interface TerraformingGoalEntry {
  id: string
  kind: TerraformingGoalKind
  label: string
  targetProjectId: string | null
  targetStatId: string | null
  targetStatConditionIndex?: number
  position: number
  satisfied: boolean
  hasRisk: boolean
  riskReason?: string
  dependentTaskIds: string[]
  hasExistingTask: boolean
  existingDraftEntryId?: string
  relatedEventId?: string
}

export interface TerraformingGoalDisplayEntry {
  id: string
  kind: TerraformingGoalKind
  label: string
  satisfied: boolean
  hasRisk: boolean
  riskReason?: string
  isFilterActive: boolean
  statGoalModel?: TerraformingStatGoalLineModel
  hasExistingTask: boolean
  existingDraftEntryId?: string
}

export interface TerraformingAutoEventDisplayEntry {
  projectId: string
  projectName: string
  effects: StatEffect[]
  statLines: TerraformingStatLineModel[]
  order: number
}

export type TerraformingGoalPlanDisplayEntry =
  | { type: 'task'; entry: TerraformingDraftTimelineEntry }
  | { type: 'goal'; entry: TerraformingGoalDisplayEntry }
  | { type: 'auto-event'; entry: TerraformingDraftTimelineEntry }

export interface TerraformingStatGoalLineModel extends TerraformingStatScaleModel {
  hasRanges: boolean
  targetValue: number
  ranges: TerraformingScaleRange[]
  requirementSegments: Array<{ startIndex: number; endIndex: number }>
  effectDirection: TerraformingStatEffectDirection
  effectFromValue: number
  effectToValue: number
  numericText: string | null
  satisfied: boolean
}

export interface TerraformingQueueEditState {
  editing: ComputedRef<boolean>
  canComplete: ComputedRef<boolean>
  unsatisfiedGoalCount: ComputedRef<number>
  planEntries: ComputedRef<TerraformingGoalPlanDisplayEntry[]>
}

export interface TerraformingResourcePanelProps {
  selectedClusterId: ComputedRef<string | null>
  executionTimeline: ComputedRef<TerraformingExecutionTimelineEntry[]>
  taskLogMode: ComputedRef<'queue' | 'executed'>
  currentQueueDisplayEntries: ComputedRef<TerraformingCurrentQueueDisplayEntry[]>
  executedEntries: ComputedRef<TerraformingExecutedDisplayEntry[]>
  archiveSyncNotice: ComputedRef<TerraformingArchiveSyncNotice | null>
  archiveActiveProjectDisplay: ComputedRef<TerraformingArchiveProjectDisplay | null>
  archiveRetainedProjectDisplays: ComputedRef<TerraformingArchiveProjectDisplay[]>
  queueEditState: TerraformingQueueEditState
  getCancelValidation: (entryId: string) => TerraformingCancelValidation
  deliveryShipMap: ComputedRef<Map<string, DeliveryShip>>
  hqBuildDocks: ComputedRef<{ totalSlots: number } | null>
}

export interface TerraformingCurrentQueueDisplayEntry {
  id: string
  projectId: string
  projectName: string
  status: RuntimeCurrentQueueDisplayEntry['status']
  source: RuntimeCurrentQueueDisplayEntry['source']
  replayEntryId?: string
  runtimeStatus?: 'active' | 'has-progress'
  fixedFirst?: boolean
}

export interface TerraformingExecutedDisplayEntry {
  id: string
  projectId: string
  projectName: string
  kind: TerraformingExecutedDisplaySource['kind']
  status: TerraformingExecutedDisplaySource['status']
  count: number
  source: TerraformingExecutedDisplaySource['source']
}

export interface TerraformingArchiveSyncNotice {
  deductedCount: number
  archiveOnlyCount: number
  hasArchiveAdvance: boolean
  hasArchiveRollbackRisk: boolean
  hasRuntimeStateChange: boolean
  message: string
}

export interface TerraformingArchiveResourceProgress {
  ware: string
  wareName: string
  scaled: number
  submitted: number
  inTransit: number
}

export interface TerraformingArchiveProjectDisplay {
  projectId: string
  projectName: string
  status: 'active' | 'aborting' | 'retained'
  shipBatches?: number
  resources: TerraformingArchiveResourceProgress[]
}

export interface TerraformingTaskDragState {
  isDragging: ComputedRef<boolean>
  projectId: ComputedRef<string>
  projectName: ComputedRef<string>
}

export interface TerraformingPresenterProps {
  toolbar: TerraformingToolbarProps
  sectorPanel: TerraformingSectorPanelProps
  taskList: TerraformingTaskListProps
  resourcePanel: TerraformingResourcePanelProps
  taskDrag: TerraformingTaskDragState
}

export interface TerraformingPresenterEmits {
  selectCluster: (clusterId: string) => void
  toggleProject: (projectId: string) => void
  setProjectCount: (projectId: string, count: number) => void
  cancelExecution: (entryId: string) => void
  clearExecutionQueue: () => void
  startQueueEdit: () => void
  cancelQueueEdit: () => void
  completeQueueEdit: () => void
  removeDraftEntry: (entryId: string) => void
  removeAllDraftEntries: () => void
  clickGoal: (goalId: string) => void
  moveTaskBeforeDependency: (entryId: string, targetGoalId: string) => void
  appendDraftTask: (projectId: string, targetIndex?: number) => void
  startDraggingTask: (projectId: string, projectName: string) => void
  endDraggingTask: () => void
  copyDraftEntry: (entryId: string) => void
  moveDraftEntry: (entryId: string, targetIndex: number) => void
  reorderDraftEntries: (entries: TerraformingDraftTimelineEntry[]) => void
  setTaskLogMode: (mode: 'queue' | 'executed') => void
  confirmArchiveSync: () => void
  debugClearExecutedBaseline: () => void
}

export interface UseTerraformingPresenterReturn {
  props: TerraformingPresenterProps
  emits: TerraformingPresenterEmits
}

export interface TerraformingPresenterStore {
  terraformingData: ComputedRef<TerraformingData | null>
  terraformingSelectedClusterId: ComputedRef<string | null>
  terraformingSelectedCluster: ComputedRef<TerraformingCluster | null>
  terraformingRuntimeProjectIds: ComputedRef<string[]>
  terraformingExecutionLog: ComputedRef<TerraformingExecutionEntry[]>
  terraformingArchiveRuntimeBaseState: ComputedRef<TerraformingArchiveRuntimeBaseState | null>
  terraformingExecutedDelta: ComputedRef<TerraformingExecutedDelta>
  terraformingDeductedExecution: ComputedRef<DeductExecutionResult>
  terraformingHqStationName: ComputedRef<string>
  terraformingHqArchiveStation: ComputedRef<ArchiveStationData | null>
  terraformingHqEffectiveModules: ComputedRef<SavedModule[]>
  terraformingHqClusterId: ComputedRef<string | null>
  selectTerraformingCluster: (clusterId: string) => void
  setTerraformingCompletedProjects: (projects: Map<string, number>) => void
  appendTerraformingProjectExecution: (projectId: string, count?: number) => void
  setTerraformingProjectCount: (projectId: string, count: number) => void
  removeTerraformingExecutionEntry: (entryId: string) => void
  replaceTerraformingExecutionLog: (entries: TerraformingExecutionEntry[]) => void
  replaceTerraformingExecutionLogAndSyncBaseline: (entries: TerraformingExecutionEntry[]) => void
  syncTerraformingExecutedBaseline: () => void
  clearTerraformingExecutedBaseline: () => void
  clearTerraformingExecutionQueue: () => void
  mapsClusters: Record<string, X4MapCluster>
  mapsSectors: Record<string, X4MapSector>
  wareNames: ComputedRef<Map<string, string>>
  moduleGroupNames: ComputedRef<Map<string, string>>
  wareGroupMap: ComputedRef<Map<string, string>>
}

function stripMacroPrefix(macro: string): string {
  return macro.replace(/^macro\./, '')
}

function isStatNeutralized(statId: string, currentVal: number, stats: TerraformingStat[]): boolean {
  const stat = stats.find(s => s.id === statId)
  if (!stat) return false
  const range = getCurrentRange(stat, currentVal)
  if (range) return range.state >= 2 || (range.habitable !== false && range.state === 0)
  return false
}

function getStatName(statId: string, data: TerraformingData, i18nLookup: I18nLookup): string {
  const statDef = data.stats.find(s => s.id === statId)
  if (!statDef) return statId
  if (statDef.nameId) return resolveTerraformingText(statDef.nameId, data, i18nLookup)
  return statDef.name || statId
}

function toScaleRanges(stat: TerraformingStat): TerraformingScaleRange[] {
  return getSortedRanges(stat).map(range => ({
    start: range.start ?? 0,
    end: range.end,
    state: range.state,
    rgb: range.rgb,
    habitable: range.habitable,
  }))
}

function getConditionMode(condition: StatCondition, statDef?: TerraformingStat): 'state-range' | 'value-range' {
  if (condition.usesValueBounds || condition.minvalue !== undefined || condition.maxvalue !== undefined) {
    return 'value-range'
  }
  if (condition.usesStateBounds) return 'state-range'
  if (!statDef) return 'value-range'
  const maxState = Math.max(...statDef.ranges.map(r => r.state))
  if ((condition.min ?? -Infinity) > maxState || (condition.max ?? -Infinity) > maxState) {
    return 'value-range'
  }
  return 'state-range'
}

function computeRequirementSegments(
  ranges: TerraformingScaleRange[],
  minValue: number | undefined,
  maxValue: number | undefined,
  requiredStates: number[],
): Array<{ startIndex: number; endIndex: number }> {
  const segments: Array<{ startIndex: number; endIndex: number }> = []
  let blockIdx = 0
  let segStart: number | null = null

  for (const range of ranges) {
    for (let value = range.start; value <= range.end; value += 1) {
      if (value === 0) continue

      let required = false
      if (minValue === undefined && maxValue === undefined) {
        required = requiredStates.includes(range.state)
      } else {
        required =
          (minValue === undefined || value >= minValue) &&
          (maxValue === undefined || value <= maxValue)
      }

      if (required && segStart === null) {
        segStart = blockIdx
      } else if (!required && segStart !== null) {
        segments.push({ startIndex: segStart, endIndex: blockIdx - 1 })
        segStart = null
      }

      blockIdx += 1
    }
  }

  if (segStart !== null) {
    segments.push({ startIndex: segStart, endIndex: blockIdx - 1 })
  }

  return segments
}

function buildConditionScaleModel(
  condition: StatCondition,
  data: TerraformingData,
  currentStats: Record<string, number>,
  i18nLookup: I18nLookup,
): TerraformingConditionScaleModel | null {
  const statDef = data.stats.find(s => s.id === condition.stat)
  if (!statDef) return null
    if (!isStatInRuntime(currentStats, condition.stat)) return null
  const currentValue = currentStats[condition.stat] ?? 0
  const currentRange = getCurrentRange(statDef, currentValue)
  const ranges = toScaleRanges(statDef)
  const mode = getConditionMode(condition, statDef)

  let requiredStates: number[] = []
  let requirementLabel = ''
  const minValue = condition.minvalue ?? condition.min
  const maxValue = condition.maxvalue ?? condition.max

  if (mode === 'state-range') {
    const minState = condition.min ?? Math.min(...ranges.map(r => r.state))
    const maxState = condition.max ?? Math.max(...ranges.map(r => r.state))
    requiredStates = ranges.filter(r => r.state >= minState && r.state <= maxState).map(r => r.state)
    requirementLabel = `${getStatName(condition.stat, data, i18nLookup)} state ${minState}-${maxState}`
  } else {
    requiredStates = ranges
      .filter(r => (minValue === undefined || r.end >= minValue) && (maxValue === undefined || r.start <= maxValue))
      .map(r => r.state)
    if (minValue !== undefined && maxValue !== undefined) requirementLabel = `${getStatName(condition.stat, data, i18nLookup)} ${minValue}-${maxValue}`
    else if (minValue !== undefined) requirementLabel = `${getStatName(condition.stat, data, i18nLookup)} >= ${minValue}`
    else if (maxValue !== undefined) requirementLabel = `${getStatName(condition.stat, data, i18nLookup)} <= ${maxValue}`
  }

  const requirementSegments = computeRequirementSegments(
    ranges,
    mode === 'value-range' ? minValue : undefined,
    mode === 'value-range' ? maxValue : undefined,
    requiredStates,
  )

  return {
    statId: condition.stat,
    statName: getStatName(condition.stat, data, i18nLookup),
    currentValue,
    currentState: currentRange?.state ?? null,
    ranges,
    mode,
    requirementLabel,
    requiredStates,
    requirementSegments,
  }
}

function buildNeutralizeScaleModel(
  statId: string,
  data: TerraformingData,
  currentStats: Record<string, number>,
  i18nLookup: I18nLookup,
): TerraformingConditionScaleModel | null {
  const statDef = data.stats.find(s => s.id === statId)
  if (!statDef) return null
  if (!isStatInRuntime(currentStats, statId)) return null
  const currentValue = currentStats[statId] ?? 0
  const currentRange = getCurrentRange(statDef, currentValue)
  const ranges = toScaleRanges(statDef)
  const requiredStates = ranges
    .filter(range => range.state >= 2 || (range.state === 0 && range.habitable !== false))
    .map(range => range.state)

  return {
    statId,
    statName: getStatName(statId, data, i18nLookup),
    currentValue,
    currentState: currentRange?.state ?? null,
    ranges,
    mode: 'state-range',
    requirementLabel: `${getStatName(statId, data, i18nLookup)} neutralized`,
    requiredStates,
    requirementSegments: computeRequirementSegments(ranges, undefined, undefined, requiredStates),
  }
}

function formatEffectLabel(
  effect: StatEffect,
  uiLabels: { min: string; max: string },
): string {
  if (effect.value !== undefined) return `=${effect.value}`
  if (effect.change === undefined) return ''
  const sign = effect.change >= 0 ? '+' : ''
  let label = `${sign}${effect.change}`
  if (effect.min !== undefined) label += `(${uiLabels.min}:${effect.min})`
  if (effect.max !== undefined) label += `(${uiLabels.max}:${effect.max})`
  return label
}

function resolveEffectTargetValue(effect: StatEffect, currentValue: number): number {
  let targetValue = effect.value ?? currentValue
  if (effect.change !== undefined) {
    targetValue = currentValue + effect.change
  }
  if (effect.min !== undefined && targetValue < effect.min) {
    targetValue = effect.min
  }
  if (effect.max !== undefined && targetValue > effect.max) {
    targetValue = effect.max
  }
  return targetValue
}

function buildTaskStatLineModels(
  project: TerraformingProject,
  data: TerraformingData,
  currentStats: Record<string, number>,
  completedCount: number,
  i18nLookup: I18nLookup,
  uiLabels: { min: string; max: string },
): TerraformingStatLineModel[] {
  const statIds = new Set<string>()
  for (const condition of project.conditions) statIds.add(condition.stat)
  for (const effect of project.effects) statIds.add(effect.stat)

  const lines: TerraformingStatLineModel[] = []

  for (const stat of data.stats) {
    if (!statIds.has(stat.id)) continue
    if (!isStatInRuntime(currentStats, stat.id)) continue

    const statName = getStatName(stat.id, data, i18nLookup)
    const currentValue = currentStats[stat.id] ?? 0
    const currentRange = getCurrentRange(stat, currentValue)
    const ranges = toScaleRanges(stat)
    const effect = project.effects.find(item => item.stat === stat.id)
    const conditionModels = project.conditions
      .filter(item => item.stat === stat.id)
      .map(item => buildConditionScaleModel(item, data, currentStats, i18nLookup))
      .filter((model): model is TerraformingConditionScaleModel => model !== null)

    const requiredStates = [...new Set(conditionModels.flatMap(model => model.requiredStates))]
    const requirementSegments = conditionModels.flatMap(model => model.requirementSegments)
    const requirementLabel = conditionModels
      .map(model => model.requirementLabel)
      .filter(Boolean)
      .join(' / ')

    let effectDirection: TerraformingStatEffectDirection = 'none'
    let effectToValue: number | null = null
    let effectLabel = ''
    const hideBlockEffectPreview = project.repeatCooldown === null && completedCount > 0 && ranges.length > 0

    if (effect) {
      effectToValue = resolveEffectTargetValue(effect, currentValue)
      if (!hideBlockEffectPreview) {
        if (effectToValue > currentValue) effectDirection = 'increase'
        else if (effectToValue < currentValue) effectDirection = 'decrease'
      }
      effectLabel = formatEffectLabel(effect, uiLabels)
    }

    if (ranges.length === 0) {
      const numericParts: string[] = []
      if (effectToValue !== null) {
        numericParts.push(`${currentValue.toLocaleString()} -> ${effectToValue.toLocaleString()}`)
      } else {
        numericParts.push(currentValue.toLocaleString())
      }

      if (requirementLabel) {
        const prefix = `${statName} `
        numericParts.push(
          requirementLabel.startsWith(prefix)
            ? requirementLabel.slice(prefix.length)
            : requirementLabel
        )
      }

      lines.push({
        statId: stat.id,
        statName,
        currentValue,
        currentState: currentRange?.state ?? null,
        ranges,
        requirementLabel,
        requiredStates,
        requirementSegments,
        effectDirection,
        effectFromValue: currentValue,
        effectToValue,
        effectLabel,
        numericText: numericParts.join('  '),
      })
      continue
    }

    lines.push({
      statId: stat.id,
      statName,
      currentValue,
      currentState: currentRange?.state ?? null,
      ranges,
      requirementLabel,
      requiredStates,
      requirementSegments,
      effectDirection,
      effectFromValue: currentValue,
      effectToValue,
      effectLabel,
      numericText: null,
    })
  }

  return lines
}

function buildTimelineStatLineModel(
  snapshot: TerraformingTimelineStatSnapshot,
  data: TerraformingData,
): TerraformingStatLineModel | null {
  const stat = data.stats.find(item => item.id === snapshot.statId)
  if (!stat) return null
  const currentRange = getCurrentRange(stat, snapshot.beforeValue)
  const ranges = toScaleRanges(stat)
  const effectDirection: TerraformingStatEffectDirection = snapshot.afterValue > snapshot.beforeValue
    ? 'increase'
    : snapshot.afterValue < snapshot.beforeValue
      ? 'decrease'
      : 'none'

  if (ranges.length === 0) {
    return {
      statId: snapshot.statId,
      statName: snapshot.statName,
      currentValue: snapshot.beforeValue,
      currentState: currentRange?.state ?? null,
      ranges,
      effectDirection,
      effectFromValue: snapshot.beforeValue,
      effectToValue: snapshot.afterValue,
      numericText: `${snapshot.beforeValue.toLocaleString()} -> ${snapshot.afterValue.toLocaleString()}`,
    }
  }

  return {
    statId: snapshot.statId,
    statName: snapshot.statName,
    currentValue: snapshot.beforeValue,
    currentState: currentRange?.state ?? null,
    ranges,
    effectDirection,
    effectFromValue: snapshot.beforeValue,
    effectToValue: snapshot.afterValue,
    numericText: null,
  }
}

function extractHousingTarget(cluster: TerraformingCluster, objectives: ClusterObjective[]): number | null {
  const housingObj = objectives.find(o => o.action === 'objective.build_housing')
  if (!housingObj) return null
  if (housingObj.textReplaces) {
    for (const r of housingObj.textReplaces) {
      if (r.from === '$AMOUNT$') {
        const val = Number(r.to)
        if (!isNaN(val)) return val
      }
    }
  }
  if (cluster.values) {
    for (const [, val] of Object.entries(cluster.values)) {
      const num = Number(val)
      if (!isNaN(num) && num > 0) {
        return num
      }
    }
  }
  return null
}

function resolveRebateName(key: string, type: 'wareGroup' | 'ware', moduleGroupNames?: Map<string, string>, wareNames?: Map<string, string>): string {
  if (type === 'wareGroup') return moduleGroupNames?.get(key) || key
  return wareNames?.get(key) || key
}

function getProjectSnapshotStatIds(project: TerraformingProject): string[] {
  const ids = new Set<string>()
  for (const effect of project.effects) ids.add(effect.stat)
  for (const condition of project.conditions) ids.add(condition.stat)
  return [...ids]
}

function translateTaskEffects(
  effects: string,
  statNames: Map<string, string>,
  uiLabels: { min: string; max: string },
): string {
  return effects
    .replace(/\(min:/g, `(${uiLabels.min}:`)
    .replace(/\(max:/g, `(${uiLabels.max}:`)
    .replace(/\b(\w+)\b/g, (match: string) => statNames.get(match) || match)
}

function translateBlockedReasonLines(
  blockedReason: string | undefined,
  data: TerraformingData,
  projectNames: Map<string, string>,
  statNames: Map<string, string>,
  uiLabels: { depends: string; current: string; anyOf: string },
): string[] {
  if (!blockedReason) return []
  const parts = blockedReason.split('; ')
  return parts.map((part: string) => {
    if (part.startsWith('depends_any: ') || part.startsWith('depends_all: ') || part.startsWith('depends: ')) {
      const raw = part.startsWith('depends_any: ')
        ? part.slice('depends_any: '.length)
        : part.startsWith('depends_all: ')
          ? part.slice('depends_all: '.length)
          : part.slice('depends: '.length)
      const refs = raw.split(' | ')
      const translated = refs.map((ref: string) => {
        const suffixMatch = ref.match(/^(.*) \(([^)]+)\)$/)
        const baseName = suffixMatch ? suffixMatch[1]!.trim() : ref.trim()
        const suffixCode = suffixMatch ? suffixMatch[2]! : ''
        let translatedName = ref
        for (const proj of data.projects) {
          if ((proj.name || proj.nameId) === baseName) {
            translatedName = projectNames.get(proj.id) || baseName
            break
          }
        }
        return suffixCode ? `${translatedName} (${suffixCode})` : translatedName
      }).join(' | ')
      if (part.startsWith('depends_any: ')) {
        return `${uiLabels.depends}: ${uiLabels.anyOf}${translated}`
      }
      return `${uiLabels.depends}: ${translated}`
    }
    return part
      .replace(/\(current:/g, `(${uiLabels.current}:`)
      .replace(/^(?:(\w+) )/, (_, statId: string) => `${statNames.get(statId) || statId} `)
  })
}

function formatDescriptionItem(
  item: DescriptionItem,
  i18n: (key: string) => string,
): string {
  const N = i18n

  switch (item.type) {
    case 'skill_add': {
      const skillName = N(`terraforming.skill.${item.skill}`) || item.skill
      const scope = item.scope === 'group'
        ? (N('terraforming.effect.allTrainees') || 'all trainees')
        : (N('terraforming.effect.assignedTrainee') || 'assigned trainee')
      return `${scope} ${skillName} +${item.stars}★ (${N('terraforming.max') || 'max'} ${item.maxStars}★)`
    }

    case 'recruitment': {
      const roleName = N(`terraforming.role.${item.role}`) || item.role
      const skillName = N(`terraforming.skill.${item.primarySkill}`) || item.primarySkill
      const measure = N('terraforming.effect.measure') || ''
      const countText = measure ? `${item.count}${measure} ` : `${item.count} `
      return `${N('terraforming.effect.recruit') || 'Recruit'} ${countText}${roleName} (${skillName}${N('terraforming.effect.skill') || ' Skill'} ${item.skillMin}-${item.skillMax}, ${N('terraforming.effect.starHint') || '3pts=1★'})`
    }

    case 'payout': {
      const priceVal = item.price ?? 0
      let investText: string
      if (priceVal <= 0) {
        investText = ''
      } else if (priceVal < 1) {
        investText = `${N('terraforming.effect.invest') || 'Invest'}: ${N('terraforming.effect.priceFactor') || 'factor'} ${priceVal}`
      } else {
        investText = `${N('terraforming.effect.invest') || 'Invest'}: ${priceVal.toLocaleString()} ${N('terraforming.creditUnit') || 'Cr'}`
      }

      let scaleText = ''
      if (item.pricescale === 'population') {
        scaleText = N('terraforming.effect.scalePopulation') || ' × population'
        investText = investText ? investText + scaleText : `${N('terraforming.effect.invest') || 'Invest'}: ${scaleText.trim()}`
      } else if (item.pricescale === 'playeraccount') {
        scaleText = N('terraforming.effect.scaleAccount') || ' × account'
        investText = investText ? investText + scaleText : `${N('terraforming.effect.invest') || 'Invest'}: ${scaleText.trim()}`
      }

      const payoutCr = item.amount
      let returnText = `${N('terraforming.effect.returns') || 'Returns'}: ${payoutCr}%`

      if (item.maxPrice) {
        returnText += ` (${N('terraforming.max') || 'max'}: ${item.maxPrice.toLocaleString()} ${N('terraforming.creditUnit') || 'Cr'})`
      }

      return `${investText} / ${returnText}`
    }

    case 'chance': {
      return `${N('terraforming.effect.chance') || 'Success rate'}: ${item.value}%`
    }

    case 'research': {
      const name = (item.nameId ? N(item.nameId) : null) || item.id
      return `${N('terraforming.effect.research') || 'Requires research'}: ${name}`
    }

    default:
      return ''
  }
}

function buildEffectItems(
  projectId: string,
  statNames: Map<string, string>,
  data: TerraformingData,
  projectNames: Map<string, string>,
  wareNames: Map<string, string>,
  moduleGroupNames: Map<string, string>,
  uiLabels: { min: string; max: string; setback: string; chance: string },
  i18nLookup: (key: string) => string,
): TerraformingEffectItem[] {
  const items: TerraformingEffectItem[] = []

  const project = data.projects.find(p => p.id === projectId)
  if (!project) return items

  const projectDescriptions = project.descriptions
  if (projectDescriptions && projectDescriptions.length) {
    for (const desc of projectDescriptions) {
      const text = formatDescriptionItem(desc, i18nLookup)
      if (text) {
        items.push({ type: 'description', text })
      }
    }
  }

  for (const rb of project.rebates) {
    let name = ''
    if (rb.wareGroup) {
      name = moduleGroupNames.get(rb.wareGroup) || rb.wareGroup
    } else if (rb.ware) {
      name = wareNames.get(rb.ware) || rb.ware
    }
    if (name) {
      items.push({ type: 'rebate', text: `${name} ${rb.value}%` })
    }
  }

  for (const se of project.sideEffects) {
    const parts: string[] = [`${se.chance}%${uiLabels.chance}`]
    if (se.project) {
      const projName = projectNames.get(se.project) || se.project
      parts.push(`${projName}`)
    }
    if (se.stat && se.change !== null && se.change !== undefined) {
      const statName = statNames.get(se.stat) || se.stat
      const sign = se.change > 0 ? '+' : ''
      parts.push(`${statName} ${sign}${se.change}`)
    }
    if (se.setback > 0) {
      parts.push(`${se.setback}% ${uiLabels.setback}`)
    }
    items.push({ type: 'sideEffect', text: parts.join(', ') })
  }

  return items
}

type DiscountedWareEntry = { wareId: string; name: string; original: number; discount: number; final: number }

function computeProjectDiscount(
  projectResources: { wares: Array<{ ware: string; amount: number; actualAmount?: number }> } | undefined,
  cumulativeEntries: RebateKey[],
  wareGroupMap: ComputedRef<Map<string, string>>,
  wareNames: ComputedRef<Map<string, string>>,
  waresMap: Record<string, { maxPrice?: number }>,
): { discountedWares: DiscountedWareEntry[]; discountAmount: number } {
  const wares = projectResources?.wares || []
  const dw: DiscountedWareEntry[] = []
  let da = 0
  if (wares.length === 0 || cumulativeEntries.length === 0) return { discountedWares: dw, discountAmount: da }
  const seen = new Set<string>()
  for (const rb of cumulativeEntries) {
    const pct = rb.value / 100
    for (const w of wares) {
      const amount = w.actualAmount ?? w.amount
      if (amount <= 0) continue
      const groupId = wareGroupMap.value.get(w.ware)
      if (rb.type === 'wareGroup' && groupId !== rb.id) continue
      if (rb.type === 'ware' && w.ware !== rb.id) continue
      if (seen.has(w.ware)) continue
      seen.add(w.ware)
      const wareName = wareNames.value.get(w.ware) || w.ware
      const discAmt = Math.floor(amount * pct)
      if (discAmt > 0) dw.push({ wareId: w.ware, name: wareName, original: amount, discount: discAmt, final: amount - discAmt })
    }
  }
  for (const e of dw) {
    const unitPrice = waresMap[e.wareId]?.maxPrice ?? 0
    if (unitPrice > 0 && e.discount > 0) da += unitPrice * e.discount
  }
  return { discountedWares: dw, discountAmount: da }
}

function translateEvaluationReasons(
  reasons: string[],
  data: TerraformingData,
  i18nLookup: I18nLookup,
): string[] {
  const tDepends = i18nLookup('terraforming.depends') || 'Needs'
  const tDependsAny = i18nLookup('terraforming.dependsAny') || 'Any of'
  const tDependsAll = i18nLookup('terraforming.dependsAll') || 'All of'
  const tRemoved = i18nLookup('terraforming.removed') || 'Removed'
  const tBlocking = i18nLookup('terraforming.blocking') || 'Blocking'
  const tBlockingGroup = i18nLookup('terraforming.blocking_group') || 'Blocking Group'

  return reasons.map(reason => {
    let s = reason.replace(/\{[^}]+\}/g, match => resolveTerraformingText(match, data, i18nLookup))

    s = s.replace(/^depends_any: /, `${tDependsAny}: `)
    s = s.replace(/^depends_all: /, `${tDependsAll}: `)
    s = s.replace(/(^| \| | \+ )depends: /g, `$1${tDepends}: `)
    s = s.replace(/^depends: /, `${tDepends}: `)

    s = s.replace(/ \(removed\)/g, ` (${tRemoved})`)
    s = s.replace(/ \(blocking\)/g, ` (${tBlocking})`)
    s = s.replace(/ \(blocking_group\)/g, ` (${tBlockingGroup})`)

    return s
  })
}

function formatDependencyExpression(
  dependency: TerraformingProjectDependency | undefined,
  projectNames: Map<string, string>,
  labels: { mutuallyExclusive: string; notCompletedBranch: string; completedBranch: string; or: string },
  runtimeProjectIds?: Set<string>,
): string[] {
  if (!dependency) return []
  if ('all' in dependency) {
    return dependency.all.flatMap(child => formatDependencyExpression(child, projectNames, labels, runtimeProjectIds))
  }
  if ('any' in dependency) {
    const isLeaf = (dep: TerraformingProjectDependency): boolean => 'completed' in dep || 'notCompleted' in dep
    if (dependency.any.every(isLeaf) && dependency.any.length > 0 && dependency.any.some(d => 'notCompleted' in d)) {
      const branchStrings = dependency.any.map(child => {
        if ('notCompleted' in child) return (runtimeProjectIds && !runtimeProjectIds.has(child.notCompleted)) ? '' : (`${labels.notCompletedBranch}${projectNames.get(child.notCompleted) || child.notCompleted}`)
        if ('completed' in child) return (runtimeProjectIds && !runtimeProjectIds.has(child.completed)) ? '' : (`${labels.completedBranch}${projectNames.get(child.completed) || child.completed}`)
        return ''
      }).filter(s => s.length > 0)
      return branchStrings.length > 0 ? [branchStrings.join(labels.or)] : []
    }
    const branchLabels = dependency.any
      .map(child => formatDependencyExpression(child, projectNames, labels, runtimeProjectIds).join(' + '))
      .filter(label => label.length > 0)
    return branchLabels.length > 0 ? [branchLabels.join(' | ')] : []
  }
  if ('completed' in dependency) {
    if (runtimeProjectIds && !runtimeProjectIds.has(dependency.completed)) return []
    return [projectNames.get(dependency.completed) || dependency.completed]
  }
  if ('notCompleted' in dependency) {
    if (runtimeProjectIds && !runtimeProjectIds.has(dependency.notCompleted)) return []
    return [`${labels.mutuallyExclusive}: ${projectNames.get(dependency.notCompleted) || dependency.notCompleted}`]
  }
  if ('groupCompleted' in dependency) return []
  if ('groupNotCompleted' in dependency) return []
  return []
}

function projectDisplayName(projectId: string, projectNames: Map<string, string>): string {
  const displayName = projectNames.get(projectId)
  if (displayName !== undefined) return displayName
  return projectId
}

function formatDependencyExpressionLines(
  dependency: TerraformingProjectDependency | undefined,
  projectNames: Map<string, string>,
  labels: { depends: string; anyOf: string; mutuallyExclusive: string; notCompletedBranch: string; completedBranch: string; or: string },
  completedProjects: Map<string, number>,
  runtimeProjectIds?: Set<string>,
): TerraformingDependencyLineModel[] {
  if (!dependency) return []
  if ('all' in dependency) {
    return dependency.all.flatMap(child => formatDependencyExpressionLines(child, projectNames, labels, completedProjects, runtimeProjectIds))
  }
  if ('any' in dependency) {
    const isLeaf = (dep: TerraformingProjectDependency): boolean => 'completed' in dep || 'notCompleted' in dep
    if (dependency.any.every(child => 'completed' in child) && dependency.any.length > 0) {
      const branchInfo = dependency.any.map(child => {
        if (!('completed' in child)) return null
        if (runtimeProjectIds && !runtimeProjectIds.has(child.completed)) return null
        return {
          text: projectDisplayName(child.completed, projectNames),
          blocked: (completedProjects.get(child.completed) ?? 0) <= 0,
        }
      }).filter((x): x is { text: string; blocked: boolean } => x !== null)
      if (branchInfo.length === 0) return []
      const anyBlocked = branchInfo.every(b => b.blocked)
      return [{
        label: labels.depends,
        value: `${labels.anyOf}${branchInfo.map(b => b.text).join(' | ')}`,
        blocked: anyBlocked,
      }]
    }
    if (dependency.any.every(isLeaf) && dependency.any.length > 0 && dependency.any.some(d => 'notCompleted' in d)) {
      const branchInfo = dependency.any.map(child => {
        if ('notCompleted' in child) {
          if (runtimeProjectIds && !runtimeProjectIds.has(child.notCompleted)) return null
          const b = (completedProjects.get(child.notCompleted) ?? 0) > 0
          return { text: `${labels.notCompletedBranch}${projectDisplayName(child.notCompleted, projectNames)}`, blocked: b }
        }
        if ('completed' in child) {
          if (runtimeProjectIds && !runtimeProjectIds.has(child.completed)) return null
          const b = (completedProjects.get(child.completed) ?? 0) <= 0
          return { text: `${labels.completedBranch}${projectDisplayName(child.completed, projectNames)}`, blocked: b }
        }
        return null
      }).filter((x): x is { text: string; blocked: boolean } => x !== null)
      if (branchInfo.length === 0) return []
      const anyBlocked = branchInfo.every(b => b.blocked)
      return [{
        label: labels.depends,
        value: branchInfo.map(b => b.text).join(labels.or),
        blocked: anyBlocked,
      }]
    }
    const branchLabels = dependency.any
      .map(child => formatDependencyExpressionLines(child, projectNames, labels, completedProjects, runtimeProjectIds)
        .map(line => `${line.label}: ${line.value}`)
        .join(' + '))
      .filter(label => label.length > 0)
    if (branchLabels.length === 0) return []
    return [{
      label: labels.depends,
      value: `${labels.anyOf}${branchLabels.join(' | ')}`,
      blocked: dependency.any.length > 0 && dependency.any.every(child => {
        const lines = formatDependencyExpressionLines(child, projectNames, labels, completedProjects, runtimeProjectIds)
        return lines.length > 0 && lines.every(l => l.blocked)
      }),
    }]
  }
  if ('completed' in dependency) {
    if (runtimeProjectIds && !runtimeProjectIds.has(dependency.completed)) return []
    return [{
      label: labels.depends,
      value: projectDisplayName(dependency.completed, projectNames),
      blocked: (completedProjects.get(dependency.completed) ?? 0) <= 0,
    }]
  }
  if ('notCompleted' in dependency) {
    if (runtimeProjectIds && !runtimeProjectIds.has(dependency.notCompleted)) return []
    return [{
      label: labels.mutuallyExclusive,
      value: projectDisplayName(dependency.notCompleted, projectNames),
      blocked: (completedProjects.get(dependency.notCompleted) ?? 0) > 0,
    }]
  }
  if ('groupCompleted' in dependency) return []
  if ('groupNotCompleted' in dependency) return []
  return []
}

function formatPredecessorDependencyLines(
  predecessors: TaskNode['predecessors'],
  projectNames: Map<string, string>,
  labels: { depends: string; anyOf: string },
  completedProjects: Map<string, number>,
): TerraformingDependencyLineModel[] {
  const projectPreds = predecessors.filter(pred => pred.type === 'project')
  if (projectPreds.length === 0) return []

  const anyPreds = projectPreds.filter(pred => pred.any)
  const allPreds = projectPreds.filter(pred => !pred.any)
  const lines: TerraformingDependencyLineModel[] = []

  if (anyPreds.length > 0) {
    const anyBlocked = anyPreds.every(pred => (completedProjects.get(pred.ref) ?? 0) <= 0)
    lines.push({
      label: labels.depends,
      value: `${labels.anyOf}${anyPreds.map(pred => projectDisplayName(pred.ref, projectNames)).join(' | ')}`,
      blocked: anyBlocked,
    })
  }

  for (const pred of allPreds) {
    lines.push({
      label: labels.depends,
      value: projectDisplayName(pred.ref, projectNames),
      blocked: (completedProjects.get(pred.ref) ?? 0) <= 0,
    })
  }

  return lines
}

function isRepeatable(project: TerraformingProject | undefined): boolean {
  return (project?.repeatCooldown ?? null) !== null
}

function isStatInRuntime(stats: Record<string, number>, statId: string): boolean {
  return statId in stats
}

export function useTerraformingPresenter(store: TerraformingPresenterStore): UseTerraformingPresenterReturn {
  const vI18nLookup: I18nLookup = (key: string) => (i18n.global.t(key) as string) || ''
  const isQueueEditing = ref(false)
  const dragTaskId = ref('')
  const dragTaskName = ref('')
  const isDraggingTask = computed(() => dragTaskId.value !== '')
  const draftExecutionLog = ref<TerraformingDraftExecutionEntry[]>([])
  const committedEventCounts = ref<Map<string, number>>(new Map())
  const draftSequence = ref(0)
  const activeGoalFilterIds = ref<Set<string>>(new Set())
  const taskLogMode = ref<'queue' | 'executed'>('queue')

	  const hqArchiveStation = computed(() => store.terraformingHqArchiveStation.value)
	  const replayBaseState = computed(() => store.terraformingArchiveRuntimeBaseState.value ?? undefined)
	  const activeRuntimeProjectId = computed(() => {
	    const active = store.terraformingArchiveRuntimeBaseState.value?.activeProject
	    if (!active || active.aborted === true) return null
	    return active.projectId
	  })
	  const committedReplayLog = computed(() => store.terraformingDeductedExecution.value.remainingLog
	    .filter(entry => entry.projectId !== activeRuntimeProjectId.value))

  const hasHqStation = computed(() => hqArchiveStation.value !== null)

  const hqStationName = computed(() => store.terraformingHqStationName.value || '')
  const stationCode = computed(() => hqArchiveStation.value?.code || '')
  const sectorName = computed(() => hqArchiveStation.value?.sector?.name || '')
  const sectorNameId = computed(() => hqArchiveStation.value?.sector?.nameId)
  const position = computed(() => hqArchiveStation.value?.position)
  const sectorResources = computed(() => hqArchiveStation.value?.sector?.resources || [])
  const sectorSunlight = computed(() => hqArchiveStation.value?.sector?.sunlight ?? 100)
  const singleBerthThroughput = computed(() => 930000)

  const clusters = computed<TerraformingCluster[]>(() => {
    return store.terraformingData.value?.clusters || []
  })

  const selectedClusterId = computed<string | null>(() => {
    return store.terraformingSelectedClusterId.value
  })

  function nextDraftId(): string {
    draftSequence.value += 1
    return `draft-${draftSequence.value}`
  }

  const clusterDisplayNames = computed<Map<string, string>>(() => {
    const map = new Map<string, string>()
    for (const cluster of clusters.value) {
      const mappedMacro = stripMacroPrefix(cluster.macro)
      const mapCluster = store.mapsClusters[mappedMacro]
      if (mapCluster) {
        const nameKey = mapCluster.nameId
        const translated = vI18nLookup(nameKey)
        map.set(cluster.id, translated || mapCluster.name || cluster.id)
      } else {
        map.set(cluster.id, cluster.id)
      }
    }
    return map
  })

  const clusterMatchesHq = computed<Record<string, boolean>>(() => {
    const hqClusterId = store.terraformingHqClusterId.value
    const result: Record<string, boolean> = {}
    if (!hqClusterId) {
      for (const c of clusters.value) {
        result[c.id] = false
      }
      return result
    }
    for (const c of clusters.value) {
      result[c.id] = stripMacroPrefix(c.macro) === hqClusterId
    }
    return result
  })

  const objectivesProgress = computed(() => {
    const cluster = store.terraformingSelectedCluster.value
    if (!cluster || !cluster.objectives) return []
    const data = store.terraformingData.value
    const currentStats = effectiveCurrentStats.value
    const completedProjects = effectiveCompletedProjects.value
    const hqClusterId = store.terraformingHqClusterId.value
    const hqArchive = store.terraformingHqArchiveStation.value
    const housingTarget = extractHousingTarget(cluster, cluster.objectives)

    return cluster.objectives.map(obj => {
      let completed = false
      let neutralizeScale: TerraformingConditionScaleModel | undefined

      switch (obj.action) {
        case 'objective.relocate':
          if (hqClusterId !== null && stripMacroPrefix(cluster.macro) === hqClusterId) {
            if (obj.relocateTarget === 'sector' && hqArchive) {
              const targetNameId = obj.textReplaces
                ?.find(r => r.from === '$LOCATION$')?.to
              const hqSectorNameId = hqArchive.sector?.nameId
              completed = targetNameId !== undefined && hqSectorNameId !== undefined
                && targetNameId === hqSectorNameId
            } else {
              completed = true
            }
          }
          break
        case 'objective.neutralize': {
          const statIdMatch = obj.textId.match(/^terraforming\.stat\.(\w+)\.name$/)
          if (statIdMatch && data) {
            const sid = statIdMatch[1]!
            completed = isStatNeutralized(sid, currentStats[sid] ?? 0, data.stats)
            neutralizeScale = buildNeutralizeScaleModel(sid, data, currentStats, vI18nLookup) ?? undefined
          }
          break
        }
        case 'objective.build_project': {
          const textId = obj.textId
          const projMatch = textId.match(/^terraforming\.project\.(\w+)\.name$/)
          if (projMatch) {
            completed = (completedProjects.get(projMatch[1]!) ?? 0) > 0
          }
          break
        }
        case 'objective.build_housing':
          if (housingTarget !== null) {
            completed = (currentStats.population ?? 0) >= housingTarget
          }
          break
      }

      const td = data!
      let text = resolveTerraformingText(obj.textId, td, vI18nLookup)
      if (obj.textReplaces) {
        text = resolveWithReplaces(text, obj.textReplaces, td, vI18nLookup)
      }
      text = text.replace(/\b\d{4,}\b/g, (m) => parseInt(m, 10).toLocaleString())

      return {
        step: obj.step,
        action: obj.action,
        text,
        completed,
        neutralizeScale
      }
    })
  })

  const _FACTION_NAMEIDS: Record<string, string> = {}

  function _loadFactionNameIds() {
    if (Object.keys(_FACTION_NAMEIDS).length > 0) return
    const gameData = useGameDataStore()
    for (const f of gameData.factions) {
      if (f.id && f.nameId) _FACTION_NAMEIDS[f.id] = f.nameId
    }
  }

  function _factionDisplayName(factionId: string): string {
    _loadFactionNameIds()
    const nameId = _FACTION_NAMEIDS[factionId]
    return nameId ? (vI18nLookup(nameId) || factionId) : factionId
  }

  const clusterRewardDisplays = computed<TerraformingRewardDisplayItem[]>(() => {
    const rewards: TerraformingRewardDisplayItem[] = []
    const td = store.terraformingData.value
    const cid = selectedClusterId.value
    if (!td || !cid) return rewards
    const cluster = td.clusters.find(c => c.id === cid)
    if (!cluster) return rewards

    const milestoneLabel = (m: number | string, label: string) => {
      if (m === 'complete') return vI18nLookup('terraforming.milestone.complete') || '完成'
      return vI18nLookup(`terraforming.milestone.${label}`) || label || `M${m}`
    }

    const gameData = useGameDataStore()

    for (const fr of cluster.factionRewards ?? []) {
      const factionName = _factionDisplayName(fr.faction)
      const label = milestoneLabel(fr.milestone, fr.conditionLabel)
      if (fr.type === 'unlock') {
        rewards.push({ milestone: label, text: `${factionName} ${vI18nLookup('terraforming.reward.factionUnlock')}` })
      } else {
        const sign = (fr.value ?? 0) >= 0 ? '+' : ''
        rewards.push({ milestone: label, text: `${factionName} ${vI18nLookup('terraforming.reward.factionAdd') || 'rep'} ${sign}${fr.value}` })
      }
    }

    for (const r of cluster.rewards ?? []) {
      const label = milestoneLabel(r.milestone, 'mission_complete')
      if (r.type === 'blueprint' && r.id) {
        const mod = gameData.modulesMap[r.id] as X4Module | undefined
        const bpName = mod ? useX4I18n().translateModule(mod) : r.id
        rewards.push({ milestone: label, text: `${vI18nLookup('terraforming.reward.blueprint') || 'BP'}: ${bpName}` })
      } else if (r.type === 'npc' && r.nameId) {
        const npcName = vI18nLookup(r.nameId)
        rewards.push({ milestone: label, text: `${npcName} ${vI18nLookup('terraforming.reward.npcJoin')}` })
      }
    }

    return rewards
  })

  function buildRuntimeClusterForReplay(
    cluster: TerraformingCluster,
    data: TerraformingData,
  ): { runtimeCluster: TerraformingCluster; clusterProjects: TerraformingProject[] } {
    const runtimeProjectIds = getRuntimeTerraformingProjectIds(cluster)
    const runtimeCluster: TerraformingCluster = {
      ...cluster,
      projectIds: runtimeProjectIds,
    }
    const pidSet = new Set(runtimeProjectIds)
    return {
      runtimeCluster,
      clusterProjects: data.projects.filter(project => pidSet.has(project.id)),
    }
  }

  function extractCompletedLeavesFromDependency(
    dependency: TerraformingProjectDependency | undefined,
  ): string[] {
    if (!dependency) return []
    if ('all' in dependency) {
      return dependency.all.flatMap(child => extractCompletedLeavesFromDependency(child))
    }
    if ('any' in dependency) {
      const isLeaf = (dep: TerraformingProjectDependency): boolean => 'completed' in dep || 'notCompleted' in dep
      if (dependency.any.every(isLeaf) && dependency.any.some(d => 'notCompleted' in d)) {
        return dependency.any.filter(d => 'completed' in d).flatMap(d => 'completed' in d ? [d.completed] : [])
      }
      return dependency.any.flatMap(child => extractCompletedLeavesFromDependency(child))
    }
    if ('completed' in dependency) return [dependency.completed]
    return []
  }


  function checkStatConditionMet(
    condition: StatCondition,
    cumulativeStats: Record<string, number>,
    statDefs: TerraformingStat[],
  ): boolean {
    const currentVal = cumulativeStats[condition.stat]
    if (currentVal === undefined) return false
    const statDef = statDefs.find(s => s.id === condition.stat)
    if (!statDef) return false
    if (condition.usesValueBounds || condition.minvalue !== undefined || condition.maxvalue !== undefined) {
      if (condition.minvalue !== undefined && currentVal < condition.minvalue) return false
      if (condition.maxvalue !== undefined && currentVal > condition.maxvalue) return false
      return true
    }
    if (condition.usesStateBounds) {
      const currentRange = getCurrentRange(statDef, currentVal)
      const currentState = currentRange?.state ?? 0
      if (condition.min !== undefined && currentState < condition.min) return false
      if (condition.max !== undefined && currentState > condition.max) return false
      return true
    }
    const currentRange = getCurrentRange(statDef, currentVal)
    const currentState = currentRange?.state ?? 0
    if (condition.min !== undefined && currentState < condition.min) return false
    if (condition.max !== undefined && currentState > condition.max) return false
    return true
  }



  function checkAllConditions(
    conditions: StatCondition[],
    stats: Record<string, number>,
    statDefs: TerraformingStat[],
  ): boolean {
    return conditions.every(c => checkStatConditionMet(c, stats, statDefs))
  }


  function generateGoalEntries(
    draftEntries: TerraformingDraftExecutionEntry[],
    cluster: TerraformingCluster,
    data: TerraformingData,
    pmap: Map<string, TerraformingProject>,
    projectNames: Map<string, string>,
    statNames: Map<string, string>,
    engineGoals: GoalEntry[],
    replayResult: TerraformingReplayResult,
  ): TerraformingGoalEntry[] {
    let goalSeq = 0
    const nextGoalId = () => `goal-${++goalSeq}`

    const goals: TerraformingGoalEntry[] = []
    for (const eg of engineGoals) {
      let position = draftEntries.length
      let minIdx = Infinity
      for (const depId of eg.dependentTaskIds) {
        const idx = draftEntries.findIndex(e => e.projectId === depId)
        if (idx >= 0 && idx < minIdx) minIdx = idx
      }
      if (minIdx < Infinity) position = minIdx

      if (eg.kind === 'stat') {
        goals.push({
          id: nextGoalId(), kind: 'stat',
          label: eg.statGoal ? (statNames.get(eg.statGoal.statId) || eg.statGoal.statId) : '',
          targetProjectId: null, targetStatId: eg.statGoal?.statId ?? null,
          targetStatConditionIndex: eg.statGoal?.targetStatConditionIndex,
          position, satisfied: false, hasRisk: false,
          dependentTaskIds: eg.dependentTaskIds.map(id => draftEntries.find(e => e.projectId === id)?.id ?? id),
          hasExistingTask: false,
        })
      } else if (eg.kind === 'project') {
        const tid = eg.projectGoal?.targetProjectId ?? ''
        const draftTask = draftEntries.find(e => e.projectId === tid)
        goals.push({
          id: nextGoalId(), kind: 'project',
          label: projectNames.get(tid) || tid,
          targetProjectId: tid, targetStatId: null,
          position, satisfied: false, hasRisk: false,
          dependentTaskIds: eg.dependentTaskIds.map(id => draftEntries.find(e => e.projectId === id)?.id ?? id),
          hasExistingTask: !!draftTask, existingDraftEntryId: draftTask?.id,
        })
      }
    }

    // Cluster goals from objectives
    if (cluster.objectives) {
      const housingTarget = extractHousingTarget(cluster, cluster.objectives)
      const finalStats = replayResult.finalStats
      const finalCompleted = replayResult.finalCompleted
      for (let oi = 0; oi < cluster.objectives.length; oi++) {
        const obj = cluster.objectives[oi]!
        let satisfied = false
        let label = ''
        let targetProjectId: string | null = null
        let targetStatId: string | null = null

        if (obj.action === 'objective.build_project') {
          const projMatch = obj.textId.match(/^terraforming\.project\.(\w+)\.name$/)
          if (projMatch) {
            satisfied = (finalCompleted.get(projMatch[1]!) ?? 0) > 0
            targetProjectId = projMatch[1]!
            const project = pmap.get(targetProjectId)
            label = project ? (projectNames.get(targetProjectId) || project.name || targetProjectId) : obj.textId
          } else { satisfied = true; continue }
        } else if (obj.action === 'objective.build_housing') {
          if (housingTarget !== null) {
            satisfied = (finalStats.population ?? 0) >= housingTarget
            targetStatId = 'population'
            label = resolveTerraformingText(obj.textId, data, vI18nLookup)
            if (obj.textReplaces) label = resolveWithReplaces(label, obj.textReplaces, data, vI18nLookup)
            label = label.replace(/\b\d{4,}\b/g, (m: string) => parseInt(m, 10).toLocaleString())
          } else { satisfied = true; continue }
        } else { satisfied = true; continue }

        if (!satisfied) {
          goals.push({
            id: nextGoalId(), kind: 'cluster', label: label || obj.textId,
            targetProjectId, targetStatId, position: draftEntries.length,
            satisfied: false, hasRisk: false, dependentTaskIds: [], hasExistingTask: false,
          })
        }
      }
    }

    // Preventive goals
    const endStats = replayResult.finalStats
    const nonStatRepeatableEvents = data.projects.filter(
      p => p.group === 'events' && p.effects.length === 0 && p.repeatCooldown !== null
    )
    for (const event of nonStatRepeatableEvents) {
      if (!checkAllConditions(event.conditions, endStats, data.stats)) continue
      const eventName = projectNames.get(event.id) || event.name || event.id
      goals.push({
        id: nextGoalId(), kind: 'preventive', label: eventName,
        targetProjectId: null, targetStatId: 'seismicactivity',
        position: -1, satisfied: false, hasRisk: true,
        riskReason: undefined, dependentTaskIds: [], hasExistingTask: false,
        relatedEventId: event.id,
      })
    }

    goals.sort((a, b) => a.position - b.position)
    return goals
  }

  function computePlanDraftEntries(): {
    replayEntries: TerraformingDraftTimelineEntry[]
    goals: TerraformingGoalEntry[]
    cumulativeStateAt: Array<{ stats: Record<string, number> }>
  } {
    const data = store.terraformingData.value
    const cluster = store.terraformingSelectedCluster.value
    if (!data || !cluster) return { replayEntries: [] as TerraformingDraftTimelineEntry[], goals: [], cumulativeStateAt: [] }

    const log = draftExecutionLog.value.map(e => ({ projectId: e.projectId }))
    const result = replayExecutionLog(log, cluster, data, {
      mode: 'draft',
      flags: { evaluations: true, stepSnapshots: true, goals: true },
      baseState: replayBaseState.value,
    })

    const pmap = projectMap.value
    const projectNames = projectDisplayNames.value
    const translatedGroupNames = groupNames.value

    const entries: TerraformingDraftTimelineEntry[] = []
    let orderSeq = 0

    for (let i = 0; i < result.steps.length; i++) {
      const step = result.steps[i]!
      const project = pmap.get(step.projectId)
      const draftEntry = draftExecutionLog.value.find(e => e.projectId === step.projectId)
      const entryId = draftEntry?.id ?? step.projectId

      const beforeStats = step.statsBefore ?? {}
      const afterStatsObj = step.statsAfter ?? {}
      const statLines = (project ? getProjectSnapshotStatIds(project) : [])
        .filter(statId => statId in beforeStats)
        .map(statId => ({
          statId, statName: (statDisplayNames.value.get(statId) || statId),
          beforeValue: beforeStats[statId] ?? 0, afterValue: afterStatsObj[statId] ?? 0,
        }))
        .filter(snapshot => snapshot.beforeValue !== snapshot.afterValue)
        .map(snapshot => buildTimelineStatLineModel(snapshot, data))
        .filter((model): model is TerraformingStatLineModel => model !== null)

      let repeatRole: TerraformingDraftRepeatRole = 'single'
      if (isRepeatable(project)) {
        const prevTask = entries.filter(e => !e.isEvent).pop()
        repeatRole = prevTask?.projectId === step.projectId ? 'duplicate' : 'first'
      }

      const cumulativeRebatesRaw = step.cumulativeRebatesAfter ?? []
      const { discountedWares: entryDw, discountAmount: entryDiscAmt } = computeProjectDiscount(
        project?.resources, cumulativeRebatesRaw,
        store.wareGroupMap, store.wareNames, useGameDataStore().waresMap,
      )

      const runtimePidSet = new Set(getRuntimeTerraformingProjectIds(cluster))

      entries.push({
        id: entryId, order: ++orderSeq, projectId: step.projectId,
        projectName: projectNames.get(step.projectId) || project?.name || step.projectId,
        projectGroupName: translatedGroupNames.get(project?.group || '') || project?.group || '',
        systemDisabled: !step.valid, systemDisabledReason: step.evaluation?.reasons?.join('; '),
        mutuallyExclusiveWith: draftEntry?.mutuallyExclusiveWith,
        repeatRole,
        reasons: step.evaluation ? translateEvaluationReasons(step.evaluation.reasons, data, vI18nLookup) : [],
        dependencies: formatDependencyExpression(project?.dependencies, projectNames, {
          mutuallyExclusive: vI18nLookup('terraforming.mutuallyExclusive') || 'Mutually exclusive',
          notCompletedBranch: vI18nLookup('terraforming.branch.notCompleted') || 'not ',
          completedBranch: vI18nLookup('terraforming.branch.completed') || '',
          or: vI18nLookup('terraforming.or') || ' or ',
        }, runtimePidSet),
        statLines, price: project?.resources?.price ?? 0,
        wares: (project?.resources?.wares || []).map(w => ({
          name: store.wareNames.value.get(w.ware) || w.ware, amount: w.actualAmount ?? w.amount,
        })),
        discountAmount: entryDiscAmt, discountedWares: entryDw,
        isEvent: step.type === 'auto-event', source: draftEntry?.source ?? 'draft',
      })
    }

    const cumulativeStateAt = result.steps
      .filter(s => s.type === 'task' && s.statsBefore)
      .map(s => ({ stats: s.statsBefore! }))

    const goals = generateGoalEntries(
      draftExecutionLog.value, cluster, data, pmap, projectNames, statDisplayNames.value,
      result.goalEntries, result,
    )

    return { replayEntries: entries, goals, cumulativeStateAt }
  }

  const combinedReplayResult = computed(() => {
    if (!isQueueEditing.value) return { replayEntries: [] as TerraformingDraftTimelineEntry[], goals: [] as TerraformingGoalEntry[], cumulativeStateAt: [] as Array<{ stats: Record<string, number> }> }
    return computePlanDraftEntries()
  })

  const draftReplayEntries = computed<TerraformingDraftTimelineEntry[]>(() => {
    return combinedReplayResult.value.replayEntries
  })

  const generatedGoals = computed<TerraformingGoalEntry[]>(() => {
    return combinedReplayResult.value.goals
  })

  const draftCompletedProjectCounts = computed<Map<string, number>>(() => {
    const counts = new Map<string, number>()
    for (const entry of draftReplayEntries.value) {
      if (entry.systemDisabled) continue
      counts.set(entry.projectId, (counts.get(entry.projectId) ?? 0) + 1)
    }
    return counts
  })

  const effectiveCompletedProjects = computed<Map<string, number>>(() => {
    const data = store.terraformingData.value
    const cluster = store.terraformingSelectedCluster.value
    if (!data || !cluster) return new Map()
    const log = isQueueEditing.value
      ? draftExecutionLog.value.filter(e => !e.systemDisabled).map(e => ({ projectId: e.projectId }))
      : committedReplayLog.value.map(e => ({ projectId: e.projectId }))
    return replayExecutionLog(log, cluster, data, {
      mode: isQueueEditing.value ? 'draft' : 'committed',
      baseState: replayBaseState.value,
    }).finalCompleted
  })

  const effectiveCurrentStats = computed<Record<string, number>>(() => {
    const data = store.terraformingData.value
    const cluster = store.terraformingSelectedCluster.value
    if (!data || !cluster) return {}
    const log = isQueueEditing.value
      ? draftExecutionLog.value.filter(e => !e.systemDisabled).map(e => ({ projectId: e.projectId }))
      : committedReplayLog.value.map(e => ({ projectId: e.projectId }))
    return replayExecutionLog(log, cluster, data, {
      mode: isQueueEditing.value ? 'draft' : 'committed',
      baseState: replayBaseState.value,
    }).finalStats
  })

  const taskTree = computed<TaskTree | null>(() => {
    const data = store.terraformingData.value
    const cluster = store.terraformingSelectedCluster.value
    if (!data || !cluster) return null
    const completedProjects = effectiveCompletedProjects.value
    const stats = effectiveCurrentStats.value
    const runtimeProjectIds = getRuntimeTerraformingProjectIds(cluster)
    const runtimeCluster: TerraformingCluster = {
      ...cluster,
      projectIds: runtimeProjectIds,
    }
    const state: TerraformingState = {
      stats,
      completedProjects,
    }
    return resolveAvailableTasks(runtimeCluster, state, data)
  })

  const groupNames = computed<Map<string, string>>(() => {
    const data = store.terraformingData.value
    const map = new Map<string, string>()
    if (data) {
      for (const pg of data.projectGroups) {
        const nameKey = pg.nameId
        const translated = nameKey ? (vI18nLookup(nameKey) || pg.name || nameKey) : (pg.name || pg.id)
        map.set(pg.id, translated)
      }
    }
    return map
  })

  const completedProjectCounts = computed<Map<string, number>>(() => {
    return new Map(effectiveCompletedProjects.value)
  })

  const archiveCompletedProjectCounts = computed<Map<string, number>>(() => {
    return new Map(store.terraformingArchiveRuntimeBaseState.value?.completedProjects ?? [])
  })

  function getArchiveCompletedProjectCount(projectId: string): number {
    return archiveCompletedProjectCounts.value.get(projectId) ?? 0
  }

  const projectMap = computed<Map<string, TerraformingProject>>(() => {
    const data = store.terraformingData.value
    if (!data) return new Map()
    return new Map(data.projects.map(p => [p.id, p]))
  })

  const projectDisplayNames = computed<Map<string, string>>(() => {
    const data = store.terraformingData.value
    const map = new Map<string, string>()
    if (data) {
      for (const p of data.projects) {
        if (p.nameId) {
          map.set(p.id, resolveTerraformingText(p.nameId, data, vI18nLookup))
        } else {
          map.set(p.id, p.name || p.id)
        }
      }
    }
    return map
  })

  const currentQueueDisplayEntries = computed<TerraformingCurrentQueueDisplayEntry[]>(() => {
    const names = projectDisplayNames.value
    const active = store.terraformingArchiveRuntimeBaseState.value?.activeProject
    const activeProjectId = activeRuntimeProjectId.value
    const hasProgressIds = new Set<string>()
    if (active?.aborted === true) hasProgressIds.add(active.projectId)
    for (const retained of store.terraformingArchiveRuntimeBaseState.value?.retainedProjects ?? []) {
      hasProgressIds.add(retained.projectId)
    }

    const entries: TerraformingCurrentQueueDisplayEntry[] = []
    if (activeProjectId) {
      entries.push({
        id: `archive-active-${activeProjectId}`,
        projectId: activeProjectId,
        projectName: names.get(activeProjectId) || activeProjectId,
        status: 'pending',
        source: 'remaining-queue',
        runtimeStatus: 'active',
        fixedFirst: true,
      })
    }

    for (const entry of store.terraformingDeductedExecution.value.currentQueueDisplayEntries) {
      if (activeProjectId && entry.projectId === activeProjectId) continue
      entries.push({
        ...entry,
        projectName: names.get(entry.projectId) || entry.projectId,
        replayEntryId: entry.source === 'remaining-queue' ? entry.id : undefined,
        runtimeStatus: hasProgressIds.has(entry.projectId) ? 'has-progress' : undefined,
      })
    }

    return entries
  })

  const executedEntries = computed<TerraformingExecutedDisplayEntry[]>(() => {
    const names = projectDisplayNames.value
    const base = store.terraformingArchiveRuntimeBaseState.value
    if (!base) return []
    const entries: TerraformingExecutedDisplayEntry[] = []
    for (const [projectId, count] of base.completedProjects) {
      if (count <= 0) continue
      entries.push({
        id: `archive-project-${projectId}`,
        projectId,
        projectName: names.get(projectId) || projectId,
        kind: 'project',
        status: 'executed',
        count,
        source: 'archive-runtime',
      })
    }
    for (const [projectId, count] of base.completedEvents) {
      if (count <= 0) continue
      entries.push({
        id: `archive-event-${projectId}`,
        projectId,
        projectName: names.get(projectId) || projectId,
        kind: 'one-time-event',
        status: 'occurred',
        count,
        source: 'archive-runtime',
      })
    }
    return entries
  })

  const archiveSyncNotice = computed<TerraformingArchiveSyncNotice | null>(() => {
    const delta = store.terraformingExecutedDelta.value
    const deduced = store.terraformingDeductedExecution.value
    const deductedCount = deduced.deductedEntries.length
    const archiveOnlyCount = deduced.archiveOnlyEntries.reduce((sum, entry) => sum + entry.count, 0)
    if (!delta.hasArchiveAdvance && !delta.hasArchiveRollbackRisk && !delta.hasRuntimeStateChange && deductedCount === 0 && archiveOnlyCount === 0) {
      return null
    }
    const message = delta.hasArchiveRollbackRisk
      ? (vI18nLookup('terraforming.archiveRollbackRisk') || 'Archive state may have rolled back')
      : delta.hasArchiveAdvance
        ? (vI18nLookup('terraforming.archiveAdvanceNotice') || 'Archive has executed terraforming entries')
        : (vI18nLookup('terraforming.archiveRuntimeChanged') || 'Archive runtime changed')
    return {
      deductedCount,
      archiveOnlyCount,
      hasArchiveAdvance: delta.hasArchiveAdvance,
      hasArchiveRollbackRisk: delta.hasArchiveRollbackRisk,
      hasRuntimeStateChange: delta.hasRuntimeStateChange,
      message,
    }
  })

  function buildArchiveProjectDisplay(
    projectId: string,
    status: TerraformingArchiveProjectDisplay['status'],
    progress: {
      scaledResources: Array<{ ware: string; amount: number }>
      submittedResources: Array<{ ware: string; amount: number }>
      inTransitResources?: Array<{ ware: string; amount: number }>
      inTransitShipBatches?: number
    },
  ): TerraformingArchiveProjectDisplay {
    const submitted = new Map(progress.submittedResources.map(item => [item.ware, item.amount]))
    const inTransit = new Map((progress.inTransitResources ?? []).map(item => [item.ware, item.amount]))
    return {
      projectId,
      projectName: projectDisplayNames.value.get(projectId) || projectId,
      status,
      shipBatches: progress.inTransitShipBatches,
      resources: progress.scaledResources.map(item => ({
        ware: item.ware,
        wareName: store.wareNames.value.get(item.ware) || item.ware,
        scaled: item.amount,
        submitted: submitted.get(item.ware) ?? 0,
        inTransit: inTransit.get(item.ware) ?? 0,
      })),
    }
  }

  const archiveActiveProjectDisplay = computed<TerraformingArchiveProjectDisplay | null>(() => {
    const active = store.terraformingArchiveRuntimeBaseState.value?.activeProject
    if (!active) return null
    return buildArchiveProjectDisplay(active.projectId, active.aborted ? 'aborting' : 'active', active)
  })

  const archiveRetainedProjectDisplays = computed<TerraformingArchiveProjectDisplay[]>(() => {
    return (store.terraformingArchiveRuntimeBaseState.value?.retainedProjects ?? [])
      .map(project => buildArchiveProjectDisplay(project.projectId, 'retained', project))
  })

  const taskNodeDisplays = computed<Map<string, TerraformingTaskNodeDisplay>>(() => {
    const data = store.terraformingData.value
    const tree = taskTree.value
    const displays = new Map<string, TerraformingTaskNodeDisplay>()
    if (!data || !tree) return displays

    const statNames = statDisplayNames.value
    const projectNames = projectDisplayNames.value
    const runtimePidSet = new Set(store.terraformingRuntimeProjectIds.value)
    const uiLabels = {
      min: vI18nLookup('terraforming.min') || 'min',
      max: vI18nLookup('terraforming.max') || 'max',
      depends: vI18nLookup('terraforming.depends') || 'Depends',
      current: vI18nLookup('terraforming.current') || 'current',
      anyOf: vI18nLookup('terraforming.anyOf') || 'Any ',
      setback: vI18nLookup('terraforming.setback') || 'setback',
      sideEffectChance: vI18nLookup('terraforming.sideEffect.chance') || 'chance',
      mutuallyExclusive: vI18nLookup('terraforming.mutuallyExclusive') || 'Mutually exclusive',
      notCompletedBranch: vI18nLookup('terraforming.branch.notCompleted') || 'not ',
      completedBranch: vI18nLookup('terraforming.branch.completed') || '',
      or: vI18nLookup('terraforming.or') || ' or ',
    }

    const visit = (node: TaskNode) => {
      const project = data.projects.find(item => item.id === node.id)
      if (!project) return
      const blockedReasonLines = translateBlockedReasonLines(node.blockedReason, data, projectNames, statNames, {
        depends: uiLabels.depends,
        current: uiLabels.current,
        anyOf: uiLabels.anyOf,
      })
      const completedMap = effectiveCompletedProjects.value
      displays.set(node.id, {
        name: projectNames.get(node.id) || node.name,
        effects: translateTaskEffects(node.effects, statNames, { min: uiLabels.min, max: uiLabels.max }),
        blockedReasonLines,
        dependencyLines: [
          ...formatPredecessorDependencyLines(node.predecessors, projectNames, {
            depends: uiLabels.depends,
            anyOf: uiLabels.anyOf,
          }, completedMap),
          ...formatDependencyExpressionLines(project.dependencies, projectNames, {
            depends: uiLabels.depends,
            anyOf: uiLabels.anyOf,
            mutuallyExclusive: uiLabels.mutuallyExclusive,
            notCompletedBranch: uiLabels.notCompletedBranch,
            completedBranch: uiLabels.completedBranch,
            or: uiLabels.or,
          }, completedMap, runtimePidSet),
        ],
        statLines: buildTaskStatLineModels(
          project,
          data,
          effectiveCurrentStats.value,
          effectiveCompletedProjects.value.get(node.id) ?? 0,
          vI18nLookup,
          { min: uiLabels.min, max: uiLabels.max },
        ),
        effectItems: buildEffectItems(
          node.id,
          statNames,
          data,
          projectNames,
          store.wareNames.value,
          store.moduleGroupNames.value,
          { min: uiLabels.min, max: uiLabels.max, setback: uiLabels.setback, chance: uiLabels.sideEffectChance },
          vI18nLookup,
        ),
      })
      for (const child of node.children) visit(child)
    }

    for (const nodes of tree.groups.values()) {
      for (const node of nodes) visit(node)
    }

    return displays
  })

  const activeRebates = computed<string[]>(() => {
    const data = store.terraformingData.value
    const completed = effectiveCompletedProjects.value
    if (!data) return []
    const wareNames = store.wareNames.value
    const moduleGroupNames = store.moduleGroupNames.value
    const aggregated: Record<string, number> = {}
    for (const [projectId, count] of completed) {
      if (count <= 0) continue
      const project = data.projects.find(p => p.id === projectId)
      if (!project?.rebates) continue
      for (const rb of project.rebates) {
        let name = ''
        if (rb.wareGroup) {
          name = moduleGroupNames.get(rb.wareGroup) || rb.wareGroup
        } else if (rb.ware) {
          name = wareNames.get(rb.ware) || rb.ware
        }
        if (!name) continue
        aggregated[name] = (aggregated[name] ?? 0) + rb.value
      }
    }
    return Object.entries(aggregated)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, value]) => `${name} ${value}%`)
  })

  const statDisplayNames = computed<Map<string, string>>(() => {
    const data = store.terraformingData.value
    const map = new Map<string, string>()
    if (data) {
      for (const s of data.stats) {
        if (s.nameId) {
          map.set(s.id, resolveTerraformingText(s.nameId, data, vI18nLookup))
        } else {
          map.set(s.id, s.name || s.id)
        }
      }
    }
    return map
  })

  const statScaleModels = computed<Map<string, TerraformingStatScaleModel>>(() => {
    const data = store.terraformingData.value
    const currentStats = effectiveCurrentStats.value
    const map = new Map<string, TerraformingStatScaleModel>()
    if (!data) return map

    for (const stat of data.stats) {
      if (!isStatInRuntime(currentStats, stat.id)) continue
      const currentValue = currentStats[stat.id] ?? 0
      const currentRange = getCurrentRange(stat, currentValue)
      map.set(stat.id, {
        statId: stat.id,
        statName: getStatName(stat.id, data, vI18nLookup),
        currentValue,
        currentState: currentRange?.state ?? null,
        ranges: toScaleRanges(stat),
      })
    }

    return map
  })

  // @ts-ignore: kept as backup — conditionScaleModels was migrated from taskList to sectorPanel (via statScaleModels)
  const conditionScaleModels = computed<Map<string, TerraformingConditionScaleModel[]>>(() => {
    const data = store.terraformingData.value
    const cluster = store.terraformingSelectedCluster.value
    const currentStats = effectiveCurrentStats.value
    const map = new Map<string, TerraformingConditionScaleModel[]>()
    if (!data || !cluster) return map

    for (const projectId of store.terraformingRuntimeProjectIds.value) {
      const project = data.projects.find(item => item.id === projectId)
      if (!project?.conditions?.length) continue

      const models = project.conditions
        .map(condition => buildConditionScaleModel(condition, data, currentStats, vI18nLookup))
        .filter((model): model is TerraformingConditionScaleModel => model !== null)

      if (models.length > 0) map.set(projectId, models)
    }

    return map
  })

  const executionTimeline = computed<TerraformingExecutionTimelineEntry[]>(() => {
    const data = store.terraformingData.value
    const cluster = store.terraformingSelectedCluster.value
    if (!data || !cluster) return []

    const log = committedReplayLog.value
    if (log.length === 0) return []

    const result = replayExecutionLog(log.map(e => ({ projectId: e.projectId })), cluster, data, {
      flags: { evaluations: true, stepSnapshots: true },
      baseState: replayBaseState.value,
    })

    const translatedGroupNames = groupNames.value
    const translatedProjectNames = projectDisplayNames.value
    const translatedStatNames = statDisplayNames.value
    const results: TerraformingExecutionTimelineEntry[] = []
    const logEntriesByProject = new Map<string, TerraformingExecutionEntry[]>()
    for (const entry of log) {
      const entries = logEntriesByProject.get(entry.projectId)
      if (entries) {
        entries.push(entry)
      } else {
        logEntriesByProject.set(entry.projectId, [entry])
      }
    }
    let previousGroupId: string | null = null
    let order = 0

    for (const step of result.steps) {
      const project = projectMap.value.get(step.projectId)
      const projectName = translatedProjectNames.get(step.projectId) || project?.name || step.projectId
      const projectGroupId = project?.group || 'unknown'
      const projectGroupName = translatedGroupNames.get(projectGroupId) || projectGroupId

      const beforeStats = step.statsBefore ?? {}
      const afterStatsObj = step.statsAfter ?? {}
      const beforeStatsList: TerraformingTimelineStatSnapshot[] = []
      for (const statId of Object.keys(beforeStats)) {
        const bv = beforeStats[statId] ?? 0
        const av = afterStatsObj[statId] ?? 0
        if (bv !== av) {
          beforeStatsList.push({ statId, statName: translatedStatNames.get(statId) || statId, beforeValue: bv, afterValue: av })
        }
      }
      const statLines = beforeStatsList
        .map(snapshot => buildTimelineStatLineModel(snapshot, data))
        .filter((model): model is TerraformingStatLineModel => model !== null)

      const cumulativeRebatesRaw = step.cumulativeRebatesAfter ?? []
      const cumulativeRebateEntries = cumulativeRebatesRaw.map(rb => ({
        name: resolveRebateName(rb.id, rb.type, store.moduleGroupNames.value, store.wareNames.value),
        value: rb.value,
      }))

      const rebateChanges = (step.rebateChanges ?? []).map(rc => ({
        name: resolveRebateName(rc.key.id, rc.key.type, store.moduleGroupNames.value, store.wareNames.value),
        before: rc.before,
        after: rc.after,
      }))

      const projectRebates = project?.rebates?.map(rb => {
        const name = resolveRebateName(rb.wareGroup ?? rb.ware ?? '', rb.wareGroup ? 'wareGroup' : 'ware', store.moduleGroupNames.value, store.wareNames.value)
        return name ? { name, value: rb.value } : null
      }).filter((r): r is { name: string; value: number } => r !== null) || []

      const { discountedWares: discountedWaresData, discountAmount: discountAmountVal } = computeProjectDiscount(
        project?.resources,
        cumulativeRebatesRaw,
        store.wareGroupMap,
        store.wareNames,
        useGameDataStore().waresMap,
      )

      const logEntry = logEntriesByProject.get(step.projectId)?.shift()

      results.push({
        id: logEntry?.id ?? step.projectId,
        order: ++order,
        projectId: step.projectId,
        projectName,
        projectGroupId,
        projectGroupName,
        showGroupMarker: projectGroupId !== previousGroupId,
        wares: project?.resources?.wares?.map(w => ({ ware: w.ware, amount: w.amount, actualAmount: w.actualAmount })) || [],
        deliveries: (project?.deliveries || []).map(d => ({ macro: d.macro, amount: d.amount })),
        deliveryDetails: (() => {
          const allDeliveries = (project?.deliveries || []).map(d => {
            const ds = deliveryShipMap.value.get(d.macro)
            const bd = ds?.buildDuration ?? 0
            const shipName = ds && ds.nameId ? (vI18nLookup(ds.nameId) || ds.name || d.macro) : (ds?.name || d.macro)
            return { macro: d.macro, amount: d.amount, shipName, buildDuration: bd, totalTime: d.amount * bd }
          })
          const slots = hqBuildDocks.value?.totalSlots ?? 0
          if (slots > 0) {
            const totalWork = allDeliveries.reduce((s, d) => s + d.totalTime, 0)
            for (const dd of allDeliveries) dd.totalTime = Math.ceil(totalWork / slots)
          } else {
            for (const dd of allDeliveries) dd.totalTime = 0
          }
          return allDeliveries
        })(),
        dockModules: hqDockModules.value,
        totalSlots: hqBuildDocks.value?.totalSlots ?? 0,
        price: project?.resources?.price || 0,
        projectRebates,
        rebateChanges,
        cumulativeRebates: cumulativeRebateEntries,
        discountedWares: discountedWaresData,
        discountAmount: discountAmountVal,
        statLines,
        beforeStats: beforeStatsList,
        afterStats: beforeStatsList,
        availableBeforeExecution: step.valid,
        blockedReason: step.evaluation?.reasons?.join('; ') || null,
        projectDuration: project?.duration ?? 0,
      })

      previousGroupId = projectGroupId
    }

    return results
  })

  const getExecutionCancelValidation = (entryId: string): TerraformingCancelValidation => {
    const data = store.terraformingData.value
    const cluster = store.terraformingSelectedCluster.value
    if (!data || !cluster) {
      return {
        canCancel: false,
        affectedEntryIds: [],
        reasons: [vI18nLookup('terraforming.projectUnavailableAfterCancel') || 'Unavailable after cancel'],
      }
    }

    const log = committedReplayLog.value
    const targetIndex = log.findIndex(entry => entry.id === entryId)
    if (targetIndex < 0) {
      return {
        canCancel: false,
        affectedEntryIds: [],
        reasons: [vI18nLookup('terraforming.projectUnavailableAfterCancel') || 'Unavailable after cancel'],
      }
    }

    const translatedProjectNames = projectDisplayNames.value
    const projectMapForCancel = projectMap.value
    let removeEndExclusive = targetIndex + 1
    while (removeEndExclusive < log.length) {
      const project = projectMapForCancel.get(log[removeEndExclusive]!.projectId)
      if (project?.group !== 'events') break
      removeEndExclusive += 1
    }
    const remainingEntries = log.filter((_, index) => index < targetIndex || index >= removeEndExclusive)
    const affectedOriginalEntryIds = new Set(
      log.slice(removeEndExclusive)
        .filter(entry => projectMapForCancel.get(entry.projectId)?.group !== 'events')
        .map(entry => entry.id),
    )
    const remainingLog = remainingEntries.map(e => ({ projectId: e.projectId }))
    const result = replayExecutionLog(remainingLog, cluster, data, {
      flags: { evaluations: true, stepSnapshots: false },
      baseState: replayBaseState.value,
    })

    const affectedEntryIds: string[] = []
    const reasons: string[] = []
    const remainingEntriesByProject = new Map<string, TerraformingExecutionEntry[]>()
    for (const entry of remainingEntries) {
      const entries = remainingEntriesByProject.get(entry.projectId)
      if (entries) {
        entries.push(entry)
      } else {
        remainingEntriesByProject.set(entry.projectId, [entry])
      }
    }
    for (const step of result.steps) {
      if (step.type !== 'task') continue
      const candidates = remainingEntriesByProject.get(step.projectId)
      const logEntry = candidates?.shift()
      if (!logEntry || !affectedOriginalEntryIds.has(logEntry.id)) continue
      if (!step.valid) {
        affectedEntryIds.push(logEntry?.id ?? step.projectId)
        reasons.push(`${translatedProjectNames.get(step.projectId) || step.projectId}: ${step.evaluation ? translateEvaluationReasons(step.evaluation.reasons, data, vI18nLookup).join('; ') : (vI18nLookup('terraforming.projectBlockedAfterCancel') || 'Blocked after cancel')}`)
      }
    }

    return {
      canCancel: reasons.length === 0,
      affectedEntryIds,
      reasons,
    }
  }

  const deliveryShipMap = computed<Map<string, DeliveryShip>>(() => {
    const data = store.terraformingData.value
    const map = new Map<string, DeliveryShip>()
    if (data?.deliveryShips) {
      for (const ds of data.deliveryShips) map.set(ds.macro, ds)
    }
    return map
  })

  const BLUEPRINT_DOCK_MODULE_ID = 'module_gen_build_dockarea_m_01'

  const hqBuildDocks = computed<{ totalSlots: number } | null>(() => {
    const modules = store.terraformingHqEffectiveModules.value
    const gameData = useGameDataStore()
    const mm = gameData.modulesMap as Record<string, X4Module>
    if (!modules.length) {
      const mod = mm[BLUEPRINT_DOCK_MODULE_ID] as X4Module | undefined
      if (mod) return { totalSlots: 1 * mod.buildProcessorCount }
      return null
    }
    let totalSlots = 0
    for (const sm of modules) {
      const mod = mm[sm.id] as X4Module | undefined
      if (!mod?.buildShipClasses?.length) continue
      totalSlots += sm.count * mod.buildProcessorCount
    }
    return { totalSlots }
  })

  const hqDockModules = computed<Array<{ name: string; count: number; slots: number }>>(() => {
    const modules = store.terraformingHqEffectiveModules.value
    const gameData = useGameDataStore()
    const localizedMap = gameData.localizedModulesMap as Record<string, { localeName: string; name: string }>
    const mm = gameData.modulesMap as Record<string, X4Module>
    if (!modules.length) {
      const mod = mm[BLUEPRINT_DOCK_MODULE_ID] as X4Module | undefined
      if (mod) {
        return [{ name: localizedMap[BLUEPRINT_DOCK_MODULE_ID]!.localeName, count: 1, slots: 1 * mod.buildProcessorCount }]
      }
      return []
    }
    const result: Array<{ name: string; count: number; slots: number }> = []
    for (const sm of modules) {
      const mod = mm[sm.id] as X4Module | undefined
      if (!mod?.buildShipClasses?.length) continue
      const name = localizedMap[sm.id]?.localeName || mod.name || sm.id
      result.push({ name, count: sm.count, slots: sm.count * mod.buildProcessorCount })
    }
    return result
  })

  const goalDisplayEntries = computed<TerraformingGoalDisplayEntry[]>(() => {
    const goals = generatedGoals.value
    const activeFilter = activeGoalFilterIds.value
    const statModels = statGoalLineModels.value

    return goals.map(goal => {
      const statModel = (goal.kind === 'stat' || goal.kind === 'preventive') ? statModels.get(goal.id) : undefined
      return {
        id: goal.id,
        kind: goal.kind,
        label: goal.label,
        satisfied: goal.satisfied,
        hasRisk: goal.hasRisk,
        riskReason: goal.riskReason,
        isFilterActive: activeFilter.has(goal.id),
        statGoalModel: statModel,
        hasExistingTask: goal.hasExistingTask,
        existingDraftEntryId: goal.existingDraftEntryId,
      }
    })
  })

  const planDisplayEntries = computed<TerraformingGoalPlanDisplayEntry[]>(() => {
    const tasks = draftReplayEntries.value
    const goals = generatedGoals.value.map(g => ({ ...g }))
    const displayGoals = goalDisplayEntries.value
    const goalMap = new Map(displayGoals.map(g => [g.id, g]))

    // Remap stat and project goal positions to match draftReplayEntries
    for (const goal of goals) {
      if ((goal.kind === 'stat' || goal.kind === 'project') && goal.dependentTaskIds.length > 0) {
        let minPos = -1
        for (const depId of goal.dependentTaskIds) {
          const idx = tasks.findIndex(t => t.id === depId)
          if (idx !== -1 && (minPos === -1 || idx < minPos)) minPos = idx
        }
        if (minPos !== -1) goal.position = minPos
      }
    }

    const entries: TerraformingGoalPlanDisplayEntry[] = []

    // Preventive goals (position -1): always at the beginning
    for (const goal of goals) {
      if (goal.kind === 'preventive') {
        const display = goalMap.get(goal.id)
        if (display) entries.push({ type: 'goal', entry: display })
      }
    }

    // Tasks, events, stat goals, and project goals interleaved
    let goalIndex = 0
    const interleavedGoals = goals.filter(g => g.kind === 'stat' || g.kind === 'project')
    for (let ti = 0; ti < tasks.length; ti++) {
      while (goalIndex < interleavedGoals.length && interleavedGoals[goalIndex]!.position <= ti) {
        const goal = interleavedGoals[goalIndex]!
        const display = goalMap.get(goal.id)
        if (display) entries.push({ type: 'goal', entry: display })
        goalIndex++
      }
      const t = tasks[ti]!
      entries.push({ type: t.isEvent ? 'auto-event' : 'task', entry: t })
    }
    while (goalIndex < interleavedGoals.length) {
      const display = goalMap.get(interleavedGoals[goalIndex]!.id)
      if (display) entries.push({ type: 'goal', entry: display })
      goalIndex++
    }

    // Cluster goals at the end
    for (const goal of goals) {
      if (goal.kind === 'cluster') {
        const display = goalMap.get(goal.id)
        if (display) entries.push({ type: 'goal', entry: display })
      }
    }

    return entries
  })

  const goalCanSatisfyTaskIds = computed<Map<string, string[]>>(() => {
    const data = store.terraformingData.value
    const cluster = store.terraformingSelectedCluster.value
    const goals = generatedGoals.value
    const result = new Map<string, string[]>()

    if (!data || !cluster) return result

    const allProjects = data.projects
    for (const goal of goals) {
      const satisfiers: string[] = []
      for (const project of allProjects) {
        if (goal.kind === 'project' && goal.targetProjectId) {
          if (project.id === goal.targetProjectId) {
            satisfiers.push(project.id)
          }
        } else if (goal.kind === 'stat' && goal.targetStatId) {
          for (const effect of project.effects) {
            if (effect.stat === goal.targetStatId) {
              satisfiers.push(project.id)
              break
            }
          }
          if (!satisfiers.includes(project.id)) {
            for (const se of project.sideEffects) {
              if (se.stat === goal.targetStatId) {
                satisfiers.push(project.id)
                break
              }
            }
          }
        } else if (goal.kind === 'cluster') {
          if (goal.targetProjectId) {
            if (project.id === goal.targetProjectId) satisfiers.push(project.id)
          } else if (goal.targetStatId) {
            for (const effect of project.effects) {
              if (effect.stat === goal.targetStatId) {
                satisfiers.push(project.id)
                break
              }
            }
          }
        } else if (goal.kind === 'preventive' && goal.targetStatId) {
          for (const effect of project.effects) {
            if (effect.stat === goal.targetStatId) {
              satisfiers.push(project.id)
              break
            }
          }
          if (!satisfiers.includes(project.id)) {
            for (const se of project.sideEffects) {
              if (se.stat === goal.targetStatId) {
                satisfiers.push(project.id)
                break
              }
            }
          }
        }
      }
      result.set(goal.id, satisfiers)
    }
    return result
  })

  const goalFilteredTaskIds = computed<Set<string> | null>(() => {
    const activeFilter = activeGoalFilterIds.value
    if (activeFilter.size === 0) return null

    const satisfiers = goalCanSatisfyTaskIds.value
    const tree = taskTree.value
    const result = new Set<string>()

    for (const goalId of activeFilter) {
      const directSatisfiers = satisfiers.get(goalId) || []
      for (const pid of directSatisfiers) {
        result.add(pid)
        // Add tree parents
        if (tree) {
          let current: string | null = pid
          for (let depth = 0; depth < 20 && current; depth++) {
            let found = false
            for (const [, nodes] of tree.groups) {
              for (const node of nodes) {
                if (node.children.some(c => c.id === current)) {
                  result.add(node.id)
                  current = node.id
                  found = true
                  break
                }
              }
              if (found) break
            }
            if (!found) break
          }
        }
      }
    }

    return result.size > 0 ? result : null
  })

  const statGoalLineModels = computed<Map<string, TerraformingStatGoalLineModel>>(() => {
    const data = store.terraformingData.value
    const cluster = store.terraformingSelectedCluster.value
    const goals = generatedGoals.value
    const pmap = projectMap.value
    const map = new Map<string, TerraformingStatGoalLineModel>()

    if (!data || !cluster) return map

    // Use cumulative state from main replay (includes auto-events)
    const replayState = combinedReplayResult.value.cumulativeStateAt

    // Pre-compute cumulative state at each entry index (fallback for non-edit mode)
    const cumulativeStateAt: Array<{ completed: Map<string, number>; stats: Record<string, number> }> = []
    if (replayState.length > 0) {
      for (let i = 0; i < replayState.length; i++) {
        cumulativeStateAt.push({
          completed: new Map(),  // not needed for stat goal models
          stats: { ...replayState[i]!.stats },
        })
      }
    } else {
      const r = replayExecutionLog(
        draftExecutionLog.value.filter(e => !e.systemDisabled).map(e => ({ projectId: e.projectId })),
        cluster, data, { mode: 'draft', flags: { stepSnapshots: true }, baseState: replayBaseState.value })
      for (const step of r.steps) {
        if (step.type === 'task' && step.statsBefore) {
          cumulativeStateAt.push({ completed: new Map(), stats: { ...step.statsBefore } })
        }
      }
    }

    for (const goal of goals) {
      if ((goal.kind !== 'stat' && goal.kind !== 'preventive') || !goal.targetStatId) continue

      const statDef = data.stats.find(s => s.id === goal.targetStatId)
      if (!statDef) continue

      // Get cumulative state at goal's position
      const pos = Math.min(goal.position, cumulativeStateAt.length)
      const stateAt = goal.kind === 'preventive'
        ? { completed: new Map<string, number>(), stats: replayState.length > 0 && replayState[replayState.length - 1] ? replayState[replayState.length - 1]!.stats : replayExecutionLog([], cluster, data, { baseState: replayBaseState.value }).finalStats }
        : pos > 0 ? cumulativeStateAt[pos - 1]! : { completed: new Map<string, number>(), stats: replayExecutionLog([], cluster, data, { baseState: replayBaseState.value }).finalStats }
      const currentValue = stateAt.stats[goal.targetStatId] ?? 0
      const ranges = toScaleRanges(statDef)
      const hasRanges = ranges.length > 0

      // Derive targetValue from the stat condition
      let targetValue = currentValue
      let effectDirection: TerraformingStatEffectDirection = 'none'
      let effectFromValue = currentValue
      let effectToValue = currentValue
      let requirementSegments: Array<{ startIndex: number; endIndex: number }> = []

      if (goal.targetStatConditionIndex !== undefined) {
        const depTaskId = goal.dependentTaskIds[0]
        const depEntry = draftExecutionLog.value.find(e => e.id === depTaskId)
        const depProject = depEntry ? pmap.get(depEntry.projectId) : null
        if (depProject) {
          const condition = depProject.conditions[goal.targetStatConditionIndex]
          if (condition) {
            const mode = getConditionMode(condition, statDef)

            if (mode === 'value-range') {
              if (condition.minvalue !== undefined && currentValue < condition.minvalue) {
                targetValue = condition.minvalue
              } else if (condition.maxvalue !== undefined && currentValue > condition.maxvalue) {
                targetValue = condition.maxvalue
              }
              const minValue = condition.minvalue ?? condition.min
              const maxValue = condition.maxvalue ?? condition.max
              requirementSegments = computeRequirementSegments(ranges, minValue, maxValue, [])
            } else {
              const currentRange = getCurrentRange(statDef, currentValue)
              const currentState = currentRange?.state ?? 0
              const minState = condition.min
              const maxState = condition.max
              const needsBelow = minState !== undefined && currentState < minState
              const needsAbove = maxState !== undefined && currentState > maxState
              if (needsBelow) {
                const targetRange = ranges.find(r => r.state === minState)
                if (targetRange) targetValue = targetRange.start
              } else if (needsAbove) {
                const targetRange = [...ranges].reverse().find(r => r.state === maxState)
                if (targetRange) targetValue = targetRange.end
              }

              const minS = minState ?? Math.min(...ranges.map(r => r.state))
              const maxS = maxState ?? Math.max(...ranges.map(r => r.state))
              const requiredStates = ranges
                .filter(r => r.state >= minS && r.state <= maxS)
                .map(r => r.state)
              requirementSegments = computeRequirementSegments(ranges, undefined, undefined, requiredStates)
            }

            if (targetValue > currentValue) {
              effectDirection = 'increase'
              effectToValue = targetValue
              effectFromValue = currentValue
            } else if (targetValue < currentValue) {
              effectDirection = 'decrease'
              effectToValue = targetValue
              effectFromValue = currentValue
            }
          }
        }
      }

      if (goal.kind === 'preventive') {
        targetValue = currentValue
        effectDirection = 'none'
        effectToValue = currentValue
        effectFromValue = currentValue
        // Highlight danger state range from the related event's conditions
        if (goal.relatedEventId) {
          const eventProj = data.projects.find(p => p.id === goal.relatedEventId)
          if (eventProj) {
            const seismicCond = eventProj.conditions.find(c => c.stat === 'seismicactivity')
            if (seismicCond && hasRanges) {
              const minS = seismicCond.min ?? 1
              const maxS = seismicCond.max ?? Math.max(...ranges.map(r => r.state))
              const dangerStates = ranges
                .filter(r => r.state >= minS && r.state <= maxS)
                .map(r => r.state)
              requirementSegments = computeRequirementSegments(ranges, undefined, undefined, dangerStates)
            }
          }
        }
      }

      const currentRange = getCurrentRange(statDef, currentValue)
      const statName = statDisplayNames.value.get(goal.targetStatId) || goal.targetStatId

      let numericText: string | null = null
      if (!hasRanges) {
        const diff = effectToValue - effectFromValue
        if (diff !== 0) {
          const sign = diff > 0 ? '+' : ''
          numericText = `${currentValue.toLocaleString()} → ${effectToValue.toLocaleString()} (${sign}${diff})`
        } else {
          numericText = currentValue.toLocaleString()
        }
      }

      map.set(goal.id, {
        statId: goal.targetStatId,
        statName,
        currentValue,
        currentState: currentRange?.state ?? null,
        ranges,
        hasRanges,
        targetValue,
        requirementSegments,
        effectDirection,
        effectFromValue,
        effectToValue,
        numericText,
        satisfied: goal.satisfied,
      })
    }

    return map
  })

  const unsatisfiedDerivedGoalCount = computed(() => {
    return generatedGoals.value.filter(g => g.kind !== 'cluster' && !g.satisfied).length
  })

  const canCompleteQueueEdit = computed(() => isQueueEditing.value && unsatisfiedDerivedGoalCount.value === 0)

	  function startQueueEdit() {
	    const userTasks: TerraformingDraftExecutionEntry[] = []
	    const committedEvents = new Map<string, number>()
	    for (const entry of store.terraformingExecutionLog.value) {
	      if (!store.terraformingDeductedExecution.value.remainingLog.some(item => item.id === entry.id)) continue
	      if (entry.projectId === activeRuntimeProjectId.value) continue
	      if (entry.projectId.startsWith('evt_')) {
        committedEvents.set(entry.projectId, (committedEvents.get(entry.projectId) ?? 0) + 1)
      } else {
        userTasks.push({
          ...entry,
          source: 'committed' as const,
          systemDisabled: false,
        })
      }
    }
    draftExecutionLog.value = userTasks
    committedEventCounts.value = committedEvents
    activeGoalFilterIds.value = new Set()
    isQueueEditing.value = true
  }

  function cancelQueueEdit() {
    draftExecutionLog.value = []
    activeGoalFilterIds.value = new Set()
    isQueueEditing.value = false
  }

  function completeQueueEdit() {
    if (!canCompleteQueueEdit.value) return
    const committed = draftReplayEntries.value
      .filter(entry => !entry.systemDisabled)
      .map(entry => ({ id: entry.source === 'committed' ? entry.id : '', projectId: entry.projectId }))
    store.replaceTerraformingExecutionLogAndSyncBaseline(committed)
    draftExecutionLog.value = []
    committedEventCounts.value = new Map()
    activeGoalFilterIds.value = new Set()
    isQueueEditing.value = false
  }

  function removeDraftEntry(entryId: string) {
    draftExecutionLog.value = draftExecutionLog.value.filter(entry => entry.id !== entryId)
  }

  function removeAllDraftEntries() {
    draftExecutionLog.value = []
  }

  function clickGoal(goalId: string) {
    const next = new Set(activeGoalFilterIds.value)
    if (next.has(goalId)) {
      next.delete(goalId)
    } else {
      next.add(goalId)
    }
    activeGoalFilterIds.value = next
  }

  function moveTaskBeforeDependency(entryId: string, goalId: string) {
    const goal = generatedGoals.value.find(g => g.id === goalId)
    if (!goal?.dependentTaskIds.length) return

    const sourceIndex = draftExecutionLog.value.findIndex(e => e.id === entryId)
    if (sourceIndex < 0) return

    // Find the earliest dependent task (task A that depends on B)
    let earliestIndex = Infinity
    for (const depId of goal.dependentTaskIds) {
      const idx = draftExecutionLog.value.findIndex(e => e.id === depId)
      if (idx >= 0 && idx < earliestIndex) earliestIndex = idx
    }
    if (earliestIndex === Infinity || earliestIndex >= sourceIndex) return

    const next = [...draftExecutionLog.value]
    const [moved] = next.splice(sourceIndex, 1)
    if (!moved) return
    next.splice(earliestIndex, 0, moved)
    draftExecutionLog.value = next
  }

  function copyDraftEntry(entryId: string) {
    const index = draftExecutionLog.value.findIndex(entry => entry.id === entryId)
    if (index < 0) return
    const source = draftExecutionLog.value[index]!
    const project = projectMap.value.get(source.projectId)
    if (!isRepeatable(project)) return
    const next = [...draftExecutionLog.value]
    next.splice(index + 1, 0, {
      id: nextDraftId(),
      projectId: source.projectId,
      source: 'draft',
      systemDisabled: false,
    })
    draftExecutionLog.value = next
  }

  function moveDraftEntry(entryId: string, targetIndex: number) {
    const currentIndex = draftExecutionLog.value.findIndex(entry => entry.id === entryId)
    if (currentIndex < 0) return
    const next = [...draftExecutionLog.value]
    const [entry] = next.splice(currentIndex, 1)
    if (!entry) return
    const boundedIndex = Math.max(0, Math.min(targetIndex, next.length))
    next.splice(boundedIndex, 0, entry)
    draftExecutionLog.value = next
  }

  function reorderDraftEntries(entries: TerraformingDraftTimelineEntry[]) {
    const lookup = new Map(draftExecutionLog.value.map(e => [e.id, e]))
    draftExecutionLog.value = entries
      .map(e => lookup.get(e.id))
      .filter((e): e is TerraformingDraftExecutionEntry => e !== undefined)
  }

  function resolveInsertIndex(projectId: string): number {
    const goals = generatedGoals.value
    const pGoals = goals.filter(g => g.kind === 'project' && g.targetProjectId)
    const sGoals = goals.filter(g => g.kind === 'stat')
    const prevGoals = goals.filter(g => g.kind === 'preventive' && g.targetStatId)

    const project = projectMap.value.get(projectId)
    if (!project) return draftExecutionLog.value.length

    // Preventive goals: insert at front if project affects the target stat
    for (const goal of prevGoals) {
      if (!goal.targetStatId) continue
      for (const effect of project.effects) {
        if (effect.stat === goal.targetStatId) return 0
      }
    }

    const relevantGoalPositions: number[] = []

    for (const goal of pGoals) {
      if (!goal.targetProjectId) continue
      const depLeaves = extractCompletedLeavesFromDependency({
        all: [
          { completed: goal.targetProjectId },
        ] as TerraformingProjectDependency[],
      } as any)
      if (project.id === goal.targetProjectId || depLeaves.includes(goal.targetProjectId)) {
        relevantGoalPositions.push(goal.position)
        continue
      }
      const pDepLeaves = extractCompletedLeavesFromDependency(project.dependencies)
      const pBlockLeaves: string[] = []
      if (pDepLeaves.includes(goal.targetProjectId) || pBlockLeaves.includes(goal.targetProjectId)) {
        relevantGoalPositions.push(goal.position)
      }
    }

    for (const goal of sGoals) {
      if (!goal.targetStatId) continue
      let affectsStat = false
      for (const effect of project.effects) {
        if (effect.stat === goal.targetStatId) { affectsStat = true; break }
      }
      if (affectsStat) {
        relevantGoalPositions.push(goal.position)
      }
    }

    if (relevantGoalPositions.length > 0) {
      return Math.min(...relevantGoalPositions)
    }

    return draftExecutionLog.value.length
  }

  function computeMutualExclusionForEntry(projectId: string): { disabled: boolean; reason?: string; mutuallyExclusive?: string } {
    const project = projectMap.value.get(projectId)
    if (!project || !project.dependencies) return { disabled: false }

    const existing = draftExecutionLog.value.filter(e => !e.systemDisabled)
    const completedProjects = new Map<string, number>()
    for (const e of existing) {
      completedProjects.set(e.projectId, (completedProjects.get(e.projectId) ?? 0) + 1)
    }

    function checkExclusion(dep: TerraformingProjectDependency): string | null {
      if (!dep) return null
      if ('all' in dep) {
        for (const child of dep.all) {
          const result = checkExclusion(child)
          if (result) return result
        }
        return null
      }
      if ('any' in dep) {
        const isLeaf = (d: TerraformingProjectDependency) => 'completed' in d || 'notCompleted' in d
        if (dep.any.every(isLeaf) && dep.any.some(d => 'notCompleted' in d)) {
          const notCompleted = dep.any.find(d => 'notCompleted' in d) as any
          if (notCompleted && notCompleted.notCompleted) {
            if ((completedProjects.get(notCompleted.notCompleted) ?? 0) > 0) {
              return notCompleted.notCompleted
            }
          }
        }
        return null
      }
      if ('notCompleted' in dep) {
        if ((completedProjects.get(dep.notCompleted) ?? 0) > 0) {
          return dep.notCompleted
        }
      }
      return null
    }

    const exclusive = checkExclusion(project.dependencies)
    if (exclusive) {
      const prefix = vI18nLookup('terraforming.mutuallyExclusive') || 'Mutually exclusive'
      return { disabled: true, reason: `${prefix} ${projectDisplayNames.value.get(exclusive) || exclusive}`, mutuallyExclusive: exclusive }
    }
    return { disabled: false }
  }

  function resolveDraftIndexFromPlanIndex(targetPlanIndex: number): number {
    if (targetPlanIndex <= 0) return 0
    const planEntries = planDisplayEntries.value
    let draftIndex = 0
    const boundedPlanIndex = Math.min(targetPlanIndex, planEntries.length)
    for (let i = 0; i < boundedPlanIndex; i += 1) {
      const entry = planEntries[i]
      if (entry?.type === 'task') draftIndex += 1
    }
    return draftIndex
  }

	  function appendDraftProject(projectId: string, targetPlanIndex?: number) {
	    if (projectId === activeRuntimeProjectId.value) return
	    const project = projectMap.value.get(projectId)
    if (project?.repeatCooldown === null && draftExecutionLog.value.some(entry => entry.projectId === projectId && !entry.systemDisabled)) {
      return
    }

    const exclusion = computeMutualExclusionForEntry(projectId)
    const insertIndex = targetPlanIndex === undefined
      ? resolveInsertIndex(projectId)
      : resolveDraftIndexFromPlanIndex(targetPlanIndex)

    const newEntry: TerraformingDraftExecutionEntry = {
      id: nextDraftId(),
      projectId,
      source: 'draft',
      systemDisabled: exclusion.disabled,
      systemDisabledReason: exclusion.reason,
      mutuallyExclusiveWith: exclusion.mutuallyExclusive,
    }

    const next = [...draftExecutionLog.value]
    next.splice(insertIndex, 0, newEntry)
    draftExecutionLog.value = next
  }

  function removeLastDraftProject(projectId: string) {
    const index = [...draftExecutionLog.value].reverse().findIndex(entry => entry.projectId === projectId)
    if (index < 0) return
    const actualIndex = draftExecutionLog.value.length - 1 - index
    const next = [...draftExecutionLog.value]
    next.splice(actualIndex, 1)
    draftExecutionLog.value = next
  }

	  function canAppendCommittedProject(projectId: string): boolean {
	    if (projectId === activeRuntimeProjectId.value) return false
	    const data = store.terraformingData.value
    const cluster = store.terraformingSelectedCluster.value
    if (!data || !cluster) return false
    const replayResult = replayExecutionLog(
      committedReplayLog.value.map(entry => ({ projectId: entry.projectId })),
      cluster,
      data,
      { mode: 'draft', baseState: replayBaseState.value },
    )
    const completedProjects = replayResult.finalCompleted
    const stats = replayResult.finalStats
    const { clusterProjects } = buildRuntimeClusterForReplay(cluster, data)
    const evaluation = evaluateTerraformingProjectExecution(
      projectMap.value.get(projectId),
      { stats, completedProjects },
      projectMap.value,
      clusterProjects,
      data.stats,
    )
    return evaluation.valid
  }

  function syncAutoEventsFromReplay() {
    const data = store.terraformingData.value
    const cluster = store.terraformingSelectedCluster.value
    if (!data || !cluster) return

    const log = committedReplayLog.value.map(e => ({ projectId: e.projectId }))
    const result = replayExecutionLog(log, cluster, data, { mode: 'draft', baseState: replayBaseState.value })
    const canonical = result.steps.map(step => ({ id: '', projectId: step.projectId }))
    const currentProjectIds = committedReplayLog.value.map(entry => entry.projectId)
    const canonicalProjectIds = canonical.map(entry => entry.projectId)
    if (
      currentProjectIds.length === canonicalProjectIds.length
      && currentProjectIds.every((projectId, index) => projectId === canonicalProjectIds[index])
    ) return
    store.replaceTerraformingExecutionLog(canonical)
  }

  function removeLastCommittedProject(projectId: string) {
    const currentCount = effectiveCompletedProjects.value.get(projectId) ?? 0
    if (currentCount <= getArchiveCompletedProjectCount(projectId)) return
    const log = store.terraformingExecutionLog.value
    for (let index = log.length - 1; index >= 0; index -= 1) {
      const entry = log[index]
      if (!entry || entry.projectId !== projectId) continue
      const validation = getExecutionCancelValidation(entry.id)
      if (!validation.canCancel) return
      store.removeTerraformingExecutionEntry(entry.id)
      return
    }
  }

  const props: TerraformingPresenterProps = {
    toolbar: {
      hqStationName,
      stationCode,
      sectorName,
      sectorNameId,
      position,
      sectorResources,
      sectorSunlight,
      singleBerthThroughput,
      hasHqStation
    },
    sectorPanel: {
      clusters,
      selectedClusterId,
      clusterDisplayNames,
      clusterMatchesHq,
      objectivesProgress,
      statScaleModels,
      currentStats: effectiveCurrentStats,
      statDisplayNames,
      activeRebates,
      clusterRewardDisplays,
    },
    taskList: {
      taskTree,
      groupNames,
      taskNodeDisplays,
      completedProjectCounts,
      archiveCompletedProjectCounts,
      projectMap,
      projectDisplayNames,
      wareNames: store.wareNames,
      moduleGroupNames: store.moduleGroupNames,
      goalFilteredTaskIds,
    },
	    resourcePanel: {
	      selectedClusterId,
	      executionTimeline,
	      taskLogMode: computed(() => taskLogMode.value),
	      currentQueueDisplayEntries,
	      executedEntries,
	      archiveSyncNotice,
	      archiveActiveProjectDisplay,
	      archiveRetainedProjectDisplays,
	      queueEditState: {
	        editing: computed(() => isQueueEditing.value),
	        canComplete: canCompleteQueueEdit,
        unsatisfiedGoalCount: unsatisfiedDerivedGoalCount,
        planEntries: planDisplayEntries,
      },
      getCancelValidation: getExecutionCancelValidation,
      deliveryShipMap,
      hqBuildDocks,
    },
    taskDrag: {
      isDragging: isDraggingTask,
      projectId: computed(() => dragTaskId.value),
      projectName: computed(() => dragTaskName.value),
    },
  }

  const emits: TerraformingPresenterEmits = {
    selectCluster: (clusterId: string) => {
      store.selectTerraformingCluster(clusterId)
      if (!isQueueEditing.value && store.terraformingExecutionLog.value.length === 0) {
        syncAutoEventsFromReplay()
      }
    },
    toggleProject: (projectId: string) => {
      if (isQueueEditing.value) {
        const currentCount = draftCompletedProjectCounts.value.get(projectId) ?? 0
        if (currentCount > 0) removeLastDraftProject(projectId)
        else appendDraftProject(projectId)
        return
      }
      const currentCount = effectiveCompletedProjects.value.get(projectId) ?? 0
      if (currentCount > getArchiveCompletedProjectCount(projectId)) {
        removeLastCommittedProject(projectId)
      } else if (canAppendCommittedProject(projectId)) {
        store.appendTerraformingProjectExecution(projectId, 1)
        syncAutoEventsFromReplay()
      }
    },
    setProjectCount: (projectId: string, count: number) => {
      if (isQueueEditing.value) {
        const currentCount = draftCompletedProjectCounts.value.get(projectId) ?? 0
        if (count > currentCount) {
          for (let i = 0; i < count - currentCount; i += 1) appendDraftProject(projectId)
        } else if (count < currentCount) {
          for (let i = 0; i < currentCount - count; i += 1) removeLastDraftProject(projectId)
        }
        return
      }
      const currentCount = effectiveCompletedProjects.value.get(projectId) ?? 0
      const targetCount = Math.max(count, getArchiveCompletedProjectCount(projectId))
      if (targetCount > currentCount) {
        for (let i = 0; i < targetCount - currentCount; i += 1) {
          if (canAppendCommittedProject(projectId)) store.appendTerraformingProjectExecution(projectId, 1)
        }
        syncAutoEventsFromReplay()
        return
      }
      if (targetCount < currentCount) {
        for (let i = 0; i < currentCount - targetCount; i += 1) removeLastCommittedProject(projectId)
      }
    },
    cancelExecution: (entryId: string) => {
      const validation = getExecutionCancelValidation(entryId)
      if (!validation.canCancel) return
      store.removeTerraformingExecutionEntry(entryId)
    },
    clearExecutionQueue: () => {
      store.clearTerraformingExecutionQueue()
    },
    startQueueEdit,
    cancelQueueEdit,
    completeQueueEdit,
    removeDraftEntry,
    removeAllDraftEntries,
    clickGoal,
    moveTaskBeforeDependency,
    copyDraftEntry,
    moveDraftEntry,
    reorderDraftEntries,
    appendDraftTask: appendDraftProject,
    startDraggingTask: (projectId: string, projectName: string) => {
      dragTaskId.value = projectId
      dragTaskName.value = projectName
    },
	    endDraggingTask: () => {
	      dragTaskId.value = ''
	      dragTaskName.value = ''
	    },
	    setTaskLogMode: (mode: 'queue' | 'executed') => {
	      taskLogMode.value = mode
	    },
	    confirmArchiveSync: () => {
	      store.replaceTerraformingExecutionLogAndSyncBaseline(committedReplayLog.value)
	    },
	    debugClearExecutedBaseline: () => {
	      store.clearTerraformingExecutedBaseline()
	    },
	  }

  return { props, emits }
}

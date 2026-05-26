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
  computeTerraformingRuntimeStats,
  getRuntimeTerraformingProjectIds,
  type TerraformingExecutionEntry,
} from '@/store/logic/terraformingRuntime'
import type { ArchiveStationData } from '@/types/saveArchive'
import type { SavedModule, X4MapCluster, X4MapSector, X4Module } from '@/types/x4'
import i18n from '@/i18n'
import { useGameDataStore } from '@/store/useGameDataStore'

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
}

export type TerraformingStatEffectDirection = 'none' | 'increase' | 'decrease'

export interface TerraformingStatLineModel extends TerraformingStatScaleModel {
  requirementLabel?: string
  requiredStates?: number[]
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
  projectMap: ComputedRef<Map<string, TerraformingProject>>
  projectDisplayNames: ComputedRef<Map<string, string>>
  currentStats: ComputedRef<Record<string, number>>
  statDisplayNames: ComputedRef<Map<string, string>>
  statScaleModels: ComputedRef<Map<string, TerraformingStatScaleModel>>
  conditionScaleModels: ComputedRef<Map<string, TerraformingConditionScaleModel[]>>
  activeRebates: ComputedRef<string[]>
  wareNames: ComputedRef<Map<string, string>>
  moduleGroupNames: ComputedRef<Map<string, string>>
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
  projectRebates: Array<{ name: string; value: number }>
  cumulativeRebates: Array<{ name: string; value: number }>
  rebateChanges: Array<{ name: string; before: number; after: number }>
  returnedWares: Array<{ name: string; amount: number }>
  statLines: TerraformingStatLineModel[]
  beforeStats: TerraformingTimelineStatSnapshot[]
  afterStats: TerraformingTimelineStatSnapshot[]
  availableBeforeExecution: boolean
  blockedReason: string | null
}

export type TerraformingDraftEntryState = 'disabled' | 'enabled-valid' | 'enabled-invalid'
export type TerraformingDraftRepeatRole = 'single' | 'first' | 'duplicate'

export interface TerraformingDraftExecutionEntry extends TerraformingExecutionEntry {
  enabled: boolean
  source: 'committed' | 'draft'
}

export interface TerraformingDraftTimelineEntry {
  id: string
  order: number
  projectId: string
  projectName: string
  projectGroupName: string
  enabled: boolean
  state: TerraformingDraftEntryState
  repeatRole: TerraformingDraftRepeatRole
  reasons: string[]
  dependencies: string[]
  statLines: TerraformingStatLineModel[]
}

export interface TerraformingQueueEditState {
  editing: ComputedRef<boolean>
  canComplete: ComputedRef<boolean>
  invalidCount: ComputedRef<number>
  draftEntries: ComputedRef<TerraformingDraftTimelineEntry[]>
}

export interface TerraformingResourcePanelProps {
  selectedClusterId: ComputedRef<string | null>
  executionTimeline: ComputedRef<TerraformingExecutionTimelineEntry[]>
  queueEditState: TerraformingQueueEditState
  getCancelValidation: (entryId: string) => TerraformingCancelValidation
  deliveryShipMap: ComputedRef<Map<string, DeliveryShip>>
  hqBuildDocks: ComputedRef<{ totalSlots: number } | null>
}

export interface TerraformingPresenterProps {
  toolbar: TerraformingToolbarProps
  sectorPanel: TerraformingSectorPanelProps
  taskList: TerraformingTaskListProps
  resourcePanel: TerraformingResourcePanelProps
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
  setDraftEntryEnabled: (entryId: string, enabled: boolean) => void
  deleteDraftEntry: (entryId: string) => void
  copyDraftEntry: (entryId: string) => void
  moveDraftEntry: (entryId: string, targetIndex: number) => void
  reorderDraftEntries: (entries: TerraformingDraftTimelineEntry[]) => void
  disableAllDraftEntries: () => void
  enableAllDraftEntries: () => void
  setHousingBuilt: (count: number) => void
}

export interface UseTerraformingPresenterReturn {
  props: TerraformingPresenterProps
  emits: TerraformingPresenterEmits
}

export interface TerraformingPresenterStore {
  terraformingData: ComputedRef<TerraformingData | null>
  terraformingSelectedClusterId: ComputedRef<string | null>
  terraformingSelectedCluster: ComputedRef<TerraformingCluster | null>
  terraformingCurrentStats: ComputedRef<Record<string, number>>
  terraformingRuntimeProjectIds: ComputedRef<string[]>
  terraformingCompletedProjects: ComputedRef<Map<string, number>>
  terraformingExecutionLog: ComputedRef<TerraformingExecutionEntry[]>
  terraformingHousingBuilt: ComputedRef<number>
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
  clearTerraformingExecutionQueue: () => void
  setTerraformingHousingBuilt: (count: number) => void
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

function buildConditionScaleModel(
  condition: StatCondition,
  data: TerraformingData,
  currentStats: Record<string, number>,
  i18nLookup: I18nLookup,
): TerraformingConditionScaleModel | null {
  const statDef = data.stats.find(s => s.id === condition.stat)
  if (!statDef) return null
  if (!(condition.stat in currentStats)) return null
  const currentValue = currentStats[condition.stat] ?? 0
  const currentRange = getCurrentRange(statDef, currentValue)
  const ranges = toScaleRanges(statDef)
  const mode = getConditionMode(condition, statDef)

  let requiredStates: number[] = []
  let requirementLabel = ''

  if (mode === 'state-range') {
    const minState = condition.min ?? Math.min(...ranges.map(r => r.state))
    const maxState = condition.max ?? Math.max(...ranges.map(r => r.state))
    requiredStates = ranges.filter(r => r.state >= minState && r.state <= maxState).map(r => r.state)
    requirementLabel = `${getStatName(condition.stat, data, i18nLookup)} state ${minState}-${maxState}`
  } else {
    const minValue = condition.minvalue ?? condition.min
    const maxValue = condition.maxvalue ?? condition.max
    requiredStates = ranges
      .filter(r => (minValue === undefined || r.end >= minValue) && (maxValue === undefined || r.start <= maxValue))
      .map(r => r.state)
    if (minValue !== undefined && maxValue !== undefined) requirementLabel = `${getStatName(condition.stat, data, i18nLookup)} ${minValue}-${maxValue}`
    else if (minValue !== undefined) requirementLabel = `${getStatName(condition.stat, data, i18nLookup)} >= ${minValue}`
    else if (maxValue !== undefined) requirementLabel = `${getStatName(condition.stat, data, i18nLookup)} <= ${maxValue}`
  }

  return {
    statId: condition.stat,
    statName: getStatName(condition.stat, data, i18nLookup),
    currentValue,
    currentState: currentRange?.state ?? null,
    ranges,
    mode,
    requirementLabel,
    requiredStates,
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
  if (!(statId in currentStats)) return null
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
    if (!(stat.id in currentStats)) continue

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
        effectLabel = formatEffectLabel(effect, uiLabels)
      }
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

function findTaskNodeById(tree: TaskTree, projectId: string): TaskNode | null {
  for (const nodes of tree.groups.values()) {
    for (const node of nodes) {
      if (node.id === projectId) return node
    }
  }
  return null
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
  uiLabels: { min: string; max: string; setback: string },
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
    const parts: string[] = [`${se.chance}%`]
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

interface CumulativeRebateResult {
  entries: Array<{ name: string; value: number }>
  aggregatedByGroup: Record<string, number>
}

function computeCumulativeRebates(
  completed: Map<string, number>,
  data: TerraformingData,
  moduleGroupNames: Map<string, string>,
  wareNames: Map<string, string>,
): CumulativeRebateResult {
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
  const entries = Object.entries(aggregated)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => ({ name, value }))
  return { entries, aggregatedByGroup: aggregated }
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
  labels: { mutuallyExclusive: string },
): string[] {
  if (!dependency) return []
  if ('all' in dependency) {
    return dependency.all.flatMap(child => formatDependencyExpression(child, projectNames, labels))
  }
  if ('any' in dependency) {
    const branchLabels = dependency.any
      .map(child => formatDependencyExpression(child, projectNames, labels).join(' + '))
      .filter(label => label.length > 0)
    return branchLabels.length > 0 ? [branchLabels.join(' | ')] : []
  }
  if ('completed' in dependency) return [projectNames.get(dependency.completed) || dependency.completed]
  if ('notCompleted' in dependency) return [`${labels.mutuallyExclusive}: ${projectNames.get(dependency.notCompleted) || dependency.notCompleted}`]
  if ('groupCompleted' in dependency) return []
  if ('groupNotCompleted' in dependency) return []
  return []
}

function projectDisplayName(projectId: string, projectNames: Map<string, string>): string {
  const displayName = projectNames.get(projectId)
  if (displayName !== undefined) return displayName
  return projectId
}

function formatDependencyBranchText(
  line: TerraformingDependencyLineModel,
  dependsLabel: string,
): string {
  if (line.label === dependsLabel) return line.value
  return `${line.label}: ${line.value}`
}

function formatDependencyExpressionLines(
  dependency: TerraformingProjectDependency | undefined,
  projectNames: Map<string, string>,
  labels: { depends: string; anyOf: string; mutuallyExclusive: string },
  blocked: boolean,
): TerraformingDependencyLineModel[] {
  if (!dependency) return []
  if ('all' in dependency) {
    return dependency.all.flatMap(child => formatDependencyExpressionLines(child, projectNames, labels, blocked))
  }
  if ('any' in dependency) {
    const branchLabels = dependency.any
      .map(child => formatDependencyExpressionLines(child, projectNames, labels, blocked)
        .map(line => formatDependencyBranchText(line, labels.depends))
        .join(' + '))
      .filter(label => label.length > 0)
    if (branchLabels.length === 0) return []
    return [{
      label: labels.depends,
      value: `${labels.anyOf}${branchLabels.join(' | ')}`,
      blocked,
    }]
  }
  if ('completed' in dependency) {
    return [{
      label: labels.depends,
      value: projectDisplayName(dependency.completed, projectNames),
      blocked,
    }]
  }
  if ('notCompleted' in dependency) {
    return [{
      label: labels.mutuallyExclusive,
      value: projectDisplayName(dependency.notCompleted, projectNames),
      blocked,
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
  blocked: boolean,
): TerraformingDependencyLineModel[] {
  const projectPreds = predecessors.filter(pred => pred.type === 'project')
  if (projectPreds.length === 0) return []

  const anyPreds = projectPreds.filter(pred => pred.any)
  const allPreds = projectPreds.filter(pred => !pred.any)
  const lines: TerraformingDependencyLineModel[] = []

  if (anyPreds.length > 0) {
    lines.push({
      label: labels.depends,
      value: `${labels.anyOf}${anyPreds.map(pred => projectDisplayName(pred.ref, projectNames)).join(' | ')}`,
      blocked,
    })
  }

  for (const pred of allPreds) {
    lines.push({
      label: labels.depends,
      value: projectDisplayName(pred.ref, projectNames),
      blocked,
    })
  }

  return lines
}

function isRepeatable(project: TerraformingProject | undefined): boolean {
  return (project?.repeatCooldown ?? null) !== null
}

export function useTerraformingPresenter(store: TerraformingPresenterStore): UseTerraformingPresenterReturn {
  const vI18nLookup: I18nLookup = (key: string) => (i18n.global.t(key) as string) || ''
  const isQueueEditing = ref(false)
  const draftExecutionLog = ref<TerraformingDraftExecutionEntry[]>([])
  const draftSequence = ref(0)

  const hqArchiveStation = computed(() => store.terraformingHqArchiveStation.value)

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
    const completedProjects = store.terraformingCompletedProjects.value
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

      return {
        step: obj.step,
        action: obj.action,
        text,
        completed,
        neutralizeScale
      }
    })
  })

  function buildRuntimeClusterForReplay(
    cluster: TerraformingCluster,
    stats: Record<string, number>,
    completedProjects: Map<string, number>,
    data: TerraformingData,
  ): { runtimeCluster: TerraformingCluster; clusterProjects: TerraformingProject[] } {
    const runtimeProjectIds = getRuntimeTerraformingProjectIds(cluster, stats, completedProjects, data)
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

  const draftReplayEntries = computed<TerraformingDraftTimelineEntry[]>(() => {
    const data = store.terraformingData.value
    const cluster = store.terraformingSelectedCluster.value
    if (!data || !cluster) return []

    let completedProjects = new Map<string, number>()
    const entries: TerraformingDraftTimelineEntry[] = []
    const projectNames = projectDisplayNames.value
    const translatedGroupNames = groupNames.value

    for (let index = 0; index < draftExecutionLog.value.length; index += 1) {
      const entry = draftExecutionLog.value[index]!
      const project = projectMap.value.get(entry.projectId)
      const beforeStats = computeTerraformingRuntimeStats(cluster, completedProjects, data)
      const { clusterProjects } = buildRuntimeClusterForReplay(cluster, beforeStats, completedProjects, data)
      const evaluation = entry.enabled
        ? evaluateTerraformingProjectExecution(project, { stats: beforeStats, completedProjects }, projectMap.value, clusterProjects, data.stats)
        : { valid: false, reasons: [] }
      const relevantStatIds = project ? getProjectSnapshotStatIds(project) : []
      const nextCompletedProjects = new Map(completedProjects)
      if (entry.enabled && evaluation.valid) {
        nextCompletedProjects.set(entry.projectId, (nextCompletedProjects.get(entry.projectId) ?? 0) + 1)
      }
      const afterStats = computeTerraformingRuntimeStats(cluster, nextCompletedProjects, data)
      const statLines = relevantStatIds
        .filter(statId => statId in beforeStats)
        .map(statId => ({
          statId,
          statName: statDisplayNames.value.get(statId) || statId,
          beforeValue: beforeStats[statId] ?? 0,
          afterValue: afterStats[statId] ?? 0,
        }))
        .filter(snapshot => snapshot.beforeValue !== snapshot.afterValue)
        .map(snapshot => buildTimelineStatLineModel(snapshot, data))
        .filter((model): model is TerraformingStatLineModel => model !== null)

      const previous = draftExecutionLog.value[index - 1]
      const next = draftExecutionLog.value[index + 1]
      let repeatRole: TerraformingDraftRepeatRole = 'single'
      if (isRepeatable(project) && (previous?.projectId === entry.projectId || next?.projectId === entry.projectId)) {
        repeatRole = previous?.projectId === entry.projectId ? 'duplicate' : 'first'
      }

      entries.push({
        id: entry.id,
        order: index + 1,
        projectId: entry.projectId,
        projectName: projectNames.get(entry.projectId) || project?.name || entry.projectId,
        projectGroupName: translatedGroupNames.get(project?.group || '') || project?.group || '',
        enabled: entry.enabled,
        state: !entry.enabled ? 'disabled' : evaluation.valid ? 'enabled-valid' : 'enabled-invalid',
        repeatRole,
        reasons: translateEvaluationReasons(evaluation.reasons, data, vI18nLookup),
        dependencies: formatDependencyExpression(project?.dependencies, projectNames, {
          mutuallyExclusive: vI18nLookup('terraforming.mutuallyExclusive') || 'Mutually exclusive',
        }),
        statLines,
      })

      completedProjects = nextCompletedProjects
    }

    return entries
  })

  const draftCompletedProjectCounts = computed<Map<string, number>>(() => {
    const counts = new Map<string, number>()
    for (const entry of draftReplayEntries.value) {
      if (entry.state !== 'enabled-valid') continue
      counts.set(entry.projectId, (counts.get(entry.projectId) ?? 0) + 1)
    }
    return counts
  })

  const effectiveCompletedProjects = computed<Map<string, number>>(() => {
    return isQueueEditing.value ? draftCompletedProjectCounts.value : store.terraformingCompletedProjects.value
  })

  const effectiveCurrentStats = computed<Record<string, number>>(() => {
    const data = store.terraformingData.value
    const cluster = store.terraformingSelectedCluster.value
    if (!data || !cluster) return store.terraformingCurrentStats.value
    return computeTerraformingRuntimeStats(cluster, effectiveCompletedProjects.value, data)
  })

  const taskTree = computed<TaskTree | null>(() => {
    const data = store.terraformingData.value
    const cluster = store.terraformingSelectedCluster.value
    if (!data || !cluster) return null
    const completedProjects = effectiveCompletedProjects.value
    const stats = effectiveCurrentStats.value
    const runtimeProjectIds = getRuntimeTerraformingProjectIds(cluster, stats, completedProjects, data)
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

  const taskNodeDisplays = computed<Map<string, TerraformingTaskNodeDisplay>>(() => {
    const data = store.terraformingData.value
    const tree = taskTree.value
    const displays = new Map<string, TerraformingTaskNodeDisplay>()
    if (!data || !tree) return displays

    const statNames = statDisplayNames.value
    const projectNames = projectDisplayNames.value
    const uiLabels = {
      min: vI18nLookup('terraforming.min') || 'min',
      max: vI18nLookup('terraforming.max') || 'max',
      depends: vI18nLookup('terraforming.depends') || 'Depends',
      current: vI18nLookup('terraforming.current') || 'current',
      anyOf: vI18nLookup('terraforming.anyOf') || 'Any ',
      setback: vI18nLookup('terraforming.setback') || 'setback',
      mutuallyExclusive: vI18nLookup('terraforming.mutuallyExclusive') || 'Mutually exclusive',
    }

    const visit = (node: TaskNode) => {
      const project = data.projects.find(item => item.id === node.id)
      if (!project) return
      const blockedReasonLines = translateBlockedReasonLines(node.blockedReason, data, projectNames, statNames, {
        depends: uiLabels.depends,
        current: uiLabels.current,
        anyOf: uiLabels.anyOf,
      })
      const dependencyBlocked = node.blockedReason ? node.blockedReason.includes('depends') : false
      displays.set(node.id, {
        name: projectNames.get(node.id) || node.name,
        effects: translateTaskEffects(node.effects, statNames, { min: uiLabels.min, max: uiLabels.max }),
        blockedReasonLines,
        dependencyLines: [
          ...formatPredecessorDependencyLines(node.predecessors, projectNames, {
            depends: uiLabels.depends,
            anyOf: uiLabels.anyOf,
          }, dependencyBlocked),
          ...formatDependencyExpressionLines(project.dependencies, projectNames, {
            depends: uiLabels.depends,
            anyOf: uiLabels.anyOf,
            mutuallyExclusive: uiLabels.mutuallyExclusive,
          }, dependencyBlocked),
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
          { min: uiLabels.min, max: uiLabels.max, setback: uiLabels.setback },
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
      if (!(stat.id in currentStats)) continue
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

  const conditionScaleModels = computed<Map<string, TerraformingConditionScaleModel[]>>(() => {
    const data = store.terraformingData.value
    const cluster = store.terraformingSelectedCluster.value
    const currentStats = store.terraformingCurrentStats.value
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

    const log = store.terraformingExecutionLog.value
    const translatedGroupNames = groupNames.value
    const translatedProjectNames = projectDisplayNames.value
    const translatedStatNames = statDisplayNames.value
    const results: TerraformingExecutionTimelineEntry[] = []

    const evaluateEntry = (
      entry: TerraformingExecutionEntry,
      completedProjects: Map<string, number>,
    ) => {
      const beforeStats = computeTerraformingRuntimeStats(cluster, completedProjects, data)
      const beforeProjectIds = getRuntimeTerraformingProjectIds(cluster, beforeStats, completedProjects, data)
      const runtimeCluster: TerraformingCluster = {
        ...cluster,
        projectIds: beforeProjectIds,
      }
      const tree = resolveAvailableTasks(runtimeCluster, {
        stats: beforeStats,
        completedProjects,
      }, data)
      return {
        beforeStats,
        tree,
        node: findTaskNodeById(tree, entry.projectId),
      }
    }

    let completedProjects = new Map<string, number>()
    let previousGroupId: string | null = null

    for (let index = 0; index < log.length; index += 1) {
      const entry = log[index]!
      const evaluated = evaluateEntry(entry, completedProjects)
      const project = projectMap.value.get(entry.projectId)
      const projectName = translatedProjectNames.get(entry.projectId) || project?.name || entry.projectId
      const projectGroupId = project?.group || evaluated.node?.group || 'unknown'
      const projectGroupName = translatedGroupNames.get(projectGroupId) || projectGroupId
      const relevantStatIds = project ? getProjectSnapshotStatIds(project) : []
      const nextCompletedProjects = new Map(completedProjects)
      nextCompletedProjects.set(entry.projectId, (nextCompletedProjects.get(entry.projectId) ?? 0) + 1)
      const afterStats = computeTerraformingRuntimeStats(cluster, nextCompletedProjects, data)
      const beforeStatsList = relevantStatIds
        .filter((statId) => statId in evaluated.beforeStats)
        .map((statId) => ({
          statId,
          statName: translatedStatNames.get(statId) || statId,
          beforeValue: evaluated.beforeStats[statId] ?? 0,
          afterValue: afterStats[statId] ?? 0,
        }))
        .filter(snapshot => snapshot.beforeValue !== snapshot.afterValue)
      const statLines = beforeStatsList
        .map(snapshot => buildTimelineStatLineModel(snapshot, data))
        .filter((model): model is TerraformingStatLineModel => model !== null)

      // Compute rebates
      const cumulative = computeCumulativeRebates(
        completedProjects,
        data,
        store.moduleGroupNames.value,
        store.wareNames.value,
      )
      const afterCumulative = computeCumulativeRebates(
        nextCompletedProjects,
        data,
        store.moduleGroupNames.value,
        store.wareNames.value,
      )
      const rebateChanges: Array<{ name: string; before: number; after: number }> = []
      for (const ae of afterCumulative.entries) {
        const before = cumulative.aggregatedByGroup[ae.name] ?? 0
        const after = ae.value
        if (before !== after) {
          rebateChanges.push({ name: ae.name, before, after })
        }
      }
      for (const be of cumulative.entries) {
        if (!afterCumulative.aggregatedByGroup[be.name]) {
          rebateChanges.push({ name: be.name, before: be.value, after: 0 })
        }
      }
      const projectRebates = project?.rebates?.map(rb => {
        let name = ''
        if (rb.wareGroup) {
          name = store.moduleGroupNames.value.get(rb.wareGroup) || rb.wareGroup
        } else if (rb.ware) {
          name = store.wareNames.value.get(rb.ware) || rb.ware
        }
        return name ? { name, value: rb.value } : null
      }).filter((r): r is { name: string; value: number } => r !== null) || []

      results.push({
        id: entry.id,
        order: index + 1,
        projectId: entry.projectId,
        projectName,
        projectGroupId,
        projectGroupName,
        showGroupMarker: projectGroupId !== previousGroupId,
        wares: project?.resources?.wares?.map(w => ({
          ware: w.ware,
          amount: w.amount,
          actualAmount: w.actualAmount,
        })) || [],
        deliveries: (project?.deliveries || []).map(d => ({
          macro: d.macro,
          amount: d.amount,
        })),
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
            const parallel = Math.ceil(totalWork / slots)
            for (const dd of allDeliveries) {
              dd.totalTime = parallel
            }
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
        cumulativeRebates: cumulative.entries,
        returnedWares: (() => {
          const rw: Array<{ name: string; amount: number }> = []
          const seen = new Set<string>()
          for (const rb of cumulative.entries) {
            const pct = rb.value / 100
            for (const w of (project?.resources?.wares || [])) {
              const amount = w.actualAmount ?? w.amount
              if (amount <= 0) continue
              const groupId = store.wareGroupMap.value.get(w.ware)
              const translatedGroup = groupId ? (store.moduleGroupNames.value.get(groupId) || groupId) : ''
              if (translatedGroup !== rb.name && w.ware !== rb.name) continue
              if (seen.has(w.ware)) continue
              seen.add(w.ware)
              const wareName = store.wareNames.value.get(w.ware) || w.ware
              const returned = Math.floor(amount * pct)
              if (returned > 0) rw.push({ name: wareName, amount: returned })
            }
          }
          return rw
        })(),
        statLines,
        beforeStats: beforeStatsList,
        afterStats: beforeStatsList,
        availableBeforeExecution: evaluated.node?.available ?? false,
        blockedReason: evaluated.node?.available === false ? (evaluated.node.blockedReason || null) : null,
      })

      previousGroupId = projectGroupId
      completedProjects = nextCompletedProjects
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

    const log = store.terraformingExecutionLog.value
    const targetIndex = log.findIndex(entry => entry.id === entryId)
    if (targetIndex < 0) {
      return {
        canCancel: false,
        affectedEntryIds: [],
        reasons: [vI18nLookup('terraforming.projectUnavailableAfterCancel') || 'Unavailable after cancel'],
      }
    }

    const translatedProjectNames = projectDisplayNames.value
    const nextLog = log.filter((_, index) => index !== targetIndex)
    let replayCounts = new Map<string, number>()
    const affectedEntryIds: string[] = []
    const reasons: string[] = []

    const evaluateEntry = (
      entry: TerraformingExecutionEntry,
      completedProjects: Map<string, number>,
    ) => {
      const beforeStats = computeTerraformingRuntimeStats(cluster, completedProjects, data)
      const { clusterProjects } = buildRuntimeClusterForReplay(cluster, beforeStats, completedProjects, data)
      return evaluateTerraformingProjectExecution(
        projectMap.value.get(entry.projectId),
        { stats: beforeStats, completedProjects },
        projectMap.value,
        clusterProjects,
        data.stats,
      )
    }

    for (let index = 0; index < nextLog.length; index += 1) {
      const entry = nextLog[index]!
      const evaluation = evaluateEntry(entry, replayCounts)
      if (!evaluation.valid) {
        if (index >= targetIndex) {
          affectedEntryIds.push(entry.id)
          reasons.push(`${translatedProjectNames.get(entry.projectId) || entry.projectId}: ${translateEvaluationReasons(evaluation.reasons, data, vI18nLookup).join('; ') || (vI18nLookup('terraforming.projectBlockedAfterCancel') || 'Blocked after cancel')}`)
        }
        continue
      }
      replayCounts = new Map(replayCounts)
      replayCounts.set(entry.projectId, (replayCounts.get(entry.projectId) ?? 0) + 1)
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

  const hqBuildDocks = computed<{ totalSlots: number } | null>(() => {
    const modules = store.terraformingHqEffectiveModules.value
    if (!modules.length) return null
    const gameData = useGameDataStore()
    const mm = gameData.modulesMap as Record<string, X4Module>
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
    if (!modules.length) return []
    const gameData = useGameDataStore()
    const localizedMap = gameData.localizedModulesMap as Record<string, { localeName: string; name: string }>
    const mm = gameData.modulesMap as Record<string, X4Module>
    const result: Array<{ name: string; count: number; slots: number }> = []
    for (const sm of modules) {
      const mod = mm[sm.id] as X4Module | undefined
      if (!mod?.buildShipClasses?.length) continue
      const name = localizedMap[sm.id]?.localeName || mod.name || sm.id
      result.push({ name, count: sm.count, slots: sm.count * mod.buildProcessorCount })
    }
    return result
  })

  const invalidDraftCount = computed(() => draftReplayEntries.value.filter(entry => entry.state === 'enabled-invalid').length)
  const canCompleteQueueEdit = computed(() => isQueueEditing.value && invalidDraftCount.value === 0)

  function startQueueEdit() {
    draftExecutionLog.value = store.terraformingExecutionLog.value.map(entry => ({
      ...entry,
      enabled: true,
      source: 'committed',
    }))
    isQueueEditing.value = true
  }

  function cancelQueueEdit() {
    draftExecutionLog.value = []
    isQueueEditing.value = false
  }

  function completeQueueEdit() {
    if (!canCompleteQueueEdit.value) return
    const committed = draftExecutionLog.value
      .filter(entry => entry.enabled)
      .map(entry => ({ id: entry.source === 'committed' ? entry.id : '', projectId: entry.projectId }))
    store.replaceTerraformingExecutionLog(committed)
    draftExecutionLog.value = []
    isQueueEditing.value = false
  }

  function setDraftEntryEnabled(entryId: string, enabled: boolean) {
    draftExecutionLog.value = draftExecutionLog.value.map(entry => entry.id === entryId ? { ...entry, enabled } : entry)
  }

  function deleteDraftEntry(entryId: string) {
    draftExecutionLog.value = draftExecutionLog.value.filter(entry => entry.id !== entryId)
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
      enabled: true,
      source: 'draft',
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

  function disableAllDraftEntries() {
    draftExecutionLog.value = draftExecutionLog.value.map(entry => ({ ...entry, enabled: false }))
  }

  function enableAllDraftEntries() {
    draftExecutionLog.value = draftExecutionLog.value.map(entry => ({ ...entry, enabled: true }))
  }

  function appendDraftProject(projectId: string) {
    const project = projectMap.value.get(projectId)
    if (project?.repeatCooldown === null && draftExecutionLog.value.some(entry => entry.projectId === projectId && entry.enabled)) {
      return
    }
    draftExecutionLog.value = [
      ...draftExecutionLog.value,
      { id: nextDraftId(), projectId, enabled: true, source: 'draft' },
    ]
  }

  function removeLastDraftProject(projectId: string) {
    const index = [...draftExecutionLog.value].reverse().findIndex(entry => entry.projectId === projectId)
    if (index < 0) return
    const actualIndex = draftExecutionLog.value.length - 1 - index
    const entry = draftExecutionLog.value[actualIndex]
    if (!entry) return
    const previous = draftExecutionLog.value[actualIndex - 1]
    if (previous?.projectId === projectId) {
      deleteDraftEntry(entry.id)
      return
    }
    setDraftEntryEnabled(entry.id, false)
  }

  function canAppendCommittedProject(projectId: string): boolean {
    const data = store.terraformingData.value
    const cluster = store.terraformingSelectedCluster.value
    if (!data || !cluster) return false
    const completedProjects = store.terraformingCompletedProjects.value
    const stats = store.terraformingCurrentStats.value
    const { clusterProjects } = buildRuntimeClusterForReplay(cluster, stats, completedProjects, data)
    const evaluation = evaluateTerraformingProjectExecution(
      projectMap.value.get(projectId),
      { stats, completedProjects },
      projectMap.value,
      clusterProjects,
      data.stats,
    )
    return evaluation.valid
  }

  function removeLastCommittedProject(projectId: string) {
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
      objectivesProgress
    },
    taskList: {
      taskTree,
      groupNames,
      taskNodeDisplays,
      completedProjectCounts,
      projectMap,
      projectDisplayNames,
      currentStats: effectiveCurrentStats,
      statDisplayNames,
      statScaleModels,
      conditionScaleModels,
      activeRebates,
      wareNames: store.wareNames,
      moduleGroupNames: store.moduleGroupNames,
    },
    resourcePanel: {
      selectedClusterId,
      executionTimeline,
      queueEditState: {
        editing: computed(() => isQueueEditing.value),
        canComplete: canCompleteQueueEdit,
        invalidCount: invalidDraftCount,
        draftEntries: draftReplayEntries,
      },
      getCancelValidation: getExecutionCancelValidation,
      deliveryShipMap,
      hqBuildDocks,
    }
  }

  const emits: TerraformingPresenterEmits = {
    selectCluster: (clusterId: string) => store.selectTerraformingCluster(clusterId),
    toggleProject: (projectId: string) => {
      if (isQueueEditing.value) {
        const currentCount = draftCompletedProjectCounts.value.get(projectId) ?? 0
        if (currentCount > 0) removeLastDraftProject(projectId)
        else appendDraftProject(projectId)
        return
      }
      const currentCount = store.terraformingCompletedProjects.value.get(projectId) ?? 0
      if (currentCount > 0) {
        removeLastCommittedProject(projectId)
      } else if (canAppendCommittedProject(projectId)) {
        store.appendTerraformingProjectExecution(projectId, 1)
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
      const currentCount = store.terraformingCompletedProjects.value.get(projectId) ?? 0
      if (count > currentCount) {
        for (let i = 0; i < count - currentCount; i += 1) {
          if (canAppendCommittedProject(projectId)) store.appendTerraformingProjectExecution(projectId, 1)
        }
        return
      }
      if (count < currentCount) {
        for (let i = 0; i < currentCount - count; i += 1) removeLastCommittedProject(projectId)
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
    setDraftEntryEnabled,
    deleteDraftEntry,
    copyDraftEntry,
    moveDraftEntry,
    reorderDraftEntries,
    disableAllDraftEntries,
    enableAllDraftEntries,
    setHousingBuilt: (count: number) => {
      store.setTerraformingHousingBuilt(count)
    }
  }

  return { props, emits }
}

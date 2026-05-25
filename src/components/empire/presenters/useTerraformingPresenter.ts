import { computed, type ComputedRef } from 'vue'
import type {
  ClusterObjective,
  DeliveryShip,
  DescriptionItem,
  StatCondition,
  TaskNode,
  TaskTree,
  TerraformingCluster,
  TerraformingData,
  TerraformingProject,
  TerraformingStat,
  TerraformingState,
} from '@/store/logic/terraformingTaskResolver'
import {
  getCurrentRange,
  getSortedRanges,
  resolveAvailableTasks,
  resolveTerraformingText,
  resolveWithReplaces,
  type I18nLookup
} from '@/store/logic/terraformingTaskResolver'
import {
  computeTerraformingRuntimeStats,
  getRuntimeTerraformingProjectIds,
  type TerraformingExecutionEntry,
} from '@/store/logic/terraformingRuntime'
import type { ArchiveStationData, SavedModule } from '@/types/saveArchive'
import type { X4MapCluster, X4MapSector, X4Module } from '@/types/x4'
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

export interface TerraformingEffectItem {
  type: 'effect' | 'rebate' | 'sideEffect' | 'description'
  text: string
}

export interface TerraformingTaskNodeDisplay {
  name: string
  effects: string
  blockedReasonLines: string[]
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
  beforeStats: TerraformingTimelineStatSnapshot[]
  afterStats: TerraformingTimelineStatSnapshot[]
  availableBeforeExecution: boolean
  blockedReason: string | null
}

export interface TerraformingResourcePanelProps {
  selectedClusterId: ComputedRef<string | null>
  executionTimeline: ComputedRef<TerraformingExecutionTimelineEntry[]>
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
        investText = `${N('terraforming.effect.invest') || 'Invest'}: ${priceVal.toLocaleString()} Cr`
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
        returnText += ` (${N('terraforming.max') || 'max'}: ${item.maxPrice.toLocaleString()} Cr)`
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
  nodeEffects: string,
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

  if (nodeEffects) {
    const translated = translateTaskEffects(nodeEffects, statNames, uiLabels)
    if (translated) {
      items.push({ type: 'effect', text: translated })
    }
  }

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

function computeDiscountedPrice(
  basePrice: number,
  wares: Array<{ ware: string; amount: number }>,
  aggregatedByGroup: Record<string, number>,
  wareGroupMap: Map<string, string>,
  moduleGroupNames: Map<string, string>,
): number {
  const wareDiscounts: number[] = []
  for (const w of wares) {
    const groupId = wareGroupMap.get(w.ware) || ''
    let discount = 0
    for (const [name, pct] of Object.entries(aggregatedByGroup)) {
      const groupEntry = moduleGroupNames.get(groupId)
      if (name === groupEntry || name === groupId) {
        discount += pct
      }
    }
    // Also check for ware-specific rebates matching by name
    if (!discount) {
      for (const [name, pct] of Object.entries(aggregatedByGroup)) {
        if (name === w.ware) {
          discount += pct
        }
      }
    }
    wareDiscounts.push(Math.min(discount, 100))
  }
  if (wareDiscounts.length === 0) return basePrice
  const avgDiscount = wareDiscounts.reduce((s, d) => s + d, 0) / wareDiscounts.length
  return Math.round(basePrice * (1 - avgDiscount / 100))
}

export function useTerraformingPresenter(store: TerraformingPresenterStore): UseTerraformingPresenterReturn {
  const vI18nLookup: I18nLookup = (key: string) => (i18n.global.t(key) as string) || ''

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
    const currentStats = store.terraformingCurrentStats.value
    const completedProjects = store.terraformingCompletedProjects.value
    const hqClusterId = store.terraformingHqClusterId.value
    const housingTarget = extractHousingTarget(cluster, cluster.objectives)

    return cluster.objectives.map(obj => {
      let completed = false
      let neutralizeScale: TerraformingConditionScaleModel | undefined

      switch (obj.action) {
        case 'objective.relocate':
          completed = hqClusterId !== null && stripMacroPrefix(cluster.macro) === hqClusterId
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

  const taskTree = computed<TaskTree | null>(() => {
    const data = store.terraformingData.value
    const cluster = store.terraformingSelectedCluster.value
    if (!data || !cluster) return null
    const runtimeCluster: TerraformingCluster = {
      ...cluster,
      projectIds: [...store.terraformingRuntimeProjectIds.value],
    }
    const state: TerraformingState = {
      stats: store.terraformingCurrentStats.value,
      completedProjects: store.terraformingCompletedProjects.value
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
    return new Map(store.terraformingCompletedProjects.value)
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
    }

    const visit = (node: TaskNode) => {
      displays.set(node.id, {
        name: projectNames.get(node.id) || node.name,
        effects: translateTaskEffects(node.effects, statNames, { min: uiLabels.min, max: uiLabels.max }),
        blockedReasonLines: translateBlockedReasonLines(node.blockedReason, data, projectNames, statNames, {
          depends: uiLabels.depends,
          current: uiLabels.current,
          anyOf: uiLabels.anyOf,
        }),
        effectItems: buildEffectItems(
          node.id,
          node.effects,
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
    const completed = store.terraformingCompletedProjects.value
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
    const currentStats = store.terraformingCurrentStats.value
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
      const beforeProjectIds = getRuntimeTerraformingProjectIds(cluster, beforeStats, completedProjects, data)
      const runtimeCluster: TerraformingCluster = {
        ...cluster,
        projectIds: beforeProjectIds,
      }
      const tree = resolveAvailableTasks(runtimeCluster, {
        stats: beforeStats,
        completedProjects,
      }, data)
      return findTaskNodeById(tree, entry.projectId)
    }

    for (let index = 0; index < nextLog.length; index += 1) {
      const entry = nextLog[index]!
      const node = evaluateEntry(entry, replayCounts)
      if (!node) {
        if (index >= targetIndex) {
          affectedEntryIds.push(entry.id)
          reasons.push(`${translatedProjectNames.get(entry.projectId) || entry.projectId}: ${vI18nLookup('terraforming.projectUnavailableAfterCancel') || 'Unavailable after cancel'}`)
        }
        continue
      }
      if (!node.available) {
        if (index >= targetIndex) {
          affectedEntryIds.push(entry.id)
          reasons.push(`${translatedProjectNames.get(entry.projectId) || entry.projectId}: ${node.blockedReason || (vI18nLookup('terraforming.projectBlockedAfterCancel') || 'Blocked after cancel')}`)
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
      currentStats: computed(() => store.terraformingCurrentStats.value),
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
      getCancelValidation: getExecutionCancelValidation,
      deliveryShipMap,
      hqBuildDocks,
    }
  }

  const emits: TerraformingPresenterEmits = {
    selectCluster: (clusterId: string) => store.selectTerraformingCluster(clusterId),
    toggleProject: (projectId: string) => {
      const currentCount = store.terraformingCompletedProjects.value.get(projectId) ?? 0
      store.setTerraformingProjectCount(projectId, currentCount > 0 ? 0 : 1)
    },
    setProjectCount: (projectId: string, count: number) => {
      store.setTerraformingProjectCount(projectId, count)
    },
    cancelExecution: (entryId: string) => {
      store.removeTerraformingExecutionEntry(entryId)
    },
    setHousingBuilt: (count: number) => {
      store.setTerraformingHousingBuilt(count)
    }
  }

  return { props, emits }
}

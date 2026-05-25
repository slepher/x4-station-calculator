import { computed, type ComputedRef } from 'vue'
import type {
  TerraformingData,
  TerraformingCluster,
  TerraformingStat,
  TerraformingState,
  TaskTree,
  TaskNode,
  ClusterObjective,
  TerraformingProject,
  StatCondition
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
import type { ArchiveStationData } from '@/types/saveArchive'
import type { X4MapCluster, X4MapSector } from '@/types/x4'
import i18n from '@/i18n'

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

export interface TerraformingTaskNodeDisplay {
  name: string
  effects: string
  blockedReasonLines: string[]
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

export interface TerraformingExecutionTimelineEntry {
  id: string
  order: number
  projectId: string
  projectName: string
  projectGroupId: string
  projectGroupName: string
  showGroupMarker: boolean
  wares: Array<{ ware: string; amount: number }>
  deliveries: Array<{ macro: string; amount: number; buildDuration: number }>
  price: number
  beforeStats: TerraformingTimelineStatSnapshot[]
  afterStats: TerraformingTimelineStatSnapshot[]
  availableBeforeExecution: boolean
  blockedReason: string | null
}

export interface TerraformingResourcePanelProps {
  selectedClusterId: ComputedRef<string | null>
  executionTimeline: ComputedRef<TerraformingExecutionTimelineEntry[]>
  getCancelValidation: (entryId: string) => TerraformingCancelValidation
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
  terraformingHqClusterId: ComputedRef<string | null>
  selectTerraformingCluster: (clusterId: string) => void
  setTerraformingCompletedProjects: (projects: Map<string, number>) => void
  appendTerraformingProjectExecution: (projectId: string, count?: number) => void
  setTerraformingProjectCount: (projectId: string, count: number) => void
  removeTerraformingExecutionEntry: (entryId: string) => void
  setTerraformingHousingBuilt: (count: number) => void
  mapsClusters: Record<string, X4MapCluster>
  mapsSectors: Record<string, X4MapSector>
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
      })
      for (const child of node.children) visit(child)
    }

    for (const nodes of tree.groups.values()) {
      for (const node of nodes) visit(node)
    }

    return displays
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
      const beforeProjectIds = getRuntimeTerraformingProjectIds(cluster, beforeStats, completedProjects)
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
      const beforeStatsList = relevantStatIds.map((statId) => ({
        statId,
        statName: translatedStatNames.get(statId) || statId,
        beforeValue: evaluated.beforeStats[statId] ?? 0,
        afterValue: afterStats[statId] ?? 0,
      }))
      results.push({
        id: entry.id,
        order: index + 1,
        projectId: entry.projectId,
        projectName,
        projectGroupId,
        projectGroupName,
        showGroupMarker: projectGroupId !== previousGroupId,
        wares: project?.resources?.wares || [],
        deliveries: project?.deliveries || [],
        price: project?.resources?.price || 0,
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
      const beforeProjectIds = getRuntimeTerraformingProjectIds(cluster, beforeStats, completedProjects)
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
      conditionScaleModels
    },
    resourcePanel: {
      selectedClusterId,
      executionTimeline,
      getCancelValidation: getExecutionCancelValidation,
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

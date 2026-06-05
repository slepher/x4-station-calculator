import type {
  TerraformingCluster,
  TerraformingData,
  TerraformingProject,
  TerraformingProjectDependency,
  StatCondition,
  TerraformingStat,
} from './terraformingTaskResolver'
import {
  evaluateTerraformingProjectExecution,
  getCurrentRange,
} from './terraformingTaskResolver'

export interface TerraformingExecutionEntry {
  id: string
  projectId: string
}

export interface ReplayFlags {
  goals?: boolean
  evaluations?: boolean
  stepSnapshots?: boolean
}

export interface ReplayOptions {
  mode?: 'committed' | 'draft'
  flags?: ReplayFlags
  baseState?: ReplayBaseState
}

export interface ReplayBaseState {
  stats?: Record<string, number>
  completedProjects?: Map<string, number>
  completedEvents?: Map<string, number>
  rebates?: RebateKey[]
}

export interface RebateKey {
  id: string
  type: 'wareGroup' | 'ware'
  value: number
}

export interface ReplayStep {
  projectId: string
  type: 'task' | 'auto-event'
  valid: boolean
  statsBefore?: Record<string, number>
  statsAfter?: Record<string, number>
  completedBefore?: Map<string, number>
  completedAfter?: Map<string, number>
  cumulativeRebatesBefore?: RebateKey[]
  cumulativeRebatesAfter?: RebateKey[]
  rebateChanges?: Array<{ key: RebateKey; before: number; after: number }>
  evaluation?: { valid: boolean; reasons: string[] }
}

export interface GoalEntry {
  id: string
  kind: 'stat' | 'project'
  position: number
  dependentTaskIds: string[]
  statGoal?: { statId: string; currentValue: number; targetValue: number; targetStatConditionIndex: number }
  projectGoal?: { targetProjectId: string }
}

export interface TerraformingReplayResult {
  steps: ReplayStep[]
  goalEntries: GoalEntry[]
  finalStats: Record<string, number>
  finalCompleted: Map<string, number>
}

export interface TerraformingArchiveRuntimeBaseState extends ReplayBaseState {
  clusterId: string
  stats: Record<string, number>
  completedProjects: Map<string, number>
  completedEvents: Map<string, number>
  rebates: RebateKey[]
  activeProject?: {
    projectId: string
    aborted?: boolean
    scaledResources: Array<{ ware: string; amount: number }>
    submittedResources: Array<{ ware: string; amount: number }>
    inTransitResources?: Array<{ ware: string; amount: number }>
    inTransitShipBatches?: number
  }
  retainedProjects: Array<{
    projectId: string
    scaledResources: Array<{ ware: string; amount: number }>
    submittedResources: Array<{ ware: string; amount: number }>
    inTransitResources?: Array<{ ware: string; amount: number }>
    inTransitShipBatches?: number
  }>
  missionComplete: boolean
}

export interface TerraformingExecutedDelta {
  completedProjects: Map<string, number>
  completedOneTimeEvents: Map<string, number>
  hasArchiveAdvance: boolean
  hasArchiveRollbackRisk: boolean
  hasRuntimeStateChange: boolean
}

export interface TerraformingCurrentQueueDisplayEntry {
  id: string
  projectId: string
  status: 'pending' | 'executed' | 'occurred'
  source: 'remaining-queue' | 'deducted-from-archive'
}

export interface TerraformingExecutedDisplaySource {
  id: string
  projectId: string
  kind: 'project' | 'one-time-event'
  status: 'executed' | 'occurred' | 'archive-only'
  count: number
  source: 'deducted-from-queue' | 'archive-runtime'
}

export interface DeductExecutionResult {
  remainingLog: TerraformingExecutionEntry[]
  currentQueueDisplayEntries: TerraformingCurrentQueueDisplayEntry[]
  deductedEntries: TerraformingExecutedDisplaySource[]
  archiveOnlyEntries: TerraformingExecutedDisplaySource[]
  consumedProjects: Map<string, number>
  consumedOneTimeEvents: Map<string, number>
}

export const TERRAFORMING_IGNORE_FLAG_TO_STAT: Record<string, string> = {
  '$IgnoreTemperature': 'temperature',
  '$IgnoreOxygen': 'oxygen',
  '$IgnoreMethane': 'methane',
  '$IgnoreCarbonDioxide': 'carbondioxide',
  '$IgnoreToxicity': 'toxicity',
  '$IgnoreRadioactivity': 'radioactivity',
  '$IgnoreHumidity': 'humidity',
  '$IgnoreAirPressure': 'airpressure',
}

export function buildProjectMap(data: TerraformingData): Map<string, TerraformingProject> {
  return new Map(data.projects.map(project => [project.id, project]))
}

export function buildCompletedProjectsFromExecutionLog(
  executionLog: TerraformingExecutionEntry[],
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const entry of executionLog) {
    counts.set(entry.projectId, (counts.get(entry.projectId) ?? 0) + 1)
  }
  return counts
}

function cloneCountMap(input: Map<string, number>): Map<string, number> {
  const output = new Map<string, number>()
  for (const [id, count] of input) {
    if (count > 0) output.set(id, count)
  }
  return output
}

export function subtractCountMaps(current: Map<string, number>, baseline: Map<string, number>): Map<string, number> {
  const delta = new Map<string, number>()
  for (const [id, currentCount] of current) {
    const diff = currentCount - (baseline.get(id) ?? 0)
    if (diff > 0) delta.set(id, diff)
  }
  return delta
}

export function hasRollback(current: Map<string, number>, baseline: Map<string, number>): boolean {
  for (const [id, baselineCount] of baseline) {
    if ((current.get(id) ?? 0) < baselineCount) return true
  }
  return false
}

function isOneTimeEventProject(project: TerraformingProject | undefined): boolean {
  return project?.group === 'events' && project.repeatCooldown === null
}

export function deductExecutionLogByArchiveDelta(
  executionLog: TerraformingExecutionEntry[],
  executedDelta: { completedProjects: Map<string, number>; completedOneTimeEvents: Map<string, number> },
  projectMap: Map<string, TerraformingProject>,
): DeductExecutionResult {
  const projectBudget = cloneCountMap(executedDelta.completedProjects)
  const eventBudget = cloneCountMap(executedDelta.completedOneTimeEvents)
  const remainingLog: TerraformingExecutionEntry[] = []
  const currentQueueDisplayEntries: TerraformingCurrentQueueDisplayEntry[] = []
  const deductedEntries: TerraformingExecutedDisplaySource[] = []
  const consumedProjects = new Map<string, number>()
  const consumedOneTimeEvents = new Map<string, number>()

  for (const entry of executionLog) {
    const project = projectMap.get(entry.projectId)
    const isOneTimeEvent = isOneTimeEventProject(project)
    const budget = isOneTimeEvent ? eventBudget : projectBudget
    const available = budget.get(entry.projectId) ?? 0

    if (available > 0) {
      budget.set(entry.projectId, available - 1)
      if (available - 1 <= 0) budget.delete(entry.projectId)
      const consumed = isOneTimeEvent ? consumedOneTimeEvents : consumedProjects
      consumed.set(entry.projectId, (consumed.get(entry.projectId) ?? 0) + 1)
      const status = isOneTimeEvent ? 'occurred' : 'executed'
      currentQueueDisplayEntries.push({
        id: entry.id,
        projectId: entry.projectId,
        status,
        source: 'deducted-from-archive',
      })
      deductedEntries.push({
        id: entry.id,
        projectId: entry.projectId,
        kind: isOneTimeEvent ? 'one-time-event' : 'project',
        status,
        count: 1,
        source: 'deducted-from-queue',
      })
      continue
    }

    remainingLog.push(entry)
    currentQueueDisplayEntries.push({
      id: entry.id,
      projectId: entry.projectId,
      status: 'pending',
      source: 'remaining-queue',
    })
  }

  const archiveOnlyEntries: TerraformingExecutedDisplaySource[] = []
  for (const [projectId, count] of projectBudget) {
    if (count <= 0) continue
    archiveOnlyEntries.push({
      id: `archive-project-${projectId}`,
      projectId,
      kind: 'project',
      status: 'archive-only',
      count,
      source: 'archive-runtime',
    })
  }
  for (const [projectId, count] of eventBudget) {
    if (count <= 0) continue
    archiveOnlyEntries.push({
      id: `archive-event-${projectId}`,
      projectId,
      kind: 'one-time-event',
      status: 'archive-only',
      count,
      source: 'archive-runtime',
    })
  }

  return {
    remainingLog,
    currentQueueDisplayEntries,
    deductedEntries,
    archiveOnlyEntries,
    consumedProjects,
    consumedOneTimeEvents,
  }
}

export function getTerraformingIgnoredStats(cluster: TerraformingCluster | null): Set<string> {
  const ignored = new Set<string>()
  if (cluster?.removedStats) {
    for (const statId of cluster.removedStats) ignored.add(statId)
  }
  if (!cluster?.values) return ignored
  for (const [flag, statId] of Object.entries(TERRAFORMING_IGNORE_FLAG_TO_STAT)) {
    if (cluster.values[flag] === 'true') ignored.add(statId)
  }
  return ignored
}

export function getClusterValueNumber(cluster: TerraformingCluster | null, prefix: string): number | null {
  if (!cluster?.values) return null
  for (const [key, raw] of Object.entries(cluster.values)) {
    if (!key.startsWith(prefix)) continue
    const value = Number(raw)
    if (!Number.isNaN(value)) return value
  }
  return null
}

export function buildTerraformingBaseStats(
  cluster: TerraformingCluster | null,
): Record<string, number> {
  if (!cluster) return {}
  const ignoredStats = getTerraformingIgnoredStats(cluster)
  const stats: Record<string, number> = {}
  for (const [statId, value] of Object.entries(cluster.initialStats)) {
    if (ignoredStats.has(statId)) continue
    stats[statId] = value
  }
  return stats
}

export function buildArchiveRuntimeStats(
  cluster: TerraformingCluster | null,
  runtimeStats: Record<string, number>,
): Record<string, number> {
  const stats: Record<string, number> = {}
  const baseStats = buildTerraformingBaseStats(cluster)
  for (const statId of Object.keys(baseStats)) {
    if (Object.prototype.hasOwnProperty.call(runtimeStats, statId)) {
      stats[statId] = runtimeStats[statId]!
    } else {
      stats[statId] = 0
    }
  }
  for (const [statId, value] of Object.entries(runtimeStats)) {
    if (Object.prototype.hasOwnProperty.call(stats, statId)) continue
    stats[statId] = value
  }
  return stats
}

export function applyProjectEffectsToTerraformingStats(
  stats: Record<string, number>,
  completed: Map<string, number>,
  projectMap: Map<string, TerraformingProject>,
  ignoredStats: Set<string>,
): Record<string, number> {
  const nextStats = { ...stats }
  for (const [projectId, count] of completed) {
    if (count <= 0) continue
    const project = projectMap.get(projectId)
    if (!project) continue
    for (const effect of project.effects) {
      if (!(effect.stat in nextStats)) continue
      if (ignoredStats.has(effect.stat)) continue
      if (effect.value !== undefined) {
        nextStats[effect.stat] = Math.max(0, effect.value)
        continue
      }
      if (effect.change === undefined) continue
      const base = nextStats[effect.stat] ?? 0
      let newValue = base + effect.change * count
      if (effect.min !== undefined) newValue = Math.max(newValue, effect.min)
      if (effect.max !== undefined) newValue = Math.min(newValue, effect.max)
      nextStats[effect.stat] = Math.max(0, newValue)
    }
    for (const se of project.sideEffects) {
      if (!se.stat || se.change === null || se.change === undefined) continue
      if (!(se.stat in nextStats)) continue
      if (ignoredStats.has(se.stat)) continue
      const base = nextStats[se.stat] ?? 0
      nextStats[se.stat] = Math.max(0, base + se.change * count)
    }
  }
  return nextStats
}

export function deriveAirPressure(
  cluster: TerraformingCluster | null,
  stats: Record<string, number>,
  ignoredStats: Set<string>,
): Record<string, number> {
  if (!cluster || ignoredStats.has('airpressure') || !('airpressure' in stats)) return stats

  const gases = ['oxygen', 'methane', 'carbondioxide'] as const
  const initialAtmosphere = gases.reduce((sum, statId) => sum + (cluster.initialStats[statId] ?? 0), 0)
  const currentAtmosphere = gases.reduce((sum, statId) => sum + (stats[statId] ?? 0), 0)
  const initialContribution = Math.floor(initialAtmosphere / 4)
  const currentContribution = Math.floor(currentAtmosphere / 4)

  return {
    ...stats,
    airpressure: Math.max(0, (stats.airpressure ?? (cluster.initialStats.airpressure ?? 0)) + currentContribution - initialContribution),
  }
}

export function getRuntimeTerraformingProjectIds(
  cluster: TerraformingCluster | null,
): string[] {
  if (!cluster) return []
  return [...cluster.taskProjectIds]
}

function isStatInRuntime(stats: Record<string, number>, statId: string): boolean {
  return statId in stats
}

function isStatAffectingEvent(project: TerraformingProject): boolean {
  return project.effects.length > 0
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

function computeTargetValue(
  condition: StatCondition,
  stats: Record<string, number>,
  statDefs: TerraformingStat[],
): number {
  const currentVal = stats[condition.stat] ?? 0
  const statDef = statDefs.find(s => s.id === condition.stat)
  if (!statDef) return currentVal
  if (condition.usesValueBounds || condition.minvalue !== undefined || condition.maxvalue !== undefined) {
    if (condition.minvalue !== undefined && currentVal < condition.minvalue) return condition.minvalue
    if (condition.maxvalue !== undefined && currentVal > condition.maxvalue) return condition.maxvalue
    return currentVal
  }
  const currentRange = getCurrentRange(statDef, currentVal)
  const currentState = currentRange?.state ?? 0
  if (condition.min !== undefined && currentState < condition.min) {
    const targetRange = statDef.ranges.find(r => r.state === condition.min)
    return targetRange ? (targetRange.start ?? currentVal) : currentVal
  }
  if (condition.max !== undefined && currentState > condition.max) {
    const targetRange = [...statDef.ranges].reverse().find(r => r.state === condition.max)
    return targetRange ? (targetRange.end ?? currentVal) : currentVal
  }
  return currentVal
}

function extractUnmetDependencyGoals(
  dependency: TerraformingProjectDependency | undefined,
  completedProjects: Map<string, number>,
  projectMap: Map<string, TerraformingProject>,
  runtimeProjectIds: Set<string>,
): { targetProjectId: string; isRisk: boolean }[] {
  if (!dependency) return []
  if ('all' in dependency) {
    return dependency.all.flatMap(child => extractUnmetDependencyGoals(child, completedProjects, projectMap, runtimeProjectIds))
  }
  if ('any' in dependency) {
    const isLeaf = (dep: TerraformingProjectDependency): boolean => 'completed' in dep || 'notCompleted' in dep
    if (dependency.any.every(isLeaf) && dependency.any.some(d => 'notCompleted' in d)) {
      const notCompletedIds = dependency.any.filter(d => 'notCompleted' in d).map(d => (d as { notCompleted: string }).notCompleted)
      const completedIds = dependency.any.filter(d => 'completed' in d).map(d => (d as { completed: string }).completed)
      const allNotCompletedSatisfied = notCompletedIds.every(pid => (completedProjects.get(pid) ?? 0) <= 0)
      if (allNotCompletedSatisfied) return []
      const unsatisfied = completedIds.filter(pid => runtimeProjectIds.has(pid) && (completedProjects.get(pid) ?? 0) <= 0)
      return unsatisfied.map(pid => ({ targetProjectId: pid, isRisk: false }))
    }
    const branchResults = dependency.any.map(child =>
      extractUnmetDependencyGoals(child, completedProjects, projectMap, runtimeProjectIds)
    )
    if (branchResults.some(r => r.length === 0)) return []
    return branchResults.flat()
  }
  if ('completed' in dependency) {
    if (!runtimeProjectIds.has(dependency.completed)) return []
    if ((completedProjects.get(dependency.completed) ?? 0) > 0) return []
    return [{ targetProjectId: dependency.completed, isRisk: false }]
  }
  return []
}

function rebateKey(r: { ware?: string | null; wareGroup?: string | null }): string {
  return r.wareGroup ? `g:${r.wareGroup}` : `w:${r.ware ?? ''}`
}

export function replayExecutionLog(
  log: Array<{ projectId: string }>,
  cluster: TerraformingCluster,
  data: TerraformingData,
  options?: ReplayOptions,
): TerraformingReplayResult {
  const mode = options?.mode ?? 'committed'
  const flags = options?.flags ?? {}
  const { evaluations, stepSnapshots, goals } = flags
  const baseState = options?.baseState

  const steps: ReplayStep[] = []
  const goalEntries: GoalEntry[] = []
  let goalSeq = 0

  let runningStats = baseState?.stats ? { ...baseState.stats } : buildTerraformingBaseStats(cluster)
  const runningCompleted = new Map<string, number>([
    ...(baseState?.completedProjects ? [...baseState.completedProjects.entries()] : []),
    ...(baseState?.completedEvents ? [...baseState.completedEvents.entries()] : []),
  ])
  const runningRebates = new Map<string, number>()
  if (baseState?.rebates) {
    for (const rb of baseState.rebates) {
      runningRebates.set(`${rb.type === 'wareGroup' ? 'g' : 'w'}:${rb.id}`, rb.value)
    }
  }
  const projectMap = buildProjectMap(data)
  const ignoredStats = getTerraformingIgnoredStats(cluster)

  function currentStats(): Record<string, number> {
    return deriveAirPressure(cluster, { ...runningStats }, ignoredStats)
  }

  function snapshotRebates(): { raw: Map<string, number>; list: RebateKey[] } {
    const raw = new Map(runningRebates)
    const list: RebateKey[] = []
    for (const [key, value] of raw) {
      const type = key.startsWith('g:') ? 'wareGroup' : 'ware'
      list.push({ id: key.slice(2), type, value })
    }
    return { raw, list }
  }

  function applyRebateEntries(projectId: string, count: number) {
    const project = projectMap.get(projectId)
    if (!project?.rebates) return
    for (const rb of project.rebates) {
      const key = rebateKey(rb)
      runningRebates.set(key, (runningRebates.get(key) ?? 0) + rb.value * count)
    }
  }

  function diffRebates(before: Map<string, number>, after: Map<string, number>) {
    const changes: Array<{ key: RebateKey; before: number; after: number }> = []
    const allKeys = new Set([...before.keys(), ...after.keys()])
    for (const k of allKeys) {
      const b = before.get(k) ?? 0
      const a = after.get(k) ?? 0
      if (b !== a) {
        const type = k.startsWith('g:') ? 'wareGroup' : 'ware'
        changes.push({ key: { id: k.slice(2), type, value: a }, before: b, after: a })
      }
    }
    return changes
  }

  function pushStep(projectId: string, type: 'task' | 'auto-event', isValid: boolean, evaluation?: { valid: boolean; reasons: string[] }) {
    const step: ReplayStep = { projectId, type, valid: isValid, evaluation }
    if (stepSnapshots) {
      step.statsBefore = currentStats()
      step.completedBefore = new Map(runningCompleted)
      const rbBefore = snapshotRebates()
      step.cumulativeRebatesBefore = rbBefore.list
    }
    if (isValid) {
      runningStats = applyProjectEffectsToTerraformingStats(
        runningStats, new Map([[projectId, 1]]), projectMap, ignoredStats,
      )
      runningCompleted.set(projectId, (runningCompleted.get(projectId) ?? 0) + 1)
      applyRebateEntries(projectId, 1)
    }
    if (stepSnapshots) {
      step.statsAfter = currentStats()
      step.completedAfter = new Map(runningCompleted)
      const rbAfter = snapshotRebates()
      step.cumulativeRebatesAfter = rbAfter.list
      if (step.cumulativeRebatesBefore) {
        const beforeMap = new Map<string, number>()
        for (const rb of step.cumulativeRebatesBefore) {
          beforeMap.set(`${rb.type === 'wareGroup' ? 'g' : 'w'}:${rb.id}`, rb.value)
        }
        step.rebateChanges = diffRebates(beforeMap, rbAfter.raw)
      }
    }
    steps.push(step)
  }

  function generateGoalsForEntry(projectId: string, stepIndex: number) {
    const project = projectMap.get(projectId)
    if (!project) return false

    // 1. Project dependency goals: virtual satisfy, no effects
    const clusterProjectIds = new Set(getRuntimeTerraformingProjectIds(cluster))
    const depGoals = extractUnmetDependencyGoals(
      project.dependencies, runningCompleted, projectMap, clusterProjectIds,
    )

    // Also check predecessors for unmet project goals
    if (project.predecessors) {
      const projectPreds = project.predecessors.filter(p => p.type === 'project' && clusterProjectIds.has(p.ref))
      const anyPreds = projectPreds.filter(p => p.any)
      const allPreds = projectPreds.filter(p => !p.any)
      // any: need at least one met; if none met, all become goals
      if (anyPreds.length > 0) {
        const anyMet = anyPreds.some(p => (runningCompleted.get(p.ref) ?? 0) > 0)
        if (!anyMet) {
          for (const pred of anyPreds) {
            depGoals.push({ targetProjectId: pred.ref, isRisk: false })
          }
        }
      }
      // all: each must be met
      for (const pred of allPreds) {
        if ((runningCompleted.get(pred.ref) ?? 0) <= 0) {
          depGoals.push({ targetProjectId: pred.ref, isRisk: false })
        }
      }
    }

    const depIdsChosen: string[] = []
    for (const dg of depGoals) {
      const existing = goalEntries.find(g => g.projectGoal?.targetProjectId === dg.targetProjectId)
      if (existing) {
        if (!existing.dependentTaskIds.includes(projectId)) {
          existing.dependentTaskIds.push(projectId)
        }
      } else {
        goalEntries.push({
          id: `goal-${++goalSeq}`, kind: 'project', position: stepIndex,
          dependentTaskIds: [projectId],
          projectGoal: { targetProjectId: dg.targetProjectId },
        })
      }
      runningCompleted.set(dg.targetProjectId, (runningCompleted.get(dg.targetProjectId) ?? 0) + 1)
      depIdsChosen.push(dg.targetProjectId)
    }

    // 2. Stat condition goals: apply delta to runningStats
    // Sort: airpressure after its gas contributors (oxygen, methane, CO2)
    const DERIVED_FROM = new Set(['oxygen', 'methane', 'carbondioxide'])
    const apBeforeLoop = runningStats['airpressure']
    const sortedConditions = project.conditions
      .map((c, i) => ({ condition: c, originalIndex: i }))
      .sort((a, b) => {
        if (a.condition.stat === b.condition.stat) return 0
        if (a.condition.stat === 'airpressure' && DERIVED_FROM.has(b.condition.stat)) return 1
        if (b.condition.stat === 'airpressure' && DERIVED_FROM.has(a.condition.stat)) return -1
        return 0
      })
    for (const { condition, originalIndex } of sortedConditions) {
      const ci = originalIndex
      if (!isStatInRuntime(runningStats, condition.stat)) continue
      if (checkStatConditionMet(condition, currentStats(), data.stats)) continue

      const targetValue = computeTargetValue(condition, currentStats(), data.stats)
      const currentValue = currentStats()[condition.stat] ?? 0

      const existing = goalEntries.find(
        g => g.kind === 'stat' && g.statGoal?.statId === condition.stat && g.statGoal?.targetValue === targetValue,
      )
      if (existing) {
        if (!existing.dependentTaskIds.includes(projectId)) {
          existing.dependentTaskIds.push(projectId)
        }
      } else {
        goalEntries.push({
          id: `goal-${++goalSeq}`, kind: 'stat', position: stepIndex,
          dependentTaskIds: [projectId],
          statGoal: { statId: condition.stat, currentValue, targetValue, targetStatConditionIndex: ci },
        })
      }

      runningStats[condition.stat] = targetValue
    }

    // After applying goals, adjust airpressure if it was modified by a goal.
    // Only adjust when a stat goal actually changed airpressure, to avoid
    // affecting subsequent entries. deriveAirPressure adds the gas contribution.
    if (apBeforeLoop !== undefined && runningStats['airpressure'] !== undefined
        && runningStats['airpressure'] !== apBeforeLoop) {
      const gases = ['oxygen', 'methane', 'carbondioxide'] as const
      const initialAtmos = gases.reduce((sum, g) => sum + (cluster.initialStats[g] ?? 0), 0)
      const currentAtmos = gases.reduce((sum, g) => sum + (runningStats[g] ?? 0), 0)
      const initialContrib = Math.floor(initialAtmos / 4)
      const currentContrib = Math.floor(currentAtmos / 4)
      if (currentContrib !== initialContrib) {
        runningStats['airpressure'] = Math.max(0, runningStats['airpressure'] - (currentContrib - initialContrib))
      }
    }

    // 3. Re-evaluate after goals applied
    const afterGoalStats = currentStats()
    const { clusterProjects } = buildRuntimeClusterForReplay(cluster, data)
    const reEval = evaluateTerraformingProjectExecution(
      project, { stats: afterGoalStats, completedProjects: runningCompleted },
      projectMap, clusterProjects, data.stats,
    )

    if (reEval.valid) {
      pushStep(projectId, 'task', true, reEval)
    } else {
      pushStep(projectId, 'task', false, reEval)
    }

    // Rollback virtual project dependency completions
    for (const pid of depIdsChosen) {
      const c = runningCompleted.get(pid) ?? 0
      if (c > 0) runningCompleted.set(pid, c - 1)
    }

    return true
  }

  const maxIterations = 20
  const insertedEventIds = new Set<string>()
  const blockedStatIds = new Set<string>()
  const runtimeProjectIds = new Set(getRuntimeTerraformingProjectIds(cluster))
  const statAffectingEvents = data.projects.filter(
    p => p.group === 'events' && isStatAffectingEvent(p) && runtimeProjectIds.has(p.id),
  )
  // eventStatIds: stats referenced by event conditions (for blocking)
  const eventStatIds = new Set<string>()
  for (const event of statAffectingEvents) {
    for (const cond of event.conditions) eventStatIds.add(cond.stat)
  }

  let cursor = 0

  function isEventProjectId(projectId: string): boolean {
    return projectMap.get(projectId)?.group === 'events'
  }

  function nextLogEntryIsEvent(eventId: string): boolean {
    return log[cursor]?.projectId === eventId
  }

  function emitTriggeredEvent(event: TerraformingProject) {
    if (nextLogEntryIsEvent(event.id)) {
      cursor += 1
    }
    pushStep(event.id, 'auto-event', true)
    insertedEventIds.add(event.id)
  }

  function handleStaleEvent(entry: { projectId: string }) {
    if (mode === 'draft') return
    pushStep(entry.projectId, 'auto-event', false, {
      valid: false,
      reasons: ['stale auto-event'],
    })
  }

  function injectEventsAtPosition(initialPhase: boolean = false) {
    let triggered = true
    let iter = 0
    const triggeredAtThisPosition = new Set<string>()
    while (triggered && iter < maxIterations) {
      triggered = false
      iter++
      for (const event of statAffectingEvents) {
        if (triggeredAtThisPosition.has(event.id)) continue
        if (event.repeatCooldown === null && insertedEventIds.has(event.id)) continue
        if (event.repeatCooldown === null && (runningCompleted.get(event.id) ?? 0) > 0) continue
        if (!initialPhase && event.conditions.some(c => blockedStatIds.has(c.stat))) continue
        if (checkAllConditions(event.conditions, currentStats(), data.stats)) {
          emitTriggeredEvent(event)
          triggeredAtThisPosition.add(event.id)
          triggered = true
          break
        }
      }
    }
  }

  // 1. Initial events (not affected by goal blocking)
  injectEventsAtPosition(true)

  // 2. Process each log entry
  while (cursor < log.length) {
    const entry = log[cursor]!
    if (isEventProjectId(entry.projectId)) {
      cursor += 1
      handleStaleEvent(entry)
      continue
    }
    cursor += 1

    const stepIndex = steps.length
    const project = projectMap.get(entry.projectId)

    if (evaluations && project) {
      const baseStats = buildTerraformingBaseStats(cluster)
      const beforeStats = deriveAirPressure(
        cluster,
        applyProjectEffectsToTerraformingStats(baseStats, runningCompleted, projectMap, ignoredStats),
        ignoredStats,
      )
      const { clusterProjects } = buildRuntimeClusterForReplay(cluster, data)
      const evalResult = evaluateTerraformingProjectExecution(
        project, { stats: beforeStats, completedProjects: runningCompleted },
        projectMap, clusterProjects, data.stats,
      )

      if (evalResult.valid) {
        pushStep(entry.projectId, 'task', true, evalResult)
      } else if (goals) {
        // Block event conditions for unmet stat conditions
        if (project) {
          for (const cond of project.conditions) {
            if (eventStatIds.has(cond.stat) && !checkStatConditionMet(cond, currentStats(), data.stats)) {
              blockedStatIds.add(cond.stat)
              break
            }
          }
        }
        generateGoalsForEntry(entry.projectId, stepIndex)
      } else {
        pushStep(entry.projectId, 'task', false, evalResult)
      }
    } else {
      pushStep(entry.projectId, 'task', true)
    }
    injectEventsAtPosition()
  }

  // 3. End-of-queue events
  injectEventsAtPosition()

  return {
    steps,
    goalEntries,
    finalStats: currentStats(),
    finalCompleted: new Map(runningCompleted),
  }
}

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

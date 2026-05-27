import type {
  TerraformingCluster,
  TerraformingData,
  TerraformingProject,
} from './terraformingTaskResolver'

export interface TerraformingExecutionEntry {
  id: string
  projectId: string
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

export function computeTerraformingRuntimeStats(
  cluster: TerraformingCluster | null,
  completed: Map<string, number>,
  data: TerraformingData | null,
): Record<string, number> {
  const baseStats = buildTerraformingBaseStats(cluster)
  if (!cluster || !data) return baseStats
  const ignoredStats = getTerraformingIgnoredStats(cluster)
  const projectMap = buildProjectMap(data)
  const effectStats = applyProjectEffectsToTerraformingStats(baseStats, completed, projectMap, ignoredStats)
  return deriveAirPressure(cluster, effectStats, ignoredStats)
}

export function getRuntimeTerraformingProjectIds(
  cluster: TerraformingCluster | null,
): string[] {
  if (!cluster) return []
  return [...cluster.taskProjectIds]
}

import type { BuildGoal, BuildScheme, BuildPlan, BuildSchemeGroup } from '@/types/build-plan'
import type { SavedModule } from '@/types/x4'

function mergeModules(a: SavedModule[], b: SavedModule[]): SavedModule[] {
  const map = new Map<string, number>()
  for (const m of [...a, ...b]) {
    map.set(m.id, (map.get(m.id) || 0) + m.count)
  }
  return Array.from(map.entries()).map(([id, count]) => ({ id, count }))
}

function mergeTargetRates(
  incoming: Record<string, number>,
  manualWares: BuildGoal[],
): Record<string, number> {
  const result = { ...incoming }
  for (const w of manualWares) {
    if (w.type === 'production-rate') {
      result[w.wareId] = (result[w.wareId] || 0) + w.ratePerHour
    }
  }
  return result
}

export function rebuildSchemeGroups(
  groups: BuildSchemeGroup[],
  mergedSchemes: BuildScheme[],
): BuildSchemeGroup[] {
  let idx = 0
  return groups.map(g => ({
    ...g,
    schemes: g.schemes.map(() => mergedSchemes[idx++]!),
  }))
}

export function mergeIntoExistingPlan(
  incomingSchemes: BuildScheme[],
  existingPlan: BuildPlan | null,
): BuildScheme[] {
  if (!existingPlan) return incomingSchemes

  const existingByLabel = new Map<string, BuildScheme>()
  for (const s of existingPlan.schemes) {
    existingByLabel.set(s.label, s)
  }

  return incomingSchemes.map(incoming => {
    const existing = existingByLabel.get(incoming.label)
    if (!existing) return incoming

    const manualModules = existing.manualModules ?? []
    const manualWares = existing.manualWares ?? []

    return {
      ...incoming,
      modules: mergeModules(incoming.modules, manualModules),
      targetRates: mergeTargetRates(incoming.targetRates, manualWares),
      manualModules,
      manualWares,
    }
  })
}

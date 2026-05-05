import type { X4Module, X4Ware, SavedModule } from '@/types/x4'
import type { ProductionLineAllocation } from '@/types/build-plan'
import { expandGoalDependencies, mergeModules } from './calculateBuildFlowPlan'

export function computeGap(
  allocations: ProductionLineAllocation[],
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
): Record<string, number> {
  const gap: Record<string, number> = {}

  for (const alloc of allocations) {
    const requiredWares: string[] = []
    for (const goal of alloc.goals) {
      if (goal.type === 'required-production') {
        requiredWares.push(goal.wareId)
      }
    }
    if (requiredWares.length === 0) continue

    // Expand all production-type goals to get total modules
    let allModules: SavedModule[] = []
    for (const goal of alloc.goals) {
      if (goal.type === 'build-module') {
        allModules.push({ id: goal.moduleId, count: goal.count })
      } else if (goal.type === 'production-rate') {
        allModules = mergeModules([
          ...allModules,
          ...expandGoalDependencies(goal, modulesMap, waresMap),
        ])
      }
    }

    for (const m of allModules) {
      const mod = modulesMap[m.id]
      if (!mod || !mod.inputs) continue
      const cycleHourly = 3600 / (mod.cycleTime || 60)
      for (const w of requiredWares) {
        const inputPerCycle = mod.inputs[w]
        if (inputPerCycle) {
          gap[w] = (gap[w] || 0) + inputPerCycle * m.count * cycleHourly
        }
      }
    }
  }

  return gap
}

import type { X4Module, X4Ware, SavedModule } from '@/types/x4'
import type { ProductionLineAllocation, BuildFlowPlanLine } from '@/types/build-plan'
import { expandGoalDependencies, mergeModules } from './calculateBuildFlowPlan'

function addInputConsumption(
  gap: Record<string, number>,
  modules: SavedModule[],
  requiredWares: string[],
  modulesMap: Record<string, X4Module>,
): void {
  for (const m of modules) {
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

export function computeGap(
  allocations: ProductionLineAllocation[],
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
  graphNodes?: Map<string, BuildFlowPlanLine>,
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
    addInputConsumption(gap, allModules, requiredWares, modulesMap)
  }

  // Also compute gap from graph nodes' isolatedWares + modules
  if (graphNodes) {
    for (const [, node] of graphNodes) {
      if (!node.isolatedWares || node.isolatedWares.size === 0) continue
      const requiredWares = [...node.isolatedWares]
      addInputConsumption(gap, node.modules, requiredWares, modulesMap)
    }
  }

  return gap
}

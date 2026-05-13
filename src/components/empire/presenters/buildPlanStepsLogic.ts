import type {
  BuildScheme,
  BuildSchemeStep,
  BuildMaterial,
  BuildGroup,
} from '@/types/build-plan'
import type {
  X4Module,
  X4Ware,
  SavedModule,
  StationSettings,
} from '@/types/x4'

export interface BuildStepsScheme {
  baseScheme: BuildScheme
  steps: BuildSchemeStep[]
  stepsCount: number
  stepsTotalCredits: number
}

function mergeModules(modules: SavedModule[]): SavedModule[] {
  const map = new Map<string, number>()
  for (const m of modules) {
    map.set(m.id, (map.get(m.id) || 0) + m.count)
  }
  return Array.from(map.entries()).map(([id, count]) => ({ id, count }))
}

function calculateNetProduction(
  modules: SavedModule[],
  modulesMap: Record<string, X4Module>,
  bonus: boolean,
  sunlight: number
): Record<string, number> {
  const state: Record<string, number> = {}
  for (const item of modules) {
    const mod = modulesMap[item.id]
    if (!mod) continue
    const eff = bonus ? 1.3 : 1.0
    for (const [ware, val] of Object.entries(mod.outputs)) {
      let sf = 1.0
      if (ware === 'energycells') sf = sunlight / 100.0
      state[ware] = (state[ware] || 0) + item.count * (val as number) * eff * sf
    }
    for (const [ware, val] of Object.entries(mod.inputs)) {
      state[ware] = (state[ware] || 0) - item.count * (val as number)
    }
  }
  return state
}

export function makeSchemeSteps(
  groups: BuildGroup[],
  moduleMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
  settings: StationSettings,
  contextModules?: SavedModule[]
): BuildSchemeStep[] {
  let builtSoFar: SavedModule[] = contextModules ? [...contextModules] : []

  let cumDuration = 0
  let cumCredits = 0
  let order = 0
  const result: BuildSchemeStep[] = []
  const stock = new Map<string, number>()

  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi]!
    const sorted = [...group.modules].sort(
      (a, b) => (moduleMap[a.id]?.tier || 0) - (moduleMap[b.id]?.tier || 0)
    )
    for (const m of sorted) {
      const mod = moduleMap[m.id]
      if (!mod) continue
      for (let ci = 0; ci < m.count; ci++) {
        const buildTime = mod.buildTime
        const net = calculateNetProduction(builtSoFar, moduleMap, settings.considerWorkforceForAutoFill, settings.sunlight)
        const cost = mod.buildCost && Object.keys(mod.buildCost).length > 0 ? mod.buildCost : {}
        const buildTimeH = buildTime / 3600
        const materials: BuildMaterial[] = Object.entries(cost).map(([wareId, val]) => {
          const totalQty = (val as number)
          const prodRate = Math.max(0, net[wareId] || 0)
          const warePrice = waresMap[wareId]?.price || 0
          const prevStock = stock.get(wareId) || 0
          const coveredByStock = Math.min(totalQty, prevStock)
          const deficitQty = totalQty - coveredByStock
          const credits = deficitQty * warePrice
          stock.set(wareId, prevStock - coveredByStock)
          const produced = prodRate * buildTimeH
          return {
            wareId,
            quantity: totalQty,
            currentProdRate: prodRate,
            stockBefore: prevStock,
            producedDuringBuild: produced,
            estimatedTime: 0,
            creditsNeeded: credits
          }
        })
        for (const [wareId, val] of Object.entries(net)) {
          const rate = val as number
          if (rate > 0) stock.set(wareId, (stock.get(wareId) || 0) + rate * buildTimeH)
        }

        cumDuration += buildTime
        cumCredits += materials.reduce((s, mat) => s + mat.creditsNeeded, 0)

        builtSoFar = mergeModules([...builtSoFar, { id: m.id, count: 1 }])

        order++
        result.push({
          order,
          moduleId: m.id,
          moduleCount: 1,
          moduleBuildTime: buildTime,
          materials,
          estimatedDuration: cumDuration,
          estimatedCredits: cumCredits,
          reason: group.reason,
          groupIndex: gi
        })
      }
    }
  }
  return result
}

export function buildStepsScheme(
  scheme: BuildScheme,
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
  settings: StationSettings
): BuildStepsScheme {
  const groups: BuildGroup[] = [{ reason: scheme.label, modules: scheme.modules }]
  const steps = makeSchemeSteps(groups, modulesMap, waresMap, settings)
  
  return {
    baseScheme: scheme,
    steps,
    stepsCount: steps.length,
    stepsTotalCredits: steps.length > 0 ? steps[steps.length - 1]!.estimatedCredits : 0,
  }
}
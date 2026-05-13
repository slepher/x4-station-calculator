import type {
  BuildScheme,
  BuildSchemeStep,
  BuildMaterial,
  BuildGroup,
  BuildSchemeGroup,
} from '@/types/build-plan'
import { autoFillForLine } from '@/store/logic/calculateBuildFlowPlan'
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
  greedyDebug?: {
    exitModules: SavedModule[]
    exitNetProduction: Record<string, number>
    exitSatisfactions: Array<{
      wareId: string
      targetRate: number
      prodRate: number
      satisfied: boolean
    }>
  }
}

export type BuildStepsSchemeGroupType = BuildSchemeGroup['groupType']

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

function moduleCountMap(modules: SavedModule[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const module of modules) {
    map.set(module.id, (map.get(module.id) || 0) + module.count)
  }
  return map
}

function sortModulesByTierAndName(
  modules: SavedModule[],
  moduleMap: Record<string, X4Module>,
): SavedModule[] {
  return [...modules].sort((a, b) => {
    const modA = moduleMap[a.id]
    const modB = moduleMap[b.id]
    if (!modA || !modB) return a.id.localeCompare(b.id)
    if (modA.tier !== modB.tier) return modA.tier - modB.tier
    return modA.name.localeCompare(modB.name)
  })
}

function getBuildMaterialTargetRates(
  scheme: BuildScheme,
): Array<[string, number]> {
  const rates = scheme.stepTargetRates || scheme.targetRates
  return Object.entries(rates)
    .filter(([, rate]) => rate > 0)
    .filter(([wareId]) => wareId !== 'energycells')
}

function findPreferredProducerFromScheme(
  wareId: string,
  schemeModules: SavedModule[],
  currentCounts: Map<string, number>,
  modulesMap: Record<string, X4Module>,
): string | null {
  const candidates = schemeModules
    .filter(module => (currentCounts.get(module.id) || 0) < module.count)
    .filter(module => {
      const mod = modulesMap[module.id]
      return Boolean(mod && (mod.outputs[wareId] || 0) > 0)
    })
    .sort((a, b) => {
      const modA = modulesMap[a.id]
      const modB = modulesMap[b.id]
      const rateA = (modA?.outputs[wareId] || 0) as number
      const rateB = (modB?.outputs[wareId] || 0) as number
      if (rateA !== rateB) return rateB - rateA
      if ((modA?.tier || 0) !== (modB?.tier || 0)) return (modA?.tier || 0) - (modB?.tier || 0)
      return (modA?.name || a.id).localeCompare(modB?.name || b.id)
    })

  return candidates[0]?.id || null
}

function buildRequiredGoalsForIsolatedWares(
  scheme: BuildScheme,
) {
  return (scheme.isolatedWareIds || []).map(wareId => ({
    type: 'required-production' as const,
    wareId,
    ratePerHour: 0,
  }))
}

function diffModuleCounts(
  previousCounts: Map<string, number>,
  nextCounts: Map<string, number>,
): SavedModule[] {
  const delta: SavedModule[] = []
  for (const [moduleId, nextCount] of nextCounts.entries()) {
    const previousCount = previousCounts.get(moduleId) || 0
    if (nextCount > previousCount) {
      delta.push({ id: moduleId, count: nextCount - previousCount })
    }
  }
  return delta
}

function capModulesToFinalScheme(
  modules: SavedModule[],
  finalCounts: Map<string, number>,
): SavedModule[] {
  const capped: SavedModule[] = []
  for (const module of mergeModules(modules)) {
    const maxCount = finalCounts.get(module.id) || 0
    if (maxCount <= 0) continue
    const cappedCount = Math.min(module.count, maxCount)
    if (cappedCount > 0) capped.push({ id: module.id, count: cappedCount })
  }
  return capped
}

function buildStepModulesFromCurrentModules(
  currentModules: SavedModule[],
  addedPrimaryModules: SavedModule[],
  isolatedGoals: ReturnType<typeof buildRequiredGoalsForIsolatedWares>,
  finalCounts: Map<string, number>,
  settings: StationSettings,
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
): SavedModule[] {
  const plannedModules = mergeModules([...currentModules, ...addedPrimaryModules])
  const autoFill = autoFillForLine(
    plannedModules,
    isolatedGoals,
    settings,
    modulesMap,
    waresMap,
  )
  return capModulesToFinalScheme(
    mergeModules([
      ...plannedModules,
      ...autoFill.autoIndustryModules,
      ...autoFill.autoHabitationModules,
    ]),
    finalCounts,
  )
}

function buildGreedyBuildMaterialGroups(
  scheme: BuildScheme,
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
  settings: StationSettings,
): {
  groups: BuildGroup[]
  greedyExitModules: SavedModule[]
  greedyExitNetProduction: Record<string, number>
  greedyExitSatisfactions: Array<{
    wareId: string
    targetRate: number
    prodRate: number
    satisfied: boolean
  }>
} {
  const targetRates = getBuildMaterialTargetRates(scheme)
  if (targetRates.length === 0) {
    return {
      groups: [],
      greedyExitModules: [],
      greedyExitNetProduction: {},
      greedyExitSatisfactions: [],
    }
  }

  const finalModules = mergeModules(scheme.modules)
  const isolatedGoals = buildRequiredGoalsForIsolatedWares(scheme)
  const groups: BuildGroup[] = []
  let currentModules: SavedModule[] = []
  let maxIterations = 120
  const finalCounts = moduleCountMap(finalModules)
  let greedyExitModules: SavedModule[] = []
  let greedyExitNetProduction: Record<string, number> = {}
  let greedyExitSatisfactions: Array<{
    wareId: string
    targetRate: number
    prodRate: number
    satisfied: boolean
  }> = []

  function captureGreedyExitSnapshot(modules: SavedModule[]) {
    const mergedModules = mergeModules(modules)
    const net = calculateNetProduction(
      mergedModules,
      modulesMap,
      settings.considerWorkforceForAutoFill,
      settings.sunlight,
    )
    greedyExitModules = mergedModules
    greedyExitNetProduction = { ...net }
    greedyExitSatisfactions = targetRates.map(([wareId, targetRate]) => {
      const prodRate = Math.max(0, net[wareId] || 0)
      return {
        wareId,
        targetRate,
        prodRate,
        satisfied: prodRate + 0.001 >= targetRate,
      }
    })
  }

  while (maxIterations-- > 0) {
    const net = calculateNetProduction(
      currentModules,
      modulesMap,
      settings.considerWorkforceForAutoFill,
      settings.sunlight,
    )

    let allMet = true
    let bottleneckWareId: string | null = null
    let worstSatisfaction = Infinity
    let tieBreakerRate = -Infinity

    for (const [wareId, targetRate] of targetRates) {
      const prodRate = Math.max(0, net[wareId] || 0)
      if (prodRate + 0.001 < targetRate) allMet = false
      const satisfaction = prodRate / targetRate
      if (
        satisfaction < worstSatisfaction
        || (Math.abs(satisfaction - worstSatisfaction) < 0.000001 && targetRate > tieBreakerRate)
      ) {
        bottleneckWareId = wareId
        worstSatisfaction = satisfaction
        tieBreakerRate = targetRate
      }
    }

    if (allMet || !bottleneckWareId) {
      captureGreedyExitSnapshot(currentModules)
      break
    }

    const producerId = findPreferredProducerFromScheme(
      bottleneckWareId,
      finalModules,
      moduleCountMap(currentModules),
      modulesMap,
    )
    if (!producerId) {
      captureGreedyExitSnapshot(currentModules)
      break
    }

    const previousCounts = moduleCountMap(currentModules)
    const nextModules = buildStepModulesFromCurrentModules(
      currentModules,
      [{ id: producerId, count: 1 }],
      isolatedGoals,
      finalCounts,
      settings,
      modulesMap,
      waresMap,
    )
    const deltaModules = diffModuleCounts(previousCounts, moduleCountMap(nextModules))
    if (deltaModules.length === 0) {
      captureGreedyExitSnapshot(currentModules)
      break
    }
    currentModules = nextModules
    groups.push({
      reason: `Build mat: ${bottleneckWareId}`,
      modules: deltaModules,
    })
  }

  if (greedyExitSatisfactions.length === 0) {
    captureGreedyExitSnapshot(currentModules)
  }

  const primaryModuleIds = new Set(scheme.primaryModuleIds)
  const remainingPrimaryModules = sortModulesByTierAndName(
    finalModules.filter(module => primaryModuleIds.has(module.id)),
    modulesMap,
  )

  for (const module of remainingPrimaryModules) {
    const currentCounts = moduleCountMap(currentModules)
    const remaining = module.count - (currentCounts.get(module.id) || 0)
    if (remaining <= 0) continue

    const previousCounts = currentCounts
    const nextModules = buildStepModulesFromCurrentModules(
      currentModules,
      [{ id: module.id, count: remaining }],
      isolatedGoals,
      finalCounts,
      settings,
      modulesMap,
      waresMap,
    )
    const deltaModules = diffModuleCounts(previousCounts, moduleCountMap(nextModules))
    if (deltaModules.length === 0) continue
    currentModules = nextModules
    groups.push({
      reason: `tail-fill: ${module.id}`,
      modules: deltaModules,
    })
  }

  return {
    groups,
    greedyExitModules,
    greedyExitNetProduction,
    greedyExitSatisfactions,
  }
}

export function canBuildStepsScheme(
  scheme: BuildScheme,
  groupType: BuildStepsSchemeGroupType,
): boolean {
  return groupType === 'build-material'
    && scheme.modules.length > 0
    && getBuildMaterialTargetRates(scheme).length > 0
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
  groupType: BuildStepsSchemeGroupType,
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
  settings: StationSettings
): BuildStepsScheme | null {
  if (!canBuildStepsScheme(scheme, groupType)) return null

  const greedyResult = buildGreedyBuildMaterialGroups(
    scheme,
    modulesMap,
    waresMap,
    settings,
  )
  const steps = makeSchemeSteps(greedyResult.groups, modulesMap, waresMap, settings)
  
  return {
    baseScheme: scheme,
    steps,
    stepsCount: steps.length,
    stepsTotalCredits: steps.length > 0 ? steps[steps.length - 1]!.estimatedCredits : 0,
    greedyDebug: {
      exitModules: greedyResult.greedyExitModules,
      exitNetProduction: greedyResult.greedyExitNetProduction,
      exitSatisfactions: greedyResult.greedyExitSatisfactions,
    },
  }
}

import type {
  SavedModule,
  X4Module,
  X4Ware,
  StationSettings,
  RaceMedicalConsumption
} from '../../types/x4'
import type { BaseModuleFlowAtom, WareProductionFlow } from '../../types/production-flow'
import {
  findBestProducer,
  findBestHabitat,
  getProductionEfficiency
} from './bestModuleSelector'
import { calculateWorkforceCensus } from './calculatorUtils'
import {
  calculateWorkforceBreakdown,
  calculateActualWorkforce,
  calculateEfficiencySaturation
} from './workforceCalculator'

export interface CalculateAutoFillInput {
  plannedModules: SavedModule[]
  settings: StationSettings
  modulesMap: Record<string, X4Module>
  waresMap: Record<string, X4Ware>
  lockedWares: string[]
}

export interface CalculateAutoFillOutput {
  autoIndustryModules: SavedModule[]
  autoHabitationModules: SavedModule[]
}

export function calculateAutoFillModules(
  input: CalculateAutoFillInput
): CalculateAutoFillOutput {
  const {
    plannedModules,
    settings,
    modulesMap,
    waresMap,
    lockedWares
  } = input

  const race = settings.racePreference
  const globalWorkforceBonus = settings.considerWorkforceForAutoFill

  const industryModules: Record<string, number> = {}
  plannedModules.forEach(m => {
    industryModules[m.id] = (industryModules[m.id] || 0) + m.count
  })

  let loopCount = 0
  let hasDeficit = true

  while (hasDeficit && loopCount < 50) {
    hasDeficit = false
    loopCount++

    const currentModulesAsSaved: SavedModule[] = Object.entries(industryModules).map(([id, count]) => ({ id, count }))
    const productionState = calculateNetProductionInternal(
      currentModulesAsSaved,
      modulesMap,
      globalWorkforceBonus,
      settings.sunlight
    )

    const sortedWares = Object.entries(productionState)
      .sort(([idA], [idB]) => (waresMap[idB]?.tier || 0) - (waresMap[idA]?.tier || 0))

    for (const [wareId, netAmount] of sortedWares) {
      if (netAmount >= -0.001) continue

      const deficit = Math.abs(netAmount)

      if (lockedWares.includes(wareId)) continue

      const producer = findBestProducer(wareId, race, currentModulesAsSaved, modulesMap, waresMap)
      if (!producer) continue

      const eff = getProductionEfficiency(producer, globalWorkforceBonus)

      let sunlightFactor = 1.0
      if (wareId === 'energycells') {
        sunlightFactor = settings.sunlight / 100.0
      }

      const singleOutput = (producer.outputs[wareId] || 0) * eff * sunlightFactor
      if (singleOutput <= 0) continue

      const countNeeded = Math.ceil(deficit / singleOutput)

      industryModules[producer.id] = (industryModules[producer.id] || 0) + countNeeded
      hasDeficit = true
    }
  }

  const autoIndustry: SavedModule[] = Object.entries(industryModules)
    .map(([id, count]) => {
      const existingCount = plannedModules.find(m => m.id === id)?.count || 0
      return { id, count: count - existingCount }
    })
    .filter(m => m.count > 0)
    .sort((a, b) => (modulesMap[b.id]?.tier || 0) - (modulesMap[a.id]?.tier || 0))

  const autoHabitation: SavedModule[] = []

  const allProducers: SavedModule[] = [...plannedModules, ...autoIndustry]
  const clientPopulation = calculateTotalWorkforceInternal(allProducers, modulesMap)

  if (globalWorkforceBonus && clientPopulation > 0) {
    const industrialWorkers = calculateTotalWorkforceInternal(allProducers, modulesMap)

    if (industrialWorkers > 0) {
      const habitat = findBestHabitat(race, allProducers, modulesMap)

      if (habitat) {
        const habitatCount = Math.ceil(industrialWorkers / habitat.workforce.capacity)

        const existingHabitatCount = plannedModules
          .filter(m => modulesMap[m.id]?.type === 'habitation')
          .reduce((sum, m) => sum + m.count, 0)

        const neededHabitats = Math.max(0, habitatCount - existingHabitatCount)

        if (neededHabitats > 0) {
          autoHabitation.push({ id: habitat.id, count: neededHabitats })
        }
      }
    }
  }

  return { 
    autoIndustryModules: autoIndustry,
    autoHabitationModules: autoHabitation
  }
}

export interface CalculateProductionFlowsCoreInput {
  plannedModules: SavedModule[]
  autoIndustryModules: SavedModule[]
  autoHabitationModules: SavedModule[]
  modulesMap: Record<string, X4Module>
  waresMap: Record<string, X4Ware>
  medicalConsumptionMap: RaceMedicalConsumption
  settings: StationSettings
  warePriority: Record<string, number>
  actualWorkforceOverride?: number
  saturationOverride?: number
}

export interface CalculateProductionFlowsCoreOutput {
  productionFlows: WareProductionFlow[]
  actualWorkforce: number
  currentEfficiency: number
}

export function calculateProductionFlowsCore(
  input: CalculateProductionFlowsCoreInput
): CalculateProductionFlowsCoreOutput {
  const {
    plannedModules,
    autoIndustryModules,
    autoHabitationModules,
    modulesMap,
    waresMap,
    medicalConsumptionMap,
    settings,
    warePriority,
    actualWorkforceOverride,
    saturationOverride
  } = input

  const allModules = [...plannedModules, ...autoIndustryModules, ...autoHabitationModules]
  const internalResult = calculateProductionFlowsInternal(
    allModules,
    modulesMap,
    waresMap,
    medicalConsumptionMap,
    settings,
    warePriority,
    actualWorkforceOverride,
    saturationOverride
  )

  return {
    productionFlows: internalResult.productionFlows,
    actualWorkforce: internalResult.actualWorkforce,
    currentEfficiency: internalResult.saturation
  }
}

export interface CalculateProductionFlowsInput {
  plannedModules: SavedModule[]
  settings: StationSettings
  modulesMap: Record<string, X4Module>
  waresMap: Record<string, X4Ware>
  lockedWares: string[]
  medicalConsumptionMap: RaceMedicalConsumption
  warePriority: Record<string, number>
}

export interface CalculateProductionFlowsOutput {
  autoIndustryModules: SavedModule[]
  autoHabitationModules: SavedModule[]
  productionFlows: WareProductionFlow[]
  actualWorkforce: number
  currentEfficiency: number
}

export function calculateProductionFlows(
  input: CalculateProductionFlowsInput
): CalculateProductionFlowsOutput {
  const {
    plannedModules,
    settings,
    modulesMap,
    waresMap,
    lockedWares,
    medicalConsumptionMap,
    warePriority
  } = input

  const autoFillResult = calculateAutoFillModules({
    plannedModules,
    settings,
    modulesMap,
    waresMap,
    lockedWares
  })

  const coreResult = calculateProductionFlowsCore({
    plannedModules,
    autoIndustryModules: autoFillResult.autoIndustryModules,
    autoHabitationModules: autoFillResult.autoHabitationModules,
    modulesMap,
    waresMap,
    medicalConsumptionMap,
    settings,
    warePriority
  })

  return {
    autoIndustryModules: autoFillResult.autoIndustryModules,
    autoHabitationModules: autoFillResult.autoHabitationModules,
    productionFlows: coreResult.productionFlows,
    actualWorkforce: coreResult.actualWorkforce,
    currentEfficiency: coreResult.currentEfficiency
  }
}

function calculateNetProductionInternal(
  modules: SavedModule[],
  modulesMap: Record<string, X4Module>,
  bonus: boolean,
  sunlight: number
): Record<string, number> {
  const productionState: Record<string, number> = {}

  for (const moduleItem of modules) {
    const module = modulesMap[moduleItem.id]
    if (!module) continue

    const eff = getProductionEfficiency(module, bonus)

    for (const [outWare, val] of Object.entries(module.outputs)) {
      let sunlightFactor = 1.0
      if (outWare === 'energycells') {
        sunlightFactor = sunlight / 100.0
      }
      productionState[outWare] = (productionState[outWare] || 0) + (moduleItem.count * val * eff * sunlightFactor)
    }

    for (const [inWare, val] of Object.entries(module.inputs)) {
      productionState[inWare] = (productionState[inWare] || 0) - (moduleItem.count * val)
    }
  }

  return productionState
}

function calculateTotalWorkforceInternal(
  modules: SavedModule[],
  modulesMap: Record<string, X4Module>
): number {
  let totalWorkers = 0

  for (const moduleItem of modules) {
    const module = modulesMap[moduleItem.id]
    if (module?.workforce?.needed) {
      totalWorkers += moduleItem.count * module.workforce.needed
    }
  }

  return totalWorkers
}

interface ProductionFlowsInternalResult {
  productionFlows: WareProductionFlow[]
  actualWorkforce: number
  saturation: number
}

function calculateProductionFlowsInternal(
  plannedModules: SavedModule[],
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
  medicalConsumptionMap: RaceMedicalConsumption,
  settings: StationSettings,
  _warePriority: Record<string, number>,
  actualWorkforceOverride?: number,
  saturationOverride?: number
): ProductionFlowsInternalResult {
  const flowMap: Record<string, WareProductionFlow> = {}

  const wareOrderMap = new Map<string, number>()
  plannedModules.forEach((mod, index) => {
    const info = modulesMap[mod.id]
    if (!info) return
    Object.keys(info.outputs || {}).forEach(wareId => {
      if (!wareOrderMap.has(wareId)) wareOrderMap.set(wareId, index)
    })
  })

  const getOrInitFlow = (wareId: string): WareProductionFlow => {
    if (!flowMap[wareId]) {
      const ware = waresMap[wareId]
      flowMap[wareId] = {
        wareId,
        orderIndex: wareOrderMap.get(wareId) ?? Number.MAX_SAFE_INTEGER,
        tier: ware?.tier || 0,
        transportType: ware?.transport || 'container',
        unitVolume: ware?.volume || 0,
        production: 0,
        consumption: 0,
        workforceConsumption: 0,
        netRate: 0,
        contributions: []
      }
    }
    return flowMap[wareId]
  }

  const workforceBreakdown = calculateWorkforceBreakdown(plannedModules, modulesMap, settings)
  const actualWorkforce = actualWorkforceOverride ?? calculateActualWorkforce(workforceBreakdown, settings)
  const saturation = saturationOverride ?? calculateEfficiencySaturation(workforceBreakdown.needed.total, actualWorkforce)

  plannedModules.forEach(item => {
    const info = modulesMap[item.id]
    if (!info) return

    const currentBonusRatio = saturation * (info.workforce?.maxBonus || 0)
    const moduleEff = 1.0 + currentBonusRatio

    for (const [wareId, hourlyAmount] of Object.entries(info.outputs)) {
      const entry = getOrInitFlow(wareId)

      let sunlightFactor = 1.0
      if (wareId === 'energycells') sunlightFactor = settings.sunlight / 100.0

      const actualAmount = hourlyAmount * item.count * moduleEff * sunlightFactor

      entry.production += actualAmount

      const contribution: BaseModuleFlowAtom = {
        moduleId: item.id,
        count: item.count,
        type: 'production',
        amount: actualAmount,
        bonusPercent: Math.round(currentBonusRatio * 100)
      }
      entry.contributions.push(contribution)
    }

    for (const [wareId, hourlyAmount] of Object.entries(info.inputs)) {
      const entry = getOrInitFlow(wareId)

      const actualAmount = hourlyAmount * item.count

      entry.consumption += actualAmount

      const contribution: BaseModuleFlowAtom = {
        moduleId: item.id,
        count: item.count,
        type: 'consumption',
        amount: -actualAmount,
        bonusPercent: 0
      }
      entry.contributions.push(contribution)
    }
  })

  const censusItems = calculateWorkforceCensus(plannedModules, modulesMap, actualWorkforce)

  censusItems.forEach(item => {
    const raceKey = item.race in medicalConsumptionMap ? item.race : 'default'
    const wares = medicalConsumptionMap[raceKey]

    if (!wares) return

    for (const [wareId, perPersonPerSecond] of Object.entries(wares)) {
      const entry = getOrInitFlow(wareId)

      const hourlyAmount = item.residents * (perPersonPerSecond as number) * 3600

      entry.consumption += hourlyAmount
      entry.workforceConsumption += hourlyAmount

      const contribution: BaseModuleFlowAtom = {
        moduleId: item.moduleId,
        count: item.count,
        type: 'consumption',
        amount: -hourlyAmount,
        bonusPercent: 0
      }
      entry.contributions.push(contribution)
    }
  })

  const allFlows = Object.values(flowMap).map(entry => {
    entry.netRate = entry.production - entry.consumption
    return entry
  })

  allFlows.sort((a, b) => {
    if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex
    if (a.tier !== b.tier) return b.tier - a.tier
    return Math.abs(b.netRate) - Math.abs(a.netRate)
  })

  return { productionFlows: allFlows, actualWorkforce, saturation }
}

import type {
  SavedModule,
  X4Module,
  X4Ware,
  StationSettings,
  WorkforceConsumptionMap
} from '../../types/x4'
import type { FlowContribution, WareProductionFlow } from '../../types/production-flow'
import type { WorkforceEntry } from '../../types/saveArchive'
import {
  findBestProducer,
  findBestModuleWithReferenceQuota,
  getProductionEfficiency
} from './bestModuleSelector'
import { calculateWorkforceCensus } from './calculatorUtils'
import { getReferenceProductionFloorModules, maxSavedModules, mergeSavedModules } from './planningRecommendedModules'
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
  referenceModules?: SavedModule[]
}

export interface CalculateAutoFillOutput {
  autoIndustryModules: SavedModule[]
  autoHabitationModules: SavedModule[]
}

export function calculateAutoIndustryModules(
  input: CalculateAutoFillInput
): SavedModule[] {
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

  return autoIndustry
}

export interface CalculateAutoIndustryWithFloorOutput {
  autoIndustryModules: SavedModule[]
}

export function calculateAutoIndustryModulesWithFloor(
  input: CalculateAutoFillInput
): CalculateAutoIndustryWithFloorOutput {
  const referenceProductionFloorModules = getReferenceProductionFloorModules(
    input.referenceModules || [],
    input.modulesMap
  )

  const effectivePlanned = maxSavedModules(input.plannedModules, referenceProductionFloorModules)
  const baseAuto = calculateAutoIndustryModules({
    ...input,
    plannedModules: effectivePlanned
  })
  const floorBeyondPlanned = referenceProductionFloorModules.map(m => ({
    id: m.id,
    count: Math.max(0, m.count - (input.plannedModules.find(p => p.id === m.id)?.count || 0))
  })).filter(m => m.count > 0)
  const autoIndustryModules = mergeSavedModules([...baseAuto, ...floorBeyondPlanned])
    .sort((a, b) => (input.modulesMap[b.id]?.tier || 0) - (input.modulesMap[a.id]?.tier || 0))

  return {
    autoIndustryModules
  }
}

export interface CalculateAutoHabitationInput {
  plannedModules: SavedModule[]
  autoIndustryModules: SavedModule[]
  settings: StationSettings
  modulesMap: Record<string, X4Module>
  referenceModules?: SavedModule[]
}

export function calculateAutoHabitationModules(
  input: CalculateAutoHabitationInput
): SavedModule[] {
  const {
    plannedModules,
    autoIndustryModules,
    settings,
    modulesMap,
    referenceModules
  } = input

  const race = settings.racePreference
  const globalWorkforceBonus = settings.considerWorkforceForAutoFill
  const refMods = referenceModules || []
  const autoHabitation: SavedModule[] = []

  const allProducers: SavedModule[] = [...plannedModules, ...autoIndustryModules]
  const clientPopulation = calculateTotalWorkforceInternal(allProducers, modulesMap)

  if (!(globalWorkforceBonus && clientPopulation > 0)) {
    return autoHabitation
  }

  const industrialWorkers = calculateTotalWorkforceInternal(allProducers, modulesMap)

  if (industrialWorkers <= 0) {
    return autoHabitation
  }

  const existingHabitationCapacity = plannedModules
    .filter(m => modulesMap[m.id]?.type === 'habitation')
    .reduce((sum, m) => sum + ((modulesMap[m.id]?.workforce.capacity || 0) * m.count), 0)

  let remainingHabitationCapacity = Math.max(0, industrialWorkers - existingHabitationCapacity)
  const habitationRefQuota: Record<string, number> = {}
  for (const ref of refMods) {
    const module = modulesMap[ref.id]
    if (!module || module.type !== 'habitation') continue
    const unitCapacity = module.workforce?.capacity || 0
    if (unitCapacity <= 0) continue
    habitationRefQuota[ref.id] = (habitationRefQuota[ref.id] || 0) + unitCapacity * ref.count
  }

  let habitationLoopCount = 0
  while (remainingHabitationCapacity > 0 && habitationLoopCount < 50) {
    habitationLoopCount++
    const selection = findBestModuleWithReferenceQuota(
      race,
      [...allProducers, ...autoHabitation],
      modulesMap,
      refMods,
      habitationRefQuota,
      (module) => module.type === 'habitation',
      (a, b) => (b.workforce?.capacity || 0) - (a.workforce?.capacity || 0)
    )

    if (!selection) break

    const unitCapacity = selection.module.workforce?.capacity || 0
    if (unitCapacity <= 0) break

    let countNeeded = Math.ceil(remainingHabitationCapacity / unitCapacity)
    if (!selection.exhaustedQuota) {
      const quota = habitationRefQuota[selection.module.id] || 0
      const maxFromQuota = Math.floor(quota / unitCapacity)
      if (maxFromQuota <= 0) {
        habitationRefQuota[selection.module.id] = 0
        continue
      }
      countNeeded = Math.min(countNeeded, maxFromQuota)
      habitationRefQuota[selection.module.id] = Math.max(0, quota - countNeeded * unitCapacity)
    }

    const existing = autoHabitation.find((module) => module.id === selection.module.id)
    if (existing) existing.count += countNeeded
    else autoHabitation.push({ id: selection.module.id, count: countNeeded })

    remainingHabitationCapacity = Math.max(0, remainingHabitationCapacity - countNeeded * unitCapacity)
  }

  return autoHabitation
}

export function calculateAutoFillModules(
  input: CalculateAutoFillInput
): CalculateAutoFillOutput {
  const autoIndustry = calculateAutoIndustryModules(input)
  const autoHabitation = calculateAutoHabitationModules({
    plannedModules: input.plannedModules,
    autoIndustryModules: autoIndustry,
    settings: input.settings,
    modulesMap: input.modulesMap
  })

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
  workforceConsumptionMap: WorkforceConsumptionMap
  settings: StationSettings
  warePriority: Record<string, number>
  actualWorkforceOverride?: number
  saturationOverride?: number
  workforceOverride?: WorkforceEntry[]
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
    workforceConsumptionMap,
    settings,
    warePriority,
    actualWorkforceOverride,
    saturationOverride,
    workforceOverride
  } = input

  const allModules = [...plannedModules, ...autoIndustryModules, ...autoHabitationModules]
  const internalResult = calculateProductionFlowsInternal(
    allModules,
    modulesMap,
    waresMap,
    workforceConsumptionMap,
    settings,
    warePriority,
    actualWorkforceOverride,
    saturationOverride,
    workforceOverride
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
  workforceConsumptionMap: WorkforceConsumptionMap
  warePriority: Record<string, number>
  referenceModules?: SavedModule[]
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
    workforceConsumptionMap,
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
    workforceConsumptionMap,
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

function aggregateRaceEntries(entries: WorkforceEntry[]): WorkforceEntry[] {
  const byRace = new Map<string, number>()

  entries.forEach(entry => {
    if (entry.amount <= 0) return
    byRace.set(entry.race, (byRace.get(entry.race) || 0) + entry.amount)
  })

  return Array.from(byRace.entries()).map(([race, amount]) => ({ race, amount }))
}

function buildRaceEntriesFromCensus(
  censusItems: Array<{ race: string; residents: number }>
): WorkforceEntry[] {
  return aggregateRaceEntries(
    censusItems.map(item => ({
      race: item.race,
      amount: item.residents
    }))
  )
}

function applySharedWorkforceConsumption(
  raceEntries: WorkforceEntry[],
  neededWorkforce: number,
  workforceConsumptionMap: WorkforceConsumptionMap,
  getOrInitFlow: (wareId: string) => WareProductionFlow
): number {
  const totalResidents = raceEntries.reduce((sum, entry) => sum + entry.amount, 0)
  const busyWorkers = Math.min(totalResidents, neededWorkforce)

  raceEntries.forEach(entry => {
    const raceKey = entry.race in workforceConsumptionMap ? entry.race : 'default'
    const raceConsumption = workforceConsumptionMap[raceKey]

    if (!raceConsumption) return

    const raceBusy = totalResidents > 0
      ? (entry.amount / totalResidents) * busyWorkers
      : 0
    const raceIdle = entry.amount - raceBusy

    if (raceBusy > 0) {
      const busyWares = raceConsumption.busy || {}
      for (const [wareId, perPersonPerHour] of Object.entries(busyWares)) {
        const hourlyAmount = raceBusy * perPersonPerHour

        if (hourlyAmount <= 0) continue

        const flowEntry = getOrInitFlow(wareId)
        flowEntry.consumption += hourlyAmount

        const contribution: FlowContribution = {
          id: entry.race,
          class: 'workforce',
          type: 'consumption',
          count: raceBusy,
          amount: -hourlyAmount,
          bonusPercent: 0
        }
        flowEntry.contributions.push(contribution)
      }
    }

    if (raceIdle > 0) {
      const idleWares = raceConsumption.idle || {}
      for (const [wareId, perPersonPerHour] of Object.entries(idleWares)) {
        const hourlyAmount = raceIdle * perPersonPerHour

        if (hourlyAmount <= 0) continue

        const flowEntry = getOrInitFlow(wareId)
        flowEntry.consumption += hourlyAmount

        const contribution: FlowContribution = {
          id: entry.race,
          class: 'workforce_idle',
          type: 'consumption',
          count: raceIdle,
          amount: -hourlyAmount,
          bonusPercent: 0
        }
        flowEntry.contributions.push(contribution)
      }
    }
  })

  return busyWorkers
}

function calculateProductionFlowsInternal(
  plannedModules: SavedModule[],
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
  workforceConsumptionMap: WorkforceConsumptionMap,
  settings: StationSettings,
  _warePriority: Record<string, number>,
  actualWorkforceOverride?: number,
  saturationOverride?: number,
  workforceOverride?: WorkforceEntry[]
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
        netRate: 0,
        contributions: []
      }
    }
    return flowMap[wareId]
  }

  const workforceBreakdown = calculateWorkforceBreakdown(plannedModules, modulesMap, settings)
  let actualWorkforce: number
  let saturation: number

  if (workforceOverride && workforceOverride.length > 0) {
    const neededWorkforce = workforceBreakdown.needed.total
    const raceEntries = aggregateRaceEntries(workforceOverride)
    actualWorkforce = applySharedWorkforceConsumption(
      raceEntries,
      neededWorkforce,
      workforceConsumptionMap,
      getOrInitFlow
    )
    saturation = saturationOverride ?? calculateEfficiencySaturation(neededWorkforce, actualWorkforce)
  } else {
    const requestedWorkforce = actualWorkforceOverride ?? calculateActualWorkforce(workforceBreakdown, settings)
    actualWorkforce = requestedWorkforce
    saturation = saturationOverride ?? calculateEfficiencySaturation(workforceBreakdown.needed.total, actualWorkforce)

    const censusItems = calculateWorkforceCensus(plannedModules, modulesMap, requestedWorkforce)

    if (settings.workforceAuto) {
      censusItems.forEach(item => {
        const raceKey = item.race in workforceConsumptionMap ? item.race : 'default'
        const raceConsumption = workforceConsumptionMap[raceKey]

        if (!raceConsumption) return

        const busyWares = raceConsumption.busy || {}
        for (const [wareId, perPersonPerHour] of Object.entries(busyWares)) {
          const entry = getOrInitFlow(wareId)

          const hourlyAmount = item.residents * perPersonPerHour

          if (hourlyAmount <= 0) continue

          entry.consumption += hourlyAmount

          const contribution: FlowContribution = {
            id: item.race,
            class: 'workforce',
            type: 'consumption',
            count: item.residents,
            amount: -hourlyAmount,
            bonusPercent: 0
          }
          entry.contributions.push(contribution)
        }
      })
    } else {
      const raceEntries = buildRaceEntriesFromCensus(censusItems)
      actualWorkforce = applySharedWorkforceConsumption(
        raceEntries,
        workforceBreakdown.needed.total,
        workforceConsumptionMap,
        getOrInitFlow
      )
      saturation = saturationOverride ?? calculateEfficiencySaturation(workforceBreakdown.needed.total, actualWorkforce)
    }
  }

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

      const contribution: FlowContribution = {
        id: item.id,
        class: 'module',
        type: 'production',
        count: item.count,
        amount: actualAmount,
        bonusPercent: Math.round(currentBonusRatio * 100)
      }
      entry.contributions.push(contribution)
    }

    for (const [wareId, hourlyAmount] of Object.entries(info.inputs)) {
      const entry = getOrInitFlow(wareId)

      const actualAmount = hourlyAmount * item.count

      entry.consumption += actualAmount

      const contribution: FlowContribution = {
        id: item.id,
        class: 'module',
        type: 'consumption',
        count: item.count,
        amount: -actualAmount,
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

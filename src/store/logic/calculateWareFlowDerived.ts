import type {
  SavedModule,
  X4Module,
  WareFlow,
  GroupedFlows,
  ModuleFlowAtom
} from '../../types/x4'
import type { WareProductionFlow } from '../../types/production-flow'

export interface CalculateWareFlowDerivedInput {
  productionFlows: WareProductionFlow[]
  autoIndustryModules: SavedModule[]
  plannedModules: SavedModule[]
  modulesMap: Record<string, X4Module>
  settings: {
    racePreference: string
    resourceBufferHours: number
    primaryProductBufferHours: number
    secondaryProductBufferHours: number
    buyMultiplier: number
    sellMultiplier: number
    transportMinutes: number
    transportShipCapacity: number
    sunlight: number
  }
  warePriorityLevels: Record<string, number>
}

export interface CalculateWareFlowDerivedOutput {
  groupedFlows: GroupedFlows
  autoInfrastructureModules: SavedModule[]
}

export function calculateWareFlowDerived(
  input: CalculateWareFlowDerivedInput
): CalculateWareFlowDerivedOutput {
  const {
    productionFlows,
    autoIndustryModules,
    plannedModules,
    modulesMap,
    settings,
    warePriorityLevels
  } = input

  const wareFlows: WareFlow[] = productionFlows.map(prodFlow => {
    const unitVolume = prodFlow.unitVolume
    const productionVolume = prodFlow.production * unitVolume
    const consumptionVolume = prodFlow.consumption * unitVolume
    const netVolume = productionVolume - consumptionVolume

    const isSurplus = prodFlow.netRate >= 0
    const multiplier = isSurplus ? settings.sellMultiplier : settings.buyMultiplier
    const unitPrice = getPriceByMultiplier(prodFlow, multiplier)
    const netValue = prodFlow.netRate * unitPrice

    const priorityLevel = warePriorityLevels?.[prodFlow.wareId] ?? 0
    const isMainOrSecondary = priorityLevel > 0
    const isSupplyGap = prodFlow.workforceConsumption > 0
    const isResourceFlow = prodFlow.transportType !== 'container'
    const shouldCountTransport = isMainOrSecondary || isSupplyGap || isResourceFlow
    const transportDemand = shouldCountTransport ? Math.abs(prodFlow.netRate) * unitVolume : 0

    const consumptionBufferCount = prodFlow.consumption * settings.resourceBufferHours

    const storagePriorityLevel = warePriorityLevels?.[prodFlow.wareId] ?? 2
    let productBufferHours = 0
    if (storagePriorityLevel === 2) {
      productBufferHours = settings.primaryProductBufferHours
    } else if (storagePriorityLevel === 1) {
      productBufferHours = settings.secondaryProductBufferHours
    }

    const productionBufferCount = (prodFlow.netRate > 0) && (storagePriorityLevel > 0)
      ? prodFlow.netRate * productBufferHours
      : 0

    const totalOccupiedConsumptionCount = consumptionBufferCount
    const totalOccupiedCount = consumptionBufferCount + productionBufferCount
    const totalOccupiedVolume = totalOccupiedCount * unitVolume

    const contributions: ModuleFlowAtom[] = prodFlow.contributions.map(atom => ({
      moduleId: atom.moduleId,
      count: atom.count,
      type: atom.type,
      amount: atom.amount,
      bonusPercent: atom.bonusPercent,
      volumeFlow: atom.amount * unitVolume,
      valueFlow: atom.amount * unitPrice,
      transportFlow: shouldCountTransport ? Math.abs(atom.amount) * unitVolume : 0
    }))

    return {
      wareId: prodFlow.wareId,
      orderIndex: prodFlow.orderIndex,
      tier: prodFlow.tier,
      transportType: prodFlow.transportType,
      unitVolume,
      production: prodFlow.production,
      consumption: prodFlow.consumption,
      workforceConsumption: prodFlow.workforceConsumption,
      netRate: prodFlow.netRate,
      productionVolume,
      consumptionVolume,
      netVolume,
      transportDemand,
      totalOccupiedCount,
      totalOccupiedConsumptionCount,
      totalOccupiedVolume,
      unitPrice,
      netValue,
      contributions
    }
  })

  wareFlows.sort((a, b) => {
    if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex
    if (a.tier !== b.tier) return b.tier - a.tier
    return Math.abs(b.netRate) - Math.abs(a.netRate)
  })

  const groupedFlows: GroupedFlows = {
    flows: wareFlows,
    rateGroups: { positive: [], operations: [], supply: [], resources: [] },
    volumeGroups: { solid: [], liquid: [], container: [] }
  }

  wareFlows.forEach(flow => {
    if (flow.netRate > 0) groupedFlows.rateGroups.positive.push(flow)
    else if (flow.workforceConsumption > 0) groupedFlows.rateGroups.supply.push(flow)
    else if (flow.transportType === 'container') groupedFlows.rateGroups.operations.push(flow)
    else groupedFlows.rateGroups.resources.push(flow)

    if (flow.transportType === 'solid') groupedFlows.volumeGroups.solid.push(flow)
    else if (flow.transportType === 'liquid') groupedFlows.volumeGroups.liquid.push(flow)
    else groupedFlows.volumeGroups.container.push(flow)
  })

  const autoInfrastructureModules = calculateInfrastructureModules(
    groupedFlows,
    plannedModules,
    autoIndustryModules,
    modulesMap,
    settings
  )

  return {
    groupedFlows,
    autoInfrastructureModules
  }
}

function getPriceByMultiplier(flow: WareProductionFlow, multiplier: number): number {
  if (multiplier <= 0.5) {
    const t = multiplier * 2
    return flow.minPrice + (flow.price - flow.minPrice) * t
  } else {
    const t = (multiplier - 0.5) * 2
    return flow.price + (flow.maxPrice - flow.price) * t
  }
}

function calculateInfrastructureModules(
  groupedFlows: GroupedFlows,
  plannedModules: SavedModule[],
  autoIndustryModules: SavedModule[],
  modulesMap: Record<string, X4Module>,
  settings: CalculateWareFlowDerivedInput['settings']
): SavedModule[] {
  const race = settings.racePreference
  const allModules = [...plannedModules, ...autoIndustryModules]
  const result: SavedModule[] = []

  const needs = { container: 0, solid: 0, liquid: 0 }

  groupedFlows.flows.forEach(flow => {
    if (flow.totalOccupiedVolume > 0) {
      if (flow.transportType === 'solid') needs.solid += flow.totalOccupiedVolume
      else if (flow.transportType === 'liquid') needs.liquid += flow.totalOccupiedVolume
      else needs.container += flow.totalOccupiedVolume
    }
  })

  const storageTypes: ('container' | 'solid' | 'liquid')[] = ['container', 'solid', 'liquid']
  for (const type of storageTypes) {
    const needed = needs[type]

    let existingCapacity = 0
    allModules.forEach(m => {
      const info = modulesMap[m.id]
      if (info?.cargo?.type === type && info.cargo?.capacity) {
        existingCapacity += info.cargo.capacity * m.count
      }
    })

    const deficit = needed - existingCapacity

    if (deficit > 0) {
      const storageModule = findBestStorage(type, race, modulesMap, allModules)
      if (storageModule && storageModule.cargo) {
        const count = Math.ceil(deficit / storageModule.cargo.capacity)
        result.push({ id: storageModule.id, count })
      }
    }
  }

  const singleBerthThroughput = Math.max(1, settings.transportShipCapacity || 1) * 15
  const throughputByType = groupedFlows.flows.reduce((acc, flow) => {
    const value = Math.abs(flow.transportDemand || 0)
    if (flow.transportType === 'solid') acc.solid += value
    else if (flow.transportType === 'liquid') acc.liquid += value
    else acc.container += value
    return acc
  }, { container: 0, solid: 0, liquid: 0 })

  const requiredTotalBerths =
    Math.ceil(throughputByType.container / singleBerthThroughput) +
    Math.ceil(throughputByType.solid / singleBerthThroughput) +
    Math.ceil(throughputByType.liquid / singleBerthThroughput)

  const modulesAfterStorage = [...allModules, ...result]
  const existingTotalBerths = modulesAfterStorage.reduce((sum, m) => {
    const info = modulesMap[m.id]
    if (info?.type !== 'pier') return sum
    return sum + getPierDockCount(info) * m.count
  }, 0)

  const berthDeficit = Math.max(0, requiredTotalBerths - existingTotalBerths)

  if (berthDeficit > 0) {
    const preferredPier = findPreferredPierModule(race, modulesMap, plannedModules)
    const berthPerModule = getPierDockCount(preferredPier)
    if (preferredPier && berthPerModule > 0) {
      const requiredPierCount = Math.ceil(berthDeficit / berthPerModule)
      result.push({ id: preferredPier.id, count: requiredPierCount })
    }
  }

  return result
}

function findBestStorage(
  type: 'container' | 'solid' | 'liquid',
  race: string,
  modules: Record<string, X4Module>,
  existingModules: SavedModule[]
): X4Module | null {
  const existingCandidates = existingModules
    .map(m => modules[m.id])
    .filter((m): m is X4Module => !!m && m.type === 'storage' && m.cargo?.type === type)
    .sort((a, b) => (b.cargo?.capacity || 0) - (a.cargo?.capacity || 0))

  if (existingCandidates.length > 0) {
    return existingCandidates[0]!
  }

  let candidate = Object.values(modules).find(m =>
    m.type === 'storage' &&
    m.race === race &&
    m.cargo?.type === type &&
    m.cargo?.capacity > 500000
  )

  if (!candidate) {
    candidate = Object.values(modules).find(m =>
      m.type === 'storage' &&
      m.cargo?.type === type &&
      m.cargo?.capacity > 500000
    )
  }

  if (!candidate) {
    const allStorages = Object.values(modules).filter(m =>
      m.type === 'storage' &&
      m.cargo?.type === type
    )
    if (allStorages.length > 0) {
      candidate = allStorages.sort((a, b) => (b.cargo?.capacity || 0) - (a.cargo?.capacity || 0))[0]
    }
  }

  return candidate || null
}

function isELargePier(module: X4Module | undefined): module is X4Module {
  return !!module && module.type === 'pier' && !!module.macroId?.includes('harbor_03')
}

function getPierDockCount(module: X4Module | null | undefined): number {
  if (!module) return 0
  if (typeof module.dockingCount === 'number' && module.dockingCount > 0) {
    return module.dockingCount
  }
  const byName = Number((module.name || '').match(/(\d+)-Dock/i)?.[1] || 0)
  if (byName > 0) return byName
  return 0
}

function findPreferredPierModule(
  race: string,
  modules: Record<string, X4Module>,
  plannedModules: SavedModule[]
): X4Module | null {
  const plannedPiers = plannedModules
    .map(m => modules[m.id])
    .filter((m): m is X4Module => !!m && m.type === 'pier')

  const sameRacePlanned = plannedPiers.find((m) => m.race === race)
  if (sameRacePlanned) return sameRacePlanned

  if (plannedPiers.length > 0) return plannedPiers[0]!

  const sameRace = Object.values(modules).find(m => isELargePier(m) && m.race === race)
  if (sameRace) return sameRace

  return Object.values(modules).find(m => isELargePier(m)) || null
}
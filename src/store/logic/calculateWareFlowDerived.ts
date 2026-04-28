import type {
  SavedModule,
  X4Module,
  X4Ware,
  WareFlow,
  GroupedFlows
} from '../../types/x4'
import type { DerivedProductionFlow, FlowContribution, WareProductionFlow } from '../../types/production-flow'

export interface CalculateWareFlowDerivedInput {
  productionFlows: WareProductionFlow[]
  autoIndustryModules: SavedModule[]
  plannedModules: SavedModule[]
  modulesMap: Record<string, X4Module>
  waresMap: Record<string, X4Ware>
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
  productionFlows: DerivedProductionFlow[]
  groupedFlows: GroupedFlows
}

export function deriveProductionFlows(
  input: CalculateWareFlowDerivedInput
): DerivedProductionFlow[] {
  const {
    productionFlows,
    waresMap,
    settings,
    warePriorityLevels
  } = input

  const wareFlows: DerivedProductionFlow[] = productionFlows.map(prodFlow => {
    const ware = waresMap[prodFlow.wareId]
    const unitVolume = prodFlow.unitVolume
    const productionVolume = prodFlow.production * unitVolume
    const consumptionVolume = prodFlow.consumption * unitVolume
    const netVolume = productionVolume - consumptionVolume

    const isSurplus = prodFlow.netRate >= 0
    const multiplier = isSurplus ? settings.sellMultiplier : settings.buyMultiplier
    const unitPrice = getPriceByMultiplier(ware, multiplier)
    const netValue = prodFlow.netRate * unitPrice

    const priorityLevel = warePriorityLevels?.[prodFlow.wareId] ?? 0
    const isMainOrSecondary = priorityLevel > 0
    const isSupplyGap = prodFlow.contributions.some(c => c.class === 'workforce')
    const isResourceFlow = prodFlow.transportType !== 'container'
    const isDeficit = prodFlow.netRate < 0
    const shouldCountTransport = isMainOrSecondary || isSupplyGap || isResourceFlow || isDeficit
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

    const contributions: FlowContribution[] = prodFlow.contributions.map(atom => ({
      ...atom,
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

  return wareFlows
}

export function groupDerivedProductionFlows(
  productionFlows: DerivedProductionFlow[]
): GroupedFlows {
  const wareFlows: WareFlow[] = [...productionFlows]

  const groupedFlows: GroupedFlows = {
    flows: wareFlows,
    rateGroups: { positive: [], operations: [], supply: [], resources: [] },
    volumeGroups: { solid: [], liquid: [], container: [] }
  }

  wareFlows.forEach(flow => {
    if (flow.netRate > 0) groupedFlows.rateGroups.positive.push(flow)
    else if (flow.contributions.some(c => c.class === 'workforce')) groupedFlows.rateGroups.supply.push(flow)
    else if (flow.transportType === 'container') groupedFlows.rateGroups.operations.push(flow)
    else groupedFlows.rateGroups.resources.push(flow)

    if (flow.transportType === 'solid') groupedFlows.volumeGroups.solid.push(flow)
    else if (flow.transportType === 'liquid') groupedFlows.volumeGroups.liquid.push(flow)
    else groupedFlows.volumeGroups.container.push(flow)
  })

  return groupedFlows
}

export function calculateWareFlowDerived(
  input: CalculateWareFlowDerivedInput
): CalculateWareFlowDerivedOutput {
  const productionFlows = deriveProductionFlows(input)
  const groupedFlows = groupDerivedProductionFlows(productionFlows)

  return {
    productionFlows,
    groupedFlows
  }
}

function getPriceByMultiplier(ware: X4Ware | undefined, multiplier: number): number {
  if (!ware) return 0
  const minPrice = ware.minPrice || 0
  const avgPrice = ware.price || 0
  const maxPrice = ware.maxPrice || 0
  
  if (multiplier <= 0.5) {
    const t = multiplier * 2
    return minPrice + (avgPrice - minPrice) * t
  } else {
    const t = (multiplier - 0.5) * 2
    return avgPrice + (maxPrice - avgPrice) * t
  }
}

import type { SavedModule, X4Module } from '@/types/x4'
import type { WareProductionFlow } from '@/types/production-flow'

export interface InfrastructureInput {
  productionFlows: WareProductionFlow[]
  plannedModules: SavedModule[]
  autoIndustryModules: SavedModule[]
  modulesMap: Record<string, X4Module>
  settings: {
    racePreference: string
    resourceBufferHours: number
    primaryProductBufferHours: number
    secondaryProductBufferHours: number
    transportShipCapacity: number
  }
  warePriorityLevels: Record<string, number>
}

export function calculateInfrastructureModules(input: InfrastructureInput): SavedModule[] {
  const {
    productionFlows,
    plannedModules,
    autoIndustryModules,
    modulesMap,
    settings,
    warePriorityLevels
  } = input

  const race = settings.racePreference
  const allModules = [...plannedModules, ...autoIndustryModules]
  const result: SavedModule[] = []

  const storageNeeds = { container: 0, solid: 0, liquid: 0 }

  for (const flow of productionFlows) {
    const priorityLevel = warePriorityLevels[flow.wareId] ?? 2
    const consumptionBufferCount = flow.consumption * settings.resourceBufferHours

    let productBufferHours = 0
    if (priorityLevel === 2) {
      productBufferHours = settings.primaryProductBufferHours
    } else if (priorityLevel === 1) {
      productBufferHours = settings.secondaryProductBufferHours
    }

    const productionBufferCount = (flow.netRate > 0) && (priorityLevel > 0)
      ? flow.netRate * productBufferHours
      : 0

    const totalOccupiedCount = consumptionBufferCount + productionBufferCount
    const totalOccupiedVolume = totalOccupiedCount * flow.unitVolume

    if (totalOccupiedVolume > 0) {
      if (flow.transportType === 'solid') {
        storageNeeds.solid += totalOccupiedVolume
      } else if (flow.transportType === 'liquid') {
        storageNeeds.liquid += totalOccupiedVolume
      } else {
        storageNeeds.container += totalOccupiedVolume
      }
    }
  }

  const storageTypes: ('container' | 'solid' | 'liquid')[] = ['container', 'solid', 'liquid']
  for (const type of storageTypes) {
    const needed = storageNeeds[type]

    let existingCapacity = 0
    for (const m of allModules) {
      const info = modulesMap[m.id]
      if (info?.cargo?.type === type && info.cargo?.capacity) {
        existingCapacity += info.cargo.capacity * m.count
      }
    }

    const deficit = needed - existingCapacity

    if (deficit > 0) {
      const storageModule = findBestStorage(type, race, modulesMap, allModules)
      if (storageModule && storageModule.cargo) {
        const count = Math.ceil(deficit / storageModule.cargo.capacity)
        result.push({ id: storageModule.id, count })
      }
    }
  }

  const transportNeeds = { container: 0, solid: 0, liquid: 0 }

  for (const flow of productionFlows) {
    const priorityLevel = warePriorityLevels[flow.wareId] ?? 0
    const isMainOrSecondary = priorityLevel > 0
    const isSupplyGap = flow.contributions.some(c => c.class === 'workforce')
    const isResourceFlow = flow.transportType !== 'container'
    const isDeficit = flow.netRate < 0
    const shouldCountTransport = isMainOrSecondary || isSupplyGap || isResourceFlow || isDeficit

    if (shouldCountTransport) {
      const transportDemand = Math.abs(flow.netRate) * flow.unitVolume
      if (flow.transportType === 'solid') {
        transportNeeds.solid += transportDemand
      } else if (flow.transportType === 'liquid') {
        transportNeeds.liquid += transportDemand
      } else {
        transportNeeds.container += transportDemand
      }
    }
  }

  const singleBerthThroughput = Math.max(1, settings.transportShipCapacity || 1) * 15

  const requiredTotalBerths =
    Math.ceil(transportNeeds.container / singleBerthThroughput) +
    Math.ceil(transportNeeds.solid / singleBerthThroughput) +
    Math.ceil(transportNeeds.liquid / singleBerthThroughput)

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
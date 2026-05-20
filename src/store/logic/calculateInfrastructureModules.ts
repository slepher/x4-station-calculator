import type { SavedModule, X4Module } from '@/types/x4'
import type { WareProductionFlow } from '@/types/production-flow'
import { findBestModuleWithReferenceQuota } from './bestModuleSelector'

export interface InfrastructureInput {
  productionFlows: WareProductionFlow[]
  plannedModules: SavedModule[]
  autoIndustryModules: SavedModule[]
  referenceModules?: SavedModule[]
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
    referenceModules,
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
      const selected = allocateAuxiliaryModules({
        deficit,
        race,
        modulesMap,
        existingModules: [...allModules, ...result],
        referenceModules: referenceModules || [],
        isValid: (module) => module.type === 'storage' && module.cargo?.type === type,
        sortFn: (a, b) => (b.cargo?.capacity || 0) - (a.cargo?.capacity || 0),
        getUnitValue: (module) => module.cargo?.capacity || 0,
        databaseCandidates: getStorageDatabaseCandidates(type, race, modulesMap)
      })
      result.push(...selected)
    }
  }

  const transportNeeds = { container: 0, solid: 0, liquid: 0 }

  for (const flow of productionFlows) {
    const priorityLevel = warePriorityLevels[flow.wareId] ?? 0
    const isMainOrSecondary = priorityLevel > 0
    const isSupplyGap = flow.contributions.some(c => c.class === 'workforce' || c.class === 'workforce_idle')
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
    const selected = allocateAuxiliaryModules({
      deficit: berthDeficit,
      race,
      modulesMap,
      existingModules: [...plannedModules, ...result],
      referenceModules: referenceModules || [],
      isValid: (module) => module.type === 'pier',
      sortFn: (a, b) => getPierDockCount(b) - getPierDockCount(a),
      getUnitValue: (module) => getPierDockCount(module),
      databaseCandidates: Object.values(modulesMap).filter((module) => isELargePier(module))
    })
    result.push(...selected)
  }

  return result
}

function allocateAuxiliaryModules(input: {
  deficit: number
  race: string
  modulesMap: Record<string, X4Module>
  existingModules: SavedModule[]
  referenceModules: SavedModule[]
  isValid: (module: X4Module) => boolean
  sortFn: (a: X4Module, b: X4Module) => number
  getUnitValue: (module: X4Module) => number
  databaseCandidates?: X4Module[]
}): SavedModule[] {
  const result: SavedModule[] = []
  const remainingQuota: Record<string, number> = {}

  for (const ref of input.referenceModules) {
    const module = input.modulesMap[ref.id]
    if (!module || !input.isValid(module)) continue
    const unitValue = input.getUnitValue(module)
    if (unitValue <= 0) continue
    remainingQuota[ref.id] = (remainingQuota[ref.id] || 0) + unitValue * ref.count
  }

  let remainingDeficit = input.deficit
  let loopCount = 0
  while (remainingDeficit > 0 && loopCount < 50) {
    loopCount++
    const selection = findBestModuleWithReferenceQuota(
      input.race,
      [...input.existingModules, ...result],
      input.modulesMap,
      input.referenceModules,
      remainingQuota,
      input.isValid,
      input.sortFn,
      input.databaseCandidates
    )
    if (!selection) break

    const unitValue = input.getUnitValue(selection.module)
    if (unitValue <= 0) break

    let countNeeded = Math.ceil(remainingDeficit / unitValue)
    if (!selection.exhaustedQuota) {
      const quota = remainingQuota[selection.module.id] || 0
      const maxFromQuota = Math.floor(quota / unitValue)
      if (maxFromQuota <= 0) {
        remainingQuota[selection.module.id] = 0
        continue
      }
      countNeeded = Math.min(countNeeded, maxFromQuota)
      remainingQuota[selection.module.id] = Math.max(0, quota - countNeeded * unitValue)
    }

    const existing = result.find((module) => module.id === selection.module.id)
    if (existing) existing.count += countNeeded
    else result.push({ id: selection.module.id, count: countNeeded })

    remainingDeficit = Math.max(0, remainingDeficit - countNeeded * unitValue)
  }

  return result
}

function getStorageDatabaseCandidates(
  type: 'container' | 'solid' | 'liquid',
  race: string,
  modulesMap: Record<string, X4Module>
): X4Module[] {
  const raceCandidates = Object.values(modulesMap).filter(module =>
    module.type === 'storage' &&
    module.race === race &&
    module.cargo?.type === type &&
    module.cargo?.capacity > 500000
  )
  if (raceCandidates.length > 0) return raceCandidates

  const broadCandidates = Object.values(modulesMap).filter(module =>
    module.type === 'storage' &&
    module.cargo?.type === type &&
    module.cargo?.capacity > 500000
  )
  if (broadCandidates.length > 0) return broadCandidates

  return Object.values(modulesMap).filter(module =>
    module.type === 'storage' &&
    module.cargo?.type === type
  )
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

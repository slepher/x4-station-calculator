export interface BufferOccupancyFlow {
  wareId: string
  consumption: number
  netRate: number
  unitVolume: number
}

export interface BufferOccupancySettings {
  resourceBufferHours: number
  primaryProductBufferHours: number
  secondaryProductBufferHours: number
}

export interface BufferOccupancyResult {
  consumptionBufferCount: number
  productionBufferCount: number
  totalOccupiedCount: number
  totalOccupiedVolume: number
}

export function computeBufferOccupancy(input: {
  flow: BufferOccupancyFlow
  settings: BufferOccupancySettings
  warePriorityLevels: Record<string, number>
}): BufferOccupancyResult {
  const { flow, settings, warePriorityLevels } = input

  const consumptionBufferCount = flow.consumption * settings.resourceBufferHours

  const priorityLevel = warePriorityLevels[flow.wareId] ?? 2
  let productBufferHours = 0
  if (priorityLevel === 2) {
    productBufferHours = settings.primaryProductBufferHours
  } else if (priorityLevel === 1) {
    productBufferHours = settings.secondaryProductBufferHours
  }

  const productionBufferCount = (flow.netRate > 0) && (priorityLevel > 0)
    ? flow.netRate * productBufferHours
    : 0

  const totalOccupiedCount = Math.max(consumptionBufferCount, productionBufferCount)
  const totalOccupiedVolume = totalOccupiedCount * flow.unitVolume

  return {
    consumptionBufferCount,
    productionBufferCount,
    totalOccupiedCount,
    totalOccupiedVolume
  }
}

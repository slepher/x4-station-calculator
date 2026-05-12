import type {
  ShipBlueprint,
  ShipBlueprintBuildAnalysis,
  ShipBlueprintBuildEntry,
  ShipBuildMaterialItem,
  X4Consumable,
  X4Drone,
  X4Equipment,
  X4Missile,
  X4Ship,
  X4Ware
} from '@/types/x4'

export const DEFAULT_SHIP_BUILD_PRICE_MULTIPLIER = 0.5

export type AnalyzeShipBlueprintBuildInput = {
  blueprint: ShipBlueprint | null
  ship: X4Ship | null
  equipments: Map<string, X4Equipment>
  wares: Map<string, X4Ware>
  consumables: Map<string, X4Consumable>
  drones: Map<string, X4Drone>
  missiles: Map<string, X4Missile>
  priceMultiplier: number
}

type CostByMethod = Record<string, Partial<Record<string, number>>> | undefined
type BuildTimeByMethod = Partial<Record<string, number>> | undefined

function getPriceByMultiplier(ware: X4Ware, multiplier: number): number {
  const minPrice = ware.minPrice ?? ware.price ?? 0
  const maxPrice = ware.maxPrice ?? ware.price ?? minPrice
  const ratio = Math.max(0, Math.min(1, multiplier))
  return Math.round(minPrice + (maxPrice - minPrice) * ratio)
}

function sortMaterialItems(items: ShipBuildMaterialItem[], wares: Map<string, X4Ware>): ShipBuildMaterialItem[] {
  return [...items].sort((a, b) => {
    const wareA = wares.get(a.wareId)
    const wareB = wares.get(b.wareId)
    const tierA = wareA?.tier ?? 0
    const tierB = wareB?.tier ?? 0
    if (tierB !== tierA) return tierB - tierA
    const nameA = wareA?.name || a.wareId
    const nameB = wareB?.name || b.wareId
    return nameA.localeCompare(nameB)
  })
}

function mapCostToMaterialItems(
  cost: Partial<Record<string, number>>,
  quantity: number,
  wares: Map<string, X4Ware>,
  priceMultiplier: number
): ShipBuildMaterialItem[] {
  const items = Object.entries(cost)
    .map(([wareId, rawCount]) => {
      const count = (rawCount || 0) * quantity
      const ware = wares.get(wareId)
      const unitPrice = ware ? getPriceByMultiplier(ware, priceMultiplier) : 0
      return {
        wareId,
        count,
        value: count * unitPrice
      }
    })
    .filter((item) => item.count > 0)

  return sortMaterialItems(items, wares)
}

function resolveCostByMethod(source: CostByMethod, method: string): Partial<Record<string, number>> {
  if (!source) return {}
  return source[method] || source.default || {}
}

function resolveBuildTimeByMethod(source: BuildTimeByMethod, method: string): number {
  if (!source) return 0
  return source[method] || source.default || 0
}

function resolveShipProductionByMethod(ship: X4Ship, method: string) {
  return ship.production.find((item) => item.method === method)
    || ship.production.find((item) => item.method === 'default')
    || null
}

function collectMethodOptions(input: AnalyzeShipBlueprintBuildInput): string[] {
  const options: string[] = []
  const optionSet = new Set<string>()
  const shipHasXenon = input.ship?.production.some((item) => item.method === 'xenon') ?? false

  const addMethod = (method: string) => {
    if (optionSet.has(method)) return
    if (method === 'xenon' && !shipHasXenon) return
    optionSet.add(method)
    options.push(method)
  }

  input.ship?.production.forEach((item) => addMethod(item.method))

  input.blueprint?.connections.forEach((conn) => {
    conn.group.forEach((group) => {
      if (group.equipment_id && group.count > 0) {
        const equipment = input.equipments.get(group.equipment_id)
        Object.keys(equipment?.cost || {}).forEach(addMethod)
      }
      if (group.shield?.equipment_id && group.shield.count > 0) {
        const shield = input.equipments.get(group.shield.equipment_id)
        Object.keys(shield?.cost || {}).forEach(addMethod)
      }
    })
  })

  const storage = input.blueprint?.storage
  if (storage) {
    storage.deployables.forEach((item) => Object.keys(input.consumables.get(item.id)?.cost || {}).forEach(addMethod))
    if (storage.countermeasure) {
      Object.keys(input.consumables.get(storage.countermeasure.id)?.cost || {}).forEach(addMethod)
    }
    storage.drones.forEach((item) => Object.keys(input.drones.get(item.id)?.cost || {}).forEach(addMethod))
    storage.missiles.forEach((item) => Object.keys(input.missiles.get(item.id)?.cost || {}).forEach(addMethod))
  }

  if (options.length === 0) {
    options.push('default')
  }

  return options
}

function buildEntryBase(entry: Omit<ShipBlueprintBuildEntry, 'totalValue' | 'materialItems'> & {
  cost: Partial<Record<string, number>>
  wares: Map<string, X4Ware>
  priceMultiplier: number
}): ShipBlueprintBuildEntry {
  const materialItems = mapCostToMaterialItems(entry.cost, entry.quantity, entry.wares, entry.priceMultiplier)
  return {
    key: entry.key,
    kind: entry.kind,
    entityId: entry.entityId,
    quantity: entry.quantity,
    totalValue: materialItems.reduce((sum, item) => sum + item.value, 0),
    unitBuildTime: entry.unitBuildTime,
    totalBuildTime: entry.totalBuildTime,
    materialItems,
    storageType: entry.storageType
  }
}

export function analyzeShipBlueprintBuild(input: AnalyzeShipBlueprintBuildInput): ShipBlueprintBuildAnalysis {
  const methodOptions = collectMethodOptions(input)
  const selectedMethod = input.blueprint?.materialMethod && methodOptions.includes(input.blueprint.materialMethod)
    ? input.blueprint.materialMethod
    : (methodOptions[0] || 'default')

  const shipEntry = (() => {
    if (!input.ship) return null
    const production = resolveShipProductionByMethod(input.ship, selectedMethod)
    const unitBuildTime = production?.time || 0
    return buildEntryBase({
      key: `ship:${input.ship.id}`,
      kind: 'ship',
      entityId: input.ship.id,
      quantity: 1,
      unitBuildTime,
      totalBuildTime: unitBuildTime,
      cost: production?.cost || {},
      wares: input.wares,
      priceMultiplier: input.priceMultiplier
    })
  })()

  const equipmentQuantityMap = new Map<string, number>()
  input.blueprint?.connections.forEach((conn) => {
    conn.group.forEach((group) => {
      if (group.equipment_id && group.count > 0) {
        equipmentQuantityMap.set(group.equipment_id, (equipmentQuantityMap.get(group.equipment_id) || 0) + group.count)
      }
      if (group.shield?.equipment_id && group.shield.count > 0) {
        equipmentQuantityMap.set(group.shield.equipment_id, (equipmentQuantityMap.get(group.shield.equipment_id) || 0) + group.shield.count)
      }
    })
  })

  const equipmentEntries = Array.from(equipmentQuantityMap.entries())
    .map(([equipmentId, quantity]) => {
      const equipment = input.equipments.get(equipmentId)
      if (!equipment) return null
      const unitBuildTime = resolveBuildTimeByMethod(equipment.buildTime, selectedMethod)
      return buildEntryBase({
        key: `equipment:${equipmentId}`,
        kind: 'equipment',
        entityId: equipmentId,
        quantity,
        unitBuildTime,
        totalBuildTime: unitBuildTime * quantity,
        cost: resolveCostByMethod(equipment.cost, selectedMethod),
        wares: input.wares,
        priceMultiplier: input.priceMultiplier
      })
    })
    .filter((entry): entry is ShipBlueprintBuildEntry => entry !== null)
    .sort((a, b) => a.entityId.localeCompare(b.entityId))

  const storageEntries: ShipBlueprintBuildEntry[] = []
  const storage = input.blueprint?.storage
  if (storage) {
    storage.deployables.forEach((item) => {
      const consumable = input.consumables.get(item.id)
      if (!consumable) return
      const unitBuildTime = 0
      storageEntries.push(buildEntryBase({
        key: `deployable:${item.id}`,
        kind: 'storage',
        entityId: item.id,
        quantity: item.count,
        unitBuildTime,
        totalBuildTime: unitBuildTime * item.count,
        cost: resolveCostByMethod(consumable.cost, selectedMethod),
        wares: input.wares,
        priceMultiplier: input.priceMultiplier,
        storageType: 'deployable'
      }))
    })

    if (storage.countermeasure) {
      const consumable = input.consumables.get(storage.countermeasure.id)
      if (consumable) {
        const unitBuildTime = 0
        storageEntries.push(buildEntryBase({
          key: `countermeasure:${storage.countermeasure.id}`,
          kind: 'storage',
          entityId: storage.countermeasure.id,
          quantity: storage.countermeasure.count,
          unitBuildTime,
          totalBuildTime: unitBuildTime * storage.countermeasure.count,
          cost: resolveCostByMethod(consumable.cost, selectedMethod),
          wares: input.wares,
          priceMultiplier: input.priceMultiplier,
          storageType: 'countermeasure'
        }))
      }
    }

    storage.drones.forEach((item) => {
      const drone = input.drones.get(item.id)
      if (!drone) return
      const unitBuildTime = 0
      storageEntries.push(buildEntryBase({
        key: `drone:${item.id}`,
        kind: 'storage',
        entityId: item.id,
        quantity: item.count,
        unitBuildTime,
        totalBuildTime: unitBuildTime * item.count,
        cost: resolveCostByMethod(drone.cost, selectedMethod),
        wares: input.wares,
        priceMultiplier: input.priceMultiplier,
        storageType: 'drone'
      }))
    })

    storage.missiles.forEach((item) => {
      const missile = input.missiles.get(item.id)
      if (!missile) return
      const unitBuildTime = 0
      storageEntries.push(buildEntryBase({
        key: `missile:${item.id}`,
        kind: 'storage',
        entityId: item.id,
        quantity: item.count,
        unitBuildTime,
        totalBuildTime: unitBuildTime * item.count,
        cost: resolveCostByMethod(missile.cost, selectedMethod),
        wares: input.wares,
        priceMultiplier: input.priceMultiplier,
        storageType: 'missile'
      }))
    })
  }

  const entries = [
    ...(shipEntry ? [shipEntry] : []),
    ...equipmentEntries,
    ...storageEntries
  ]

  const summaryMap = new Map<string, ShipBuildMaterialItem>()
  entries.forEach((entry) => {
    entry.materialItems.forEach((item) => {
      const existing = summaryMap.get(item.wareId)
      if (existing) {
        existing.count += item.count
        existing.value += item.value
      } else {
        summaryMap.set(item.wareId, { ...item })
      }
    })
  })

  const summaryItems = sortMaterialItems(Array.from(summaryMap.values()), input.wares)
  const totalValue = entries.reduce((sum, entry) => sum + entry.totalValue, 0)
  const totalBuildTime = entries.reduce((sum, entry) => (
    entry.totalBuildTime > 0 ? sum + entry.totalBuildTime : sum
  ), 0)

  return {
    methodOptions,
    selectedMethod,
    priceMultiplier: input.priceMultiplier,
    totalValue,
    totalBuildTime,
    summaryItems,
    shipEntry,
    equipmentEntries,
    storageEntries,
    entries
  }
}

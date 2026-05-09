import type {
  ShipBlueprint,
  X4Ship,
  X4Equipment,
  X4Consumable,
  X4Drone,
  X4Missile,
} from '@/types/x4'

function resolveCostByMethod(
  source: Record<string, Partial<Record<string, number>>> | undefined,
  method: string,
): Partial<Record<string, number>> {
  if (!source) return {}
  return source[method] || source['default'] || {}
}

function resolveShipCostByMethod(
  ship: X4Ship,
  method: string,
): Record<string, number> {
  const target =
    ship.production.find((item) => item.method === method) ||
    ship.production.find((item) => item.method === 'default')
  return target?.cost || {}
}

export function resolveBlueprintMaterialCost(
  blueprint: ShipBlueprint,
  ship: X4Ship,
  equipmentMap: Map<string, X4Equipment>,
  consumablesMap: Map<string, X4Consumable>,
  dronesMap: Map<string, X4Drone>,
  missilesMap: Map<string, X4Missile>,
): Record<string, number> {
  const method = blueprint.materialMethod || 'default'
  const result: Record<string, number> = {}

  const addCost = (cost: Partial<Record<string, number>>, multiplier: number) => {
    for (const [wareId, qty] of Object.entries(cost)) {
      const count = (qty || 0) * multiplier
      if (count > 0) {
        result[wareId] = (result[wareId] || 0) + count
      }
    }
  }

  const shipCost = resolveShipCostByMethod(ship, method)
  for (const [wareId, qty] of Object.entries(shipCost)) {
    result[wareId] = (result[wareId] || 0) + qty
  }

  for (const connection of blueprint.connections) {
    for (const group of connection.group) {
      if (group.equipment_id && group.count > 0) {
        const equipment = equipmentMap.get(group.equipment_id)
        if (equipment) {
          const cost = resolveCostByMethod(equipment.cost, method)
          addCost(cost, group.count)
        }
      }

      if (group.shield?.equipment_id && group.shield.count > 0) {
        const shieldEquipment = equipmentMap.get(group.shield.equipment_id)
        if (shieldEquipment) {
          const cost = resolveCostByMethod(shieldEquipment.cost, method)
          addCost(cost, group.shield.count)
        }
      }
    }
  }

  const storage = blueprint.storage
  if (storage) {
    for (const item of storage.deployables) {
      const data = consumablesMap.get(item.id)
      if (data?.cost) {
        const cost = resolveCostByMethod(data.cost, method)
        addCost(cost, item.count)
      }
    }

    if (storage.countermeasure) {
      const data = consumablesMap.get(storage.countermeasure.id)
      if (data?.cost) {
        const cost = resolveCostByMethod(data.cost, method)
        addCost(cost, storage.countermeasure.count)
      }
    }

    for (const item of storage.drones) {
      const data = dronesMap.get(item.id)
      if (data?.cost) {
        const cost = resolveCostByMethod(data.cost, method)
        addCost(cost, item.count)
      }
    }

    for (const item of storage.missiles) {
      const data = missilesMap.get(item.id)
      if (data?.cost) {
        const cost = resolveCostByMethod(data.cost, method)
        addCost(cost, item.count)
      }
    }
  }

  return result
}

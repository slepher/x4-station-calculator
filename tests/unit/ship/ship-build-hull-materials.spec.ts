import { describe, expect, it } from 'vitest'
import { analyzeShipBlueprintBuild, type AnalyzeShipBlueprintBuildInput } from '@/store/logic/analyzeShipBlueprintBuild'
import type { ShipBlueprint, X4Consumable, X4Drone, X4Equipment, X4Missile, X4Ship, X4Ware } from '@/types/x4'

function fixture(): AnalyzeShipBlueprintBuildInput {
  const blueprint: ShipBlueprint = {
    id: 'hull-plan', name: 'Hull contribution', shipId: 'ship', materialMethod: 'default', createdAt: 1, lastUpdated: 1,
    hull: { materials: { energycells: 3, fieldcoils: 4 } },
    connections: [{ slot_type: 'engine', group: [{ group: 'engine-group', equipment_id: 'engine', count: 2, shield: { equipment_id: 'shield', count: 1 } }] }],
    storage: {
      deployables: [{ id: 'deployable', name: '', count: 2 }],
      countermeasure: { id: 'countermeasure', name: '', count: 1 },
      drones: [{ id: 'drone', name: '', count: 1 }], missiles: [{ id: 'missile', name: '', count: 1 }]
    }
  }
  return {
    blueprint,
    ship: { id: 'ship', production: [
      { method: 'default', cost: { energycells: 10, hullparts: 2 }, time: 60 },
      { method: 'terran', cost: { energycells: 20 }, time: 90 }
    ] } as X4Ship,
    equipments: new Map([
      ['engine', { id: 'engine', cost: { default: { energycells: 5 } }, buildTime: { default: 4 } } as unknown as X4Equipment],
      ['shield', { id: 'shield', cost: { default: { energycells: 7 } }, buildTime: { default: 3 } } as unknown as X4Equipment]
    ]),
    consumables: new Map([
      ['deployable', { id: 'deployable', cost: { default: { energycells: 11 } } } as unknown as X4Consumable],
      ['countermeasure', { id: 'countermeasure', cost: { default: { energycells: 13 } } } as unknown as X4Consumable]
    ]),
    drones: new Map([['drone', { id: 'drone', cost: { default: { energycells: 17 } } } as unknown as X4Drone]]),
    missiles: new Map([['missile', { id: 'missile', cost: { default: { energycells: 19 } } } as unknown as X4Missile]]),
    wares: new Map([
      ['energycells', { id: 'energycells', name: 'Energy Cells', minPrice: 2, maxPrice: 6, tier: 0 } as X4Ware],
      ['hullparts', { id: 'hullparts', name: 'Hull Parts', minPrice: 10, maxPrice: 20, tier: 1 } as X4Ware],
      ['fieldcoils', { id: 'fieldcoils', name: 'Field Coils', minPrice: 3, maxPrice: 7, tier: 2 } as X4Ware]
    ]),
    priceMultiplier: 0.5
  }
}

const counts = (items: { wareId: string; count: number }[]) => Object.fromEntries(items.map(item => [item.wareId, item.count]))

describe('shared ship build analysis includes explicit hull material', () => {
  it.each([[0, 234, 58], [0.5, 454, 102], [1, 674, 146]])('price %s counts each production/hull/equipment/storage source once', (priceMultiplier, totalValue, shipValue) => {
    const input = fixture()
    input.priceMultiplier = priceMultiplier!
    const original = structuredClone(input)
    const result = analyzeShipBlueprintBuild(input)
    // Energy:10 production+3 hull+2*5 engine+7 shield+2*11 deployable+13 counter+17 drone+19 missile=101.
    expect(counts(result.summaryItems)).toEqual({ energycells: 101, hullparts: 2, fieldcoils: 4 })
    expect(counts(result.shipEntry!.materialItems)).toEqual({ energycells: 13, hullparts: 2, fieldcoils: 4 })
    expect(result.shipEntry).toMatchObject({ quantity: 1, totalValue: shipValue, totalBuildTime: 60 })
    expect(result.equipmentEntries.map(entry => [entry.entityId, entry.quantity])).toEqual([['engine', 2], ['shield', 1]])
    expect(result.storageEntries.map(entry => [entry.entityId, entry.quantity])).toEqual([['deployable', 2], ['countermeasure', 1], ['drone', 1], ['missile', 1]])
    expect(result.entries).toHaveLength(7)
    expect(result.totalValue).toBe(totalValue)
    expect(result.totalValue).toBe(result.summaryItems.reduce((sum, item) => sum + item.value, 0))
    expect(result.totalValue).toBe(result.entries.reduce((sum, entry) => sum + entry.totalValue, 0))
    expect(result.totalBuildTime).toBe(71)
    expect(input).toEqual(original)
  })

  it('method change keeps explicit hull material and adds no hull construction time', () => {
    const input = fixture()
    input.blueprint!.materialMethod = 'terran'
    const result = analyzeShipBlueprintBuild(input)
    expect(counts(result.summaryItems)).toEqual({ energycells: 111, fieldcoils: 4 })
    expect(counts(result.shipEntry!.materialItems)).toEqual({ energycells: 23, fieldcoils: 4 })
    expect(result.totalValue).toBe(464)
    expect(result.totalBuildTime).toBe(101)
    expect(result.shipEntry!.totalBuildTime).toBe(90)
  })

  it.each([undefined, { materials: {} }, { materials: { energycells: 0, fieldcoils: 0 } }])('absent/empty/zero hull leaves production and loadout unchanged: %j', hull => {
    const input = fixture()
    input.blueprint!.hull = hull
    const result = analyzeShipBlueprintBuild(input)
    expect(counts(result.summaryItems)).toEqual({ energycells: 98, hullparts: 2 })
    expect(counts(result.shipEntry!.materialItems)).toEqual({ energycells: 10, hullparts: 2 })
    expect(result.totalValue).toBe(422)
    expect(result.totalBuildTime).toBe(71)
  })
})

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { analyzeShipBlueprintBuild, DEFAULT_SHIP_BUILD_PRICE_MULTIPLIER } from '@/store/logic/analyzeShipBlueprintBuild'
import { resolveBlueprintMaterialCost } from '@/store/logic/resolveBlueprintMaterialCost'
import type {
  SavedShipBlueprintsState,
  ShipBlueprint,
  X4Consumable,
  X4Drone,
  X4Equipment,
  X4Missile,
  X4Ship,
  X4Ware,
} from '@/types/x4'

const WARE_DATA: X4Ware[] = JSON.parse(readFileSync(resolve('src/assets/x4_game_data/8.0-Diplomacy/data/wares.json'), 'utf-8'))
const SHIP_DATA: X4Ship[] = JSON.parse(readFileSync(resolve('src/assets/x4_game_data/8.0-Diplomacy/data/ships.json'), 'utf-8'))
const EQUIP_DATA: X4Equipment[] = JSON.parse(readFileSync(resolve('src/assets/x4_game_data/8.0-Diplomacy/data/equipments.json'), 'utf-8'))
const CONSUMABLE_DATA: X4Consumable[] = JSON.parse(readFileSync(resolve('src/assets/x4_game_data/8.0-Diplomacy/data/consumables.json'), 'utf-8'))
const DRONE_DATA: X4Drone[] = JSON.parse(readFileSync(resolve('src/assets/x4_game_data/8.0-Diplomacy/data/drones.json'), 'utf-8'))
const MISSILE_DATA: X4Missile[] = JSON.parse(readFileSync(resolve('src/assets/x4_game_data/8.0-Diplomacy/data/missiles.json'), 'utf-8'))

const shipsMap = new Map<string, X4Ship>()
for (const ship of SHIP_DATA) shipsMap.set(ship.id, ship)

const equipmentMap = new Map<string, X4Equipment>()
for (const equipment of EQUIP_DATA) equipmentMap.set(equipment.id, equipment)

const consumablesMap = new Map<string, X4Consumable>()
for (const consumable of CONSUMABLE_DATA) consumablesMap.set(consumable.id, consumable)

const dronesMap = new Map<string, X4Drone>()
for (const drone of DRONE_DATA) dronesMap.set(drone.id, drone)

const missilesMap = new Map<string, X4Missile>()
for (const missile of MISSILE_DATA) missilesMap.set(missile.id, missile)

const waresMap = new Map<string, X4Ware>()
for (const ware of WARE_DATA) waresMap.set(ware.id, ware)

function loadBlueprintState(): SavedShipBlueprintsState {
  const exportRaw = JSON.parse(readFileSync(resolve('tests/fixtures/export.json'), 'utf-8'))
  const data = exportRaw.data || exportRaw
  return data.x4_ship_blueprints as SavedShipBlueprintsState
}

function getBlueprints(): ShipBlueprint[] {
  return loadBlueprintState().ships.flatMap((bucket) => bucket.blueprints)
}

function deriveMaterialMapFromAnalysis(blueprint: ShipBlueprint, ship: X4Ship): Record<string, number> {
  const analysis = analyzeShipBlueprintBuild({
    blueprint,
    ship,
    equipments: equipmentMap,
    wares: waresMap,
    consumables: consumablesMap,
    drones: dronesMap,
    missiles: missilesMap,
    priceMultiplier: DEFAULT_SHIP_BUILD_PRICE_MULTIPLIER,
  })

  return Object.fromEntries(analysis.summaryItems.map((item) => [item.wareId, item.count]))
}

describe('ship blueprint build analysis for build-plan', () => {
  it('can derive the same fleet material counts as the legacy build-plan calculation', () => {
    for (const blueprint of getBlueprints()) {
      const ship = shipsMap.get(blueprint.shipId)
      expect(ship).toBeDefined()

      const legacy = resolveBlueprintMaterialCost(
        blueprint,
        ship!,
        equipmentMap,
        consumablesMap,
        dronesMap,
        missilesMap,
      )

      expect(deriveMaterialMapFromAnalysis(blueprint, ship!)).toEqual(legacy)
    }
  })
})

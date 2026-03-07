import type {
  X4Consumable,
  X4Drone,
  X4Equipment,
  X4EquipmentType,
  X4Missile,
  X4Module,
  X4ModuleGroup,
  X4Ship,
  X4ShipRace,
  X4SlotTag,
  X4ShipType,
  X4Ware,
  RaceMedicalConsumption
} from '../../types/x4'

import waresRaw from '../../assets/x4_game_data/8.0-Diplomacy/data/wares.json'
import ModulesRaw from '../../assets/x4_game_data/8.0-Diplomacy/data/modules.json'
import moduleGroupsRaw from '../../assets/x4_game_data/8.0-Diplomacy/data/module_groups.json'
import consumptionRaw from '../../assets/x4_game_data/8.0-Diplomacy/data/consumption.json'
import shipsRaw from '../../assets/x4_game_data/8.0-Diplomacy/data/ships.json'
import shipRacesRaw from '../../assets/x4_game_data/8.0-Diplomacy/data/ship_races.json'
import shipTypesRaw from '../../assets/x4_game_data/8.0-Diplomacy/data/ship_types.json'
import equipmentsRaw from '../../assets/x4_game_data/8.0-Diplomacy/data/equipments.json'
import equipmentTypesRaw from '../../assets/x4_game_data/8.0-Diplomacy/data/equipment_types.json'
import slotTagsRaw from '../../assets/x4_game_data/8.0-Diplomacy/data/slot_tags.json'
import consumablesRaw from '../../assets/x4_game_data/8.0-Diplomacy/data/consumables.json'
import dronesRaw from '../../assets/x4_game_data/8.0-Diplomacy/data/drones.json'
import missilesRaw from '../../assets/x4_game_data/8.0-Diplomacy/data/missiles.json'

export type LocalizedX4Module = X4Module & { localeName: string }
export type LocalizedX4ModuleGroup = X4ModuleGroup & { localeName: string }
export type ShipBuildDatas = {
  shipMap: Map<string, X4Ship>
  raceMap: Map<string, X4ShipRace>
  typeMap: Map<string, X4ShipType>
  equipmentMap: Map<string, X4Equipment>
  shipTypes: X4ShipType[]
  shipRaces: X4ShipRace[]
}
export type ShipBuildRawData = {
  ships: X4Ship[]
  races: X4ShipRace[]
  types: X4ShipType[]
  equipments: X4Equipment[]
  equipmentTypes: X4EquipmentType[]
  slotTags: X4SlotTag[]
  wares: X4Ware[]
}
export type ConsumableDatas = {
  consumables: X4Consumable[]
  drones: X4Drone[]
  missiles: X4Missile[]
  consumablesMap: Map<string, X4Consumable>
  dronesMap: Map<string, X4Drone>
  missilesMap: Map<string, X4Missile>
}

export function getShipBuildRawData(): ShipBuildRawData {
  return {
    ships: shipsRaw as unknown as X4Ship[],
    races: shipRacesRaw as X4ShipRace[],
    types: shipTypesRaw as X4ShipType[],
    equipments: equipmentsRaw as X4Equipment[],
    equipmentTypes: equipmentTypesRaw as X4EquipmentType[],
    slotTags: slotTagsRaw as X4SlotTag[],
    wares: waresRaw as X4Ware[]
  }
}

export function buildShipBuildDatas(payload: {
  ships: X4Ship[]
  races: X4ShipRace[]
  types: X4ShipType[]
  equipments: X4Equipment[]
} = getShipBuildRawData()): ShipBuildDatas {
  const shipMap = new Map<string, X4Ship>()
  payload.ships.forEach((ship) => shipMap.set(ship.id, ship))

  const raceMap = new Map<string, X4ShipRace>()
  payload.races.forEach((race) => raceMap.set(race.id, race))

  const typeMap = new Map<string, X4ShipType>()
  payload.types.forEach((type) => typeMap.set(type.id, type))

  const equipmentMap = new Map<string, X4Equipment>()
  payload.equipments.forEach((equipment) => equipmentMap.set(equipment.id, equipment))

  return {
    shipMap,
    raceMap,
    typeMap,
    equipmentMap,
    shipTypes: payload.types,
    shipRaces: payload.races
  }
}

export function buildConsumableDatas(payload?: {
  consumables?: X4Consumable[]
  drones?: X4Drone[]
  missiles?: X4Missile[]
}): ConsumableDatas {
  const consumables = payload?.consumables || (consumablesRaw as X4Consumable[])
  const drones = payload?.drones || (dronesRaw as X4Drone[])
  const missiles = payload?.missiles || (missilesRaw as X4Missile[])

  const consumablesMap = new Map<string, X4Consumable>()
  consumables.forEach((item) => consumablesMap.set(item.id, item))

  const dronesMap = new Map<string, X4Drone>()
  drones.forEach((item) => dronesMap.set(item.id, item))

  const missilesMap = new Map<string, X4Missile>()
  missiles.forEach((item) => missilesMap.set(item.id, item))

  return {
    consumables,
    drones,
    missiles,
    consumablesMap,
    dronesMap,
    missilesMap
  }
}

export function buildWaresMap(): Record<string, X4Ware> {
  const map: Record<string, X4Ware> = {}
  ;(waresRaw as any[]).forEach(w => {
    map[w.id] = {
      ...w,
      price: w.price || 0,
      minPrice: w.minPrice || 0,
      maxPrice: w.maxPrice || 0
    }
  })
  return map
}

export function buildModulesMap(): Record<string, X4Module> {
  const map: Record<string, X4Module> = {}
  ;(ModulesRaw as any[]).forEach(m => {
    if(!m.isPlayerBlueprint) return
    map[m.id] = {
      ...m,
      macroId: m.macroId || '',
      buildCost: m.buildCost || {},
      outputs: m.outputs || {},
      inputs: m.inputs || {},
      cycleTime: m.cycleTime || 0,
      workforce: {
        capacity: m.workforce?.capacity || 0,
        needed: m.workforce?.needed || 0,
        maxBonus: m.workforce?.maxBonus || 0
      }
    }
  })
  return map
}

export function buildModulesByMacroIdMap(modulesMap: Record<string, X4Module>): Record<string, X4Module> {
  const map: Record<string, X4Module> = {}
  Object.values(modulesMap).forEach((module) => {
    if (!module.macroId) return
    map[module.macroId] = module
  })
  return map
}

export function buildModulesByOutputMap(modulesMap: Record<string, X4Module>): Record<string, X4Module[]> {
  const outputMap: Record<string, X4Module[]> = {}
  Object.values(modulesMap).forEach(module => {
    Object.keys(module.outputs).forEach(wareId => {
      if (!outputMap[wareId]) {
        outputMap[wareId] = []
      }
      outputMap[wareId].push(module)
    })
  })
  return outputMap
}

export function buildMedicalConsumptionMap(): RaceMedicalConsumption {
  return consumptionRaw as RaceMedicalConsumption
}

export function buildLocalizedModulesMap(
  isEn: boolean,
  translateModule: (m: X4Module) => string
): Record<string, LocalizedX4Module> {
  const map: Record<string, LocalizedX4Module> = {}
  ;(ModulesRaw as any[]).forEach(m => {
    if(!m.isPlayerBlueprint) return
    map[m.id] = {
      ...m,
      macroId: m.macroId || '',
      localeName: isEn ? (m.name || '') : translateModule(m as X4Module)
    }
  })
  return map
}

export function buildLocalizedModuleGroupsMap(
  isEn: boolean,
  translateModuleGroup: (mg: X4ModuleGroup) => string
): Record<string, LocalizedX4ModuleGroup> {
  const map: Record<string, LocalizedX4ModuleGroup> = {}
  ;(moduleGroupsRaw as any[]).forEach((mg: any) => {
    map[mg.id] = {
      ...mg,
      localeName: isEn ? (mg.name || '') : translateModuleGroup(mg)
    }
  })
  return map
}

export function findModuleForWare(
  wareId: string,
  lineage: string,
  modulesByOutputMap: Record<string, X4Module[]>
): X4Module | null {
  const producers = (modulesByOutputMap[wareId] || []).filter(m => m.method !== 'recycling')
  if (producers.length === 0) return null

  let found = producers.find(m => m.race === lineage)
  if (found) return found

  found = producers.find(m => m.method === lineage)
  if (found) return found

  if (lineage === 'teladi') {
    found = producers.find(m => m.race === 'default')
    if (found) return found
  }

  found = producers.find(m => m.method === 'default')
  if (found) return found

  const agriRaces = ['argon', 'boron', 'paranid', 'split']
  if (agriRaces.includes(lineage)) {
    found = producers.find(m => m.race === 'default')
    if (found) return found
  }

  return producers[0] || null
}

export function precomputeCandidateWares(
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
  modulesByOutputMap: Record<string, X4Module[]>
): {
  wareSetsByIndustrialRace: Record<string, Set<string>>
  wareSetsByRace: Record<string, Set<string>>
} {
  const industrialRaces = ['default', 'terran', 'teladi']
  const agriRaces = ['argon', 'boron', 'paranid', 'split', 'teladi', 'terran']

  const INDUSTRIAL_GROUPS = ['minerals', 'gases', 'refined', 'hightech', 'shiptech', 'energy']
  const AGRICULTURAL_GROUPS = ['agricultural', 'food', 'pharmaceutical', 'water', 'ice', 'energy']

  const wareSetsByIndustrialRace: Record<string, Set<string>> = {}
  const wareSetsByRace: Record<string, Set<string>> = {}

  industrialRaces.forEach(raceKey => {
    const resultSet = new Set<string>()
    const seeds = new Set<string>()
    
    Object.values(modulesMap).forEach(m => {
      if (m.race === raceKey && INDUSTRIAL_GROUPS.includes(m.group)) {
        Object.keys(m.outputs).forEach(id => {
          seeds.add(id)
        })
      }
    })

    if (raceKey === 'teladi') {
      Object.values(modulesMap).forEach(m => {
        if (m.race === 'default' && INDUSTRIAL_GROUPS.includes(m.group)) {
          Object.keys(m.outputs).forEach(id => {
            if (waresMap[id]?.tier === 3) {
              seeds.add(id)
            }
          })
        }
      })
    }

    const visited = new Set<string>()
    const trace = (wareId: string) => {
      if (visited.has(wareId)) return
      visited.add(wareId)
      
      resultSet.add(wareId)
      
      const ware = waresMap[wareId]
      if (ware && ware.tier === 0) return

      const module = findModuleForWare(wareId, raceKey, modulesByOutputMap)
      if (module && module.inputs) {
        Object.keys(module.inputs).forEach(inputId => trace(inputId))
      }
    }
    seeds.forEach(id => trace(id))
    wareSetsByIndustrialRace[raceKey] = resultSet
  })

  agriRaces.forEach(race => {
    const resultSet = new Set<string>()
    const seeds = new Set<string>()

    Object.values(modulesMap).forEach(m => {
      if (m.race === race && AGRICULTURAL_GROUPS.includes(m.group)) {
        Object.keys(m.outputs).forEach(id => {
          seeds.add(id)
        })
      }
    })

    const visited = new Set<string>()
    const trace = (wareId: string) => {
      if (visited.has(wareId)) return
      visited.add(wareId)
      
      resultSet.add(wareId)

      const ware = waresMap[wareId]
      if (ware && ware.tier === 0) return

      const module = findModuleForWare(wareId, race, modulesByOutputMap)
      if (module && module.inputs) {
        Object.keys(module.inputs).forEach(inputId => trace(inputId))
      }
    }
    seeds.forEach(id => trace(id))
    wareSetsByRace[race] = resultSet
  })

  return { wareSetsByIndustrialRace, wareSetsByRace }
}

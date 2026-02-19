import type { X4Module, X4Ware, X4ModuleGroup, RaceMedicalConsumption } from '@/types/x4'

import waresRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/wares.json'
import ModulesRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/modules.json'
import moduleGroupsRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/module_groups.json'
import consumptionRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/consumption.json'

export type LocalizedX4Module = X4Module & { localeName: string }
export type LocalizedX4ModuleGroup = X4ModuleGroup & { localeName: string }

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
  const producers = modulesByOutputMap[wareId] || []
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

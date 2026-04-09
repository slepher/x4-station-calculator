import type { AggregatedStationModule } from '@/types/saveArchive'
import type { SavedModule, StationPlan, X4Module } from '@/types/x4'

const ENERGY_GROUP = 'energy'
const MIXED_PRODUCTION_PROFILE = 'mixed'
const TECH_CLUSTER_GROUPS = ['shiptech', 'hightech', 'refined'] as const
const LIFE_CLUSTER_GROUPS = ['pharmaceutical', 'agricultural', 'food', 'water'] as const
const TECH_CLUSTER_GROUP_SET = new Set<string>(TECH_CLUSTER_GROUPS)
const LIFE_CLUSTER_GROUP_SET = new Set<string>(LIFE_CLUSTER_GROUPS)

const FACTORY_GROUP_PRIORITY = [
  'shiptech',
  'hightech',
  'refined',
  'pharmaceutical',
  'food',
  'agricultural',
  'water',
  'energy'
]

export type StationPoiClassification = {
  tag: string
  isPiratebase?: boolean
  isShipyard?: boolean
  isWharf?: boolean
  isEquipmentdock?: boolean
  isFactory?: boolean
  isDefencemodule?: boolean
  is_headquarter?: boolean
  factoryGroup?: string
  productionProfile?: string
  profileName?: string
}

export function buildAggregatedModulesFromStationPlan(
  station: StationPlan,
  modulesMap: Record<string, X4Module>
): AggregatedStationModule[] {
  return (station.modules || []).flatMap((module: SavedModule) => {
    const resolved = modulesMap[module.id]
    if (!resolved) return []
    return [{
      ref: resolved.macroId,
      amount: module.count,
      module_id: resolved.id,
      type: resolved.type,
      group: resolved.group
    }]
  })
}

export function getFactoryGroup(
  modules: AggregatedStationModule[] | undefined
): string {
  if (!modules || modules.length === 0) return 'factory'

  const productionModules = modules.filter((m) => m.type === 'production')
  if (productionModules.length === 0) return 'factory'

  const groups = productionModules.map((m) => m.group).filter((g): g is string => Boolean(g))

  for (const priorityGroup of FACTORY_GROUP_PRIORITY) {
    if (groups.includes(priorityGroup)) {
      return priorityGroup
    }
  }

  return 'factory'
}

function getPrimaryProductionModule(
  modules: AggregatedStationModule[] | undefined
): AggregatedStationModule | undefined {
  if (!modules?.length) return undefined

  const productionModules = modules.filter((module) => module.type === 'production')
  if (!productionModules.length) return undefined

  const nonEnergyModules = productionModules.filter((module) => module.group !== ENERGY_GROUP)
  if (nonEnergyModules.length === 1) return nonEnergyModules[0]
  if (nonEnergyModules.length > 1) return undefined

  const energyModule = productionModules.find((module) => module.module_id === 'module_gen_prod_energycells_01')
  return energyModule || productionModules[0]
}

export function getProductionProfile(
  modules: AggregatedStationModule[] | undefined,
  modulesByMacroId?: Record<string, X4Module>
): { productionProfile?: string; profileName?: string } {
  if (!modules?.length) return {}

  const productionModules = modules.filter((module) => module.type === 'production')
  if (!productionModules.length) return {}

  const nonEnergyModules = productionModules.filter((module) => module.group !== ENERGY_GROUP)
  const nonEnergyGroups = [...new Set(nonEnergyModules.map((module) => module.group).filter((group): group is string => Boolean(group)))]

  if (nonEnergyModules.length === 1 || nonEnergyModules.length === 0) {
    const primaryModule = getPrimaryProductionModule(modules)
    if (!primaryModule?.module_id) return {}
    const moduleName = modulesByMacroId?.[primaryModule.ref]?.name
    return {
      productionProfile: primaryModule.module_id,
      profileName: moduleName || primaryModule.module_id
    }
  }

  if (nonEnergyGroups.length === 1) {
    return {
      productionProfile: nonEnergyGroups[0],
      profileName: nonEnergyGroups[0]
    }
  }

  if (nonEnergyGroups.every((group) => TECH_CLUSTER_GROUP_SET.has(group))) {
    const primaryGroup = TECH_CLUSTER_GROUPS.find((group) => nonEnergyGroups.includes(group))
    if (!primaryGroup) return {}
    return {
      productionProfile: primaryGroup,
      profileName: primaryGroup
    }
  }

  if (nonEnergyGroups.every((group) => LIFE_CLUSTER_GROUP_SET.has(group))) {
    const primaryGroup = LIFE_CLUSTER_GROUPS.find((group) => nonEnergyGroups.includes(group))
    if (!primaryGroup) return {}
    return {
      productionProfile: primaryGroup,
      profileName: primaryGroup
    }
  }

  return {
    productionProfile: MIXED_PRODUCTION_PROFILE,
    profileName: 'Mixed Production'
  }
}

export function hasModulePattern(modules: AggregatedStationModule[] | undefined, patterns: string[]): boolean {
  if (!modules || modules.length === 0) return false
  return modules.some((module) => {
    const ref = module.ref.toLowerCase()
    return patterns.some((pattern) => ref.includes(pattern))
  })
}

export function classifyPlayerStationPoi(args: {
  macro?: string | null
  modules?: AggregatedStationModule[]
  isHeadquarter?: boolean
  modulesByMacroId?: Record<string, X4Module>
}): StationPoiClassification {
  const modules = args.modules || []
  const macro = (args.macro || '').toLowerCase()

  const isPiratebase = macro.includes('_piratebase')
  const isShipyard = hasModulePattern(modules, ['_ships_xl_', '_ships_xl', '_ships_x_', '_ships_x'])
  const isWharf = hasModulePattern(modules, ['_ships_m_', '_ships_m'])
  const isEquipmentdock = hasModulePattern(modules, ['_equip'])
  const isFactory = modules.some((m) => m.type === 'production')
  const factoryGroup = getFactoryGroup(modules)
  const isTradestation = macro.includes('tradestation')
  const isDefencemodule = modules.some((m) => m.type === 'defencemodule')
  const isHeadquarter = hasModulePattern(modules, ['player_hq_']) || args.isHeadquarter

  let tag = 'factory'
  if (isPiratebase) tag = 'piratestation'
  else if (isShipyard) tag = 'shipyard'
  else if (isWharf) tag = 'wharf'
  else if (isEquipmentdock) tag = 'equipmentdock'
  else if (isFactory) tag = 'factory'
  else if (isTradestation) tag = 'tradestation'
  else if (isDefencemodule) tag = 'defencemodule'

  const { productionProfile, profileName } = getProductionProfile(modules, args.modulesByMacroId)

  return {
    tag,
    isPiratebase: isPiratebase || undefined,
    isShipyard: isShipyard || undefined,
    isWharf: isWharf || undefined,
    isEquipmentdock: isEquipmentdock || undefined,
    isFactory: isFactory || undefined,
    isDefencemodule: isDefencemodule || undefined,
    is_headquarter: isHeadquarter || undefined,
    factoryGroup: factoryGroup !== 'factory' ? factoryGroup : undefined,
    productionProfile,
    profileName
  }
}

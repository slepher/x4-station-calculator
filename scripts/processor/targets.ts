export const processorTargets = ['wares', 'consumption', 'modules', 'ships', 'equipments', 'slot-tags',
  'dlcs', 'missiles', 'bullets', 'drones', 'consumables', 'resource-info', 'factions',
  'terraforming', 'research', 'blueprints', 'maps', 'map-resources', 'languages'] as const
export type ProcessorTarget = typeof processorTargets[number]
export type ProcessorSelection = ProcessorTarget | 'all'

export function parseTargets(value: string): ProcessorSelection[] {
  const aliases: Record<string, ProcessorSelection> = { data: 'all', map: 'maps', resources: 'map-resources' }
  const selected: ProcessorSelection[] = []
  for (const token of value.split(',')) {
    const name = token.trim()
    const target = Object.hasOwn(aliases, name) ? aliases[name]! : name
    if (target !== 'all' && !processorTargets.includes(target as ProcessorTarget)) throw new Error(`未知或空目标: ${name}`)
    if (selected.includes(target as ProcessorSelection)) throw new Error(`重复目标: ${target}`)
    selected.push(target as ProcessorSelection)
  }
  if (selected.includes('all') && selected.length !== 1) throw new Error('all 不可与其他目标组合')
  return selected
}

export const targetFiles: Record<ProcessorTarget, string[]> = {
  wares: ['wares'], consumption: ['consumption'], modules: ['modules', 'module_groups'],
  ships: ['ships', 'ship_slots', 'default_maxes', 'ship_types', 'ship_races'],
  equipments: ['equipments', 'equipment_types'], 'slot-tags': ['slot_tags'], dlcs: ['dlcs'],
  missiles: ['missiles'], bullets: ['bullets'], drones: ['drones'], consumables: ['consumables'],
  'resource-info': ['res'], factions: ['factions'], terraforming: ['terraforming'], research: ['research'],
  blueprints: ['blueprints'], maps: ['maps'], 'map-resources': ['map_resources', 'resourceareas'], languages: ['languages']
}

export const stageOrder = ['initialize', 'database', 'colors', 'modules', 'ships', 'equipments', 'missiles',
  'drones', 'bullets', 'factions', 'maps', 'locale-index', 'terraforming', 'research',
  'blueprints', 'types', 'names', 'map-resources', 'save'] as const
export type ProcessorStage = typeof stageOrder[number]

const dependencies: Record<ProcessorTarget, ProcessorStage[]> = {
  wares: ['database'], consumption: ['database'], modules: ['database', 'colors', 'modules'],
  ships: ['database', 'ships'], equipments: ['database', 'equipments'],
  'slot-tags': ['database', 'ships', 'equipments'], dlcs: ['database'],
  missiles: ['database', 'missiles'], bullets: ['bullets'], drones: ['database', 'drones'],
  consumables: ['database', 'drones'], 'resource-info': ['database', 'colors'], factions: ['factions'],
  terraforming: ['database', 'terraforming'], research: ['database', 'research'],
  blueprints: ['database', 'blueprints'], maps: ['factions', 'maps'],
  'map-resources': ['factions', 'maps', 'map-resources'], languages: []
}

export function planProcessor(selection: ProcessorSelection[], modern = false) {
  const all = selection.includes('all')
  const targets: ProcessorTarget[] = all ? [...processorTargets] : processorTargets.filter(target => selection.includes(target))
  const stages = new Set<ProcessorStage>(['initialize', 'locale-index', 'types', 'names', 'save'])
  const computeTargets = targets.includes('languages') ? processorTargets.filter(target => target !== 'map-resources') : targets
  for (const target of computeTargets) for (const stage of dependencies[target]) stages.add(stage)
  if (targets.includes('map-resources')) for (const stage of dependencies['map-resources']) stages.add(stage)
  const files = new Set(targets.flatMap(target => targetFiles[target]))
  if (targets.includes('map-resources')) for (const name of modern ? ['regionyield_definitions'] : ['regions', 'regionyields']) files.add(name)
  return { targets, stages: stageOrder.filter(stage => stages.has(stage)),
    files, rebuildLanguages: all || targets.includes('languages') }
}

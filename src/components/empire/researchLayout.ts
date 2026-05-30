import type { X4ResearchItem } from '@/types/x4'

export interface LayoutNode {
  id: string
  layer: number
}

export interface LayoutRow {
  id: string
  nodes: LayoutNode[]
  edges: [string, string][]
}

export interface LayoutGroup {
  id: string
  nameKey: string
  rows: LayoutRow[]
}

export interface NodeConnectionSides {
  incoming: boolean
  outgoing: boolean
}

export interface EdgePoints {
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface RectLike {
  left: number
  top: number
  width: number
  height: number
}

export interface ContainerRectLike {
  left: number
  top: number
}

export interface ScrollLike {
  scrollLeft: number
  scrollTop: number
}

interface ResearchGroupDefinition {
  id: string
  nameKey: string
  ids: string[]
}

export const RESEARCH_GROUPS: ResearchGroupDefinition[] = [
  { id: 'teleport', nameKey: 'research.group.teleport', ids: ['research_teleportation', 'research_teleportation_range_01', 'research_teleportation_range_02', 'research_teleportation_range_03', 'research_warp_hq_01', 'research_warp_hq_02'] },
  { id: 'station_modules', nameKey: 'research.group.station_modules', ids: ['research_module_dock', 'research_module_production', 'research_module_storage', 'research_module_defence', 'research_module_habitation', 'research_module_build', 'research_module_welfare_1', 'research_module_welfare_2', 'research_module_venture'] },
  { id: 'ship_mods', nameKey: 'research.group.ship_mods', ids: ['research_mod_engine_mk1', 'research_mod_engine_mk2', 'research_mod_engine_mk3', 'research_mod_shield_mk1', 'research_mod_shield_mk2', 'research_mod_shield_mk3', 'research_mod_ship_mk1', 'research_mod_ship_mk2', 'research_mod_ship_mk3', 'research_mod_weapon_mk1', 'research_mod_weapon_mk2', 'research_mod_weapon_mk3'] },
  { id: 'hq_base', nameKey: 'research.group.hq_base', ids: ['research_high_mass_teleportation', 'research_seta'] },
  { id: 'diplomacy', nameKey: 'research.group.diplomacy', ids: ['research_diplomacy_network', 'research_interference_network', 'research_agentslot_01', 'research_agentslot_02'] },
  { id: 'xenon_crisis', nameKey: 'research.group.xenon_crisis', ids: ['research_xenon_crisis_01', 'research_xenon_crisis_02'] },
  { id: 'abandoned_ships', nameKey: 'research.group.abandoned_ships', ids: ['research_ship_ter_s_fighter_01', 'research_ship_ter_m_corvette_01', 'research_ship_ter_l_flagship_01', 'research_ship_arg_s_racing_01', 'research_ship_tel_s_racing_01', 'research_ship_par_s_racing_01', 'research_ship_gen_m_corvette_02'] },
  { id: 'pirate_dlc', nameKey: 'research.group.pirate_dlc', ids: ['research_erlking_core', 'research_condensate_sample'] },
  { id: 'terran_dlc', nameKey: 'research.group.terran_dlc', ids: ['research_tf_tech'] },
  { id: 'xen_equipment', nameKey: 'research.group.xen_equipment', ids: ['research_equipment_xenon'] },
]

const STATION_BLUEPRINT_NODE_ORDER = [
  'research_module_dock',
  'research_module_production',
  'research_module_storage',
  'research_module_defence',
  'research_module_habitation',
  'research_module_build',
]

const STATION_BLUEPRINT_LAYER: Record<string, number> = {
  research_module_dock: 0,
  research_module_production: 0,
  research_module_storage: 0,
  research_module_defence: 1,
  research_module_habitation: 1,
  research_module_build: 2,
}

const STATION_BLUEPRINT_EDGES: [string, string][] = [
  ['research_module_dock', 'research_module_defence'],
  ['research_module_production', 'research_module_defence'],
  ['research_module_storage', 'research_module_defence'],
  ['research_module_dock', 'research_module_habitation'],
  ['research_module_production', 'research_module_habitation'],
  ['research_module_storage', 'research_module_habitation'],
  ['research_module_defence', 'research_module_build'],
  ['research_module_habitation', 'research_module_build'],
]

const STATION_WELFARE_NODE_ORDER = [
  'research_module_welfare_1',
  'research_module_welfare_2',
]

const STATION_STANDALONE_NODE_ORDER = [
  'research_module_venture',
]

export function buildResearchLayoutGroups(items: X4ResearchItem[]): LayoutGroup[] {
  const itemMap = new Map<string, X4ResearchItem>()
  for (const item of items) {
    itemMap.set(item.id, item)
  }

  const groups: LayoutGroup[] = []
  for (const group of RESEARCH_GROUPS) {
    const groupItems = group.ids
      .map(id => itemMap.get(id))
      .filter((item): item is X4ResearchItem => item !== undefined)

    if (groupItems.length === 0) continue

    if (group.id === 'station_modules') {
      groups.push({
        id: group.id,
        nameKey: group.nameKey,
        rows: buildStationModuleRows(itemMap),
      })
      continue
    }

    groups.push({
      id: group.id,
      nameKey: group.nameKey,
      rows: buildGenericRows(groupItems),
    })
  }

  return groups
}

export function getNodeConnectionSides(row: LayoutRow, nodeId: string): NodeConnectionSides {
  let incoming = false
  let outgoing = false

  for (const [sourceId, targetId] of row.edges) {
    if (sourceId === nodeId) outgoing = true
    if (targetId === nodeId) incoming = true
  }

  return { incoming, outgoing }
}

export function makeOrthogonalEdgePath(points: EdgePoints): string {
  const midX = Math.round((points.x1 + points.x2) / 2)
  return `M ${points.x1} ${points.y1} H ${midX} V ${points.y2} H ${points.x2}`
}

export function resolveEdgePointsInContainer(
  containerRect: ContainerRectLike,
  sourceRect: RectLike,
  targetRect: RectLike,
  scroll: ScrollLike,
): EdgePoints {
  return {
    x1: sourceRect.left - containerRect.left + sourceRect.width + scroll.scrollLeft,
    y1: sourceRect.top - containerRect.top + sourceRect.height / 2 + scroll.scrollTop,
    x2: targetRect.left - containerRect.left + scroll.scrollLeft,
    y2: targetRect.top - containerRect.top + targetRect.height / 2 + scroll.scrollTop,
  }
}

function buildStationModuleRows(itemMap: Map<string, X4ResearchItem>): LayoutRow[] {
  const rows: LayoutRow[] = []

  const blueprintNodes = orderedNodes(STATION_BLUEPRINT_NODE_ORDER, STATION_BLUEPRINT_LAYER, itemMap)
  if (blueprintNodes.length > 0) {
    rows.push({
      id: 'blueprint_hack',
      nodes: blueprintNodes,
      edges: visibleEdges(STATION_BLUEPRINT_EDGES, itemMap),
    })
  }

  const welfareNodes = orderedNodes(STATION_WELFARE_NODE_ORDER, {
    research_module_welfare_1: 0,
    research_module_welfare_2: 1,
  }, itemMap)
  if (welfareNodes.length > 0) {
    rows.push({
      id: 'welfare',
      nodes: welfareNodes,
      edges: visibleEdges([['research_module_welfare_1', 'research_module_welfare_2']], itemMap),
    })
  }

  const standaloneNodes = orderedNodes(STATION_STANDALONE_NODE_ORDER, {
    research_module_venture: 0,
  }, itemMap)
  if (standaloneNodes.length > 0) {
    rows.push({
      id: 'standalone',
      nodes: standaloneNodes,
      edges: [],
    })
  }

  return rows
}

function orderedNodes(ids: string[], layerById: Record<string, number>, itemMap: Map<string, X4ResearchItem>): LayoutNode[] {
  const nodes: LayoutNode[] = []
  for (const id of ids) {
    if (!itemMap.has(id)) continue
    const layer = layerById[id]
    if (layer === undefined) continue
    nodes.push({ id, layer })
  }
  return nodes
}

function visibleEdges(edges: [string, string][], itemMap: Map<string, X4ResearchItem>): [string, string][] {
  return edges.filter(([sourceId, targetId]) => itemMap.has(sourceId) && itemMap.has(targetId))
}

function buildGenericRows(items: X4ResearchItem[]): LayoutRow[] {
  const visibleIds = new Set(items.map(item => item.id))
  const edges: [string, string][] = []
  for (const item of items) {
    for (const dep of item.dependencies) {
      if (visibleIds.has(dep)) {
        edges.push([dep, item.id])
      }
    }
  }

  if (edges.length === 0) {
    return [{
      id: 'flat',
      nodes: items.map(item => ({ id: item.id, layer: 0 })),
      edges: [],
    }]
  }

  const adj = new Map<string, string[]>()
  const revAdj = new Map<string, string[]>()
  for (const id of visibleIds) {
    adj.set(id, [])
    revAdj.set(id, [])
  }
  for (const [sourceId, targetId] of edges) {
    const outgoing = adj.get(sourceId)
    const incoming = revAdj.get(targetId)
    if (outgoing !== undefined) outgoing.push(targetId)
    if (incoming !== undefined) incoming.push(sourceId)
  }

  const visited = new Set<string>()
  const components: string[][] = []
  for (const id of visibleIds) {
    if (visited.has(id)) continue
    const queue = [id]
    const component: string[] = []
    while (queue.length > 0) {
      const current = queue.pop()
      if (current === undefined) continue
      if (visited.has(current)) continue
      visited.add(current)
      component.push(current)

      const outgoing = adj.get(current)
      if (outgoing !== undefined) {
        for (const next of outgoing) {
          if (!visited.has(next)) queue.push(next)
        }
      }

      const incoming = revAdj.get(current)
      if (incoming !== undefined) {
        for (const next of incoming) {
          if (!visited.has(next)) queue.push(next)
        }
      }
    }
    components.push(component)
  }

  const rows: LayoutRow[] = []
  components.forEach((component, index) => {
    rows.push({
      id: `component_${index}`,
      ...buildComponentRow(component, edges, adj),
    })
  })

  return rows
}

function buildComponentRow(component: string[], edges: [string, string][], adj: Map<string, string[]>): Pick<LayoutRow, 'nodes' | 'edges'> {
  const componentSet = new Set(component)
  const indegree = new Map<string, number>()
  for (const id of component) {
    indegree.set(id, 0)
  }

  for (const [sourceId, targetId] of edges) {
    if (componentSet.has(sourceId) && componentSet.has(targetId)) {
      const current = indegree.get(targetId)
      if (current !== undefined) indegree.set(targetId, current + 1)
    }
  }

  const nodes: LayoutNode[] = []
  const degree = new Map(indegree)
  let roots = component.filter(id => indegree.get(id) === 0)
  let layer = 0
  while (roots.length > 0) {
    for (const id of roots) {
      nodes.push({ id, layer })
    }

    const nextRoots: string[] = []
    for (const root of roots) {
      const outgoing = adj.get(root)
      if (outgoing === undefined) continue
      for (const targetId of outgoing) {
        if (!componentSet.has(targetId)) continue
        const current = degree.get(targetId)
        if (current === undefined) continue
        const nextDegree = current - 1
        degree.set(targetId, nextDegree)
        if (nextDegree === 0) nextRoots.push(targetId)
      }
    }

    roots = Array.from(new Set(nextRoots))
    layer += 1
  }

  const componentEdges = edges.filter(([sourceId, targetId]) => componentSet.has(sourceId) && componentSet.has(targetId))
  return {
    nodes,
    edges: componentEdges,
  }
}

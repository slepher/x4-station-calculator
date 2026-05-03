import type {
  BuildFlowPlanGraph,
  BuildFlowPlanLine,
  BuildFlowPlanEdge,
  BuildFlowPlanView,
} from '@/types/build-plan'
import type {
  X4Module,
  SavedModule,
} from '@/types/x4'

interface GraphNode extends Omit<BuildFlowPlanLine, 'trackedWares'> {
  trackedWares: Set<string>
}
type Graph = {
  nodes: Map<string, GraphNode>
  edges: BuildFlowPlanEdge[]
}

function computeBuildRates(
  modules: SavedModule[],
  modulesMap: Record<string, X4Module>
): Record<string, number> {
  const materials: Record<string, number> = {}
  let totalTime = 0
  for (const m of modules) {
    const mod = modulesMap[m.id]
    if (!mod) continue
    totalTime += mod.buildTime * m.count
    const cost = mod.buildCost
    if (!cost || Object.keys(cost).length === 0) continue
    for (const [wareId, qty] of Object.entries(cost)) {
      if (wareId === 'energycells') continue
      materials[wareId] = (materials[wareId] || 0) + qty * m.count
    }
  }
  const rates: Record<string, number> = {}
  for (const [wareId, qty] of Object.entries(materials)) {
    rates[wareId] = totalTime > 0 ? qty / (totalTime / 3600) : 0
  }
  return rates
}

function findOutputBuildConnection(
  wareId: string,
  buildFlowView: BuildFlowPlanView
): { sourceGroupId: string } | null {
  for (const assign of buildFlowView.assignments) {
    if (assign.wareId === wareId && assign.targetType === 'output-build-material') {
      return { sourceGroupId: assign.sourceGroupId }
    }
  }
  for (const ve of buildFlowView.virtualEdges) {
    if (ve.wareId === wareId && ve.targetType === 'output-build-material') {
      return { sourceGroupId: ve.sourceGroupId }
    }
  }
  return null
}

function findLineBuildMaterialConnection(
  wareId: string,
  buildFlowView: BuildFlowPlanView,
  targetGroupId: string
): { sourceGroupId: string } | null {
  for (const assign of buildFlowView.assignments) {
    if (assign.wareId === wareId && assign.targetType === 'line-build-material') {
      if (assign.targetGroupId === targetGroupId) {
        return { sourceGroupId: assign.sourceGroupId }
      }
    }
  }
  for (const ve of buildFlowView.virtualEdges) {
    if (ve.wareId === wareId && ve.targetType === 'line-build-material') {
      return { sourceGroupId: ve.sourceGroupId }
    }
  }
  return null
}

function getGroupBuildMaterialWares(
  groupId: string,
  buildFlowView: BuildFlowPlanView
): string[] {
  for (const group of buildFlowView.buildFlowGroups) {
    for (const card of group.lineCards) {
      if (card.groupId === groupId) {
        return card.buildMaterialTags.map(t => t.wareId)
      }
    }
  }
  return []
}

function getGroupDisplayName(
  groupId: string,
  buildFlowView: BuildFlowPlanView
): string {
  for (const group of buildFlowView.buildFlowGroups) {
    for (const card of group.lineCards) {
      if (card.groupId === groupId) {
        return card.title || groupId
      }
    }
  }
  return groupId
}

/**
 * Tarjan's SCC algorithm.
 * Only returns SCCs with ≥ 2 nodes or self-loops.
 */
function findSCCs(graph: Graph): string[][] {
  const nodeKeys = [...graph.nodes.keys()]
  const index = new Map<string, number>()
  const lowlink = new Map<string, number>()
  const onStack = new Set<string>()
  const stack: string[] = []
  let idx = 0
  const result: string[][] = []

  // Build adjacency: nodeId → list of adjacent nodeIds
  const adj = new Map<string, string[]>()
  for (const key of nodeKeys) {
    adj.set(key, [])
  }
  for (const edge of graph.edges) {
    if (edge.fromLineKey !== '__C__' && graph.nodes.has(edge.fromLineKey)) {
      const list = adj.get(edge.fromLineKey)
      if (list && !list.includes(edge.toLineKey)) {
        list.push(edge.toLineKey)
      }
    }
  }

  function strongConnect(v: string) {
    index.set(v, idx)
    lowlink.set(v, idx)
    idx++
    stack.push(v)
    onStack.add(v)

    const neighbors = adj.get(v) || []
    for (const w of neighbors) {
      if (!index.has(w)) {
        strongConnect(w)
        lowlink.set(v, Math.min(lowlink.get(v)!, lowlink.get(w)!))
      } else if (onStack.has(w)) {
        lowlink.set(v, Math.min(lowlink.get(v)!, index.get(w)!))
      }
    }

    if (lowlink.get(v) === index.get(v)) {
      const scc: string[] = []
      let w: string
      do {
        w = stack.pop()!
        onStack.delete(w)
        scc.push(w)
      } while (w !== v)

      // Only keep SCCs with ≥ 2 nodes or self-loop
      let hasSelfLoop = false
      for (const edge of graph.edges) {
        if (edge.fromLineKey === v && edge.toLineKey === v) {
          hasSelfLoop = true
          break
        }
      }
      if (scc.length >= 2 || (scc.length === 1 && hasSelfLoop)) {
        result.push(scc)
      }
    }
  }

  for (const key of nodeKeys) {
    if (!index.has(key)) {
      strongConnect(key)
    }
  }

  return result
}

export function buildFlowPlanGraph(
  cModules: SavedModule[],
  buildFlowView: BuildFlowPlanView | null,
  modulesMap: Record<string, X4Module>
): BuildFlowPlanGraph {
  const graph: Graph = {
    nodes: new Map(),
    edges: [],
  }

  const cBuildCostRates = computeBuildRates(cModules, modulesMap)
  const cWares = Object.keys(cBuildCostRates).filter(w => w !== 'energycells')

  if (!buildFlowView || buildFlowView.buildFlowGroups.length === 0) {
    return {
      nodes: new Map(),
      edges: [],
      sccGroups: [],
      cModules,
      cBuildCostRates,
    }
  }

  // BFS queue: { wareIds, fromKey, fromLabel }
  interface QueueItem {
    wareIds: string[]
    fromKey: string
    fromLabel: string
  }
  const queue: QueueItem[] = [{ wareIds: cWares, fromKey: '__C__', fromLabel: 'C buildCost' }]
  const addedGroups = new Set<string>()

  while (queue.length > 0) {
    const item = queue.shift()!
    for (const wid of item.wareIds) {
      const conn = item.fromKey === '__C__'
        ? findOutputBuildConnection(wid, buildFlowView)
        : findLineBuildMaterialConnection(wid, buildFlowView, item.fromKey)
      if (!conn) continue

      const targetKey = conn.sourceGroupId

      if (!addedGroups.has(targetKey)) {
        const node: GraphNode = {
          lineGroupId: targetKey,
          lineName: getGroupDisplayName(targetKey, buildFlowView),
          trackedWares: new Set([wid]),
          modules: [],
          moduleIds: [],
          isSelfBootstrap: false,
          netProduction: {},
        }
        graph.nodes.set(targetKey, node)
        addedGroups.add(targetKey)

        // Get line buildMaterialTags for further BFS
        const lineBuildWares = getGroupBuildMaterialWares(targetKey, buildFlowView)
        if (lineBuildWares.length > 0) {
          queue.push({
            wareIds: lineBuildWares,
            fromKey: targetKey,
            fromLabel: node.lineName + ' buildCost',
          })
        }
      } else {
        const node = graph.nodes.get(targetKey)!
        node.trackedWares.add(wid)
      }

      graph.edges.push({
        fromLineKey: item.fromKey,
        toLineKey: targetKey,
        wareId: wid,
        sourceLabel: item.fromLabel,
      })
    }
  }

  // SCC Detection using Tarjan's algorithm
  const sccGroups = findSCCs(graph)

  return {
    nodes: graph.nodes as Map<string, BuildFlowPlanLine>,
    edges: graph.edges,
    sccGroups,
    cModules,
    cBuildCostRates,
  }
}

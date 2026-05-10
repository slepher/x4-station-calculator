import { describe, it, expect } from 'vitest'
import { buildFlowPlanGraph, ROOT_BUILD_COST_KEY } from '@/store/logic/buildFlowPlanGraph'
import type { BuildFlowPlanView } from '@/types/build-plan'
import type { BuildFlowGroup, BuildFlowTag, BuildFlowLineCard, BuildFlowAssignment, FlowNode, ProductionLineGroup } from '@/types/x4'
import type { SavedModule, X4Module, X4Ware } from '@/types/x4'

function makeModule(overrides: Partial<X4Module> & { id: string }): X4Module {
  return {
    name: overrides.id,
    nameId: '',
    type: 'production',
    method: 'default',
    race: 'argon',
    dlc_tag: 'base',
    tier: 1,
    group: 'hightech',
    macroId: '',
    isPlayerBlueprint: true,
    buildTime: 3600,
    buildCost: {},
    inputs: {},
    outputs: {},
    workforceCapacity: 0,
    workforceNeeded: 0,
    ...overrides
  }
}

function makeWare(overrides: Partial<X4Ware> & { id: string }): X4Ware {
  return {
    name: overrides.id,
    nameId: '',
    dlc_tag: 'base',
    transport: 'container',
    volume: 1,
    price: 100,
    minPrice: 50,
    maxPrice: 200,
    tier: 1,
    group: 'hightech',
    ...overrides
  }
}

function makeBuildFlowTag(wareId: string, suffix: string = ''): BuildFlowTag {
  return {
    tagId: `tag-${wareId}${suffix}`,
    wareId,
    label: wareId,
  }
}

function makeBuildFlowLineCard(groupId: string, sourceWares: string[], buildWares: string[]): BuildFlowLineCard {
  return {
    groupId,
    title: groupId,
    sourceTags: sourceWares.map(w => makeBuildFlowTag(w, '-src')),
    buildMaterialTags: buildWares.map(w => makeBuildFlowTag(w, '-bld')),
  }
}

function makeBuildFlowGroup(lineCards: BuildFlowLineCard[]): BuildFlowGroup {
  const allSourceWares = new Set<string>()
  for (const card of lineCards) {
    for (const tag of card.sourceTags) {
      allSourceWares.add(tag.wareId)
    }
  }
  return {
    groupKey: lineCards.map(c => c.groupId).join(':'),
    lineCards,
    outputBuildTags: [...allSourceWares].map(w => makeBuildFlowTag(w, '-outbuild')),
    outputMaterialTags: [...allSourceWares].map(w => makeBuildFlowTag(w, '-outmat')),
  }
}

let nodeIdCounter = 0
function makeNode(overrides: Partial<FlowNode> & { wareId: string }): FlowNode {
  return {
    id: overrides.id || `node_${++nodeIdCounter}`,
    wareId: overrides.wareId,
    moduleId: overrides.moduleId,
    race: overrides.race || 'argon',
    lineage: overrides.lineage || '',
    column: overrides.column ?? 1,
    isIsolated: overrides.isIsolated ?? false,
    isAuto: overrides.isAuto ?? (overrides.source === 'auto'),
    isRoot: overrides.isRoot ?? (overrides.source === 'manual'),
    source: overrides.source || 'manual',
    order: overrides.order ?? 0,
    isPreview: overrides.isPreview,
  }
}

function makeGroup(overrides: Partial<ProductionLineGroup> & { id: string }): ProductionLineGroup {
  return {
    id: overrides.id,
    name: overrides.name || overrides.id,
    category: overrides.category || 'industrial',
    subCategory: overrides.subCategory || 'default',
    isLocked: overrides.isLocked ?? false,
    lockedLineage: overrides.lockedLineage || '',
    nodes: overrides.nodes || [],
  }
}

describe('buildFlowPlanGraph', () => {
  const hullpartsWare = makeWare({ id: 'hullparts', name: 'Hull Parts' })
  const claytronicsWare = makeWare({ id: 'claytronics', name: 'Claytronics' })
  const advancedWare = makeWare({ id: 'advancedcomposites', name: 'Advanced Composites' })
  const plasmaWare = makeWare({ id: 'plasmaconductors', name: 'Plasma Conductors' })

  const hullpartsModule = makeModule({
    id: 'module_hullparts',
    name: 'Hull Part Production',
    group: 'hightech',
    outputs: { hullparts: 100 },
    inputs: { refinedmetals: 200, graphene: 100, energycells: 50 },
    buildCost: { advancedcomposites: 100, plasmaconductors: 100 },
  })

  const claytronicsModule = makeModule({
    id: 'module_claytronics',
    name: 'Claytronics Production',
    group: 'hightech',
    outputs: { claytronics: 40 },
    inputs: { siliconwafers: 200, microchips: 100, energycells: 50 },
    buildCost: { hullparts: 2851, claytronics: 1140, energycells: 249 },
  })

  const claytronicsInputModule = makeModule({
    id: 'module_siliconwafers',
    name: 'Silicon Wafer Production',
    group: 'intermediates',
    outputs: { siliconwafers: 200 },
    inputs: { silicon: 100, energycells: 50 },
    buildCost: { hullparts: 84, claytronics: 84, energycells: 188 },
  })

  const modulesMap: Record<string, X4Module> = {
    module_hullparts: hullpartsModule,
    module_claytronics: claytronicsModule,
    module_siliconwafers: claytronicsInputModule,
  }

  const waresMap: Record<string, X4Ware> = {
    hullparts: hullpartsWare,
    claytronics: claytronicsWare,
    advancedcomposites: advancedWare,
    plasmaconductors: plasmaWare,
  }

  it('builds graph with single outputBuildTag connection', () => {
    // C = claytronics module, buildCost → hullparts
    // hullparts has outputBuildTag connected to line "L1"
    const cModules: SavedModule[] = [{ id: 'module_claytronics', count: 1 }]

    const l1Card = makeBuildFlowLineCard('L1', ['hullparts'], ['advancedcomposites', 'plasmaconductors'])
    const group = makeBuildFlowGroup([l1Card])

    const buildFlowView: BuildFlowPlanView = {
      buildFlowGroups: [group],
      assignments: [{
        wareId: 'hullparts',
        sourceGroupId: 'L1',
        targetType: 'output-build-material',
      }],
      virtualEdges: [],
    }

    const graph = buildFlowPlanGraph(cModules, buildFlowView, modulesMap)

    // One node for L1
    expect(graph.nodes.size).toBe(1)
    expect(graph.nodes.has('L1')).toBe(true)

    const l1Node = graph.nodes.get('L1')!
    expect(l1Node.lineGroupId).toBe('L1')
    expect(l1Node.trackedWares).toEqual(new Set(['hullparts']))

    // One edge: root → L1
    expect(graph.edges.length).toBe(1)
    expect(graph.edges[0]).toMatchObject({
      fromLineKey: ROOT_BUILD_COST_KEY,
      toLineKey: 'L1',
      wareId: 'hullparts',
    })

    // No SCCs
    expect(graph.sccGroups.length).toBe(0)
  })

  it('builds DAG chain: C→L1→L2', () => {
    // C = claytronics module, buildCost → hullparts
    // hullparts connected to L1 (hullpart producer)
    // L1's buildCost → advancedcomposites, plasmaconductors
    // plasmaconductors connected to L2
    const cModules: SavedModule[] = [{ id: 'module_claytronics', count: 1 }]

    const l1Card = makeBuildFlowLineCard('L1', ['hullparts'], ['advancedcomposites', 'plasmaconductors'])
    const l2Card = makeBuildFlowLineCard('L2', ['plasmaconductors'], [])
    const group = makeBuildFlowGroup([l1Card, l2Card])

    const buildFlowView: BuildFlowPlanView = {
      buildFlowGroups: [group],
      assignments: [
        { wareId: 'hullparts', sourceGroupId: 'L1', targetType: 'output-build-material' },
        { wareId: 'plasmaconductors', sourceGroupId: 'L2', targetType: 'output-build-material' },
        { wareId: 'plasmaconductors', sourceGroupId: 'L2', targetType: 'line-build-material', targetGroupId: 'L1' },
      ],
      virtualEdges: [],
    }

    const graph = buildFlowPlanGraph(cModules, buildFlowView, modulesMap)

    expect(graph.nodes.size).toBe(2)
    expect(graph.nodes.has('L1')).toBe(true)
    expect(graph.nodes.has('L2')).toBe(true)

    const l1Node = graph.nodes.get('L1')!
    expect(l1Node.trackedWares).toEqual(new Set(['hullparts']))
    const l2Node = graph.nodes.get('L2')!
    expect(l2Node.trackedWares).toEqual(new Set(['plasmaconductors']))

    // Edges: root→L1 (hullparts), L1→L2 (plasmaconductors)
    expect(graph.edges.length).toBe(2)
    const cL1Edge = graph.edges.find(e => e.fromLineKey === ROOT_BUILD_COST_KEY && e.toLineKey === 'L1')
    expect(cL1Edge).toBeDefined()
    expect(cL1Edge!.wareId).toBe('hullparts')

    const l1L2Edge = graph.edges.find(e => e.fromLineKey === 'L1' && e.toLineKey === 'L2')
    expect(l1L2Edge).toBeDefined()
    expect(l1L2Edge!.wareId).toBe('plasmaconductors')

    expect(graph.sccGroups.length).toBe(0)
  })

  it('ignores ware with no outputBuildTag connection', () => {
    // C = hullparts module, buildCost → advancedcomposites, plasmaconductors
    // plasmaconductors has no connection → ignored
    // advancedcomposites connected to L1
    const cModules: SavedModule[] = [{ id: 'module_hullparts', count: 1 }]

    const l1Card = makeBuildFlowLineCard('L1', ['advancedcomposites'], [])
    const group = makeBuildFlowGroup([l1Card])

    const buildFlowView: BuildFlowPlanView = {
      buildFlowGroups: [group],
      assignments: [
        { wareId: 'advancedcomposites', sourceGroupId: 'L1', targetType: 'output-build-material' },
      ],
      virtualEdges: [],
    }

    const graph = buildFlowPlanGraph(cModules, buildFlowView, modulesMap)

    // Only L1 in graph (plasmaconductors ignored)
    expect(graph.nodes.size).toBe(1)
    expect(graph.nodes.has('L1')).toBe(true)
    expect(graph.edges.length).toBe(1)
  })

  it('detects SCC in cycle: C→L1→L2→L1', () => {
    // L1 buildCost → ware_a, connected to L2
    // L2 buildCost → ware_b, connected back to L1
    const cModules: SavedModule[] = [{ id: 'module_claytronics', count: 1 }]

    const l1Card = makeBuildFlowLineCard('L1', ['hullparts'], ['ware_a'])
    const l2Card = makeBuildFlowLineCard('L2', ['ware_a'], ['hullparts'])
    const group = makeBuildFlowGroup([l1Card, l2Card])

    const buildFlowView: BuildFlowPlanView = {
      buildFlowGroups: [group],
      assignments: [
        { wareId: 'hullparts', sourceGroupId: 'L1', targetType: 'output-build-material' },
        { wareId: 'ware_a', sourceGroupId: 'L2', targetType: 'output-build-material' },
        { wareId: 'ware_a', sourceGroupId: 'L2', targetType: 'line-build-material', targetGroupId: 'L1' },
        { wareId: 'hullparts', sourceGroupId: 'L1', targetType: 'line-build-material', targetGroupId: 'L2' },
      ],
      virtualEdges: [],
    }

    const graph = buildFlowPlanGraph(cModules, buildFlowView, modulesMap)

    expect(graph.nodes.size).toBe(2)
    // SCC should have L1 and L2
    expect(graph.sccGroups.length).toBe(1)
    const scc = graph.sccGroups[0]!
    expect(scc).toContain('L1')
    expect(scc).toContain('L2')
    expect(scc.length).toBe(2)
  })

  // ------------------------------------------------------------------
  // Isolated expansion
  // ------------------------------------------------------------------

  it('adds producing line via isolated expansion when no buildFlow groups param given', () => {
    // When no groups param is given, isolated expansion is skipped
    const cModules: SavedModule[] = [{ id: 'module_claytronics', count: 1 }]

    const l1Card = makeBuildFlowLineCard('g1', ['hullparts'], [])
    const group = makeBuildFlowGroup([l1Card])

    const buildFlowView: BuildFlowPlanView = {
      buildFlowGroups: [group],
      assignments: [
        { wareId: 'hullparts', sourceGroupId: 'g1', targetType: 'output-build-material' },
      ],
      virtualEdges: [],
    }

    const graph = buildFlowPlanGraph(cModules, buildFlowView, modulesMap, [])

    // Only g1 from build flow
    expect(graph.nodes.size).toBe(1)
    expect(graph.nodes.has('g1')).toBe(true)
  })

  it('expands isolated ware to producing line via findGroupProducingWare', () => {
    const cModules: SavedModule[] = [{ id: 'module_claytronics', count: 1 }]

    const l1Card = makeBuildFlowLineCard('g1', ['hullparts'], [])
    const buildFlowGroup = makeBuildFlowGroup([l1Card])

    const buildFlowView: BuildFlowPlanView = {
      buildFlowGroups: [buildFlowGroup],
      assignments: [
        { wareId: 'hullparts', sourceGroupId: 'g1', targetType: 'output-build-material' },
      ],
      virtualEdges: [],
    }

    // g1 has isolated node for advComp, g2 produces advComp
    const isolatedAdvComp = makeNode({ wareId: 'advancedcomposites', source: 'manual', isIsolated: true })
    const producingAdvComp = makeNode({ wareId: 'advancedcomposites', source: 'manual' })
    const logicGroup1 = makeGroup({ id: 'g1', nodes: [isolatedAdvComp] })
    const logicGroup2 = makeGroup({ id: 'g2', nodes: [producingAdvComp] })

    const graph = buildFlowPlanGraph(cModules, buildFlowView, modulesMap, [logicGroup1, logicGroup2])

    expect(graph.nodes.size).toBe(2)
    expect(graph.nodes.has('g1')).toBe(true)
    expect(graph.nodes.has('g2')).toBe(true)

    const g2Node = graph.nodes.get('g2')!
    expect(g2Node.trackedWares).toEqual(new Set(['advancedcomposites']))

    // Edge: g1 → g2 (advancedcomposites)
    const edge = graph.edges.find(e => e.fromLineKey === 'g1' && e.toLineKey === 'g2')
    expect(edge).toBeDefined()
    expect(edge!.wareId).toBe('advancedcomposites')

    // No SCCs
    expect(graph.sccGroups.length).toBe(0)
  })

  it('does not add edge for isolated ware with no producing line', () => {
    const cModules: SavedModule[] = [{ id: 'module_claytronics', count: 1 }]

    const l1Card = makeBuildFlowLineCard('g1', ['hullparts'], [])
    const buildFlowGroup = makeBuildFlowGroup([l1Card])

    const buildFlowView: BuildFlowPlanView = {
      buildFlowGroups: [buildFlowGroup],
      assignments: [
        { wareId: 'hullparts', sourceGroupId: 'g1', targetType: 'output-build-material' },
      ],
      virtualEdges: [],
    }

    // g1 has isolated node for advComp, but no producing line exists
    const isolatedAdvComp = makeNode({ wareId: 'advancedcomposites', source: 'manual', isIsolated: true })
    const logicGroup1 = makeGroup({ id: 'g1', nodes: [isolatedAdvComp] })

    const graph = buildFlowPlanGraph(cModules, buildFlowView, modulesMap, [logicGroup1])

    // Only g1 from build flow
    expect(graph.nodes.size).toBe(1)
    expect(graph.nodes.has('g1')).toBe(true)
  })

  it('only adds edge for isolated ware already in graph, no duplicate node', () => {
    const cModules: SavedModule[] = [{ id: 'module_claytronics', count: 1 }]

    const l1Card = makeBuildFlowLineCard('g1', ['hullparts'], ['advancedcomposites'])
    const buildFlowGroup = makeBuildFlowGroup([l1Card])

    const buildFlowView: BuildFlowPlanView = {
      buildFlowGroups: [buildFlowGroup],
      assignments: [
        { wareId: 'hullparts', sourceGroupId: 'g1', targetType: 'output-build-material' },
        { wareId: 'advancedcomposites', sourceGroupId: 'g2', targetType: 'line-build-material', targetGroupId: 'g1' },
      ],
      virtualEdges: [],
    }

    // g2 is already in buildFlow (via buildMaterialTags), g1 has isolated node for advComp
    const isolatedAdvComp = makeNode({ wareId: 'advancedcomposites', source: 'manual', isIsolated: true })
    const producingAdvComp = makeNode({ wareId: 'advancedcomposites', source: 'manual' })
    const logicGroup1 = makeGroup({ id: 'g1', nodes: [isolatedAdvComp] })
    const logicGroup2 = makeGroup({ id: 'g2', nodes: [producingAdvComp] })

    const graph = buildFlowPlanGraph(cModules, buildFlowView, modulesMap, [logicGroup1, logicGroup2])

    // g2 should be in graph (from build flow), not duplicated
    expect(graph.nodes.size).toBe(2)
    expect(graph.nodes.has('g1')).toBe(true)
    expect(graph.nodes.has('g2')).toBe(true)
  })
})

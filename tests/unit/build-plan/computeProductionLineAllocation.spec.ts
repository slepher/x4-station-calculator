import { describe, it, expect } from 'vitest'
import { computeProductionLineAllocation } from '@/store/logic/computeProductionLineAllocation'
import type { BuildGoal, ProductionLineAllocation } from '@/types/build-plan'
import type {
  X4Module,
  X4Ware,
  FlowNode,
  ProductionLineGroup,
  BuildFlowGroup,
  BuildFlowAssignment,
  BuildFlowTag,
  BuildFlowLineCard,
  VirtualEdge,
} from '@/types/x4'

// ---- Factory helpers ----

let moduleIdCounter = 0
function makeModule(overrides: Partial<X4Module> & { id?: string }): X4Module {
  const id = overrides.id || `mod_${++moduleIdCounter}`
  return {
    id,
    macroId: overrides.macroId || `macro_${id}`,
    wareId: overrides.wareId || `ware_${id}`,
    nameId: overrides.nameId || '',
    name: overrides.name || id,
    dlc_tag: overrides.dlc_tag || '',
    type: overrides.type || 'production',
    method: overrides.method || 'default',
    isPlayerBlueprint: overrides.isPlayerBlueprint ?? true,
    group: overrides.group || 'hightech',
    race: overrides.race || 'argon',
    buildTime: overrides.buildTime || 600,
    buildCost: overrides.buildCost || {},
    cycleTime: overrides.cycleTime || 60,
    workforce: overrides.workforce || { max: 100, perModule: 10, race: 'argon' },
    outputs: overrides.outputs || {},
    inputs: overrides.inputs || {},
    dockingCount: overrides.dockingCount || 0,
    color: overrides.color || '#FF0000',
    color_rgb: overrides.color_rgb || '#FF0000',
    tier: overrides.tier ?? 1,
  }
}

let wareIdCounter = 0
function makeWare(overrides: Partial<X4Ware> & { id?: string }): X4Ware {
  const id = overrides.id || `ware_${++wareIdCounter}`
  return {
    id,
    nameId: overrides.nameId || '',
    name: overrides.name || id,
    description: overrides.description || '',
    group: overrides.group || 'hightech',
    dlc_tag: overrides.dlc_tag || '',
    price: overrides.price || { min: 100, avg: 200, max: 300 },
    volume: overrides.volume || 1,
    transportType: overrides.transportType || 'container',
    tier: overrides.tier ?? 1,
    shipProductionValue: overrides.shipProductionValue ?? 0,
    moduleGroup: overrides.moduleGroup || '',
    wareGroup: overrides.wareGroup || '',
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
    name: overrides.name || '',
    category: overrides.category || 'industrial',
    subCategory: overrides.subCategory || 'default',
    isLocked: overrides.isLocked ?? false,
    lockedLineage: overrides.lockedLineage || '',
    nodes: overrides.nodes || [],
  }
}

function makeBuildFlowGroup(
  groupKey: string,
  lineCardGroupIds: string[],
  outputMaterialWareIds: string[],
): BuildFlowGroup {
  const lineCards: BuildFlowLineCard[] = lineCardGroupIds.map((gid) => ({
    groupId: gid,
    title: gid,
    sourceTags: [],
    buildMaterialTags: [],
  }))
  const outputMaterialTags: BuildFlowTag[] = outputMaterialWareIds.map((wid) => ({
    tagId: `out:${groupKey}:${wid}`,
    wareId: wid,
    label: wid,
  }))
  return {
    groupKey,
    lineCards,
    outputBuildTags: [],
    outputMaterialTags,
  }
}

function makeAssignment(wareId: string, sourceGroupId: string): BuildFlowAssignment {
  return {
    wareId,
    sourceGroupId,
    targetType: 'output-material',
  }
}

function makeVirtualEdge(wareId: string, sourceGroupId: string): VirtualEdge {
  return {
    wareId,
    sourceGroupId,
    targetType: 'output-material',
    isArchived: false,
    isDashed: true,
  }
}

// ---- Tests ----

describe('computeProductionLineAllocation', () => {
  // ------------------------------------------------------------------
  // Tracer bullet: empty input
  // ------------------------------------------------------------------
  it('returns empty allocations for empty goals', () => {
    const result = computeProductionLineAllocation([], [], null, {}, {})
    expect(result).toEqual([])
  })

  // ------------------------------------------------------------------
  // Layer 2: Logic-flow manual node matching
  // ------------------------------------------------------------------
  it('matches prod-rate goal to manual node by wareId', () => {
    const wareId = 'hullparts'
    const module = makeModule({ id: 'mod_hp', outputs: { [wareId]: 1000 } })
    const node = makeNode({ wareId, source: 'manual', moduleId: 'mod_hp' })
    const group = makeGroup({ id: 'g1', name: 'Hull Parts Line', nodes: [node] })

    const goal: BuildGoal = { type: 'production-rate', wareId, ratePerHour: 500 }
    const result = computeProductionLineAllocation(
      [goal],
      [group],
      null,
      { [module.id]: module },
      { [wareId]: [module] },
    )

    expect(result).toHaveLength(1)
    expect(result[0].groupId).toBe('g1')
    expect(result[0].groupName).toBe('Hull Parts Line')
    expect(result[0].isUnmatched).toBe(false)
    expect(result[0].goals).toHaveLength(1)
    expect(result[0].goals[0]).toEqual(goal)
  })

  // ------------------------------------------------------------------
  // Layer 2: Logic-flow auto node matching (fallback after manual)
  // ------------------------------------------------------------------
  it('matches prod-rate goal to auto node when no manual matches', () => {
    const wareId = 'hullparts'
    const manualNode = makeNode({ wareId: 'missilecomponents', source: 'manual' })
    const autoNode = makeNode({ wareId, source: 'auto' })
    const group = makeGroup({
      id: 'g1',
      name: 'Missile Line',
      nodes: [manualNode, autoNode],
    })

    const goal: BuildGoal = { type: 'production-rate', wareId, ratePerHour: 500 }
    const module = makeModule({ id: 'mod_hp', outputs: { [wareId]: 1000 } })
    const result = computeProductionLineAllocation(
      [goal],
      [group],
      null,
      { [module.id]: module },
      { [wareId]: [module] },
    )

    expect(result).toHaveLength(1)
    expect(result[0].groupId).toBe('g1')
    expect(result[0].goals[0]).toEqual(goal)
  })

  // ------------------------------------------------------------------
  // Layer 3: Unmatched
  // ------------------------------------------------------------------
  it('assigns unmatched goal to "未命中"', () => {
    const wareId = 'hullparts'
    const module = makeModule({ id: 'mod_hp', outputs: { [wareId]: 1000 } })

    const goal: BuildGoal = { type: 'production-rate', wareId, ratePerHour: 500 }
    const result = computeProductionLineAllocation(
      [goal],
      [],
      null,
      { [module.id]: module },
      { [wareId]: [module] },
    )

    expect(result).toHaveLength(1)
    expect(result[0].isUnmatched).toBe(true)
    expect(result[0].groupId).toBeUndefined()
    expect(result[0].goals[0]).toEqual(goal)
  })

  // ------------------------------------------------------------------
  // Layer 1: Build-flow outputMaterialTag matching
  // ------------------------------------------------------------------
  it('matches goal to sourceGroupId via build-flow outputMaterialTag', () => {
    const wareId = 'hullparts'
    const sourceGroupId = 'g1'
    const module = makeModule({ id: 'mod_hp', outputs: { [wareId]: 1000 } })

    const group = makeGroup({ id: sourceGroupId, name: 'Hull Parts Line', nodes: [] })
    const bfg = makeBuildFlowGroup('bfg1', [], [wareId])
    const assignment = makeAssignment(wareId, sourceGroupId)

    const goal: BuildGoal = { type: 'production-rate', wareId, ratePerHour: 500 }
    const result = computeProductionLineAllocation(
      [goal],
      [group],
      {
        buildFlowGroups: [bfg],
        assignments: [assignment],
        virtualEdges: [],
      },
      { [module.id]: module },
      { [wareId]: [module] },
    )

    expect(result).toHaveLength(1)
    expect(result[0].groupId).toBe(sourceGroupId)
    expect(result[0].isUnmatched).toBe(false)
  })

  // ------------------------------------------------------------------
  // Layer 1: Build-flow virtual edge fallback (no assignment)
  // ------------------------------------------------------------------
  it('falls back to virtual edge when no assignment exists', () => {
    const wareId = 'claytronics'
    const sourceGroupId = 'g1'
    const module = makeModule({ id: 'mod_ct', outputs: { [wareId]: 500 } })

    const group = makeGroup({ id: sourceGroupId, name: 'Claytronics Line', nodes: [] })
    const bfg = makeBuildFlowGroup('bfg1', [], [wareId])
    const virtualEdge = makeVirtualEdge(wareId, sourceGroupId)

    const goal: BuildGoal = { type: 'production-rate', wareId, ratePerHour: 500 }
    const result = computeProductionLineAllocation(
      [goal],
      [group],
      {
        buildFlowGroups: [bfg],
        assignments: [],
        virtualEdges: [virtualEdge],
      },
      { [module.id]: module },
      { [wareId]: [module] },
    )

    expect(result).toHaveLength(1)
    expect(result[0].groupId).toBe(sourceGroupId)
  })

  // ------------------------------------------------------------------
  // build-module goal matching via moduleId
  // ------------------------------------------------------------------
  it('matches build-module goal to manual node by moduleId', () => {
    const moduleId = 'mod_missile_fac'
    const wareId = 'missilecomponents'
    const module = makeModule({ id: moduleId, outputs: { [wareId]: 500 } })
    const node = makeNode({ wareId, source: 'manual', moduleId })
    const group = makeGroup({ id: 'g1', name: 'Missile Line', nodes: [node] })

    const goal: BuildGoal = { type: 'build-module', moduleId, count: 1 }
    const result = computeProductionLineAllocation(
      [goal],
      [group],
      null,
      { [moduleId]: module },
      { [wareId]: [module] },
    )

    expect(result).toHaveLength(1)
    expect(result[0].groupId).toBe('g1')
    expect(result[0].goals[0]).toEqual(goal)
  })

  // ------------------------------------------------------------------
  // Derived goal: producing group upstream triggers derivation
  // ------------------------------------------------------------------
  // Derived goal: isolated node upstream triggers derivation
  // ------------------------------------------------------------------
  it('generates derived-rate goal when isolated node is upstream of user goal', () => {
    const parentWare = 'missilecomponents'
    const inputWare = 'hullparts'
    const parentModule = makeModule({
      id: 'mod_missile',
      outputs: { [parentWare]: 500 },
      inputs: { [inputWare]: 100 },
    })
    const inputModule = makeModule({
      id: 'mod_hullparts',
      outputs: { [inputWare]: 1000 },
      inputs: {},
    })

    const isolatedNode = makeNode({ wareId: inputWare, source: 'manual', isIsolated: true })
    const group = makeGroup({ id: 'g1', name: 'Hull Line', nodes: [isolatedNode] })

    const goal: BuildGoal = { type: 'production-rate', wareId: parentWare, ratePerHour: 500 }
    const result = computeProductionLineAllocation(
      [goal],
      [group],
      null,
      { [parentModule.id]: parentModule, [inputModule.id]: inputModule },
      {
        [parentWare]: [parentModule],
        [inputWare]: [inputModule],
      },
    )

    const allGoals = result.flatMap((a) => a.goals)
    const derived = allGoals.find((g) => g.type === 'derived-rate')
    expect(derived).toBeDefined()
    expect(derived!.type).toBe('derived-rate')
    expect((derived as { wareId: string }).wareId).toBe(inputWare)
    expect((derived as { ratePerHour: number }).ratePerHour).toBe(0)
  })

  // ------------------------------------------------------------------
  // Derived goal: producing-only node does NOT generate derived
  // ------------------------------------------------------------------
  it('does not generate derived goal when upstream ware has non-isolated node only', () => {
    const parentWare = 'missilecomponents'
    const inputWare = 'hullparts'
    const parentModule = makeModule({
      id: 'mod_missile',
      outputs: { [parentWare]: 500 },
      inputs: { [inputWare]: 100 },
    })
    const inputModule = makeModule({
      id: 'mod_hullparts',
      outputs: { [inputWare]: 1000 },
      inputs: {},
    })

    // Producing (non-isolated) node - does NOT trigger derived goal
    const producingNode = makeNode({ wareId: inputWare, source: 'manual', isIsolated: false })
    const group = makeGroup({ id: 'g1', name: 'Hull Line', nodes: [producingNode] })

    const goal: BuildGoal = { type: 'production-rate', wareId: parentWare, ratePerHour: 500 }
    const result = computeProductionLineAllocation(
      [goal],
      [group],
      null,
      { [parentModule.id]: parentModule, [inputModule.id]: inputModule },
      {
        [parentWare]: [parentModule],
        [inputWare]: [inputModule],
      },
    )

    const allGoals = result.flatMap((a) => a.goals)
    const derived = allGoals.filter((g) => g.type === 'derived-rate')
    expect(derived).toHaveLength(0)
  })

  // ------------------------------------------------------------------
  // No flow groups → all goals unmatched (no derived)
  // ------------------------------------------------------------------
  it('assigns all goals to unmatched when no flow groups exist', () => {
    const wareId = 'hullparts'
    const module = makeModule({ id: 'mod_hp', outputs: { [wareId]: 1000 } })
    const goal: BuildGoal = { type: 'production-rate', wareId, ratePerHour: 500 }

    const result = computeProductionLineAllocation(
      [goal],
      [],
      null,
      { [module.id]: module },
      { [wareId]: [module] },
    )

    expect(result).toHaveLength(1)
    expect(result[0].isUnmatched).toBe(true)
    expect(result[0].goals).toHaveLength(1)
  })

  // ------------------------------------------------------------------
  // Multiple groups: each goal matched to correct group
  // ------------------------------------------------------------------
  it('distributes goals across multiple groups correctly', () => {
    const wareA = 'missilecomponents'
    const wareB = 'hullparts'
    const modA = makeModule({ id: 'mod_ma', outputs: { [wareA]: 500 } })
    const modB = makeModule({ id: 'mod_hp', outputs: { [wareB]: 1000 } })

    const nodeA = makeNode({ wareId: wareA, source: 'manual', moduleId: 'mod_ma' })
    const nodeB = makeNode({ wareId: wareB, source: 'manual', moduleId: 'mod_hp' })
    const groupA = makeGroup({ id: 'g1', name: 'Missile', nodes: [nodeA] })
    const groupB = makeGroup({ id: 'g2', name: 'Hull Parts', nodes: [nodeB] })

    const goalA: BuildGoal = { type: 'production-rate', wareId: wareA, ratePerHour: 500 }
    const goalB: BuildGoal = { type: 'build-module', moduleId: 'mod_hp', count: 1 }

    const result = computeProductionLineAllocation(
      [goalA, goalB],
      [groupA, groupB],
      null,
      { [modA.id]: modA, [modB.id]: modB },
      { [wareA]: [modA], [wareB]: [modB] },
    )

    expect(result).toHaveLength(2)
    expect(result[0].groupId).toBe('g1')
    expect(result[0].goals).toHaveLength(1)
    expect(result[0].goals[0]).toEqual(goalA)

    expect(result[1].groupId).toBe('g2')
    expect(result[1].goals).toHaveLength(1)
    expect(result[1].goals[0]).toEqual(goalB)
  })

  // ------------------------------------------------------------------
  // Derived goal is assigned to the same group via matching
  // ------------------------------------------------------------------
  it('derived goal is assigned to matching group', () => {
    const parentWare = 'missilecomponents'
    const inputWare = 'hullparts'
    const parentModule = makeModule({
      id: 'mod_missile',
      outputs: { [parentWare]: 500 },
      inputs: { [inputWare]: 100 },
    })
    const inputModule = makeModule({
      id: 'mod_hp',
      outputs: { [inputWare]: 1000 },
      inputs: {},
    })

    // Hull Parts isolated node is in group g2
    const isolatedNode = makeNode({ wareId: inputWare, source: 'manual', isIsolated: true })
    const groupMissile = makeGroup({ id: 'g1', name: 'Missile', nodes: [] })
    const groupHP = makeGroup({ id: 'g2', name: 'Hull Parts', nodes: [isolatedNode] })

    const goal: BuildGoal = { type: 'production-rate', wareId: parentWare, ratePerHour: 500 }
    const result = computeProductionLineAllocation(
      [goal],
      [groupMissile, groupHP],
      null,
      { [parentModule.id]: parentModule, [inputModule.id]: inputModule },
      {
        [parentWare]: [parentModule],
        [inputWare]: [inputModule],
      },
    )

    // Derived Hull Parts should match to g2 (where its isolated node is)
    expect(result).toHaveLength(2) // g2 (derived) + unmatched (user goal)
    const derivedAlloc = result.find((a) => a.groupId === 'g2')
    expect(derivedAlloc).toBeDefined()
    expect(derivedAlloc!.goals).toHaveLength(1)
    expect(derivedAlloc!.goals[0].type).toBe('derived-rate')
  })

  // ------------------------------------------------------------------
  // Recursive derivation: isolated node deeper upstream triggers derived
  // ------------------------------------------------------------------
  it('recursively generates derived goals for nested upstream isolated nodes', () => {
    // missilecomponents (user) ← hullparts (no isolated) ← refinedmetals (isolated)
    const wareMissile = 'missilecomponents'
    const wareHP = 'hullparts'
    const wareRM = 'refinedmetals'

    const modMissile = makeModule({
      id: 'mod_missile',
      outputs: { [wareMissile]: 500 },
      inputs: { [wareHP]: 100 },
    })
    const modHP = makeModule({
      id: 'mod_hp',
      outputs: { [wareHP]: 1000 },
      inputs: { [wareRM]: 200 },
    })
    const modRM = makeModule({
      id: 'mod_rm',
      outputs: { [wareRM]: 2000 },
      inputs: {},
    })

    const isolatedRM = makeNode({ wareId: wareRM, source: 'manual', isIsolated: true })
    const group = makeGroup({ id: 'g1', name: 'Upstream', nodes: [isolatedRM] })

    const goal: BuildGoal = { type: 'production-rate', wareId: wareMissile, ratePerHour: 500 }
    const result = computeProductionLineAllocation(
      [goal],
      [group],
      null,
      { [modMissile.id]: modMissile, [modHP.id]: modHP, [modRM.id]: modRM },
      {
        [wareMissile]: [modMissile],
        [wareHP]: [modHP],
        [wareRM]: [modRM],
      },
    )

    const allGoals = result.flatMap((a) => a.goals)
    const derived = allGoals.filter((g) => g.type === 'derived-rate')
    expect(derived).toHaveLength(1)
    expect((derived[0] as { wareId: string }).wareId).toBe(wareRM)
  })
})

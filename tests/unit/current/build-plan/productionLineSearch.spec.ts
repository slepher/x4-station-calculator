import { describe, it, expect } from 'vitest'
import { findGroupProducingWare } from '@/store/logic/productionLineSearch'
import type { ProductionLineGroup, FlowNode } from '@/types/x4'

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

describe('findGroupProducingWare', () => {
  it('returns null for empty groups', () => {
    expect(findGroupProducingWare('hullparts', [])).toBeNull()
  })

  it('returns groupId when manual node matches wareId', () => {
    const node = makeNode({ wareId: 'hullparts', source: 'manual' })
    const group = makeGroup({ id: 'g1', name: 'Hull Line', nodes: [node] })
    expect(findGroupProducingWare('hullparts', [group])).toEqual({ sourceGroupId: 'g1' })
  })

  it('returns null when no node matches wareId', () => {
    const node = makeNode({ wareId: 'hullparts', source: 'manual' })
    const group = makeGroup({ id: 'g1', nodes: [node] })
    expect(findGroupProducingWare('claytronics', [group])).toBeNull()
  })

  it('prefers manual node over auto node', () => {
    const autoNode = makeNode({ wareId: 'hullparts', source: 'auto' })
    const manualNode = makeNode({ wareId: 'hullparts', source: 'manual' })
    const group = makeGroup({ id: 'g1', nodes: [autoNode, manualNode] })
    expect(findGroupProducingWare('hullparts', [group])).toEqual({ sourceGroupId: 'g1' })
  })

  it('falls back to auto node when no manual node matches', () => {
    const node = makeNode({ wareId: 'hullparts', source: 'auto' })
    const group = makeGroup({ id: 'g1', nodes: [node] })
    expect(findGroupProducingWare('hullparts', [group])).toEqual({ sourceGroupId: 'g1' })
  })

  it('ignores isolated nodes in manual match', () => {
    const node = makeNode({ wareId: 'hullparts', source: 'manual', isIsolated: true })
    const group = makeGroup({ id: 'g1', nodes: [node] })
    expect(findGroupProducingWare('hullparts', [group])).toBeNull()
  })

  it('finds correct group among multiple groups', () => {
    const nodeA = makeNode({ wareId: 'hullparts', source: 'manual' })
    const nodeB = makeNode({ wareId: 'claytronics', source: 'manual' })
    const groupA = makeGroup({ id: 'g1', nodes: [nodeA] })
    const groupB = makeGroup({ id: 'g2', nodes: [nodeB] })
    expect(findGroupProducingWare('claytronics', [groupA, groupB])).toEqual({ sourceGroupId: 'g2' })
  })

  it('prefers manual group over auto group across groups', () => {
    const autoNode = makeNode({ wareId: 'hullparts', source: 'auto' })
    const manualNode = makeNode({ wareId: 'hullparts', source: 'manual' })
    const autoGroup = makeGroup({ id: 'g1', nodes: [autoNode] })
    const manualGroup = makeGroup({ id: 'g2', nodes: [manualNode] })
    const result = findGroupProducingWare('hullparts', [autoGroup, manualGroup])
    expect(result).toEqual({ sourceGroupId: 'g2' })
  })
})

import type { FlowNode, X4Module, X4Ware } from '@/types/x4'
import { findModuleForWare } from './useGameData'

export interface ExpandContext {
  waresMap: Record<string, X4Ware>
  modulesMap: Record<string, X4Module>
  modulesByOutputMap?: Record<string, X4Module[]>
  findModuleForWare?: (wareId: string, lineage: string) => X4Module | null
}

export interface GroupSnapshot {
  id: string
  nodes: FlowNode[]
  isLocked: boolean
  lockedLineage?: string
  subCategory: string
}

interface ExpandResult {
  newNodes: FlowNode[]
  updatedNodes: Array<{ nodeId: string; updates: Partial<FlowNode> }>
}

export function computeExpandUpstream(
  ctx: ExpandContext,
  group: GroupSnapshot,
  wareId: string,
  source: 'manual' | 'auto',
  overrideLineage?: string
): ExpandResult {
  const result: ExpandResult = {
    newNodes: [],
    updatedNodes: []
  }

  const ware = ctx.waresMap[wareId]
  if (!ware) return result

  const isT0 = ware.tier === 0 || wareId === 'energycells'
  if (isT0) {
    const existingT0Node = group.nodes.find(n => n.wareId === wareId)
    if (!existingT0Node) {
      result.newNodes.push({
        id: crypto.randomUUID(),
        wareId,
        race: 'default',
        lineage: 'default',
        isIsolated: false,
        isAuto: true,
        isRoot: false,
        source: 'auto',
        column: ware.tier,
        order: 0
      })
    }
    return result
  }

  const isolatedNode = group.nodes.find(n => n.wareId === wareId && n.isIsolated)
  if (isolatedNode) {
    return result
  }

  const effectiveLineage = group.isLocked 
    ? (group.lockedLineage || 'default') 
    : (overrideLineage || group.subCategory || 'default')
  let module: X4Module | null = null
  if (ctx.modulesByOutputMap && Object.keys(ctx.modulesByOutputMap).length > 0) {
    module = findModuleForWare(wareId, effectiveLineage, ctx.modulesByOutputMap)
  } else if (ctx.findModuleForWare) {
    module = ctx.findModuleForWare(wareId, effectiveLineage)
  }

  if (!module) {
    return result
  }

  const existingNode = group.nodes.find(n => n.moduleId === module.id)
  if (existingNode) {
    if (existingNode.source === 'auto' && source === 'manual') {
      result.updatedNodes.push({
        nodeId: existingNode.id,
        updates: {
          source: 'manual',
          isAuto: false,
          isRoot: true
        }
      })
    }
    return result
  }

  const newNode: FlowNode = {
    id: crypto.randomUUID(),
    wareId,
    moduleId: module.id,
    race: module.race,
    lineage: effectiveLineage,
    isIsolated: false,
    isAuto: source === 'auto',
    isRoot: source === 'manual',
    source: source,
    column: ware.tier,
    order: 0
  }

  result.newNodes.push(newNode)

  if (module.inputs) {
    Object.keys(module.inputs).forEach(inputWareId => {
      const subResult = computeExpandUpstream(
        ctx,
        { ...group, nodes: [...group.nodes, ...result.newNodes] },
        inputWareId,
        'auto',
        newNode.lineage
      )
      result.newNodes.push(...subResult.newNodes)
      result.updatedNodes.push(...subResult.updatedNodes)
    })
  }

  return result
}

export function traceWareDependencies(
  seeds: Array<{ wareId: string; race: string }>,
  ctx: ExpandContext
): { modules: Set<string>; wares: Set<string> } {
  const collectedModules = new Set<string>()
  const collectedWares = new Set<string>()
  const visitedTraces = new Set<string>()

  function trace(wareId: string, race: string) {
    const traceKey = `${wareId}:${race}`
    if (visitedTraces.has(traceKey)) return
    visitedTraces.add(traceKey)

    const ware = ctx.waresMap[wareId]
    if (!ware) return

    collectedWares.add(wareId)

    let module: X4Module | null = null
    if (ctx.modulesByOutputMap && Object.keys(ctx.modulesByOutputMap).length > 0) {
      module = findModuleForWare(wareId, race, ctx.modulesByOutputMap)
    } else if (ctx.findModuleForWare) {
      module = ctx.findModuleForWare(wareId, race)
    }
    if (!module) return

    collectedModules.add(module.id)

    if (module.inputs) {
      Object.keys(module.inputs).forEach((inputWareId) => {
        trace(inputWareId, race)
      })
    }
  }

  seeds.forEach((seed) => {
    trace(seed.wareId, seed.race)
  })

  return { modules: collectedModules, wares: collectedWares }
}

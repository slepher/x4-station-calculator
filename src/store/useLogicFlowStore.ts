import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useGameDataStore } from './useGameDataStore'
import { computeExpandUpstream, type ExpandContext, type GroupSnapshot } from './logic/logicFlowStream'
import type { FlowNode, ProductionLineGroup, SavedFlowNode, SavedFlowGroup, LogicFlowPlan, SavedFlowPlansState, LogicFlowSettings } from '@/types/x4'

export const useLogicFlowStore = defineStore('logicFlow', () => {
  const gameData = useGameDataStore()
  
  // --- State ---
  const groups = ref<ProductionLineGroup[]>([])
  const activeGroupId = ref<string | null>(null)
  const isDragging = ref(false)
  const draggingWareId = ref<string | null>(null)
  const draggingLineage = ref<string | null>(null)
  const hoveredGroupId = ref<string | null>(null)
  const hoveredNodeId = ref<string | null>(null) // 高亮链路追踪：当前悬停的节点 ID
  const isHoveringNewZone = ref(false)
  const isDefaultLocked = ref(true)
  const previewNodes = ref<Map<string, FlowNode>>(new Map()) // 预览节点：key 为 groupId 或 '__new__'

  // --- Plan Management State ---
  const currentPlanName = ref<string>('')
  const savedPlans = ref<SavedFlowPlansState>({ version: 1, activeId: null, list: [] })
  const lastSavedSnapshot = ref<string>('')
  const settings = ref<LogicFlowSettings>({ isDefaultLocked: true })

  // 同步到 state 以便持久化（可选，但目前主要用于测试注入）
  const startDragging = (wareId: string, lineage?: string) => {
    // T0 资源不可被拖拽 - 每次调用时重新获取 gameData 实例
    const gameDataStore = useGameDataStore()
    const ware = gameDataStore.waresMap[wareId]
    if (ware && ware.tier === 0) {
      return
    }
    isDragging.value = true
    draggingWareId.value = wareId
    draggingLineage.value = lineage || null
  }

  const stopDragging = () => {
    isDragging.value = false
    draggingWareId.value = null
    draggingLineage.value = null
    hoveredGroupId.value = null
    isHoveringNewZone.value = false
    previewNodes.value.clear()
  }

  /**
   * 悬停进入目标 - 生成预览节点
   */
  const handleHover = (targetGroupId: string | 'new') => {
    hoveredGroupId.value = targetGroupId === 'new' ? null : targetGroupId
    isHoveringNewZone.value = targetGroupId === 'new'
    
    if (!draggingWareId.value) return
    
    // 清除其他组的预览节点
    previewNodes.value.clear()
    
    // 检查血统兼容性（对于锁定的产线组）
    if (targetGroupId !== 'new') {
      const lineage = draggingLineage.value || 'default'
      const status = getWareGroupStatus(targetGroupId, draggingWareId.value, lineage)
      if (status === 'rejected' || status === 'duplicated') {
        return
      }
    }
    
    // 生成预览节点
    const lineage = draggingLineage.value || 'default'
    const ware = gameData.waresMap[draggingWareId.value]
    if (!ware) return
    
    const previewNode: FlowNode = {
      id: `preview-${draggingWareId.value}`,
      wareId: draggingWareId.value,
      moduleId: `preview-module-${draggingWareId.value}`,
      race: lineage,
      lineage,
      column: ware.tier,
      isIsolated: false,
      isAuto: false,
      isRoot: true,
      source: 'manual',
      order: 0,
      isPreview: true,
    }
    
    const key = targetGroupId === 'new' ? '__new__' : targetGroupId
    previewNodes.value.set(key, previewNode)
  }

  /**
   * 离开目标区域 - 清除该目标的预览节点
   */
  const handleMoveOut = (targetGroupId: string | 'new') => {
    const key = targetGroupId === 'new' ? '__new__' : targetGroupId
    previewNodes.value.delete(key)
    
    if (targetGroupId === 'new') {
      isHoveringNewZone.value = false
    } else if (hoveredGroupId.value === targetGroupId) {
      hoveredGroupId.value = null
    }
  }

  /**
   * 放置确认 - 将预览转为正式节点
   */
  const handleDrop = (targetGroupId: string | 'new', effectiveLineage?: string) => {
    if (!draggingWareId.value) return
    
    const lineage = effectiveLineage || draggingLineage.value || 'default'
    
    if (targetGroupId === 'new') {
      // 创建新产线组
      const ware = gameData.waresMap[draggingWareId.value]
      if (ware) {
        const isAgricultural = ['agricultural', 'food', 'pharmaceutical', 'water', 'ice'].includes(ware.group)
        const category = isAgricultural ? 'agricultural' : 'industrial'
        const subCategory = lineage || (category === 'industrial' ? 'default' : 'argon')
        const group = addGroup(category, subCategory, undefined, isDefaultLocked.value)
        expandUpstream(group.id, draggingWareId.value, 'manual', subCategory)
      }
    } else {
      // 添加到现有产线组
      const status = getWareGroupStatus(targetGroupId, draggingWareId.value, lineage)
      switch (status) {
        case 'isolated':
          connectAndExpand(targetGroupId, draggingWareId.value, lineage)
          break
        case 'replace':
          replaceNodeWithLineage(targetGroupId, draggingWareId.value, lineage)
          break
        case 'auto':
          const node = groups.value.find(g => g.id === targetGroupId)?.nodes.find(n => n.wareId === draggingWareId.value)
          if (node) promoteNode(targetGroupId, node.id)
          break
        case 'available':
          expandUpstream(targetGroupId, draggingWareId.value, 'manual', lineage)
          break
      }
    }
    
    stopDragging()
  }

  /**
   * 获取产线组的节点（包含预览节点）
   */
  const getNodesWithPreview = (groupId: string): FlowNode[] => {
    const group = groups.value.find(g => g.id === groupId)
    if (!group) return []
    
    const nodes = [...group.nodes]
    
    const preview = previewNodes.value.get(groupId)
    if (preview) {
      nodes.push(preview)
    }
    
    return nodes
  }

  /**
   * 设置悬停节点（用于高亮链路追踪）
   */
  const setHoveredNode = (nodeId: string | null) => {
    hoveredNodeId.value = nodeId
  }

  /**
   * 计算需要高亮的节点 ID 集合
   * 从 hoveredNodeId 出发，追踪上下游依赖链路
   */
  const highlightedNodeIds = computed(() => {
    const result = new Set<string>()
    if (!hoveredNodeId.value) return result

    // 找到悬停的节点
    let hoveredNode: FlowNode | null = null
    let hoveredGroup: ProductionLineGroup | null = null
    
    for (const group of groups.value) {
      const node = group.nodes.find(n => n.id === hoveredNodeId.value)
      if (node) {
        hoveredNode = node
        hoveredGroup = group
        break
      }
    }

    if (!hoveredNode || !hoveredGroup) return result

    // 添加悬停节点本身
    result.add(hoveredNodeId.value)

    // 追踪上游（递归查找输入依赖，直到 T0）
    const traceUpstream = (node: FlowNode, visited: Set<string>) => {
      if (visited.has(node.id)) return
      visited.add(node.id)

      // 获取该节点的输入
      if (node.moduleId) {
        const module = gameData.modulesMap[node.moduleId]
        if (module?.inputs) {
          Object.keys(module.inputs).forEach(inputWareId => {
            // 排除能量电池
            if (inputWareId === 'energycells') return
            
            // 找到组内提供该输入的所有节点（包括 isolated 节点）
            const sourceNodes = hoveredGroup!.nodes.filter(n => n.wareId === inputWareId)
            sourceNodes.forEach(sourceNode => {
              result.add(sourceNode.id)
              // 只有非隔离节点才继续递归追踪
              if (!sourceNode.isIsolated) {
                traceUpstream(sourceNode, visited)
              }
            })
          })
        }
      }
    }

    // 追踪下游（查找消费该产物的节点，直到 T3）
    const traceDownstream = (node: FlowNode, visited: Set<string>) => {
      if (visited.has(node.id)) return
      visited.add(node.id)

      // 找到组内消费该节点产物的所有节点
      hoveredGroup!.nodes.forEach(consumerNode => {
        if (!consumerNode.moduleId) return

        const module = gameData.modulesMap[consumerNode.moduleId]
        if (module?.inputs && module.inputs[node.wareId] !== undefined) {
          result.add(consumerNode.id)
          // 只有非隔离节点才继续递归追踪
          if (!consumerNode.isIsolated) {
            traceDownstream(consumerNode, visited)
          }
        }
      })
    }

    // 执行追踪
    traceUpstream(hoveredNode, new Set())
    traceDownstream(hoveredNode, new Set())

    return result
  })

  /**
   * 计算需要高亮的连线 ID 集合
   * 连线 ID 格式为 `${sourceNodeId}-${targetNodeId}`
   */
  const highlightedConnectionIds = computed(() => {
    const result = new Set<string>()
    if (!hoveredNodeId.value || highlightedNodeIds.value.size === 0) return result

    // 找到悬停节点所在的组
    let hoveredGroup: ProductionLineGroup | null = null
    for (const group of groups.value) {
      if (group.nodes.some(n => n.id === hoveredNodeId.value)) {
        hoveredGroup = group
        break
      }
    }

    if (!hoveredGroup) return result

    // 遍历所有高亮节点之间的连线
    highlightedNodeIds.value.forEach((nodeId: string) => {
      const node = hoveredGroup!.nodes.find(n => n.id === nodeId)
      if (!node || !node.moduleId) return

      const module = gameData.modulesMap[node.moduleId]
      if (!module?.inputs) return

      Object.keys(module.inputs).forEach(inputWareId => {
        // 排除能量电池
        if (inputWareId === 'energycells') return

        // 找到提供该输入的节点
        const sourceNodes = hoveredGroup!.nodes.filter(n => n.wareId === inputWareId)
        sourceNodes.forEach(sourceNode => {
          // 只有当两个节点都在高亮集合中时，才高亮连线
          if (highlightedNodeIds.value.has(sourceNode.id) && highlightedNodeIds.value.has(node.id)) {
            result.add(`${sourceNode.id}-${node.id}`)
          }
        })
      })
    })

    return result
  })

  // --- Computed ---
  /**
   * 计算指定 WareId 所需的所有 T0 资源（不含能量电池）
   */
  function calculateRequiredT0Wares(wareId: string, race: string = 'default'): Record<string, number> {
    const res: Record<string, number> = {}
    const visited = new Set<string>()

    const trace = (id: string, amount: number) => {
      if (id === 'energycells') return // 排除能量电池
      
      const ware = gameData.waresMap[id]
      if (!ware) {
        return
      }

      if (ware.tier === 0) {
        res[id] = (res[id] || 0) + amount
        return
      }

      if (visited.has(id)) return
      visited.add(id)

      // 寻找模块
      const module = gameData.findModuleForWare(id, race)
      if (module && module.inputs) {
        Object.entries(module.inputs).forEach(([inputId, inputAmount]) => {
          trace(inputId, inputAmount * amount)
        })
      }
    }

    trace(wareId, 1)
    return res
  }

  /**
   * 计算指定组的 T0 资源需求（可选包含正在拖拽的模块）
   */
  function getGroupT0Resources(groupId: string, includeDragging: boolean = false): Record<string, number> {
    const group = groups.value.find(g => g.id === groupId)
    if (!group) return {}

    const total: Record<string, number> = {}
    
    // 1. 计算现有 manual 节点的 T0 需求（排除隔离节点）
    group.nodes.filter(n => n.source === 'manual' && !n.isIsolated).forEach(node => {
      const resources = calculateRequiredT0Wares(node.wareId, node.race)
      Object.entries(resources).forEach(([id, amount]) => {
        total[id] = (total[id] || 0) + amount
      })
    })

    // 2. 如果需要包含拖拽中的模块
    if (includeDragging && draggingWareId.value) {
      // 检查是否已经是重复项
      const isDup = group.nodes.some(n => n.wareId === draggingWareId.value)
      if (!isDup) {
        const race = group.category === 'industrial' ? group.subCategory : 'default'
        const resources = calculateRequiredT0Wares(draggingWareId.value, race)
        Object.entries(resources).forEach(([id, amount]) => {
          total[id] = (total[id] || 0) + amount
        })
      }
    }

    return total
  }

  /**
   * 获取排序后的 T0 资源列表 (Dependency-Follow Sorting)
   * 规则：
   * 1. 遍历给定的节点列表（通常是按 Tier 高->低排序的 Manual 节点）
   * 2. 对每个节点，获取其 T0 需求
   * 3. 将需求展平，并去重（保留第一次出现的位置）
   */
  function getSortedGroupT0Resources(nodes: FlowNode[]): string[] {
    const allResources: string[] = []
    const seen = new Set<string>()

    nodes.forEach(node => {
      // 计算该节点的 T0 需求
      const resources = calculateRequiredT0Wares(node.wareId, node.race)
      // calculateRequiredT0Wares 返回的是 Record<id, amount>，键序是不确定的
      // 但对于单个节点，我们希望保持稳定的内部顺序（例如按字母序，或者按 inputs 定义序）
      // 这里暂时按 wareId 字母序，或者如果 inputs 有固定顺序更好。
      // 由于 calculateRequiredT0Wares 使用递归，Object.entries 的顺序依赖于 JS 引擎。
      // 为了稳定，我们对单个节点的资源按名称排序，或者保持原样。
      // 用户希望 "Dependency-Follow"，即该节点的依赖紧随其后。
      
      const nodeResources = Object.keys(resources).sort() // 简单的字母序作为该节点内部的顺序
      
      nodeResources.forEach(resId => {
        if (!seen.has(resId)) {
          seen.add(resId)
          allResources.push(resId)
        }
      })
    })

    return allResources
  }

  /**
   * 初始化
   */
  function init() {
    loadPlansFromStorage()
    
    // 根据 activeId 自动加载当前方案
    if (savedPlans.value.activeId) {
      const activePlan = savedPlans.value.list.find(p => p.id === savedPlans.value.activeId)
      if (activePlan) {
        applyPlan(activePlan)
      }
    }
    
    if (!gameData.isReady) {
      gameData.initialize()
    }
  }

  /**
   * 添加产线组
   */
  function addGroup(category: 'industrial' | 'agricultural', subCategory: string, name?: string, isLocked: boolean = false) {
    const id = crypto.randomUUID()
    
    // name 为空时，UI 会显示默认名称（最高 tier 的 manual 产线名称）
    const newGroup: ProductionLineGroup = {
      id,
      name: name || '',
      category,
      subCategory,
      isLocked,
      lockedLineage: subCategory,
      nodes: []
    }
    groups.value.push(newGroup)
    activeGroupId.value = id
    return newGroup
  }

  /**
   * 删除产线组
   */
  function removeGroup(groupId: string) {
    const idx = groups.value.findIndex(g => g.id === groupId)
    if (idx !== -1) {
      groups.value.splice(idx, 1)
      if (activeGroupId.value === groupId) {
        activeGroupId.value = groups.value[0]?.id || null
      }
    }
  }

  /**
   * 上移产线组
   */
  function moveGroupUp(groupId: string) {
    const index = groups.value.findIndex(g => g.id === groupId)
    if (index <= 0) return
    const moved = groups.value.splice(index, 1)[0]
    if (moved) {
      groups.value.splice(index - 1, 0, moved)
    }
  }

  /**
   * 下移产线组
   */
  function moveGroupDown(groupId: string) {
    const index = groups.value.findIndex(g => g.id === groupId)
    if (index < 0 || index >= groups.value.length - 1) return
    const moved = groups.value.splice(index, 1)[0]
    if (moved) {
      groups.value.splice(index + 1, 0, moved)
    }
  }

  /**
   * 切换节点隔离状态 (原 Lock/Unlock)
   * 隔离操作：Manual → 先降级为 Auto → 再设置 isIsolated = true
   * 连接操作：isIsolated = false，保持 Auto 状态（用户需要手动转正）
   */
  function toggleNodeIsolation(groupId: string, nodeId: string) {
    const group = groups.value.find(g => g.id === groupId)
    if (!group) return

    const node = group.nodes.find(n => n.id === nodeId)
    if (!node) return

    if (!node.isIsolated) {
      // 切换到隔离状态 (Isolate)
      // 1. 如果是 Manual，先降级为 Auto（类似删除按钮的行为）
      if (node.source === 'manual') {
        node.source = 'auto'
      }
      // 2. 设置隔离状态
      node.isIsolated = true
      // 3. 清除模块信息（变成产品占位符）
      node.moduleId = undefined
      // 4. 删除其他同 wareId 的节点（合并为一个 isolated 节点）
      const otherNodes = group.nodes.filter(n => n.wareId === node.wareId && n.id !== node.id)
      otherNodes.forEach(n => {
        const index = group.nodes.indexOf(n)
        if (index > -1) {
          group.nodes.splice(index, 1)
        }
      })
      // 5. 清理不再被需要的上游
      cleanupUnusedAutoNodes(groupId)
    } else {
      // 切换到连接状态 (Connect)
      node.isIsolated = false
      // 保持 Auto 状态，用户需要手动转正
      // 尝试展开上游
      const module = gameData.findModuleForWare(node.wareId, node.lineage || group.subCategory)
      if (module) {
        node.moduleId = module.id
        if (module.inputs) {
          Object.keys(module.inputs).forEach(inputWareId => {
            expandUpstream(groupId, inputWareId, 'auto', node.lineage)
          })
        }
      }
    }
  }

  /**
   * 检查节点是否被依赖
   */
  function isNodeDepended(groupId: string, wareId: string): boolean {
    const group = groups.value.find(g => g.id === groupId)
    if (!group) return false

    return group.nodes.some(n => {
      // 只有非隔离且具有模块 ID 的节点才会依赖上游
      if (!n.moduleId || n.isIsolated) return false
      const module = gameData.modulesMap[n.moduleId]
      return module && module.inputs && module.inputs[wareId] !== undefined
    })
  }

  /**
   * 降级节点为 auto
   */
  function downgradeNode(groupId: string, nodeId: string) {
    const group = groups.value.find(g => g.id === groupId)
    if (group) {
      const node = group.nodes.find(n => n.id === nodeId)
      if (node) {
        node.source = 'auto'
        node.isRoot = false
      }
    }
  }

  /**
   * 将节点转换为隔离状态的 auto 节点
   */
  function convertToIsolatedAuto(groupId: string, nodeId: string) {
    const group = groups.value.find(g => g.id === groupId)
    if (group) {
      const node = group.nodes.find(n => n.id === nodeId)
      if (node) {
        node.source = 'auto'
        node.isIsolated = true
        node.moduleId = undefined
        cleanupUnusedAutoNodes(groupId)
      }
    }
  }

  /**
   * 删除节点
   */
  function removeNode(groupId: string, nodeId: string) {
    const group = groups.value.find(g => g.id === groupId)
    if (group) {
      const idx = group.nodes.findIndex(n => n.id === nodeId)
      if (idx !== -1) {
        const targetNode = group.nodes[idx]
        if (!targetNode) return
        
        // 只有 manual 节点允许调用此方法
        if (targetNode.source !== 'manual') return

        // 检查是否仍被其他节点依赖
        if (isNodeDepended(groupId, targetNode.wareId)) {
          // 降级为 auto
          targetNode.source = 'auto'
          targetNode.isRoot = false
        } else {
          // 物理移除
          group.nodes.splice(idx, 1)
          // 级联清理
          cleanupUnusedAutoNodes(groupId)
        }
      }
    }
  }

  /**
   * 递归扩展上游产业链
   */
  function expandUpstream(
    groupId: string, 
    wareId: string, 
    source: 'manual' | 'auto', 
    overrideLineage?: string
  ) {
    const group = groups.value.find(g => g.id === groupId)
    if (!group) return

    const ctx: ExpandContext = {
      waresMap: gameData.waresMap,
      modulesMap: gameData.modulesMap,
      modulesByOutputMap: gameData.modulesByOutputMap || {},
      findModuleForWare: gameData.findModuleForWare
    }

    const groupSnapshot: GroupSnapshot = {
      id: group.id,
      nodes: group.nodes,
      isLocked: group.isLocked,
      lockedLineage: group.lockedLineage,
      subCategory: group.subCategory
    }

    const result = computeExpandUpstream(ctx, groupSnapshot, wareId, source, overrideLineage)

    result.newNodes.forEach(node => {
      insertNodeSorted(group, node)
    })

    result.updatedNodes.forEach(update => {
      const node = group.nodes.find(n => n.id === update.nodeId)
      if (node) {
        Object.assign(node, update.updates)
      }
    })

    if (source === 'manual' && result.newNodes.length > 0) {
      updateGroupName(group)
    }
  }

  /**
   * 辅助：有序插入节点
   */
  function insertNodeSorted(group: ProductionLineGroup, node: FlowNode) {
    const targetTier = node.column
    let insertIndex = 0
    for (let i = group.nodes.length - 1; i >= 0; i--) {
      const existing = group.nodes[i]
      if (existing && existing.column >= targetTier) {
        insertIndex = i + 1
        break
      }
    }
    group.nodes.splice(insertIndex, 0, node)
  }

  /**
   * 辅助：更新组名称
   */
  function updateGroupName(group: ProductionLineGroup) {
    const maxTierInGroup = Math.max(...group.nodes.map(n => n.column))
    const highestTierManualNode = group.nodes
      .filter(n => n.source === 'manual' && n.column === maxTierInGroup)
      .sort((a, b) => b.column - a.column)[0]
    
    if (highestTierManualNode) {
      const wareName = gameData.localizedWaresMap[highestTierManualNode.wareId]?.localeName || highestTierManualNode.wareId
      group.name = wareName
    }
  }

  /**
   * 级联清理未使用的 auto 节点
   */
  function cleanupUnusedAutoNodes(groupId: string) {
    const group = groups.value.find(g => g.id === groupId)
    if (!group) return

    const nodesToRemove = new Set<string>()
    let hasChanged = true

    while (hasChanged) {
      hasChanged = false
      // 所有非根节点（包括自动生成的和被提升但失去了下游的）都应参与清理检查
      const candidates = group.nodes.filter(n => !n.isRoot)
      
      candidates.forEach(node => {
        if (nodesToRemove.has(node.id)) return

        // 检查是否有任何节点（手动或未被标记删除的自动）依赖于此节点的产出
        const isNeeded = group.nodes.some(otherNode => {
          if (nodesToRemove.has(otherNode.id) || otherNode.id === node.id) return false
          
          // 如果下游节点被隔离，则它不产生对当前节点（上游）的需求
          if (otherNode.isIsolated) return false

          // 获取 otherNode 的输入
          let inputs: string[] = []
          if (otherNode.moduleId) {
            const module = gameData.modulesMap[otherNode.moduleId]
            if (module?.inputs) inputs = Object.keys(module.inputs)
          }

          return inputs.includes(node.wareId)
        })

        if (!isNeeded) {
          nodesToRemove.add(node.id)
          hasChanged = true
        }
      })
    }

    if (nodesToRemove.size > 0) {
      group.nodes = group.nodes.filter(n => !nodesToRemove.has(n.id))
    }
  }

  /**
   * 检查产物是否已在任何组中规划（忽略锁定的节点）
   */
  function isWareInAnyGroup(wareId: string) {
    return groups.value.some(g => g.nodes.some(n => n.wareId === wareId && !n.isIsolated))
  }

  /**
   * 重新排序组内节点
   */
  function reorderNodes(groupId: string, colIndex: number, newNodes: FlowNode[]) {
    const group = groups.value.find(g => g.id === groupId)
    if (!group) return

    // 1. 获取不属于该列的所有节点
    const otherNodes = group.nodes.filter(n => n.column !== colIndex)
    
    // 2. 将新排序的节点与其它节点合并
    group.nodes = [...otherNodes, ...newNodes]
  }

  /**
   * 清空所有产线组
   */
  function clearAllGroups() {
    groups.value = []
    activeGroupId.value = null
  }

  /**
   * 连接并扩展上游
   */
  function connectAndExpand(groupId: string, wareId: string, lineage?: string) {
    const group = groups.value.find(g => g.id === groupId)
    if (!group) return

    const isolatedNode = group.nodes.find(n => n.wareId === wareId && n.isIsolated)
    if (isolatedNode) {
      // 打破隔离状态
      isolatedNode.isIsolated = false
      isolatedNode.source = 'manual'
      isolatedNode.isRoot = true
      
      // 更新 moduleId 为正确的模块
      const effectiveLineage = lineage || group.subCategory
      const module = gameData.findModuleForWare(wareId, effectiveLineage)
      if (module) {
        isolatedNode.moduleId = module.id
        isolatedNode.race = module.race
        isolatedNode.lineage = effectiveLineage
        
        // 直接扩展上游（绕过 expandUpstream 的 moduleId 检查）
        if (module.inputs) {
          Object.keys(module.inputs).forEach(inputWareId => {
            expandUpstream(groupId, inputWareId, 'auto', effectiveLineage)
          })
        }
      }
    }
  }

  /**
   * 将自动生成的节点提升为手动节点 (Promote)
   */
  function promoteNode(groupId: string, nodeId: string) {
    const group = groups.value.find(g => g.id === groupId)
    if (!group) return

    const node = group.nodes.find(n => n.id === nodeId)
    if (node && node.source === 'auto') {
      node.source = 'manual'
      node.isAuto = false
      updateGroupName(group)
    }
  }

  /**
   * 替换节点为指定血统的模块（用于不同血统的同种产品替换）
   */
  function replaceNodeWithLineage(groupId: string, wareId: string, newLineage: string) {
    const group = groups.value.find(g => g.id === groupId)
    if (!group) return

    const node = group.nodes.find(n => n.wareId === wareId)
    if (!node) return

    const newModule = gameData.findModuleForWare(wareId, newLineage)
    if (!newModule) return

    // 更新节点信息
    node.moduleId = newModule.id
    node.lineage = newLineage
    node.race = newModule.race
    node.source = 'manual'
    node.isAuto = false
    node.isRoot = true

    // 清理旧的上游
    cleanupUnusedAutoNodes(groupId)

    // 扩展新的上游
    if (newModule.inputs) {
      Object.keys(newModule.inputs).forEach(inputWareId => {
        expandUpstream(groupId, inputWareId, 'auto', newLineage)
      })
    }

    updateGroupName(group)
  }

  /**
   * 切换组锁定状态
   */
  function toggleGroupLock(groupId: string) {
    const group = groups.value.find(g => g.id === groupId)
    if (!group) return

    // 检查是否允许切换：所有手动节点必须具有相同的血统
    const manualNodes = group.nodes.filter(n => n.source === 'manual')
    const lineages = new Set(manualNodes.map(n => n.lineage))
    
    if (lineages.size > 1) {
      // 如果有多个血统，不允许锁定（或者根据需求，这里可以抛出警告）
      console.warn(`[LogicFlowStore] Cannot lock group with multiple lineages: ${Array.from(lineages)}`)
      return
    }

    group.isLocked = !group.isLocked
    if (group.isLocked && lineages.size === 1) {
      const lineage = Array.from(lineages)[0]
      if (lineage) {
        group.lockedLineage = lineage
      }
    }
  }

  /**
   * 获取产物在指定组中的状态
   * 状态优先级：rejected > duplicated > isolated > auto > available
   */
  function getWareGroupStatus(groupId: string, wareId: string, lineage: string) {
    const group = groups.value.find(g => g.id === groupId)
    if (!group) return 'available'

    // 0. T0 资源始终可用
    const ware = gameData.waresMap[wareId]
    if (ware && (ware.tier === 0 || wareId === 'energycells')) {
      return 'available'
    }

    // 1. 检查锁定冲突与血统兼容性（仅对锁定的规划区）
    if (group.isLocked) {
      const backtraceSet = group.category === 'industrial' 
        ? gameData.wareSetsByIndustrialRace[group.lockedLineage]
        : gameData.wareSetsByRace[group.lockedLineage]
      
      if (!backtraceSet?.has(wareId)) {
        return 'rejected'
      }
    }

    // 2. 查找组内是否存在相同 wareId 的节点
    const existingNode = group.nodes.find(n => n.wareId === wareId)
    const effectiveLineage = group.isLocked ? group.lockedLineage : lineage
    
    if (existingNode) {
      // 2.1 检查是否为隔离节点
      // 用户主动拖拽表示要打破隔离状态，将隔离节点转化为新模块
      if (existingNode.isIsolated) {
        return 'isolated'
      }
      
      // 2.2 检查新模块是否与现有节点的模块相同
      const newModule = gameData.findModuleForWare(wareId, effectiveLineage)
      
      // 2.3 如果模块相同，根据节点类型返回状态
      if (newModule && existingNode.moduleId === newModule.id) {
        if (existingNode.source === 'auto') {
          return 'auto' // 可以转正
        }
        return 'duplicated' // 真正的重复
      }
      
      // 2.4 模块不同（不同血统的同种产品）
      if (existingNode.source === 'auto') {
        return 'replace' // 可以替换为不同血统
      }
      // Manual 节点已存在不同血统，允许添加新节点
    }

    // 3. 检查重复（基于 moduleId，用于不同 wareId 但相同 module 的情况）
    const module = gameData.findModuleForWare(wareId, lineage)
    if (module && group.nodes.some(n => n.moduleId === module.id)) {
      return 'duplicated'
    }

    return 'available'
  }

  /**
   * 更新产线组名称
   */
  function updateGroupCustomName(groupId: string, name: string) {
    const group = groups.value.find(g => g.id === groupId)
    if (group) {
      group.name = name
    }
  }

  // --- Plan Management Methods ---

  /**
   * 脏检查：当前状态与上次保存的快照是否一致
   */
  const isDirty = computed(() => {
    const current = JSON.stringify({ groups: groups.value, settings: settings.value })
    return current !== lastSavedSnapshot.value
  })

  /**
   * 将 FlowNode 转换为 SavedFlowNode（仅保存 manual 和 isolated 节点）
   */
  function toSavedFlowNode(node: FlowNode): SavedFlowNode | null {
    if (node.source === 'auto' && !node.isIsolated) return null
    return {
      id: node.id,
      wareId: node.wareId,
      moduleId: node.moduleId,
      race: node.race,
      lineage: node.lineage,
      column: node.column,
      isIsolated: node.isIsolated,
      source: 'manual',
      isRoot: node.isRoot,
      order: node.order
    }
  }

  /**
   * 将 ProductionLineGroup 转换为 SavedFlowGroup
   */
  function toSavedFlowGroup(group: ProductionLineGroup): SavedFlowGroup {
    return {
      id: group.id,
      name: group.name,
      category: group.category,
      subCategory: group.subCategory,
      isLocked: group.isLocked,
      lockedLineage: group.lockedLineage,
      nodes: group.nodes
        .map(toSavedFlowNode)
        .filter((n): n is SavedFlowNode => n !== null)
    }
  }

  /**
   * 保存当前方案
   */
  function saveCurrentPlan(name?: string): boolean {
    if (groups.value.length === 0) return false

    const planName = name || currentPlanName.value
    if (!planName.trim()) return false

    const plan: LogicFlowPlan = {
      id: savedPlans.value.activeId || crypto.randomUUID(),
      name: planName,
      groups: groups.value.map(toSavedFlowGroup),
      settings: { ...settings.value },
      lastUpdated: Date.now()
    }

    if (savedPlans.value.activeId) {
      const idx = savedPlans.value.list.findIndex(p => p.id === savedPlans.value.activeId)
      if (idx !== -1) {
        savedPlans.value.list[idx] = plan
      } else {
        savedPlans.value.list.push(plan)
        savedPlans.value.activeId = plan.id
      }
    } else {
      savedPlans.value.list.push(plan)
      savedPlans.value.activeId = plan.id
    }

    currentPlanName.value = planName
    lastSavedSnapshot.value = JSON.stringify({ groups: groups.value, settings: settings.value })
    savePlansToStorage()
    return true
  }

  /**
   * 加载指定方案
   */
  function loadPlan(index: number) {
    const plan = savedPlans.value.list[index]
    if (!plan) return
    applyPlan(plan)
  }

  /**
   * 应用方案数据（含 auto 节点重建）
   */
  function applyPlan(plan: LogicFlowPlan) {
    groups.value = []
    activeGroupId.value = null
    currentPlanName.value = plan.name
    savedPlans.value.activeId = plan.id
    settings.value = { ...plan.settings }
    isDefaultLocked.value = plan.settings.isDefaultLocked

    for (const savedGroup of plan.groups) {
      const newGroup: ProductionLineGroup = {
        id: savedGroup.id,
        name: savedGroup.name,
        category: savedGroup.category,
        subCategory: savedGroup.subCategory,
        isLocked: savedGroup.isLocked,
        lockedLineage: savedGroup.lockedLineage,
        nodes: []
      }
      groups.value.push(newGroup)

      // 第一轮：先添加所有 isolated 节点，确保 expandUpstream 能检测到它们
      for (const savedNode of savedGroup.nodes) {
        if (savedNode.isIsolated) {
          const isolatedNode: FlowNode = {
            ...savedNode,
            isAuto: false,
            isPreview: false
          }
          newGroup.nodes.push(isolatedNode)
        }
      }

      // 第二轮：添加 manual 节点并扩展上游
      for (const savedNode of savedGroup.nodes) {
        if (!savedNode.isIsolated) {
          const manualNode: FlowNode = {
            ...savedNode,
            isAuto: false,
            isPreview: false
          }
          newGroup.nodes.push(manualNode)
          if (manualNode.moduleId) {
            const module = gameData.modulesMap[manualNode.moduleId]
            if (module?.inputs) {
              Object.keys(module.inputs).forEach(inputWareId => {
                expandUpstream(newGroup.id, inputWareId, 'auto', manualNode.lineage)
              })
            }
          }
        }
      }

      if (newGroup.nodes.length > 0) {
        activeGroupId.value = newGroup.id
      }
    }

    lastSavedSnapshot.value = JSON.stringify({ groups: groups.value, settings: settings.value })
  }

  /**
   * 删除指定方案
   */
  function deletePlan(index: number) {
    const plan = savedPlans.value.list[index]
    if (!plan) return

    savedPlans.value.list.splice(index, 1)

    if (savedPlans.value.activeId === plan.id) {
      savedPlans.value.activeId = null
      currentPlanName.value = ''
    }

    savePlansToStorage()
  }

  /**
   * 清空当前工作区
   */
  function clearAll() {
    groups.value = []
    activeGroupId.value = null
    currentPlanName.value = ''
    savedPlans.value.activeId = null
    settings.value = { isDefaultLocked: true }
    isDefaultLocked.value = true
    lastSavedSnapshot.value = ''
  }

  // --- Plan Persistence ---

  function loadPlansFromStorage() {
    const stored = localStorage.getItem('x4_logic_flow_plans')
    if (stored) {
      try {
        const data = JSON.parse(stored)
        savedPlans.value = data
      } catch (e) {
        console.error('[LogicFlowStore] Failed to load plans:', e)
      }
    }
  }

  function savePlansToStorage() {
    localStorage.setItem('x4_logic_flow_plans', JSON.stringify(savedPlans.value))
  }

  return {
    groups,
    activeGroupId,
    isDragging,
    draggingWareId,
    draggingLineage,
    hoveredGroupId,
    hoveredNodeId,
    isHoveringNewZone,
    isDefaultLocked,
    previewNodes,
    setHoveredNode,
    highlightedNodeIds,
    highlightedConnectionIds,
    startDragging,
    stopDragging,
    handleHover,
    handleMoveOut,
    handleDrop,
    getNodesWithPreview,
    init,
    addGroup,
    removeGroup,
    moveGroupUp,
    moveGroupDown,
    clearAllGroups,
    toggleNodeIsolation,
    toggleGroupLock,
    removeNode,
    expandUpstream,
    connectAndExpand,
    isWareInAnyGroup,
    reorderNodes,
    calculateRequiredT0Wares,
    getGroupT0Resources,
    getSortedGroupT0Resources,
    isNodeDepended,
    downgradeNode,
    convertToIsolatedAuto,
    promoteNode,
    replaceNodeWithLineage,
    getWareGroupStatus,
    cleanupUnusedAutoNodes,
    updateGroupCustomName,
    // Plan Management
    currentPlanName,
    savedPlans,
    lastSavedSnapshot,
    settings,
    isDirty,
    saveCurrentPlan,
    loadPlan,
    applyPlan,
    deletePlan,
    clearAll,
  }
})

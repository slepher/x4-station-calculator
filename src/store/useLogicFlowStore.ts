import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { useGameDataStore } from './useGameDataStore'
import type { FlowNode, ProductionLineGroup } from '@/types/x4'

export const useLogicFlowStore = defineStore('logicFlow', () => {
  const gameData = useGameDataStore()
  
  // --- State ---
  const groups = ref<ProductionLineGroup[]>([])
  const activeGroupId = ref<string | null>(null)
  const isDragging = ref(false)
  const draggingWareId = ref<string | null>(null)
  const hoveredGroupId = ref<string | null>(null)
  const isHoveringNewZone = ref(false)

  // 同步到 state 以便持久化（可选，但目前主要用于测试注入）
  const startDragging = (wareId: string) => {
    isDragging.value = true
    draggingWareId.value = wareId
  }

  const stopDragging = () => {
    isDragging.value = false
    draggingWareId.value = null
    hoveredGroupId.value = null
    isHoveringNewZone.value = false
  }

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
    
    // 1. 计算现有 manual 节点的 T0 需求
    group.nodes.filter(n => n.source === 'manual').forEach(node => {
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

  // --- Persistence ---
  const loadFromStorage = () => {
    const stored = localStorage.getItem('x4_logic_flow_data')
    if (stored) {
      try {
        const data = JSON.parse(stored)
        const loadedGroups = data.groups || []
        
        // 数据迁移：将旧的 method 字段转换为 race
        loadedGroups.forEach((g: any) => {
          g.nodes?.forEach((n: any) => {
            if (n.method && !n.race) {
              n.race = n.method
              delete n.method
            }
          })
        })

        groups.value = loadedGroups
        activeGroupId.value = data.activeGroupId || null
      } catch (e) {
        console.error('[LogicFlowStore] Failed to load data:', e)
      }
    }
  }

  const saveToStorage = () => {
    localStorage.setItem('x4_logic_flow_data', JSON.stringify({
      groups: groups.value,
      activeGroupId: activeGroupId.value
    }))
  }

  watch(groups, saveToStorage, { deep: true })
  watch(activeGroupId, saveToStorage)

  /**
   * 初始化
   */
  function init() {
    loadFromStorage()
    if (!gameData.isReady) {
      gameData.initialize()
    }
  }

  /**
   * 添加产线组
   */
  function addGroup(category: 'industrial' | 'agricultural', subCategory: string, name?: string, isLocked: boolean = false) {
    const id = crypto.randomUUID()
    
    // 如果没有提供名称，暂时使用默认占位符，由 expandUpstream 或 UI 在添加首个 manual 节点时更新
    const defaultName = name || `${category === 'industrial' ? '工业' : '农业'} - ${subCategory}`
    
    const newGroup: ProductionLineGroup = {
      id,
      name: defaultName,
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
   * 切换节点隔离状态 (原 Lock/Unlock)
   */
  function toggleNodeIsolation(groupId: string, nodeId: string) {
    const group = groups.value.find(g => g.id === groupId)
    if (!group) return

    const node = group.nodes.find(n => n.id === nodeId)
    if (!node) return

    node.isLocked = !node.isLocked

    if (!node.isLocked) {
      // 如果切换到连接状态 (Connect)，尝试展开上游
      if (node.moduleId) {
        const module = gameData.modulesMap[node.moduleId]
        if (module?.inputs) {
          Object.keys(module.inputs).forEach(inputWareId => {
            expandUpstream(groupId, inputWareId, 'auto', node.lineage)
          })
        }
      }
    } else {
      // 如果切换到隔离状态 (Isolate)，清理不再被需要的上游
      cleanupUnusedAutoNodes(groupId)
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
      if (!n.moduleId || n.isLocked) return false
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
   * 将节点转换为锁定状态的 auto 节点
   */
  function convertToLockedAuto(groupId: string, nodeId: string) {
    const group = groups.value.find(g => g.id === groupId)
    if (group) {
      const node = group.nodes.find(n => n.id === nodeId)
      if (node) {
        node.source = 'auto'
        node.isLocked = true
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

    const ware = gameData.waresMap[wareId]
    if (!ware) return

    // 0. T0 资源特殊处理：强制合并且无血统
    const isT0 = ware.tier === 0 || wareId === 'energycells'
    if (isT0) {
      const existingT0Node = group.nodes.find(n => n.wareId === wareId)
      if (!existingT0Node) {
        const t0Node: FlowNode = {
          id: crypto.randomUUID(),
          wareId,
          race: 'default',
          lineage: 'default',
          isLocked: false,
          isAuto: true,
          isRoot: false,
          source: 'auto',
          column: ware.tier,
          order: 0
        }
        // T0 总是插入到对应的 Tier 列
        insertNodeSorted(group, t0Node)
      }
      return
    }

    // 1. 物理主键检查：moduleId 唯一性 (对于非 T0 资源)
    // 首先根据 lineage 确定模块
    const effectiveLineage = overrideLineage || (group.isLocked ? group.lockedLineage : group.subCategory)
    const module = gameData.findModuleForWare(wareId, effectiveLineage)
    
    if (!module) {
      console.warn(`[LogicFlowStore] No module found for ware ${wareId} under lineage ${effectiveLineage}`)
      return
    }

    const existingNode = group.nodes.find(n => n.moduleId === module.id)
    if (existingNode) {
      // 如果已存在物理模块，则仅处理升级逻辑
      if (existingNode.source === 'auto' && source === 'manual') {
        existingNode.source = 'manual'
        existingNode.isAuto = false
        existingNode.isRoot = true
      }
      return
    }

    // 2. 创建新节点
    const node: FlowNode = {
      id: crypto.randomUUID(),
      wareId,
      moduleId: module.id,
      race: module.race,
      lineage: effectiveLineage,
      isLocked: false,
      isAuto: source === 'auto',
      isRoot: source === 'manual',
      source: source,
      column: ware.tier,
      order: 0
    }

    insertNodeSorted(group, node)

    // 3. 更新组名称
    if (source === 'manual') {
      updateGroupName(group)
    }

    // 4. 递归回溯：使用当前节点的 lineage
    if (module.inputs) {
      Object.keys(module.inputs).forEach(inputWareId => {
        expandUpstream(groupId, inputWareId, 'auto', node.lineage)
      })
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
      if (existing.column >= targetTier) {
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
          if (otherNode.isLocked) return false

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
    return groups.value.some(g => g.nodes.some(n => n.wareId === wareId && !n.isLocked))
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
   * 解锁并扩展上游
   */
  function unlockAndExpand(groupId: string, wareId: string) {
    const group = groups.value.find(g => g.id === groupId)
    if (!group) return

    const node = group.nodes.find(n => n.wareId === wareId)
    if (node && node.isLocked) {
      node.isLocked = false
      expandUpstream(groupId, wareId, 'manual')
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
      group.lockedLineage = Array.from(lineages)[0]
    }
  }

  /**
   * 获取产物在指定组中的状态
   */
  function getWareGroupStatus(groupId: string, wareId: string, lineage: string) {
    const group = groups.value.find(g => g.id === groupId)
    if (!group) return 'available'

    // 0. T0 资源始终可用
    const ware = gameData.waresMap[wareId]
    if (ware && (ware.tier === 0 || wareId === 'energycells')) {
      return 'available'
    }

    // 1. 检查锁定冲突
    if (group.isLocked) {
      // 检查该 wareId 是否属于 group.lockedLineage 的回溯集
      const backtraceSet = group.category === 'industrial' 
        ? gameData.wareSetsByIndustrialRace[group.lockedLineage]
        : gameData.wareSetsByRace[group.lockedLineage]
      
      if (!backtraceSet?.has(wareId)) {
        return 'rejected'
      }

      // 如果属于该血统，但当前拖拽/选择的 lineage 与之不同，标记为需要重映射
      if (group.lockedLineage !== lineage) {
        return 'available' // 仍然可用，但 expandUpstream 会执行重映射
      }
    }

    // 2. 检查重复 (基于 moduleId)
    const module = gameData.findModuleForWare(wareId, lineage)
    if (module && group.nodes.some(n => n.moduleId === module.id)) {
      return 'duplicated'
    }

    return 'available'
  }

  return {
    groups,
    activeGroupId,
    isDragging,
    draggingWareId,
    hoveredGroupId,
    isHoveringNewZone,
    startDragging,
    stopDragging,
    init,
    addGroup,
    removeGroup,
    clearAllGroups,
    toggleNodeIsolation,
    toggleGroupLock,
    removeNode,
    expandUpstream,
    unlockAndExpand,
    isWareInAnyGroup,
    reorderNodes,
    calculateRequiredT0Wares,
    getGroupT0Resources,
    getSortedGroupT0Resources,
    isNodeDepended,
    downgradeNode,
    convertToLockedAuto,
    promoteNode,
    getWareGroupStatus,
    cleanupUnusedAutoNodes,
  }
})

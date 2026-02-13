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
  function addGroup(category: 'industrial' | 'agricultural', subCategory: string, name?: string) {
    const id = crypto.randomUUID()
    
    // 如果没有提供名称，暂时使用默认占位符，由 expandUpstream 或 UI 在添加首个 manual 节点时更新
    const defaultName = name || `${category === 'industrial' ? '工业' : '农业'} - ${subCategory}`
    
    const newGroup: ProductionLineGroup = {
      id,
      name: defaultName,
      category,
      subCategory,
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
   * 切换锁定状态
   */
  function toggleLock(groupId: string, nodeId: string) {
    const group = groups.value.find(g => g.id === groupId)
    if (group) {
      const node = group.nodes.find(n => n.id === nodeId)
      if (node) {
        node.isLocked = !node.isLocked
        // 锁定后强制切换为产物模式（即清除 moduleId），并在 expandUpstream 中处理递归停止
        if (node.isLocked) {
          node.moduleId = undefined
          // 级联清理：移除所有因为该节点锁定而失去引用链的 auto 节点
          cleanupUnusedAutoNodes(groupId)
        } else {
          // 解锁时尝试重新匹配模块并重新递归
          const ware = gameData.waresMap[node.wareId]
          if (ware) {
            const isBasic = ware.tier === 0 || node.wareId === 'energycells'
            if (!isBasic) {
              const preferredRace = group.category === 'industrial' ? group.subCategory : 'default'
              const fallbackRace = group.category === 'agricultural' ? group.subCategory : 'argon'
              const module = gameData.findModuleForWare(node.wareId, preferredRace, fallbackRace)
              if (module) {
                node.moduleId = module.id
                node.race = module.race
                // 重新递归扩展
                Object.keys(module.inputs).forEach(inputWareId => {
                  expandUpstream(groupId, inputWareId, 'auto')
                })
              }
            }
          }
        }
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
        const isStillNeeded = group.nodes.some(n => {
          if (n.id === nodeId || !n.moduleId) return false
          const m = gameData.modulesMap[n.moduleId]
          return m && m.inputs[targetNode.wareId]
        })

        if (isStillNeeded) {
          // 降级为 auto
          targetNode.source = 'auto'
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
    overrideRace?: string
  ) {
    const group = groups.value.find(g => g.id === groupId)
    if (!group) return

    const ware = gameData.waresMap[wareId]
    if (!ware) return

    // 1. 检查是否已存在该产物的节点
    const existingNode = group.nodes.find(n => n.wareId === wareId)
    if (existingNode) {
      // 如果已存在且是 auto 节点，而此次是 manual 请求，则升级为 manual
      if (existingNode.source === 'auto' && source === 'manual') {
        // 禁止重复投放逻辑：如果已经是 manual 了，其实不应该再进来，
        // 但为了健壮性，这里仅在从 auto 升级时处理
        existingNode.source = 'manual'
      }
      
      // 2. 如果当前节点因为锁定等原因没有模块 ID，且此次请求需要生产模块，尝试重新匹配
      const isBasic = ware.tier === 0 || wareId === 'energycells'
      if (!isBasic && !existingNode.moduleId) {
        const preferredRace = overrideRace || (group.category === 'industrial' ? group.subCategory : 'default')
        const fallbackRace = overrideRace || (group.category === 'agricultural' ? group.subCategory : 'argon')
        const module = gameData.findModuleForWare(wareId, preferredRace, fallbackRace)
        
        if (module) {
          existingNode.moduleId = module.id
          existingNode.race = module.race
          existingNode.isLocked = false // 强制解锁以展开
          
          // 继续递归
          Object.keys(module.inputs).forEach(inputWareId => {
            expandUpstream(groupId, inputWareId, 'auto', overrideRace)
          })
        }
      }
      return
    }

    // --- 智能插入排序逻辑 ---
    // 识别模块
    const isBasic = ware.tier === 0 || wareId === 'energycells'
    let module = null
    let race = 'default'

    if (!isBasic) {
      // 优先级：参数传入 > 组定义
      const preferredRace = overrideRace || (group.category === 'industrial' ? group.subCategory : 'default')
      const fallbackRace = overrideRace || (group.category === 'agricultural' ? group.subCategory : 'argon')
      
      // 使用 gameData.findModuleForWare
      module = gameData.findModuleForWare(wareId, preferredRace, fallbackRace)

      if (module) {
        race = module.race
      } else {
        // 如果不是基础资源且找不到生产模块，说明该环境下无法生产，不添加节点
        console.warn(`[LogicFlowStore] No module found for ware ${wareId} under race ${preferredRace}`)
        return
      }
    } else {
      // 基础资源，虽然没有 module，但我们记录一下当前期望的 race 以便 UI 显示正确的图标
      race = overrideRace || (group.category === 'industrial' ? group.subCategory : 'default')
    }

    // 创建节点
    const node: FlowNode = {
      id: crypto.randomUUID(),
      wareId,
      moduleId: module?.id,
      race: race,
      isLocked: false,
      source: source,
      column: ware.tier,
      order: 0 // order 字段现在主要由数组索引决定
    }

    // 计算插入位置：高 Tier 在前，同 Tier 后置
    const targetTier = ware.tier
    let insertIndex = 0; // 默认为最前面（如果所有现有节点 Tier 都比它低）
    for (let i = group.nodes.length - 1; i >= 0; i--) {
      const existingNode = group.nodes[i];
      if (existingNode && existingNode.column >= targetTier) {
        insertIndex = i + 1;
        break;
      }
    }
    group.nodes.splice(insertIndex, 0, node)

    // 4. 更新产线组名称 (如果是 manual 添加且该产物是该组最高 tier 产物之一)
    if (source === 'manual') {
      const maxTierInGroup = Math.max(...group.nodes.map(n => n.column))
      const highestTierManualNode = group.nodes
        .filter(n => n.source === 'manual' && n.column === maxTierInGroup)
        .sort((a, b) => b.column - a.column)[0]
      
      if (highestTierManualNode) {
        const wareName = gameData.localizedWaresMap[highestTierManualNode.wareId]?.localeName || highestTierManualNode.wareId
        group.name = wareName
      }
    }

    // 递归上游 (仅当未锁定且有模块时)
    if (module && !node.isLocked) {
      Object.keys(module.inputs).forEach(inputWareId => {
        expandUpstream(groupId, inputWareId, 'auto', overrideRace)
      })
    }
  }

  /**
   * 级联清理未使用的 auto 节点
   */
  function cleanupUnusedAutoNodes(groupId: string) {
    const group = groups.value.find(g => g.id === groupId)
    if (!group) return

    let changed = true
    while (changed) {
      changed = false
      // 找出所有不再被依赖的 auto 节点
      const nodesToRemove: string[] = []
      
      group.nodes.forEach(node => {
        if (node.source === 'manual') return

        // 检查是否有其他节点依赖于它
        const isNeeded = group.nodes.some(n => {
          if (n.id === node.id || n.isLocked || !n.moduleId) return false
          const m = gameData.modulesMap[n.moduleId]
          return m && m.inputs[node.wareId]
        })

        if (!isNeeded) {
          nodesToRemove.push(node.id)
        }
      })

      if (nodesToRemove.length > 0) {
        group.nodes = group.nodes.filter(n => !nodesToRemove.includes(n.id))
        changed = true
      }
    }
  }

  /**
   * 检查产物是否已在任何组中规划
   */
  function isWareInAnyGroup(wareId: string) {
    return groups.value.some(g => g.nodes.some(n => n.wareId === wareId))
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

  return {
    groups,
    activeGroupId,
    isDragging,
    draggingWareId,
    hoveredGroupId,
    init,
    addGroup,
    removeGroup,
    clearAllGroups,
    toggleLock,
    removeNode,
    expandUpstream,
    isWareInAnyGroup,
    reorderNodes,
  }
})

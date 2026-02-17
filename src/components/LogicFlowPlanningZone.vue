<script setup lang="ts">
import { ref, watch } from 'vue'
import draggable from 'vuedraggable'
import { useI18n } from 'vue-i18n'
import { useLogicFlowStore } from '@/store/useLogicFlowStore'
import { useGameDataStore } from '@/store/useGameDataStore'
import ProductionLineGroupComponent from './ProductionLineGroup.vue'
import type { ProductionLineGroup, FlowNode } from '@/types/x4'

const { t } = useI18n()
const logicFlow = useLogicFlowStore()
const gameData = useGameDataStore()

const dragEnterCounter = ref<Record<string, number>>({})
const newZoneEnterCounter = ref(0)

const getAttribute = (element: any, attribute: string) => {
  if (element && typeof element.getAttribute === 'function') {
    return element.getAttribute(attribute)
  }
  if (element?.el && typeof element.el.getAttribute === 'function') {
    return element.el.getAttribute(attribute)
  }
  return null
}

/**
 * 获取有效的血统（考虑锁定组）
 */
const getEffectiveLineage = (group: ProductionLineGroup, event?: any): string => {
  const fromSubCategory = event ? getAttribute(event?.from, 'data-subcategory') : null
  const draggingLineage = logicFlow.draggingLineage || fromSubCategory || 'default'
  return group.isLocked ? group.lockedLineage! : draggingLineage
}

/**
 * 获取拖拽状态（统一入口）
 */
const getDropStatus = (group: ProductionLineGroup, event?: any): string => {
  const wareId = logicFlow.draggingWareId || (event?.item?._underlying_vm_?.id)
  if (!wareId) return 'available'
  
  // T0 资源不可被拖入规划区
  const ware = gameData.waresMap[wareId]
  if (ware && ware.tier === 0) return 'rejected'
  
  const effectiveLineage = getEffectiveLineage(group, event)
  return logicFlow.getWareGroupStatus(group.id, wareId, effectiveLineage)
}

/**
 * 判断是否允许 drop
 */
const isDropAllowedForStatus = (status: string): boolean => {
  return status !== 'rejected' && status !== 'duplicated'
}

/**
 * 格式化资源数据以便循环显示
 * 原则：使用与 ProductionLineGroup 相同的数据源（group.nodes 中的 T0 节点）
 * 注意：紧凑模式排除能量电池
 */
const getFormattedResources = (group: ProductionLineGroup, includeDragging: boolean) => {
  // 1. 获取实际存储的 T0 节点（column === 0，排除能量电池和隔离节点）
  const existingT0Nodes = group.nodes
    .filter((n: FlowNode) => n.column === 0 && n.wareId !== 'energycells' && !n.isIsolated)
  
  const existingT0Ids = new Set(existingT0Nodes.map(n => n.wareId))
  
  // 2. 获取组内所有非隔离节点的 wareId（用于排除中间层级的供应）
  const existingNonIsolatedWareIds = new Set(
    group.nodes
      .filter((n: FlowNode) => !n.isIsolated)
      .map((n: FlowNode) => n.wareId)
  )
  
  // 3. 获取组内所有隔离节点的 wareId（用于停止递归追踪）
  const isolatedWareIds = new Set(
    group.nodes
      .filter((n: FlowNode) => n.isIsolated)
      .map((n: FlowNode) => n.wareId)
  )
  
  // 4. 如果正在拖拽，计算新增的 T0 资源（排除能量电池）
  const newIds: string[] = []
  if (includeDragging && logicFlow.draggingWareId) {
    // 【修复】先检查拖拽是否被拒绝或重复，如果是则不显示预览
    const dropStatus = getDropStatus(group)
    if (dropStatus !== 'rejected' && dropStatus !== 'duplicated') {
      const draggingWare = gameData.waresMap[logicFlow.draggingWareId]
      if (draggingWare && draggingWare.tier > 0) {
        const lineage = getEffectiveLineage(group)
        
        // 自定义递归追踪：遇到隔离节点时停止
        const traceT0 = (wareId: string, visited: Set<string>): string[] => {
          if (wareId === 'energycells') return []
          
          const ware = gameData.waresMap[wareId]
          if (!ware) return []
          
          // T0 资源直接返回
          if (ware.tier === 0) return [wareId]
          
          // 防止循环
          if (visited.has(wareId)) return []
          visited.add(wareId)
          
          // 遇到隔离节点，停止追踪（隔离节点不参与供应链）
          if (isolatedWareIds.has(wareId)) return []
          
          // 递归追踪上游
          const module = gameData.findModuleForWare(wareId, lineage)
          if (!module || !module.inputs) return []
          
          const result: string[] = []
          Object.keys(module.inputs).forEach(inputId => {
            result.push(...traceT0(inputId, visited))
          })
          
          return result
        }
        
        const requiredT0 = traceT0(logicFlow.draggingWareId, new Set())
        const uniqueT0 = [...new Set(requiredT0)]
        
        uniqueT0.forEach(wareId => {
          // 排除能量电池、已存在的 T0 资源、以及组内已有非隔离节点供应的资源
          if (wareId !== 'energycells' && !existingT0Ids.has(wareId) && !existingNonIsolatedWareIds.has(wareId)) {
            newIds.push(wareId)
          }
        })
      }
    }
  }
  
  // 5. 合并结果
  const result = [
    ...existingT0Nodes.map(n => ({ wareId: n.wareId, isNew: false })),
    ...newIds.map(wareId => ({ wareId, isNew: true }))
  ]
  
  return result
}

/**
 * 获取 New Line 预览的排序后资源
 * 注意：排除能量电池
 */
const getNewLineResources = () => {
  if (!logicFlow.draggingWareId) return []
  const ware = gameData.waresMap[logicFlow.draggingWareId]
  if (!ware) return []
  
  // 计算拖拽产物的 T0 需求（排除能量电池）
  const lineage = logicFlow.draggingLineage || 'default'
  const requiredT0 = logicFlow.calculateRequiredT0Wares(logicFlow.draggingWareId, lineage)
  
  return Object.keys(requiredT0).filter(wareId => wareId !== 'energycells')
}

/**
 * 获取新产线预览的模块名称
 */
const getNewLineModuleName = (): string => {
  if (!logicFlow.draggingWareId) return ''
  
  const ware = gameData.waresMap[logicFlow.draggingWareId]
  if (!ware || ware.tier === 0) {
    return gameData.getWareDisplayName(logicFlow.draggingWareId)
  }
  
  const lineage = logicFlow.draggingLineage || 'default'
  const module = gameData.findModuleForWare(logicFlow.draggingWareId, lineage)
  
  if (module) {
    return gameData.getModuleDisplayName(module.id) || gameData.getWareDisplayName(logicFlow.draggingWareId)
  }
  
  return gameData.getWareDisplayName(logicFlow.draggingWareId)
}

/**
 * 获取紧凑版节点显示名称
 */
const getCompactNodeDisplayName = (node: any, group: any): string => {
  // T0 资源显示产品名称
  const ware = gameData.waresMap[node.wareId]
  if (ware?.tier === 0) {
    return gameData.getWareDisplayName(node.wareId)
  }
  
  // 非预览节点：直接从 group.nodes 查找 moduleId
  if (!node.isPreview) {
    const storeNode = group.nodes.find((n: any) => n.wareId === node.wareId)
    if (storeNode?.moduleId) {
      return gameData.getModuleDisplayName(storeNode.moduleId) || gameData.getWareDisplayName(node.wareId)
    }
  }
  
  // 预览节点：根据 wareId + 血统查找模块
  if (node.isPreview) {
    const lineage = getEffectiveLineage(group)
    const module = gameData.findModuleForWare(node.wareId, lineage)
    if (module) {
      return gameData.getModuleDisplayName(module.id) || gameData.getWareDisplayName(node.wareId)
    }
  }
  
  // 最终回退：显示产品名称
  return gameData.getWareDisplayName(node.wareId)
}

/**
 * 获取紧凑模式产线组标题
 * 如果 name 为空，则动态计算默认名称（最高 tier 的 manual 产线名称）
 */
const getCompactGroupTitle = (group: ProductionLineGroup): { title: string; t0Resources: string[] } => {
  // 获取 T0 资源（排除能量电池和隔离节点）
  const t0Nodes = group.nodes.filter(n => n.column === 0 && n.wareId !== 'energycells' && !n.isIsolated)
  const t0Resources = t0Nodes.map(n => gameData.getWareDisplayName(n.wareId))
  
  // 如果有用户自定义名称，直接返回
  if (group.name) {
    return { title: group.name, t0Resources }
  }
  
  // 动态计算默认名称：Find highest tier manual nodes
  let maxTier = -1
  group.nodes.forEach(n => {
    if (n.source === 'manual' && n.column > maxTier) {
      maxTier = n.column
    }
  })

  if (maxTier === -1) {
    return { title: '空', t0Resources }
  }

  // Get manual nodes in the highest tier column
  const highestTierNodes = group.nodes
    .filter(n => n.source === 'manual' && n.column === maxTier)
    .sort((a, b) => {
      if (a.isIsolated && !b.isIsolated) return 1
      if (!a.isIsolated && b.isIsolated) return -1
      return a.order - b.order
    })

  const topNode = highestTierNodes[0]
  const title = topNode ? gameData.getWareDisplayName(topNode.wareId) : '空'
  
  return { title, t0Resources }
}

/**
 * Nodes for display, including a preview node if dragging over a group
 * 注意：紧凑模式模块区域只显示 manual 节点，T0 资源显示在标题旁边
 */
const nodesWithPreview = (group: any) => {
  const filteredNodes = group.nodes
    .filter((n: any) => n.source === 'manual' && !n.isIsolated)
  
  const nodes = filteredNodes.map((n: any) => ({ ...n, isPreview: false }))

  // 从 store 获取预览节点
  const previewNode = logicFlow.previewNodes.get(group.id)
  if (previewNode) {
    nodes.push(previewNode)
  }

  return nodes.sort((a: any, b: any) => b.column - a.column)
}

const handleAddToExistingGroup = (groupId: string, event: any) => {
  if (logicFlow.hoveredGroupId !== groupId) {
    return
  }
  
  const draggingWareId = logicFlow.draggingWareId || (event.item?._underlying_vm_?.id)
  
  if (draggingWareId) {
    const group = logicFlow.groups.find(g => g.id === groupId)
    if (group) {
      const effectiveLineage = getEffectiveLineage(group, event)
      logicFlow.handleDrop(groupId, effectiveLineage)
    }
  }
}

const isRejected = (group: ProductionLineGroup, event: any) => {
  return getDropStatus(group, event) === 'rejected'
}

const isDuplicated = (group: ProductionLineGroup, event: any) => {
  return getDropStatus(group, event) === 'duplicated'
}

const isDropAllowed = (group: ProductionLineGroup, event: any) => {
  return isDropAllowedForStatus(getDropStatus(group, event))
}

const getDragStatus = (group: ProductionLineGroup) => {
  if (!logicFlow.draggingWareId) return null
  return getDropStatus(group)
}

const dummyList = ref([])

const handleDragEnter = (groupId: string) => {
  if (!logicFlow.isDragging) return
  dragEnterCounter.value[groupId] = (dragEnterCounter.value[groupId] || 0) + 1
  if (dragEnterCounter.value[groupId] === 1) {
    logicFlow.handleHover(groupId)
  }
}

const handleDragLeave = (groupId: string) => {
  if (!logicFlow.isDragging) return
  dragEnterCounter.value[groupId] = Math.max(0, (dragEnterCounter.value[groupId] || 0) - 1)
  if (dragEnterCounter.value[groupId] === 0) {
    logicFlow.handleMoveOut(groupId)
  }
}

watch(() => logicFlow.isDragging, (newVal) => {
  if (!newVal) {
    dragEnterCounter.value = {}
    newZoneEnterCounter.value = 0
  }
})

const handleNewZoneDragEnter = () => {
  if (!logicFlow.isDragging) return
  newZoneEnterCounter.value++
  if (newZoneEnterCounter.value === 1) {
    logicFlow.handleHover('new')
  }
}

const handleNewZoneDragLeave = () => {
  if (!logicFlow.isDragging) return
  newZoneEnterCounter.value = Math.max(0, newZoneEnterCounter.value - 1)
  if (newZoneEnterCounter.value === 0) {
    logicFlow.handleMoveOut('new')
  }
}

const isDropAllowedForNewZone = () => {
  const wareId = logicFlow.draggingWareId
  if (!wareId) return true
  
  // T0 资源不可被拖入规划区
  const ware = gameData.waresMap[wareId]
  if (ware && ware.tier === 0) return false
  
  return true
}

const handleAddFromDrop = (event: any) => {
  const ware = event.item?._underlying_vm_
  const capturedLineage = logicFlow.draggingLineage
  const fromSubCategory = getAttribute(event.from, 'data-subcategory')
  
  if (!logicFlow.isHoveringNewZone) {
    return
  }
  
  if (ware && ware.id) {
    // T0 资源不可被添加
    const wareData = gameData.waresMap[ware.id]
    if (wareData && wareData.tier === 0) {
      return
    }
    
    const effectiveLineage = capturedLineage || fromSubCategory || 'default'
    logicFlow.handleDrop('new', effectiveLineage)
  }
  
  dummyList.value = []
}
</script>

<template>
  <div class="planning-zone mt-8 overflow-x-auto custom-scrollbar pb-8 pl-4 pr-8">
    <!-- Regular View -->
    <div 
      class="groups-list flex flex-col gap-8 min-w-[1000px]" 
      v-show="!logicFlow.isDragging"
    >
      <ProductionLineGroupComponent 
        v-for="group in logicFlow.groups" 
        :key="group.id"
        :group="group"
      />

      <!-- Add New Zone in Regular View (Always visible as footer) -->
      <draggable
        :list="[]"
        :group="{ name: 'wares', put: isDropAllowedForNewZone, pull: false }"
        :sort="false"
        item-key="id"
        @add="handleAddFromDrop"
        class="drop-target bg-white/[0.02] border-2 border-dashed border-white/10 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 hover:bg-blue-500/5 hover:border-blue-500/30 transition-all cursor-pointer group"
        @click="logicFlow.addGroup('industrial', 'default', undefined, logicFlow.isDefaultLocked)"
      >
        <template #item="{ element }">
          <div :key="element.id" class="hidden"></div>
        </template>
        <template #header>
          <div class="flex flex-col items-center gap-2 pointer-events-none">
            <div class="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
              <span class="text-xl text-white/40 group-hover:text-blue-400">+</span>
            </div>
            <div class="text-center">
              <div class="text-xs font-bold text-white/30 group-hover:text-blue-400/60 uppercase tracking-widest">
                {{ $t('logicFlow.dropToCreate') }}
              </div>
            </div>
          </div>
        </template>
      </draggable>
    </div>

    <!-- 2. Compact View (Active during dragging) -->
    <div v-show="logicFlow.isDragging" class="compact-view grid grid-cols-4 gap-6 py-12 min-h-full" data-testid="compact-view">
      <!-- Existing Groups as Drop Targets -->
      <draggable
        v-for="group in logicFlow.groups"
        :key="group.id"
        :list="[]"
        :group="{ 
          name: 'wares', 
          put: (_to: any, from: any, item: any) => {
            return isDropAllowed(group, { from, item });
          }, 
          pull: false 
        }"
        :sort="false"
        item-key="id"
        @add="(event: any) => handleAddToExistingGroup(group.id, event)"
        class="compact-group drop-target bg-white/5 border rounded-2xl p-4 flex flex-col gap-3 transition-all cursor-pointer min-h-[160px]"
        :class="[
          isRejected(group, null)
            ? 'border-red-600 bg-red-900/10'
            : (isDuplicated(group, null)
              ? 'border-red-500 bg-red-500/5'
              : (logicFlow.groups.find(g => g.id === group.id)?.isLocked 
                  ? 'border-amber-500/50 bg-amber-500/5' 
                  : (logicFlow.hoveredGroupId === group.id ? 'border-blue-500 bg-blue-500/10' : 'border-white/10')))
        ]"
        @dragenter="handleDragEnter(group.id)"
        @dragleave="handleDragLeave(group.id)"
      >
        <template #item="{ element }">
          <div :key="element.id" class="hidden"></div>
        </template>
        <template #header>
          <div class="flex flex-col gap-3 pointer-events-none h-full">
            <div class="flex items-center gap-2 border-b border-white/5 pb-2 min-w-0">
              <div 
                class="w-1 h-3 rounded-full flex-shrink-0"
                :class="group.category === 'industrial' ? 'bg-blue-500' : 'bg-emerald-500'"
              ></div>
              
              <!-- 标题 - 可缩略显示，为 T0 资源留出空间 -->
              <span class="text-[13px] font-black text-white truncate max-w-[40%]">{{ getCompactGroupTitle(group).title }}</span>
              
              <!-- T0 Resources Preview in Header - 优先完整显示 -->
              <div class="flex items-center gap-1 overflow-hidden flex-1 min-w-0">
                <div 
                  v-for="res in getFormattedResources(group, logicFlow.hoveredGroupId === group.id)" 
                  :key="res.wareId"
                  class="flex items-center gap-0.5 px-1 rounded bg-white/5 border border-white/5 transition-all duration-300 flex-shrink-0"
                  :class="{ 'border-blue-500 bg-blue-500/20 animate-pulse scale-110': res.isNew }"
                  :title="gameData.getWareDisplayName(res.wareId)"
                  :data-ware-id="res.wareId"
                >
                  <span class="text-[10px] font-bold text-white/80 leading-none whitespace-nowrap">{{ t('res.' + res.wareId) }}</span>
                </div>
              </div>

              <div v-if="isRejected(group, { from: null, item: null })" class="ml-auto text-[10px] text-red-500 font-bold uppercase tracking-widest flex items-center gap-1" data-testid="rejected-label">
                <span>🚫</span>
                <span>{{ t('logicFlow.rejected') }}</span>
              </div>
              <div v-else-if="isDuplicated(group, null)" class="ml-auto text-[10px] text-red-400 font-bold uppercase tracking-widest" data-testid="duplicate-label">
                {{ t('logicFlow.duplicate') }}
              </div>
              <div v-else-if="getDragStatus(group) === 'isolated'" class="ml-auto text-[10px] font-bold uppercase tracking-widest" data-testid="isolated-label">
                <span :class="logicFlow.hoveredGroupId === group.id ? 'text-blue-400' : 'text-amber-400/60'">
                  {{ logicFlow.hoveredGroupId === group.id ? t('logicFlow.connect') : t('logicFlow.isolate') }}
                </span>
              </div>
              <div v-else-if="getDragStatus(group) === 'replace'" class="ml-auto text-[10px] font-bold uppercase tracking-widest" data-testid="replace-label">
                <span :class="logicFlow.hoveredGroupId === group.id ? 'text-blue-400' : 'text-purple-400/60'">
                  {{ logicFlow.hoveredGroupId === group.id ? t('logicFlow.replace') : t('logicFlow.auto') }}
                </span>
              </div>
              <div v-else-if="getDragStatus(group) === 'auto'" class="ml-auto text-[10px] font-bold uppercase tracking-widest" data-testid="auto-label">
                <span :class="logicFlow.hoveredGroupId === group.id ? 'text-blue-400' : 'text-emerald-400/60'">
                  {{ logicFlow.hoveredGroupId === group.id ? t('logicFlow.manual') : t('logicFlow.auto') }}
                </span>
              </div>
              <div v-else-if="logicFlow.groups.find(g => g.id === group.id)?.isLocked" class="ml-auto text-[10px] font-bold uppercase tracking-widest" data-testid="locked-label">
                <span class="text-amber-400/60">
                  {{ t('race.' + logicFlow.groups.find(g => g.id === group.id)?.lockedLineage) }}
                </span>
              </div>
            </div>
            
            <!-- Nodes Grid (4xN logic: 4 columns) -->
      <div class="grid grid-cols-4 gap-1.5 flex-1 content-start compact-node-grid">
              <div 
                v-for="node in nodesWithPreview(group)" 
                :key="node.id"
                class="compact-node px-1 py-0.5 rounded border text-[8px] font-bold flex items-center justify-center truncate transition-all duration-200 min-h-[20px]"
                :class="[
                  node.isPreview 
                    ? 'bg-blue-500/20 border-blue-500 border-dashed text-blue-300 animate-pulse' 
                    : 'bg-white/5 border-white/5 text-white/50'
                ]"
                :data-ware-id="node.wareId"
              >
                <span class="truncate text-center w-full leading-tight">
                  {{ getCompactNodeDisplayName(node, group) }}
                </span>
              </div>
            </div>
          </div>
        </template>
      </draggable>

      <!-- New Line Drop Zone (Compact Version) -->
      <draggable
        :list="[]"
        :group="{ name: 'wares', put: isDropAllowedForNewZone, pull: false }"
        :sort="false"
        item-key="id"
        @add="handleAddFromDrop"
        class="compact-group drop-target border-2 rounded-2xl transition-all cursor-pointer group min-h-[160px]"
        :class="[
          logicFlow.isHoveringNewZone 
            ? 'bg-white/5 border-blue-500/50 p-4' 
            : 'bg-white/[0.02] border-dashed border-white/10 p-8 flex flex-col items-center justify-center'
        ]"
        @dragenter="handleNewZoneDragEnter()"
        @dragleave="handleNewZoneDragLeave()"
      >
        <template #item="{ element }">
          <div :key="element.id" class="hidden"></div>
        </template>
        <template #header>
          <!-- Regular Add State -->
          <div v-if="!logicFlow.isHoveringNewZone" class="flex flex-col items-center gap-2 pointer-events-none">
            <div class="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
              <span class="text-xl text-white/40 group-hover:text-blue-400">+</span>
            </div>
            <span class="text-xs font-bold text-white/20 group-hover:text-blue-400/60 uppercase tracking-widest">
              {{ $t('logicFlow.dropToCreate') }}
            </span>
          </div>

          <!-- Phantom Preview State -->
          <div v-else class="flex flex-col gap-3 pointer-events-none h-full w-full">
            <div class="flex items-center gap-2 border-b border-white/5 pb-2">
              <div class="w-1 h-3 rounded-full bg-blue-500"></div>
              <span class="text-[13px] font-black text-white/80 truncate italic">
                Preview: {{ getNewLineModuleName() || 'New Line' }}
              </span>
              
              <!-- T0 Resources Preview for New Line -->
              <div class="flex items-center gap-1 ml-2 overflow-hidden">
                <div 
                  v-for="resId in getNewLineResources()" 
                  :key="resId"
                  class="flex items-center gap-0.5 px-1 rounded bg-blue-500/20 border border-blue-500/30"
                  :data-ware-id="resId"
                >
                  <span class="text-[10px] font-bold text-white/80 leading-none">{{ t('res.' + resId) }}</span>
                </div>
              </div>
            </div>

            <!-- Nodes Grid Preview -->
            <div class="grid grid-cols-4 gap-1.5 flex-1 content-start compact-node-grid">
              <div 
                class="compact-node px-1 py-0.5 rounded border border-dashed border-blue-500 bg-blue-500/20 text-blue-300 text-[8px] font-bold flex items-center justify-center min-h-[20px] animate-pulse"
              >
                <span class="truncate text-center w-full leading-tight">
                  {{ getNewLineModuleName() }}
                </span>
              </div>
            </div>
          </div>
        </template>
      </draggable>
    </div>
  </div>
</template>

<style scoped>
.planning-zone {
  min-height: 500px;
}

/* Hide default vuedraggable ghosts in compact view to avoid redundancy with our grid preview */
:deep(.compact-view .sortable-ghost) {
  display: none !important;
}

:deep(.compact-view .sortable-fallback) {
  display: none !important;
}

/* Ensure the drop target doesn't show default cursor hints when blocked */
.compact-group.border-red-500 {
  cursor: not-allowed;
}
</style>

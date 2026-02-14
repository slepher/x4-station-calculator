<script setup lang="ts">
import { ref } from 'vue'
import draggable from 'vuedraggable'
import { useI18n } from 'vue-i18n'
import { useLogicFlowStore } from '@/store/useLogicFlowStore'
import { useGameDataStore } from '@/store/useGameDataStore'
import ProductionLineGroupComponent from './ProductionLineGroup.vue'
import type { ProductionLineGroup, FlowNode } from '@/types/x4'

const { t } = useI18n()
const logicFlow = useLogicFlowStore()
const gameData = useGameDataStore()

/**
 * 格式化资源数据以便循环显示
 */
const getFormattedResources = (group: ProductionLineGroup, includeDragging: boolean) => {
  // 1. 获取节点列表 (如果正在拖拽且悬停在该组，则包含预览节点)
  let nodes: any[] = []
  if (includeDragging) {
    nodes = nodesWithPreview(group)
  } else {
    nodes = group.nodes
      .filter((n: FlowNode) => n.source === 'manual')
      .sort((a: FlowNode, b: FlowNode) => b.column - a.column)
  }

  // 2. 获取排序后的资源 ID
  // Note: nodesWithPreview returns objects that match FlowNode structure but with extra props.
  // We cast to FlowNode[] for the store method.
  const sortedIds = logicFlow.getSortedGroupT0Resources(nodes as FlowNode[])

  // 3. 获取原始资源用于比对新增状态
  const originalResources = logicFlow.getGroupT0Resources(group.id, false)
  
  return sortedIds.map(wareId => ({
    wareId,
    isNew: !originalResources[wareId]
  }))
}

/**
 * 获取 New Line 预览的排序后资源
 */
const getNewLineResources = () => {
  if (!logicFlow.draggingWareId) return []
  const ware = gameData.waresMap[logicFlow.draggingWareId]
  if (!ware) return []
  
  // 构造临时节点用于计算排序
  const tempNode: any = {
    id: 'temp',
    wareId: logicFlow.draggingWareId,
    column: ware.tier,
    source: 'manual',
    // 默认 race
    race: 'default' 
  }
  
  return logicFlow.getSortedGroupT0Resources([tempNode])
}

/**
 * Nodes for display, including a preview node if dragging over a group
 */
const nodesWithPreview = (group: any) => {
  // 1. Get current manual nodes
  const nodes = group.nodes
    .filter((n: any) => n.source === 'manual')
    .map((n: any) => ({ ...n, isPreview: false }))

  // 2. If dragging over this group
  if (logicFlow.isDragging && 
      logicFlow.draggingWareId && 
      logicFlow.hoveredGroupId === group.id) {
    
    // 检查是否已经存在该产物
    const existingNode = group.nodes.find((n: any) => n.wareId === logicFlow.draggingWareId)
    
    // 如果不存在，或者虽然存在但是锁定的（Locked 节点也是预览的目标），或者虽然存在但是 Auto 的（转正的目标），则显示预览点
    if (!existingNode || existingNode.isLocked || existingNode.source === 'auto') {
      const ware = gameData.waresMap[logicFlow.draggingWareId]
      if (ware) {
        nodes.push({
          id: 'preview-' + logicFlow.draggingWareId,
          wareId: logicFlow.draggingWareId,
          column: ware.tier,
          isPreview: true,
          source: 'manual'
        })
      }
    }
  }

  // 3. Sort by Tier (High to Low)
  return nodes.sort((a: any, b: any) => b.column - a.column)
}

const handleAddToExistingGroup = (groupId: string, event: any) => {
  if (logicFlow.hoveredGroupId !== groupId) return

  const draggingWareId = logicFlow.draggingWareId || (event.item?._underlying_vm_?.id)
  
  if (draggingWareId) {
    const group = logicFlow.groups.find(g => g.id === groupId)
    if (group) {
      const node = group.nodes.find(n => n.wareId === draggingWareId)
      
      if (node) {
        if (node.isLocked) {
          // 如果已锁定，执行解锁并扩展逻辑
          logicFlow.unlockAndExpand(groupId, draggingWareId)
        } else if (node.source === 'auto') {
          // 如果是自动节点，执行转正逻辑
          logicFlow.promoteNode(groupId, draggingWareId)
        } else {
          // 如果已经是手动节点且未锁定，视为重复，不执行操作
          console.warn('[PlanningZone] Duplicate manual ware detected, blocking add')
        }
      } else {
        // 如果不存在，正常添加
        const subCategory = event.from?.getAttribute('data-subcategory') || 'default'
        logicFlow.expandUpstream(groupId, draggingWareId, 'manual', subCategory)
      }
    }
  }
  
  logicFlow.hoveredGroupId = null
}

const isDuplicate = (groupId: string) => {
  if (!logicFlow.draggingWareId) return false
  const group = logicFlow.groups.find(g => g.id === groupId)
  if (!group) return false
  
  const node = group.nodes.find(n => n.wareId === logicFlow.draggingWareId)
  // 如果节点存在：
  // 1. 如果是 locked，不重复（可以解锁）
  // 2. 如果是 auto，不重复（可以转正）
  // 3. 只有当它是 manual 且非 locked 时，才算重复
  return node ? (node.source === 'manual' && !node.isLocked) : false
}

const isLocked = (groupId: string) => {
  if (!logicFlow.draggingWareId) return false
  const group = logicFlow.groups.find(g => g.id === groupId)
  if (!group) return false
  
  const node = group.nodes.find(n => n.wareId === logicFlow.draggingWareId)
  return node ? node.isLocked : false
}

const isAuto = (groupId: string) => {
  if (!logicFlow.draggingWareId) return false
  const group = logicFlow.groups.find(g => g.id === groupId)
  if (!group) return false
  
  const node = group.nodes.find(n => n.wareId === logicFlow.draggingWareId)
  return node ? node.source === 'auto' : false
}

const dummyList = ref([])

const handleAddFromDrop = (event: any) => {
  // vuedraggable 的 item 是 DOM 元素，通过 _underlying_vm_ 获取数据
  const ware = event.item?._underlying_vm_
  
  // 关键修复：延迟处理，让 vuedraggable 完成其内部的 DOM 操作
  // 使用 requestAnimationFrame 或较长的 setTimeout 确保生命周期解耦
  setTimeout(() => {
    if (ware && ware.id) {
      const isAgricultural = ['agricultural', 'food', 'pharmaceutical', 'water', 'ice'].includes(ware.group)
      const category = isAgricultural ? 'agricultural' : 'industrial'
      
      const subCategory = event.from?.getAttribute('data-subcategory') || (category === 'industrial' ? 'default' : 'argon')
      const group = logicFlow.addGroup(category, subCategory)
      
      logicFlow.expandUpstream(group.id, ware.id, 'manual', subCategory)
    }
    
    // 最后清空临时列表
    dummyList.value = []
  }, 20) // 给 vuedraggable 留出足够的清理时间
}
</script>

<template>
  <div class="planning-zone mt-8 overflow-x-auto custom-scrollbar pb-8">
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

      <!-- Add New Zone in Regular View (Visible when empty or as a footer) -->
      <draggable
        v-if="logicFlow.groups.length === 0"
        :list="[]"
        :group="{ name: 'wares', put: true, pull: false }"
        :sort="false"
        item-key="id"
        @add="handleAddFromDrop"
        class="drop-target bg-white/[0.02] border-2 border-dashed border-white/10 rounded-2xl p-12 flex flex-col items-center justify-center gap-4 hover:bg-blue-500/5 hover:border-blue-500/30 transition-all cursor-pointer group"
        @click="logicFlow.addGroup('industrial', 'default')"
      >
        <template #item="{ element }">
          <div :key="element.id" class="hidden"></div>
        </template>
        <template #header>
          <div class="flex flex-col items-center gap-3 pointer-events-none">
            <div class="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
              <span class="text-2xl text-white/40 group-hover:text-blue-400">+</span>
            </div>
            <div class="text-center">
              <div class="text-sm font-bold text-white/40 group-hover:text-blue-400/80 uppercase tracking-widest mb-1">
                {{ $t('logicFlow.dropToCreate') }}
              </div>
              <div class="text-[10px] text-white/20 uppercase tracking-tighter">
                {{ t('logicFlow.clickToAddManually') }}
              </div>
            </div>
          </div>
        </template>
      </draggable>
    </div>

    <!-- 2. Compact View (Active during dragging) -->
    <div v-show="logicFlow.isDragging" class="compact-view grid grid-cols-4 gap-6 px-12 py-12 min-h-full" data-testid="compact-view">
      <!-- Existing Groups as Drop Targets -->
      <draggable
        v-for="group in logicFlow.groups"
        :key="group.id"
        :list="[]"
        :group="{ 
          name: 'wares', 
          put: () => !isDuplicate(group.id), 
          pull: false 
        }"
        :sort="false"
        item-key="id"
        @add="(event: any) => handleAddToExistingGroup(group.id, event)"
        class="compact-group drop-target bg-white/5 border rounded-2xl p-4 flex flex-col gap-3 transition-all cursor-pointer min-h-[160px]"
        :class="[
          isDuplicate(group.id) 
            ? 'border-red-500 bg-red-500/5' 
            : (isLocked(group.id) 
                ? 'border-amber-500/50 bg-amber-500/5' 
                : (logicFlow.hoveredGroupId === group.id ? 'border-blue-500 bg-blue-500/10' : 'border-white/10'))
        ]"
        @dragenter="logicFlow.hoveredGroupId = group.id"
        @dragleave="logicFlow.hoveredGroupId = null"
        @mouseenter="logicFlow.isDragging && (logicFlow.hoveredGroupId = group.id)"
        @mouseleave="logicFlow.isDragging && (logicFlow.hoveredGroupId = null)"
      >
        <template #item="{ element }">
          <div :key="element.id" class="hidden"></div>
        </template>
        <template #header>
          <div class="flex flex-col gap-3 pointer-events-none h-full">
            <div class="flex items-center gap-2 border-b border-white/5 pb-2">
              <div 
                class="w-1 h-3 rounded-full"
                :class="group.category === 'industrial' ? 'bg-blue-500' : 'bg-emerald-500'"
              ></div>
              <span class="text-[13px] font-black text-white truncate">{{ group.name }}</span>
              
              <!-- T0 Resources Preview in Header -->
              <div class="flex items-center gap-1 ml-2 overflow-hidden">
                <div 
                  v-for="res in getFormattedResources(group, logicFlow.hoveredGroupId === group.id)" 
                  :key="res.wareId"
                  class="flex items-center gap-0.5 px-1 rounded bg-white/5 border border-white/5 transition-all duration-300"
                  :class="{ 'border-blue-500 bg-blue-500/20 animate-pulse scale-110': res.isNew }"
                  :title="gameData.localizedWaresMap[res.wareId]?.localeName"
                  :data-ware-id="res.wareId"
                >
                  <span class="text-[10px] font-bold text-white/80 leading-none">{{ t('res.' + res.wareId) }}</span>
                </div>
              </div>

              <div v-if="isDuplicate(group.id)" class="ml-auto text-[10px] text-red-400 font-bold uppercase tracking-widest" data-testid="duplicate-label">
                {{ t('logicFlow.duplicate') }}
              </div>
              <div v-else-if="isLocked(group.id)" class="ml-auto text-[10px] font-bold uppercase tracking-widest" data-testid="locked-label">
                <span :class="logicFlow.hoveredGroupId === group.id ? 'text-blue-400' : 'text-amber-400/60'">
                  {{ logicFlow.hoveredGroupId === group.id ? t('logicFlow.connect') : t('logicFlow.isolate') }}
                </span>
              </div>
              <div v-else-if="isAuto(group.id)" class="ml-auto text-[10px] font-bold uppercase tracking-widest" data-testid="auto-label">
                <span :class="logicFlow.hoveredGroupId === group.id ? 'text-blue-400' : 'text-emerald-400/60'">
                  {{ logicFlow.hoveredGroupId === group.id ? t('logicFlow.manual') : t('logicFlow.auto') }}
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
                  {{ gameData.localizedWaresMap[node.wareId]?.localeName || node.wareId }}
                </span>
              </div>
            </div>
          </div>
        </template>
      </draggable>

      <!-- New Line Drop Zone (Compact Version) -->
      <draggable
        :list="[]"
        :group="{ name: 'wares', put: true, pull: false }"
        :sort="false"
        item-key="id"
        @add="handleAddFromDrop"
        class="compact-group drop-target border-2 rounded-2xl transition-all cursor-pointer group min-h-[160px]"
        :class="[
          logicFlow.isHoveringNewZone 
            ? 'bg-white/5 border-blue-500/50 p-4' 
            : 'bg-white/[0.02] border-dashed border-white/10 p-8 flex flex-col items-center justify-center'
        ]"
        @dragenter="logicFlow.isHoveringNewZone = true"
        @dragleave="logicFlow.isHoveringNewZone = false"
        @mouseenter="logicFlow.isDragging && (logicFlow.isHoveringNewZone = true)"
        @mouseleave="logicFlow.isDragging && (logicFlow.isHoveringNewZone = false)"
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
                Preview: {{ logicFlow.draggingWareId ? (gameData.localizedWaresMap[logicFlow.draggingWareId]?.localeName || logicFlow.draggingWareId) : 'New Line' }}
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
                :style="{ 
                  gridColumnStart: logicFlow.draggingWareId ? (gameData.waresMap[logicFlow.draggingWareId]?.tier === 0 ? 1 : 4 - (gameData.waresMap[logicFlow.draggingWareId]?.tier || 0)) : 1 
                }"
              >
                <span class="truncate text-center w-full leading-tight">
                  {{ logicFlow.draggingWareId ? (gameData.localizedWaresMap[logicFlow.draggingWareId]?.localeName || logicFlow.draggingWareId) : '' }}
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

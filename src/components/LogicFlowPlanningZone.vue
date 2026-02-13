<script setup lang="ts">
import { ref } from 'vue'
import draggable from 'vuedraggable'
import { useLogicFlowStore } from '@/store/useLogicFlowStore'
import { useGameDataStore } from '@/store/useGameDataStore'
import ProductionLineGroupComponent from './ProductionLineGroup.vue'

const logicFlow = useLogicFlowStore()
const gameData = useGameDataStore()

/**
 * Nodes for display, including a preview node if dragging over a group
 */
const nodesWithPreview = (group: any) => {
  // 1. Get current manual nodes
  const nodes = group.nodes
    .filter((n: any) => n.source === 'manual')
    .map((n: any) => ({ ...n, isPreview: false }))

  // 2. If dragging over this group, and not a duplicate, add a preview node
  if (logicFlow.isDragging && 
      logicFlow.draggingWareId && 
      logicFlow.hoveredGroupId === group.id && 
      !group.nodes.some((n: any) => n.wareId === logicFlow.draggingWareId)) {
    
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

  // 3. Sort by Tier (High to Low)
  return nodes.sort((a: any, b: any) => b.column - a.column)
}

const handleAddToExistingGroup = (groupId: string, event: any) => {
  // 核心修复：只有当鼠标确实悬停在当前组时，才允许添加
  // 解决“移出区域后仍添加成功”的 Bug
  if (logicFlow.hoveredGroupId !== groupId) {
    console.log('[PlanningZone] Drop ignored: not hovered over target group')
    return
  }

  // 优先从 store 获取正在拖拽的 ID
  const draggingWareId = logicFlow.draggingWareId || (event.item?._underlying_vm_?.id)
  
  if (draggingWareId) {
    // 重复校验
    const group = logicFlow.groups.find(g => g.id === groupId)
    if (group && group.nodes.some(n => n.wareId === draggingWareId)) {
      console.warn('[PlanningZone] Duplicate ware detected, blocking add')
      return
    }

    const subCategory = event.from?.getAttribute('data-subcategory') || 'default'
    logicFlow.expandUpstream(groupId, draggingWareId, 'manual', subCategory)
  }
  
  // 清理悬停状态
  logicFlow.hoveredGroupId = null
}

const isDuplicate = (groupId: string) => {
  if (!logicFlow.draggingWareId) return false
  const group = logicFlow.groups.find(g => g.id === groupId)
  return group ? group.nodes.some(n => n.wareId === logicFlow.draggingWareId) : false
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
                Click to add manually
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
            : logicFlow.hoveredGroupId === group.id ? 'border-blue-500 bg-blue-500/10' : 'border-white/10'
        ]"
        @dragenter="logicFlow.hoveredGroupId = group.id"
        @dragleave="logicFlow.hoveredGroupId = null"
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
              <div v-if="isDuplicate(group.id)" class="ml-auto text-[10px] text-red-400 font-bold uppercase tracking-widest" data-testid="duplicate-label">
                Duplicate
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
        class="compact-group drop-target bg-white/[0.02] border-2 border-dashed border-white/10 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 hover:bg-blue-500/5 hover:border-blue-500/30 transition-all cursor-pointer group min-h-[160px]"
      >
        <template #item="{ element }">
          <div :key="element.id" class="hidden"></div>
        </template>
        <template #header>
          <div class="flex flex-col items-center gap-2 pointer-events-none">
            <div class="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
              <span class="text-xl text-white/40 group-hover:text-blue-400">+</span>
            </div>
            <span class="text-xs font-bold text-white/20 group-hover:text-blue-400/60 uppercase tracking-widest">
              {{ $t('logicFlow.dropToCreate') }}
            </span>
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

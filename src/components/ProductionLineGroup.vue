<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import draggable from 'vuedraggable'
import { useLogicFlowStore } from '@/store/useLogicFlowStore'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useI18n } from 'vue-i18n'
import type { ProductionLineGroup, FlowNode } from '@/types/x4'
import FlowNodeComponent from './FlowNode.vue'

const props = defineProps<{
  group: ProductionLineGroup
}>()

const { t } = useI18n()
const logicFlow = useLogicFlowStore()
const gameData = useGameDataStore()

// SVG Connectivity
const svgRef = ref<SVGSVGElement | null>(null)
const connections = ref<{ d: string, id: string }[]>([])

  // Groups nodes by column (Tier 0-3)
  const columns = computed(() => {
    const cols: FlowNode[][] = [[], [], [], []]
    
    // 1. 分组处理：将节点按列分开
    const nodesByColumn: Record<number, FlowNode[]> = { 0: [], 1: [], 2: [], 3: [] }
    props.group.nodes.forEach(node => {
      const target = nodesByColumn[node.column]
      if (target) {
        target.push(node)
      }
    })

    // 2. 对每一列进行独立排序
    Object.keys(nodesByColumn).forEach(key => {
      const colIndex = parseInt(key)
      const nodes = nodesByColumn[colIndex]
      if (!nodes) return
      
      const sorted = [...nodes].sort((a, b) => {
        // A. 特殊规则：能量电池在 Tier 0 中永远最后
        if (colIndex === 0) {
          if (a.wareId === 'energycells' && b.wareId !== 'energycells') return 1
          if (a.wareId !== 'energycells' && b.wareId === 'energycells') return -1
        }

        // B. 锁定状态（EXT/Locked）置底
        if (a.isLocked && !b.isLocked) return 1
        if (!a.isLocked && b.isLocked) return -1

        // C. 来源排序 (Manual 置顶)
        if (a.source === 'manual' && b.source === 'auto') return -1
        if (a.source === 'auto' && b.source === 'manual') return 1

        return a.order - b.order
      })
      cols[colIndex] = sorted
    })

    return cols
  })

/**
 * Calculate SVG paths for connections
 */
const updateConnections = async () => {
  await nextTick()
  if (!svgRef.value) return

  const svgRect = svgRef.value.getBoundingClientRect()
  const newConnections: { d: string, id: string }[] = []

    props.group.nodes.forEach(targetNode => {
      // Only nodes with modules have inputs (upstream dependencies)
      if (!targetNode.moduleId || targetNode.isLocked) return

      const module = gameData.modulesMap[targetNode.moduleId]
      if (!module) return

      const targetEl = document.getElementById(`node-${targetNode.id}`)
      if (!targetEl) return

    const targetRect = targetEl.getBoundingClientRect()
    const targetX = targetRect.left - svgRect.left
    const targetY = targetRect.top - svgRect.top + targetRect.height / 2

      Object.keys(module.inputs).forEach(inputWareId => {
        // energycell不再进行连线防止过于杂乱
        if (inputWareId === 'energycells') return

        // Find the source node for this input in the same group
        const sourceNode = props.group.nodes.find(n => n.wareId === inputWareId)
        if (!sourceNode) return

        const sourceEl = document.getElementById(`node-${sourceNode.id}`)
        if (!sourceEl) return

      const sourceRect = sourceEl.getBoundingClientRect()
      const sourceX = sourceRect.right - svgRect.left
      const sourceY = sourceRect.top - svgRect.top + sourceRect.height / 2

      // Create a cubic bezier curve
      const cp1x = sourceX + (targetX - sourceX) / 2
      const cp2x = sourceX + (targetX - sourceX) / 2
      
      const d = `M ${sourceX} ${sourceY} C ${cp1x} ${sourceY}, ${cp2x} ${targetY}, ${targetX} ${targetY}`
      newConnections.push({ d, id: `${sourceNode.id}-${targetNode.id}` })
    })
  })

  connections.value = newConnections
}

// Watch for changes that might affect connections
watch(() => props.group.nodes, updateConnections, { deep: true })
watch(() => gameData.searchQuery, updateConnections) // Highlight might affect layout

onMounted(() => {
  window.addEventListener('resize', updateConnections)
  updateConnections()
})

onUnmounted(() => {
  window.removeEventListener('resize', updateConnections)
})

const handleToggleGroupLock = () => {
  logicFlow.toggleGroupLock(props.group.id)
}

const removeGroup = () => {
  if (confirm(`Remove production line group "${props.group.name}"?`)) {
    logicFlow.removeGroup(props.group.id)
  }
}

const getGroupName = computed(() => {
  // Find highest tier nodes
  let maxTier = -1
  props.group.nodes.forEach(n => {
    if (n.column > maxTier) maxTier = n.column
  })

  if (maxTier === -1) return props.group.name || '空'

  // Get nodes in the highest tier column
  const highestTierNodes = props.group.nodes
    .filter(n => n.column === maxTier)
    .sort((a, b) => {
      // 1. 特殊逻辑：能量电池（Energy Cells）在 Tier 0 中绝对置底
      if (a.column === 0 && b.column === 0) {
        if (a.wareId === 'energycells' && b.wareId !== 'energycells') return 1
        if (a.wareId !== 'energycells' && b.wareId === 'energycells') return -1
      }

      // 2. 锁定状态（EXT/Locked）置底
      if (a.isLocked && !b.isLocked) return 1
      if (!a.isLocked && b.isLocked) return -1

      // 3. 来源排序 (Manual 置顶)
      if (a.source === 'manual' && b.source === 'auto') return -1
      if (a.source === 'auto' && b.source === 'manual') return 1

      return a.order - b.order
    })

  const topNode = highestTierNodes[0]
  const wareName = topNode ? (gameData.localizedWaresMap[topNode.wareId]?.localeName || topNode.wareId) : '空'
  
  return wareName
})

const handleReorder = (colIndex: number, newNodes: any[]) => {
  // 关键过滤：确保 newNodes 中只包含 FlowNode (即具有 wareId 属性的对象)
  // vuedraggable 在外部拖入时可能会先触发 update:model-value 传入原始 Ware 对象
  const validNodes = newNodes.filter(n => n.wareId)
  
  if (validNodes.length !== newNodes.length) {
    // 如果存在非 FlowNode 对象，说明是外部拖入过程中的中间态，由 handleAdd 处理真正的添加逻辑
    // 我们只更新已存在的 FlowNode 的顺序
  }

  const updatedNodes = validNodes.map((n, index) => ({
    ...n,
    column: colIndex,
    order: index
  }))
  
  logicFlow.reorderNodes(props.group.id, colIndex, updatedNodes)
}

const handleAdd = (_colIndex: number, event: any) => {
  // draggable adds the item to the local list, we need to handle it in the store
  const ware = event.item._underlying_vm_
  
  // 关键修复：延迟处理，让 vuedraggable 完成其内部的 DOM 操作
  setTimeout(() => {
    if (ware && ware.id) {
      const subCategory = event.from?.getAttribute('data-subcategory') || props.group.subCategory
      
      logicFlow.expandUpstream(props.group.id, ware.id, 'manual', subCategory)
    }
    
    // 手动移除 vuedraggable 插入的 DOM 节点，因为我们的数据模型已经更新并会重新渲染
    if (event.item && event.item.parentNode) {
      event.item.parentNode.removeChild(event.item)
    }
  }, 20)
}
</script>

<template>
  <div class="production-group mb-8 last:mb-0">
    <!-- Group Header: Title & Actions -->
    <div class="flex items-center justify-between mb-2 px-4">
      <div class="flex items-center gap-2">
        <div 
          class="w-1.5 h-4 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]"
          :class="group.category === 'industrial' ? 'bg-blue-500' : 'bg-emerald-500'"
        ></div>
        <h3 class="text-xl font-black text-white tracking-tight">{{ getGroupName }}</h3>
      </div>
      
      <div class="flex items-center gap-3">
        <!-- Group Lock Toggle -->
        <div class="group-lock-control flex items-center gap-2">
          <button 
            @click="handleToggleGroupLock"
            class="group-lock-btn"
            :class="group.isLocked ? 'group-lock-btn-active' : 'group-lock-btn-inactive'"
          >
            <span class="text-[12px]">{{ group.isLocked ? '🔒' : '🔓' }}</span>
            <span class="text-[10px] font-bold uppercase tracking-widest">{{ group.isLocked ? t('race.' + group.lockedLineage) : t('logicFlow.unlock') }}</span>
          </button>
        </div>

        <button 
          @click="removeGroup"
          class="p-2 hover:bg-red-500/10 text-white/20 hover:text-red-400 rounded-lg transition-all"
          title="Remove Group"
        >
          <span class="text-sm">🗑️</span>
        </button>
        <div class="drag-handle cursor-grab active:cursor-grabbing p-2 text-white/10 hover:text-white/40">
          <span class="text-lg">⋮⋮</span>
        </div>
      </div>
    </div>

    <!-- 4-Column Layout -->
    <div class="grid grid-cols-4 gap-12 px-4 relative">
      <!-- SVG Connectivity Layer -->
      <svg 
        ref="svgRef"
        class="absolute inset-0 w-full h-full pointer-events-none z-0"
        style="min-height: 100px;"
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="6"
            markerHeight="4"
            refX="5"
            refY="2"
            orient="auto"
          >
            <polygon points="0 0, 6 2, 0 4" fill="rgba(255,255,255,0.1)" />
          </marker>
        </defs>
        <path 
          v-for="conn in connections" 
          :key="conn.id"
          :d="conn.d"
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          stroke-width="1.5"
          marker-end="url(#arrowhead)"
          class="connection-line transition-all duration-500"
        />
      </svg>

      <div 
        v-for="(columnNodes, colIndex) in columns" 
        :key="colIndex"
        class="relative min-h-[100px] flex flex-col z-10"
      >
        <!-- Column Label (Subtle) -->
        <div class="px-2 py-1 mb-2 border-b border-white/5 flex justify-between items-center">
          <span class="text-[9px] font-black text-white/10 uppercase tracking-[0.2em]">Tier {{ colIndex }}</span>
          <span class="text-[8px] text-white/5">{{ columnNodes.length }}</span>
        </div>

        <draggable 
          class="flex flex-col gap-3 h-full pb-4"
          :model-value="columnNodes"
          @update:model-value="(val: any) => handleReorder(colIndex, val)"
          @add="(event: any) => handleAdd(colIndex, event)"
          :group="{ name: 'wares', put: true, pull: false }"
          :sort="false"
          item-key="id"
          ghost-class="opacity-50"
          drag-class="opacity-0"
        >
          <template #item="{ element: node }">
            <FlowNodeComponent 
              :node="node" 
              :group-id="group.id"
            />
          </template>
        </draggable>
      </div>
    </div>
  </div>
</template>

<style scoped>
.column-container {
  transition: all 0.3s ease;
}
.column-container:hover {
  @apply border-white/10 bg-black/30;
}

/* --- Group Lock Button Styles --- */
.group-lock-btn {
  @apply flex items-center gap-2 px-3 py-1.5 rounded-full transition-all border;
}

.group-lock-btn-active {
  @apply bg-amber-500/20 border-amber-500/50 text-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.2)];
}

.group-lock-btn-inactive {
  @apply bg-white/5 border-white/10 text-white/30 hover:text-white/60 hover:bg-white/10;
}
</style>

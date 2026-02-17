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

// 标题编辑状态
const isEditingTitle = ref(false)
const titleInputRef = ref<HTMLInputElement | null>(null)
const lastValidTitle = ref('')
const editingValue = ref('')

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
        if (a.isIsolated && !b.isIsolated) return 1
        if (!a.isIsolated && b.isIsolated) return -1

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
      if (!targetNode.moduleId || targetNode.isIsolated) return

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

        // Find ALL source nodes for this input in the same group
        // (multiple nodes with same wareId but different lineages)
        const sourceNodes = props.group.nodes.filter(n => n.wareId === inputWareId)
        
        sourceNodes.forEach(sourceNode => {
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

const isFirstGroup = computed(() => {
  return logicFlow.groups[0]?.id === props.group.id
})

const isLastGroup = computed(() => {
  return logicFlow.groups[logicFlow.groups.length - 1]?.id === props.group.id
})

const hasMixedLineage = computed(() => {
  const manualNodes = props.group.nodes.filter(n => n.source === 'manual')
  const lineages = new Set(manualNodes.map(n => n.lineage))
  return lineages.size > 1
})

const handleMoveUp = () => {
  logicFlow.moveGroupUp(props.group.id)
}

const handleMoveDown = () => {
  logicFlow.moveGroupDown(props.group.id)
}

const getGroupName = computed(() => {
  // 优先显示用户自定义标题
  if (props.group.customName) {
    return props.group.customName
  }
  
  // 否则自动计算：Find highest tier nodes
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
      if (a.isIsolated && !b.isIsolated) return 1
      if (!a.isIsolated && b.isIsolated) return -1

      // 3. 来源排序 (Manual 置顶)
      if (a.source === 'manual' && b.source === 'auto') return -1
      if (a.source === 'auto' && b.source === 'manual') return 1

      return a.order - b.order
    })

  const topNode = highestTierNodes[0]
  const wareName = topNode ? gameData.getWareDisplayName(topNode.wareId) : '空'
  
  return wareName
})

// 标题编辑方法
const startEditing = async () => {
  lastValidTitle.value = getGroupName.value
  editingValue.value = getGroupName.value
  isEditingTitle.value = true
  await nextTick()
  titleInputRef.value?.focus()
  titleInputRef.value?.select()
}

const finishEditing = () => {
  isEditingTitle.value = false
  editingValue.value = ''
}

const confirmEditing = () => {
  isEditingTitle.value = false
  if (!editingValue.value.trim()) {
    // 空值回退到上一个有效值
    return
  }
  // 保存自定义标题
  logicFlow.updateGroupCustomName(props.group.id, editingValue.value.trim())
}

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

const getAttribute = (element: any, attribute: string) => {
  if (element && typeof element.getAttribute === 'function') {
    return element.getAttribute(attribute)
  }
  if (element?.el && typeof element.el.getAttribute === 'function') {
    return element.el.getAttribute(attribute)
  }
  return null
}

const handleAdd = (_colIndex: number, event: any) => {
  const ware = event.item._underlying_vm_
  
  if (!logicFlow.isDragging) {
    return
  }
  
  if (ware && ware.id) {
    const subCategory = getAttribute(event.from, 'data-subcategory') || props.group.subCategory
    logicFlow.handleDrop(props.group.id, subCategory)
  }
}
</script>

<template>
  <div class="production-group mb-8 last:mb-0">
    <!-- Group Header: Title & Actions -->
    <div class="flex items-center justify-between mb-2 px-4">
      <div class="flex items-center gap-2 min-w-0">
        <div 
          class="w-1.5 h-4 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)] flex-shrink-0"
          :class="group.category === 'industrial' ? 'bg-blue-500' : 'bg-emerald-500'"
        ></div>
        
        <!-- 编辑模式 -->
        <div v-if="isEditingTitle" class="flex items-center gap-2 flex-1 min-w-0">
          <input
            ref="titleInputRef"
            v-model="editingValue"
            class="bg-slate-700 text-white font-black text-xl px-2 py-0.5 rounded border border-sky-500/50 outline-none flex-1 min-w-0 text-left transition-all h-[32px]"
            @blur="finishEditing"
            @keydown.enter="confirmEditing"
          />
          <button 
            @mousedown.prevent="confirmEditing" 
            class="text-green-400 hover:text-green-300 transition-colors p-1 rounded hover:bg-slate-700 h-[32px] w-[32px] flex items-center justify-center flex-shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </button>
        </div>
        
        <!-- 显示模式 -->
        <div 
          v-else 
          class="group/title flex items-center gap-2 cursor-pointer hover:bg-slate-700/50 px-2 py-0.5 rounded transition-colors min-w-0"
          @click="startEditing"
        >
          <h3 class="text-xl font-black text-white tracking-tight truncate">{{ getGroupName }}</h3>
          <svg class="w-4 h-4 text-slate-500 opacity-0 group-hover/title:opacity-100 transition-opacity flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </div>
      </div>
      
      <div class="flex items-center gap-3">
        <!-- Group Lock Toggle (iOS Style) -->
        <div class="group-lock-control flex items-center gap-2">
          <span class="text-[10px] font-bold uppercase tracking-widest text-white/40 group-hover:text-white/70 transition-colors">
            {{ hasMixedLineage ? t('logicFlow.mixed') : (group.isLocked ? t('race.' + group.lockedLineage) : t('logicFlow.unlock')) }}
          </span>
          <label class="relative inline-flex items-center cursor-pointer group" :class="{ 'pointer-events-none opacity-50': hasMixedLineage }">
            <input 
              type="checkbox" 
              :checked="group.isLocked"
              :disabled="hasMixedLineage"
              @change="handleToggleGroupLock"
              class="sr-only peer"
            >
            <div class="w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600 transition-colors"></div>
          </label>
        </div>

        <button 
          @click="handleMoveUp"
          :disabled="isFirstGroup"
          class="p-1 hover:bg-blue-500/10 text-white/20 hover:text-blue-400 rounded transition-all disabled:opacity-0 disabled:pointer-events-none"
          title="Move Up"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
          </svg>
        </button>
        <button 
          @click="handleMoveDown"
          :disabled="isLastGroup"
          class="p-1 hover:bg-blue-500/10 text-white/20 hover:text-blue-400 rounded transition-all disabled:opacity-0 disabled:pointer-events-none"
          title="Move Down"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <button 
          @click="removeGroup"
          class="p-2 hover:bg-red-500/10 text-white/20 hover:text-red-400 rounded-lg transition-all"
          title="Remove Group"
        >
          <span class="text-sm">🗑️</span>
        </button>
      </div>
    </div>

    <!-- 4-Column Layout -->
    <div class="grid grid-cols-[2fr_3fr_3fr_4fr] gap-12 px-4 relative">
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
          <marker
            id="arrowhead-highlighted"
            markerWidth="8"
            markerHeight="5"
            refX="6"
            refY="2.5"
            orient="auto"
          >
            <polygon points="0 0, 8 2.5, 0 5" fill="rgba(59,130,246,0.8)" />
          </marker>
        </defs>
        <path 
          v-for="conn in connections" 
          :key="conn.id"
          :d="conn.d"
          fill="none"
          :stroke="logicFlow.highlightedConnectionIds.has(conn.id) ? 'rgba(59,130,246,0.8)' : 'rgba(255,255,255,0.08)'"
          :stroke-width="logicFlow.highlightedConnectionIds.has(conn.id) ? 2.5 : 1.5"
          :marker-end="logicFlow.highlightedConnectionIds.has(conn.id) ? 'url(#arrowhead-highlighted)' : 'url(#arrowhead)'"
          class="connection-line transition-all duration-300"
          :class="{ 'highlighted-connection': logicFlow.highlightedConnectionIds.has(conn.id) }"
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


</style>

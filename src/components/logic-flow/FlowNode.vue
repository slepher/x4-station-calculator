<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useLogicFlowStore } from '@/store/useLogicFlowStore'
import type { FlowNode } from '@/types/x4'

const props = defineProps<{
  node: FlowNode
  groupId: string
}>()

const { t } = useI18n()
const gameData = useGameDataStore()
const logicFlow = useLogicFlowStore()

const moduleDisplayName = computed(() => gameData.getModuleDisplayName(props.node.moduleId))
const wareDisplayName = computed(() => gameData.getWareDisplayName(props.node.wareId))

const isRawResource = computed(() => gameData.isRawMaterialWare(props.node.wareId))

const volumeCompressionRate = computed(() => {
  if (!props.node.moduleId || props.node.isIsolated) {
    return undefined
  }
  const module = gameData.modulesMap[props.node.moduleId]
  if (!module?.inputs || Object.keys(module.inputs).length === 0) {
    return undefined
  }
  return gameData.getModuleVolumeCompression(props.node.moduleId)
})

const volumeCompressionPercent = computed(() => {
  if (volumeCompressionRate.value === undefined) return undefined
  return Math.round(volumeCompressionRate.value * 100)
})

const isVolumeCompression = computed(() => {
  return volumeCompressionRate.value !== undefined && volumeCompressionRate.value <= 1
})

const getTierColor = (tier: number) => {
  switch (tier) {
    case 3: return 'text-purple-400'
    case 2: return 'text-blue-400'
    case 1: return 'text-green-400'
    default: return 'text-amber-400'
  }
}

const getTierBg = (tier: number) => {
  switch (tier) {
    case 3: return 'bg-purple-500/10'
    case 2: return 'bg-blue-500/10'
    case 1: return 'bg-green-500/10'
    default: return 'bg-amber-500/10'
  }
}

const isDepended = computed(() => logicFlow.isNodeDepended(props.groupId, props.node.wareId))

const canIsolate = computed(() => {
  if (isRawResource.value) return false
  return isDepended.value
})

// 高亮状态
const isHighlighted = computed(() => {
  return logicFlow.highlightedNodeIds.has(props.node.id)
})

const handleMouseEnter = () => {
  logicFlow.setHoveredNode(props.node.id)
}

const handleMouseLeave = () => {
  logicFlow.setHoveredNode(null)
}

const handleToggleIsolation = () => {
  logicFlow.toggleNodeIsolation(props.groupId, props.node.id)
}

const handlePromote = () => {
  logicFlow.promoteNode(props.groupId, props.node.id)
}

const handleRemove = () => {
  if (props.node.source === 'manual') {
    logicFlow.removeNode(props.groupId, props.node.id)
  }
}
</script>

<template>
  <div 
    class="flow-node group relative px-2 py-1.5 rounded-lg border transition-all duration-300"
    :class="[
      isHighlighted ? 'highlighted-node' : '',
      node.isIsolated 
        ? 'bg-white/5 border-white/10 opacity-80 grayscale italic border-dashed' 
        : (node.source === 'manual' 
          ? 'bg-white/10 border-white/20 shadow-lg hover:border-blue-500/50 hover:bg-white/15' 
          : 'bg-white/5 border-white/10 border-dashed opacity-80 hover:border-white/20'),
      getTierBg(node.column)
    ]"
    :id="`node-${node.id}`"
    :data-ware-id="node.wareId"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <!-- Content: Ware/Module Name & Actions -->
    <div class="flex items-center gap-2 h-5">
      <!-- Status/Tier indicator -->
      <div 
        class="w-1 h-1 rounded-full shrink-0"
        :class="node.source === 'manual' ? 'bg-blue-400 shadow-[0_0_5px_rgba(96,165,250,0.5)]' : 'bg-white/20'"
      ></div>

      <!-- Module Name (Primary) -->
      <div 
        class="flex-1 text-[11px] font-bold text-white truncate cursor-default"
        :title="moduleDisplayName || wareDisplayName"
      >
        {{ moduleDisplayName || wareDisplayName }}
      </div>
      
      <!-- Actions (Hover Only) -->
      <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <!-- Isolation Toggle (Isolate/Connect) -->
        <button 
          v-if="canIsolate"
          @click="handleToggleIsolation"
          class="hover:bg-white/10 rounded transition-colors"
          :title="node.isIsolated ? t('logicFlow.connect') : t('logicFlow.isolate')"
        >
          <span class="text-[9px]">{{ node.isIsolated ? '🔗' : '✂️' }}</span>
        </button>

        <!-- Promote Button (+) for Auto Nodes -->
        <button
          v-if="node.source === 'auto' && !node.isIsolated && !isRawResource"
          @click="handlePromote"
          class="hover:bg-blue-500/20 rounded transition-colors"
          :title="t('logicFlow.promoteToManual')"
        >
          <span class="text-[9px]">➕</span>
        </button>

        <!-- Remove Button for Manual Nodes (not isolated) -->
        <button
          v-if="node.source === 'manual' && !node.isIsolated"
          @click="handleRemove"
          class="hover:bg-red-500/20 rounded transition-colors"
          :title="t('logicFlow.remove')"
        >
          <span class="text-[9px]">🗑️</span>
        </button>
      </div>
    </div>

    <!-- Subtitle: Race / Status -->
    <div class="flex items-center justify-between mt-0.5 h-3">
      <div class="flex items-center gap-1 overflow-hidden">
        <span
          v-if="node.source === 'auto' && !node.isIsolated"
          class="text-[7px] font-bold uppercase tracking-tighter px-0.5 rounded bg-blue-500/20 text-blue-400 shrink-0 border border-blue-500/30"
        >
          {{ t('logicFlow.auto') }}
        </span>
        <span 
          class="text-[7px] font-bold uppercase tracking-tighter px-0.5 rounded bg-black/40 shrink-0"
          :class="getTierColor(node.column)"
        >
          {{ isRawResource ? t('ui.tag_res') : (!moduleDisplayName ? t('ui.tag_ops') : (node.race?.replace('_', ' ') || '???')) }}
        </span>
      </div>
      
      <!-- Volume Compression Rate -->
      <div 
        v-if="volumeCompressionPercent !== undefined"
        class="flex items-center gap-0.5 shrink-0"
      >
        <span 
          class="text-[7px] font-bold font-mono"
          :class="isVolumeCompression ? 'text-emerald-400' : 'text-red-400'"
        >
          {{ volumeCompressionPercent }}%
        </span>
        <svg class="w-2.5 h-2.5" :class="isVolumeCompression ? 'text-emerald-400/60' : 'text-red-400/60'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
          <path d="m3.3 7 8.7 5 8.7-5"/>
          <path d="M12 22V12"/>
        </svg>
      </div>
    </div>

    <!-- Status indicator for external supply -->
    <div 
      v-if="node.isIsolated" 
      class="absolute inset-0 flex items-center justify-center pointer-events-none"
    >
      <div class="px-1 py-0.5 bg-black/40 backdrop-blur-sm border border-white/5 rounded text-[7px] font-bold text-white/40 uppercase tracking-widest">
        EXT
      </div>
    </div>
  </div>
</template>

<style scoped>
.flow-node {
  min-width: 130px;
  height: 36px;
}

.highlighted-node {
  box-shadow: 0 0 12px rgba(59, 130, 246, 0.5), 0 0 24px rgba(59, 130, 246, 0.3);
  border-color: rgba(59, 130, 246, 0.6) !important;
  background-color: rgba(59, 130, 246, 0.15) !important;
}
</style>

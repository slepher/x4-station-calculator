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

const module = computed(() => props.node.moduleId ? gameData.localizedModulesMap[props.node.moduleId] : null)

const isRawResource = computed(() => props.node.column === 0 || props.node.wareId === 'energycells')

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

const toggleLock = () => {
  logicFlow.toggleLock(props.groupId, props.node.id)
}

const removeNode = () => {
  logicFlow.removeNode(props.groupId, props.node.id)
}

const expandUpstream = () => {
  if (props.node.isLocked) return
  logicFlow.expandUpstream(props.groupId, props.node.wareId, 'manual')
}
</script>

<template>
  <div 
    class="flow-node group relative px-2 py-1.5 rounded-lg border transition-all duration-300"
    :class="[
      node.isLocked 
        ? 'bg-white/5 border-white/10 opacity-80 grayscale italic' 
        : 'bg-white/10 border-white/20 shadow-lg hover:border-blue-500/50 hover:bg-white/15',
      getTierBg(node.column)
    ]"
    :id="`node-${node.id}`"
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
        :title="module?.localeName || (gameData.localizedWaresMap[node.wareId]?.localeName || node.wareId)"
      >
        {{ module?.localeName || (gameData.localizedWaresMap[node.wareId]?.localeName || node.wareId) }}
      </div>
      
      <!-- Actions (Hover Only) -->
      <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button 
          v-if="!isRawResource && !node.isLocked"
          @click="expandUpstream"
          class="hover:bg-blue-500/20 rounded transition-colors"
          title="Expand"
        >
          <span class="text-[9px]">🌳</span>
        </button>
        <button 
          v-if="!isRawResource"
          @click="toggleLock"
          class="hover:bg-white/10 rounded transition-colors"
          :title="node.isLocked ? 'Unlock' : 'Lock'"
        >
          <span class="text-[9px]">{{ node.isLocked ? '🔓' : '🔒' }}</span>
        </button>
        <button 
          v-if="node.source === 'manual'"
          @click="removeNode"
          class="hover:bg-red-500/20 rounded transition-colors"
          title="Remove"
        >
          <span class="text-[9px]">🗑️</span>
        </button>
      </div>
    </div>

    <!-- Subtitle: Race / Status -->
    <div class="flex items-center justify-between mt-0.5 h-3">
      <div class="flex items-center gap-1 overflow-hidden">
        <span 
          class="text-[7px] font-bold uppercase tracking-tighter px-0.5 rounded bg-black/40 shrink-0"
          :class="getTierColor(node.column)"
        >
          {{ isRawResource ? t('ui.tag_res') : (!module ? t('ui.tag_ops') : (node.race?.replace('_', ' ') || '???')) }}
        </span>
      </div>
    </div>

    <!-- Status indicator for external supply -->
    <div 
      v-if="node.isLocked" 
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
</style>

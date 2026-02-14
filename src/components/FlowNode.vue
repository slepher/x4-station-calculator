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

const isDepended = computed(() => logicFlow.isNodeDepended(props.groupId, props.node.wareId))

const canIsolate = computed(() => {
  // 基础资源不能隔离（本身就是基础）
  if (isRawResource.value) return false
  return true
})

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
      node.isLocked 
        ? 'bg-white/5 border-white/10 opacity-80 grayscale italic border-dashed' 
        : (node.source === 'manual' 
          ? 'bg-white/10 border-white/20 shadow-lg hover:border-blue-500/50 hover:bg-white/15' 
          : 'bg-white/5 border-white/10 border-dashed opacity-80 hover:border-white/20'),
      getTierBg(node.column)
    ]"
    :id="`node-${node.id}`"
    :data-ware-id="node.wareId"
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
        <!-- Promote Button (+) for Auto Nodes -->
        <button 
          v-if="node.source === 'auto' && !node.isLocked"
          @click="handlePromote"
          class="hover:bg-blue-500/20 rounded transition-colors"
          title="Promote to Manual"
        >
          <span class="text-[9px]">➕</span>
        </button>

        <!-- Isolation Toggle (Isolate/Connect) -->
        <button 
          v-if="canIsolate"
          @click="handleToggleIsolation"
          class="hover:bg-white/10 rounded transition-colors"
          :title="node.isLocked ? t('logicFlow.connect') : t('logicFlow.isolate')"
        >
          <span class="text-[9px]">{{ node.isLocked ? '🔗' : '✂️' }}</span>
        </button>

        <!-- Remove Button for Manual Nodes -->
        <button 
          v-if="node.source === 'manual'"
          @click="handleRemove"
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
          v-if="node.source === 'auto' && !node.isLocked"
          class="text-[7px] font-bold uppercase tracking-tighter px-0.5 rounded bg-blue-500/20 text-blue-400 shrink-0 border border-blue-500/30"
        >
          Auto
        </span>
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

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useLogicFlowStore } from '@/store/useLogicFlowStore'
import { getLogicFlowGroupDisplayName } from '@/store/logic/logicFlowGroupName'
import type { SavedFlowGroup } from '@/types/x4'

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits(['close'])
const { t } = useI18n()
const gameData = useGameDataStore()
const store = useLogicFlowStore()

const formatDate = (ts: number) => new Date(ts).toLocaleString()

const handleLoadPlan = (index: number) => {
  if (store.isDirty && store.groups.length > 0) {
    if (!confirm(t('planning.confirm_load_with_unsaved'))) {
      return
    }
  }
  store.loadPlan(index)
  emit('close')
}

const getPlanDescription = (groups: SavedFlowGroup[]) => {
  const groupNames = groups.map((group) => getLogicFlowGroupDisplayName(group, gameData.getWareDisplayName))
  
  if (groupNames.length <= 3) {
    return groupNames.join(', ')
  }
  return groupNames.slice(0, 3).join(', ') + '...'
}

const getGroupNodeCount = (groups: SavedFlowGroup[]) => {
  return groups.reduce((total, g) => total + g.nodes.length, 0)
}

const handleDeletePlan = (index: number) => {
  if (confirm(t('planning.confirm_delete_plan'))) {
    store.deletePlan(index)
  }
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
    <div
      class="w-full max-w-3xl bg-slate-800 border border-slate-600 rounded-lg shadow-2xl flex flex-col max-h-[85vh] animate-fade-in">

      <div class="flex justify-between items-center px-6 py-4 border-b border-slate-700 bg-slate-900/30">
        <h3 class="text-xl font-bold text-white tracking-wide flex items-center gap-2">
          <svg class="w-5 h-5 text-purple-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          {{ t('planning.load_flow_plan') }}
        </h3>
        <button @click="$emit('close')"
          class="text-slate-400 hover:text-white transition p-1 hover:bg-slate-700 rounded">
          <svg class="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
        <div v-if="store.savedPlans.list.length === 0" class="text-center py-12 text-slate-500 italic">
          {{ t('planning.no_saved_flow_plans') }}
        </div>

        <div v-for="(plan, index) in store.savedPlans.list" :key="plan.id"
          class="group bg-slate-700/40 border border-slate-600/50 rounded-md p-4 hover:border-purple-500/50 hover:bg-slate-700/60 transition-all duration-200">
          <div class="flex justify-between items-start mb-2">
            <div>
              <div class="font-bold text-lg text-purple-100 mb-1 group-hover:text-purple-400 transition-colors">{{
                plan.name }}</div>
              <div class="text-xs text-slate-500 font-mono">{{ formatDate(plan.lastUpdated) }}</div>
            </div>
            <div class="text-xs text-slate-400 bg-slate-800/50 px-2 py-1 rounded">
              {{ plan.groups.length }} {{ t('planning.groups_count') }} · {{ getGroupNodeCount(plan.groups) }} {{ t('planning.nodes_count') }}
            </div>
          </div>

          <div
            class="text-sm text-slate-300 mb-4 line-clamp-2 leading-relaxed bg-slate-800/50 p-2 rounded border border-slate-700/50">
            {{ getPlanDescription(plan.groups) }}
          </div>

          <div class="flex items-center gap-3 pt-2 border-t border-slate-700/50">
            <button @click="handleLoadPlan(index)"
              class="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-purple-400 hover:text-purple-300 hover:bg-purple-900/30 px-3 py-1.5 rounded transition">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M15 3h6v6" />
                <path d="M10 14L21 3" />
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              </svg>
              {{ t('planning.action_load_plan') }}
            </button>

            <div class="flex-1"></div>

            <button @click="handleDeletePlan(index)"
              class="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-red-400 hover:text-red-300 hover:bg-red-900/30 px-3 py-1.5 rounded transition">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
              {{ t('planning.action_delete') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(30, 41, 59, 0.5);
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(71, 85, 105, 0.8);
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(100, 116, 139, 1);
}

@keyframes fade-in {
  from {
    opacity: 0;
    transform: scale(0.95);
  }

  to {
    opacity: 1;
    transform: scale(1);
  }
}

.animate-fade-in {
  animation: fade-in 0.2s ease-out;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>

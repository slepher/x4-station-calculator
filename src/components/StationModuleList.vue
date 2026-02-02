<script setup lang="ts">
import { ref } from 'vue'
import { useStationStore } from '@/store/useStationStore'
import draggable from 'vuedraggable'
import { useI18n } from 'vue-i18n'
import StationModuleItem from './StationModuleItem.vue'
import StationModuleSelector from './StationModuleSelector.vue'
import X4NumberInput from './common/X4NumberInput.vue'

const {t} = useI18n()
const store = useStationStore()
</script>

<template>
  <div class="space-y-2">
    <div class="header-row">
      <h3 class="header-title">{{ t('ui.module_list') }}</h3>
      <div class="flex items-center gap-2">
        <span class="header-label">{{ t('ui.sun_light') }}</span>
        <div class="x4-composite-input-wrapper">
          <X4NumberInput v-model="store.settings.sunlight" width-class="w-16" class="x4-nested-input" />
          <div class="x4-unit-suffix-box">%</div>
        </div>
      </div>
    </div>

    <div class="module-list-scroll">
      <draggable 
        v-model="store.plannedModules" 
        item-key="id" 
        ghost-class="drag-ghost" 
        filter=".ignore-drag"
        :prevent-on-filter="false"
        class="space-y-2"
      >
        <template #item="{ element, index }">
          <StationModuleItem 
            :item="element"
            :info="store.getModuleInfo(element.id)!"
            @update:count="(val) => store.updateModuleCount(index, val)"
            @remove="store.removeModule(index)"
          />
        </template>
      </draggable>
    </div>

    <div class="module-controls-panel space-y-3">
      <StationModuleSelector />

      <div class="auto-fill-section items-start px-1">
        <button class="action-fill-capsule" @click="store.autoFillMissingLines">
          <svg viewBox="0 0 24 24" class="w-3.5 h-3.5 mr-1.5 fill-current">
            <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
          </svg>
          <span>{{ t('ui.auto_fill_deficit') }}</span>
        </button>
        
        <label for="wf-fill-check" class="wf-config-note">
          <input 
            type="checkbox" 
            id="wf-fill-check" 
            v-model="store.settings.considerWorkforceForAutoFill" 
            class="x4-checkbox-mini" 
          />
          <span>{{ t('ui.consider_workforce_bonus') }}</span>
        </label>
      </div>
    </div>
  </div>
</template>

<style scoped>
.header-row { @apply flex justify-between items-center mb-2 border-b border-slate-700 pb-2 h-9; }
.header-title { @apply text-lg font-semibold text-slate-200 uppercase tracking-tight; }
.header-label { @apply text-slate-500 text-[10px] uppercase font-bold tracking-widest leading-none; }

.x4-composite-input-wrapper { @apply flex items-center h-6 overflow-hidden rounded border border-slate-700 bg-slate-950/60 transition-colors duration-200; }
:deep(.x4-nested-input .x4-input-container) { @apply border-none bg-transparent rounded-none h-full; }
.x4-unit-suffix-box { @apply flex items-center justify-center px-1.5 h-full text-[10px] font-bold text-slate-500 border-l border-slate-700/50 bg-slate-900/40; min-width: 20px; }

.module-list-scroll { @apply max-h-[600px] overflow-y-auto pr-1 scrollbar-thin; }
.drag-ghost { @apply opacity-30 bg-slate-700 border-sky-500 border-dashed border-2; }

.module-controls-panel { @apply mt-4 pt-4 border-t border-slate-700; }

.auto-fill-section {
  @apply flex flex-col gap-1.5;
}

.action-fill-capsule {
  @apply flex items-center px-4 h-7 rounded bg-sky-600 text-white transition-all hover:bg-sky-500 active:scale-95 shadow-lg shadow-sky-900/20;
  @apply text-[10px] font-bold tracking-tight;
  width: fit-content;
}

.wf-config-note {
  @apply flex items-center gap-1.5 text-[8px] text-slate-600 uppercase font-bold tracking-tighter cursor-pointer hover:text-slate-500 transition-colors select-none;
}

.x4-checkbox-mini {
  @apply w-2.5 h-2.5 rounded-sm border-slate-800 bg-slate-950 text-sky-600 focus:ring-0 cursor-pointer;
}

.scrollbar-thin::-webkit-scrollbar { @apply w-1; }
.scrollbar-thin::-webkit-scrollbar-thumb { @apply bg-slate-700 rounded-full; }
</style>
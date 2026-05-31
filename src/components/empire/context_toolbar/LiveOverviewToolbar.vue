<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { StationSettings } from '@/types/x4'

const props = defineProps<{
  titleModel: {
    value: string
    placeholder: string
  }
  settings: Partial<StationSettings> | StationSettings | null
  races: Array<{ value: string; label: string }>
}>()

const emit = defineEmits<{
  updateTitle: [value: string]
  updateRacePreference: [value: string]
  openImport: []
}>()

const { t } = useI18n()

const titleValue = computed({
  get: () => props.titleModel.value,
  set: (val: string) => emit('updateTitle', val)
})

const racePreference = computed({
  get: () => props.settings?.racePreference ?? 'argon',
  set: (val: string) => emit('updateRacePreference', val)
})

const handleOpenImport = () => {
  emit('openImport')
}
</script>

<template>
  <div class="live-toolbar">
    <div class="toolbar-content w-full flex items-center h-full">
      <div class="toolbar-section">
        <div class="input-group">
          <label class="group-label">{{ t('binding.binding_name') }}</label>
          <input 
            v-model="titleValue"
            class="ghost-input w-64 text-lg"
            :placeholder="props.titleModel.placeholder"
          />
        </div>
      </div>

      <div class="separator mx-6"></div>
      
      <div class="toolbar-section">
        <div class="input-group">
          <label class="group-label">{{ t('toolbar.race_preference') }}</label>
          <select v-model="racePreference" class="race-select">
            <option v-for="r in props.races" :key="r.value" :value="r.value">{{ r.label }}</option>
          </select>
        </div>
      </div>
    </div>

    <div class="toolbar-import-slot">
      <button
        class="icon-btn"
        :title="t('logicFlowImport.entry_title')"
        data-testid="logicflow-import-entry-empire"
        @click="handleOpenImport"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.live-toolbar {
  @apply w-full h-16 shrink-0 bg-slate-950 border-b border-slate-800 flex px-6 select-none relative z-10;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.toolbar-section {
  @apply flex items-center h-full;
}

.separator {
  @apply h-8 w-px bg-slate-800 mx-3;
}

.group-label {
  @apply text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1 whitespace-nowrap block leading-none;
}

.input-group {
  @apply flex flex-col justify-end h-10;
}

.toolbar-import-slot {
  @apply ml-auto flex items-center;
}

.icon-btn {
  @apply flex items-center justify-center w-9 h-9 text-slate-500 hover:text-sky-400 hover:bg-slate-900 rounded transition-colors;
}

.ghost-input {
  @apply bg-transparent border-b border-slate-800 hover:border-slate-600 focus:border-sky-500 text-sm font-bold text-slate-200 px-1 h-6 outline-none transition-colors;
}

.race-select {
  @apply bg-slate-900 border border-slate-700 rounded px-2 h-6 text-xs text-slate-300 outline-none cursor-pointer transition-colors appearance-none min-w-[90px];
}
.race-select:hover {
  @apply border-slate-500;
}
.race-select:focus {
  @apply border-sky-500;
}
.race-select option {
  @apply bg-slate-900 text-slate-300;
}
</style>

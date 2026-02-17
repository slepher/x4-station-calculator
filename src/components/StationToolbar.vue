<script setup lang="ts">
import { ref, reactive, computed, watch, nextTick } from 'vue'
import { useStationStore } from '@/store/useStationStore'
import { useLogicFlowStore } from '@/store/useLogicFlowStore'
import { useStatusStore } from '@/store/useStatusStore'
import LanguageSelector from './LanguageSelector.vue'
import MissingTranslate from './MissingTranslate.vue'
import LoadPlanModal from './LoadPlanModal.vue'
import LoadFlowPlanModal from './LoadFlowPlanModal.vue'
import ImportPlanModal from './ImportPlanModal.vue'
import SmartSaveDialog from './SmartSaveDialog.vue'
import { useI18n } from 'vue-i18n'

const stationStore = useStationStore()
const logicFlowStore = useLogicFlowStore()
const statusStore = useStatusStore()
const { t } = useI18n()

const showLoadModal = ref(false)
const showLoadFlowModal = ref(false)
const showImportModal = ref(false)
const smartDialog = reactive({
  isOpen: false,
  intent: 'NEW' as 'NEW' | 'SAVE_AS'
})

const isEditingTitle = ref(false)
const titleInputRef = ref<HTMLInputElement | null>(null)
const lastValidTitle = ref('')
const editingValue = ref('')

const isFlowView = computed(() => stationStore.activeView === 'flow')
const currentStore = computed(() => isFlowView.value ? logicFlowStore : stationStore)

const themeColors = computed(() => {
  return isFlowView.value
    ? {
        title: 'text-purple-400',
        titleBorder: 'border-purple-500/50',
        primary: 'btn-purple',
        secondary: 'btn-fuchsia'
      }
    : {
        title: 'text-sky-400',
        titleBorder: 'border-sky-500/50',
        primary: 'btn-blue',
        secondary: 'btn-cyan'
      }
})

const displayTitle = computed(() => {
  if (isFlowView.value) {
    return logicFlowStore.currentPlanName || t('menu.default_flow_name')
  }
  return stationStore.currentPlanName || t('menu.default_station_name')
})

const startEditing = async () => {
  lastValidTitle.value = displayTitle.value
  editingValue.value = displayTitle.value
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
  const defaultName = isFlowView.value ? t('menu.default_flow_name') : t('menu.default_station_name')
  if (!editingValue.value.trim()) {
    if (isFlowView.value) {
      logicFlowStore.currentPlanName = lastValidTitle.value === defaultName ? '' : lastValidTitle.value
    } else {
      stationStore.currentPlanName = lastValidTitle.value === defaultName ? '' : lastValidTitle.value
    }
  } else {
    if (isFlowView.value) {
      logicFlowStore.currentPlanName = editingValue.value
    } else {
      stationStore.currentPlanName = editingValue.value
    }
  }
}

watch(displayTitle, (newVal) => {
  document.title = newVal
}, { immediate: true })

const handleNew = () => {
  const store = currentStore.value
  const isEmpty = isFlowView.value 
    ? logicFlowStore.groups.length === 0 
    : stationStore.plannedModules.length === 0
  
  if (isEmpty || !store.isDirty) {
    store.clearAll()
    return
  }
  smartDialog.intent = 'NEW'
  smartDialog.isOpen = true
}

const handleSave = () => {
  const store = currentStore.value
  const isEmpty = isFlowView.value 
    ? logicFlowStore.groups.length === 0 
    : stationStore.plannedModules.length === 0
  
  if (isEmpty) {
    statusStore.pushMessage('warning', 'save', t('menu.cannot_save_empty_plan'))
    return
  }
  if (store.savedPlans.activeId) {
    const current = store.savedPlans.list.find(l => l.id === store.savedPlans.activeId)
    if (current) {
      store.saveCurrentPlan()
      return
    }
  }
  handleSaveAs()
}

const handleSaveAs = () => {
  const isEmpty = isFlowView.value 
    ? logicFlowStore.groups.length === 0 
    : stationStore.plannedModules.length === 0
  
  if (isEmpty) {
    statusStore.pushMessage('warning', 'save', t('menu.cannot_save_empty_plan'))
    return
  }
  smartDialog.intent = 'SAVE_AS'
  smartDialog.isOpen = true
}

const handleLoad = () => {
  if (isFlowView.value) {
    showLoadFlowModal.value = true
  } else {
    showLoadModal.value = true
  }
}
</script>

<template>
  <div class="toolbar-panel">
    <div class="flex items-center gap-1.5 ml-4">
      <button :class="['btn-tool', themeColors.secondary]" @click="handleNew">
        <svg class="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        <span>{{ t('menu.new') }}</span>
      </button>
      <button :class="['btn-tool', themeColors.primary]" @click="handleSave">
        <svg class="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
          <polyline points="17 21 17 13 7 13 7 21" />
          <polyline points="7 3 7 8 15 8" />
        </svg>
        <span>{{ t('menu.save') }}</span>
      </button>
      <button :class="['btn-tool', themeColors.primary]" @click="handleSaveAs">
        <svg class="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M7 21h10" />
          <path d="M7 3h10" />
          <path d="M10 8h4" />
          <path d="M10 16h4" />
          <rect width="20" height="20" x="2" y="2" rx="2" />
        </svg>
        <span>{{ t('menu.save_as') }}</span>
      </button>
      <button :class="['btn-tool', themeColors.secondary]" @click="handleLoad">
        <svg class="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
        <span>{{ t('menu.load') }}</span>
      </button>
      <button class="btn-tool btn-gray">
        <svg class="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" x2="12" y1="2" y2="15" />
        </svg>
        <span>{{ t('menu.share') }}</span>
      </button>
      <button class="btn-tool btn-amber" @click="showImportModal = true">
        <svg class="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
          <path d="M8 18h8" />
          <path d="M8 14h8" />
        </svg>
        <span>{{ t('menu.import') }}</span>
      </button>
    </div>

    <div class="flex-1 flex justify-center min-w-0 mx-4">
      <div v-if="isEditingTitle" class="w-full flex justify-center items-center gap-2">
        <input
          ref="titleInputRef"
          v-model="editingValue"
          :class="['bg-slate-700 font-bold text-2xl px-2 py-0.5 rounded border outline-none w-3/4 min-w-[300px] text-center transition-all h-[40px]', themeColors.title, themeColors.titleBorder]"
          @blur="finishEditing"
          @keydown.enter="confirmEditing"
        />
        <button 
          @mousedown.prevent="confirmEditing" 
          class="text-green-400 hover:text-green-300 transition-colors p-1 rounded hover:bg-slate-700 h-[40px] w-[40px] flex items-center justify-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
        </button>
      </div>
      <div 
        v-else 
        class="group flex items-center gap-2 cursor-pointer hover:bg-slate-700/50 px-4 py-1 rounded transition-colors max-w-full truncate"
        @click="startEditing"
      >
        <h2 :class="['toolbar-title', themeColors.title]">{{ displayTitle }}</h2>
        <svg class="w-4 h-4 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      </div>
    </div>

    <div class="flex items-center bg-black/40 p-1 rounded-full border border-white/10">
      <button 
        @click="stationStore.activeView = 'production'"
        class="px-4 py-1.5 rounded-full text-xs transition-all duration-300 flex items-center gap-2"
        :class="stationStore.activeView === 'production' ? 'bg-blue-600 text-white shadow-lg' : 'text-white/40 hover:text-white/70'"
      >
        <span class="w-2 h-2 rounded-full" :class="stationStore.activeView === 'production' ? 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]' : 'bg-transparent border border-white/20'"></span>
        {{ t('view.production') }}
      </button>
      <button 
        @click="stationStore.activeView = 'flow'"
        class="px-4 py-1.5 rounded-full text-xs transition-all duration-300 flex items-center gap-2"
        :class="stationStore.activeView === 'flow' ? 'bg-purple-600 text-white shadow-lg' : 'text-white/40 hover:text-white/70'"
      >
        <span class="w-2 h-2 rounded-full" :class="stationStore.activeView === 'flow' ? 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]' : 'bg-transparent border border-white/20'"></span>
        {{ t('view.logical_flow') }}
      </button>
    </div>

    <div class="flex items-center gap-2 ml-2 mr-4">
      <MissingTranslate />
      <LanguageSelector />
    </div>

    <LoadPlanModal :isOpen="showLoadModal" @close="showLoadModal = false" />
    <LoadFlowPlanModal :isOpen="showLoadFlowModal" @close="showLoadFlowModal = false" />

    <ImportPlanModal :isOpen="showImportModal" @close="showImportModal = false" />

    <SmartSaveDialog 
      :isOpen="smartDialog.isOpen" 
      :intent="smartDialog.intent" 
      :initialName="currentStore.currentPlanName"
      :storeType="isFlowView ? 'logicFlow' : 'station'"
      @close="smartDialog.isOpen = false" 
    />
  </div>
</template>

<style scoped>
.btn-tool {
  @apply flex items-center gap-2 px-3 py-1.5 rounded text-white font-bold transition-all duration-200 border border-transparent select-none;
  height: 32px;
}

.btn-cyan {
  @apply bg-cyan-500 hover:bg-cyan-400 text-slate-900;
}

.btn-fuchsia {
  @apply bg-fuchsia-500 hover:bg-fuchsia-400 text-slate-900;
}

.btn-blue {
  @apply bg-blue-600 hover:bg-blue-500;
}

.btn-purple {
  @apply bg-purple-600 hover:bg-purple-500;
}

.btn-gray {
  @apply bg-slate-500 hover:bg-slate-400;
}

.btn-amber {
  @apply bg-amber-600 hover:bg-amber-500;
}

.toolbar-panel {
  @apply flex flex-wrap gap-4 justify-between items-center mb-6 bg-slate-800 py-3 border-y border-slate-700 shadow-2xl px-0 -mx-4 rounded-none;
}

.toolbar-title {
  @apply text-2xl font-bold mx-auto select-none;
}
</style>

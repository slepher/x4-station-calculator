<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useStationStore } from '@/store/useStationStore'
import LanguageSelector from './LanguageSelector.vue'
import MissingTranslate from './MissingTranslate.vue'
import LoadLayoutModal from './LoadLayoutModal.vue'
import ImportPlanModal from './ImportPlanModal.vue'
import SmartSaveDialog from './SmartSaveDialog.vue'
import { useI18n } from 'vue-i18n'

const store = useStationStore()
const { t } = useI18n()
const showLoadModal = ref(false)
const showImportModal = ref(false)
const smartDialog = reactive({
  isOpen: false,
  intent: 'NEW' as 'NEW' | 'SAVE_AS'
})

const handleNew = () => {
  if (store.plannedModules.length === 0 || !store.isDirty) {
    store.clearAll()
    return
  }
  smartDialog.intent = 'NEW'
  smartDialog.isOpen = true
}

const handleSave = () => {
  if (store.savedLayouts.activeId) {
    const current = store.savedLayouts.list.find(l => l.id === store.savedLayouts.activeId)
    if (current) {
      store.saveCurrentLayout(current.name)
      return
    }
  }
  handleSaveAs()
}

const handleSaveAs = () => {
  smartDialog.intent = 'SAVE_AS'
  smartDialog.isOpen = true
}

const handleLoad = () => {
  showLoadModal.value = true
}
</script>

<template>
  <div class="toolbar-panel">
    <div class="flex items-center gap-1.5 ml-4">
      <button class="btn-tool btn-cyan" @click="handleNew">
        <svg class="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        <span>{{ t('ui.new') }}</span>
      </button>
      <button class="btn-tool btn-blue" @click="handleSave">
        <svg class="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
          <polyline points="17 21 17 13 7 13 7 21" />
          <polyline points="7 3 7 8 15 8" />
        </svg>
        <span>{{ t('ui.save') }}</span>
      </button>
      <button class="btn-tool btn-blue" @click="handleSaveAs">
        <svg class="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M7 21h10" />
          <path d="M7 3h10" />
          <path d="M10 8h4" />
          <path d="M10 16h4" />
          <rect width="20" height="20" x="2" y="2" rx="2" />
        </svg>
        <span>{{ t('ui.save_as') }}</span>
      </button>
      <button class="btn-tool btn-cyan" @click="handleLoad">
        <svg class="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
        <span>{{ t('ui.load') }}</span>
      </button>
      <button class="btn-tool btn-gray">
        <svg class="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" x2="12" y1="2" y2="15" />
        </svg>
        <span>{{ t('ui.share') }}</span>
      </button>
      <button class="btn-tool btn-amber" @click="showImportModal = true">
        <svg class="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
          <path d="M8 18h8" />
          <path d="M8 14h8" />
        </svg>
        <span>{{ t('ui.import') }}</span>
      </button>
    </div>

    <h2 class="toolbar-title">{{ t('ui.station_planner') }}</h2>
    <div class="flex items-center gap-2 ml-auto lg:ml-0 mr-4">
      <MissingTranslate />
      <LanguageSelector />
    </div>

    <LoadLayoutModal :isOpen="showLoadModal" @close="showLoadModal = false" />

    <ImportPlanModal :isOpen="showImportModal" @close="showImportModal = false" />

    <SmartSaveDialog :isOpen="smartDialog.isOpen" :intent="smartDialog.intent" @close="smartDialog.isOpen = false" />
  </div>
</template>

<style scoped>
/* 样式管理共识：明细颜色及交互逻辑由类驱动 */
.btn-tool {
  @apply flex items-center gap-2 px-3 py-1.5 rounded text-white font-bold transition-all duration-200 border border-transparent select-none;
  height: 32px;
}

.btn-cyan {
  @apply bg-cyan-500 hover:bg-cyan-400 text-slate-900;
}

.btn-blue {
  @apply bg-blue-600 hover:bg-blue-500;
}

.btn-gray {
  @apply bg-slate-500 hover:bg-slate-400;
}

/* Amber 按钮用于 Import，高对比度跳脱背景 */
.btn-amber {
  @apply bg-amber-600 hover:bg-amber-500;
}

.toolbar-panel {
  @apply flex flex-wrap gap-4 justify-between items-center mb-6 bg-slate-800 py-3 border-y border-slate-700 shadow-2xl px-0 -mx-4 rounded-none;
}

.toolbar-title {
  @apply text-2xl font-bold text-sky-400 uppercase tracking-widest mx-auto select-none;
}
</style>
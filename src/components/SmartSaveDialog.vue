<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useStationStore } from '@/store/useStationStore'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  isOpen: boolean
  intent: 'NEW' | 'SAVE_AS'
}>()

const emit = defineEmits(['close'])
const store = useStationStore()
const { t } = useI18n()

// Local State
const isSaveAsExpanded = ref(false)
const inputName = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

// Reset state when opened
watch(() => props.isOpen, (val) => {
  if (val) {
    isSaveAsExpanded.value = false
    // Default name logic
    if (props.intent === 'SAVE_AS') {
        const baseName = store.savedLayouts.activeId 
            ? store.savedLayouts.list.find(l => l.id === store.savedLayouts.activeId)?.name 
            : ''
        inputName.value = baseName ? `${baseName} ${t('ui.copy_suffix')}` : t('ui.default_station_name')
    } else {
        inputName.value = t('ui.default_station_name')
    }
    
    if (showInput.value) {
      nextTick(() => inputRef.value?.select())
    }
  }
})

// --- Computed UI Logic ---

const isNewPlan = computed(() => !store.savedLayouts.activeId)
const currentPlanName = computed(() => {
    if (store.savedLayouts.activeId) {
        return store.savedLayouts.list.find(l => l.id === store.savedLayouts.activeId)?.name || ''
    }
    return ''
})

const dialogTitle = computed(() => {
  if (props.intent === 'SAVE_AS') {
    return t('ui.dialog_title_save_as')
  }
  if (isNewPlan.value) {
    return t('ui.dialog_title_save_new_plan')
  } else {
    return t('ui.dialog_title_save_changes')
  }
})

const dialogMessage = computed(() => {
  if (props.intent === 'SAVE_AS') return null
  
  if (!isNewPlan.value) {
    return t('ui.dialog_msg_save_changes_to', { name: currentPlanName.value })
  }
  return t('ui.dialog_msg_unsaved_new_plan')
})

const showInput = computed(() => {
  if (props.intent === 'SAVE_AS') return true
  if (props.intent === 'NEW' && isNewPlan.value) return true
  if (props.intent === 'NEW' && !isNewPlan.value && isSaveAsExpanded.value) return true
  return false
})

// --- Actions ---

const handlePrimaryAction = () => {
  const nameToSave = showInput.value ? inputName.value : currentPlanName.value
  
  if (!nameToSave.trim()) return 

  if (isNewPlan.value || showInput.value) {
    const originalId = store.savedLayouts.activeId
    if (showInput.value) {
        store.savedLayouts.activeId = null 
    }
    try {
        store.saveCurrentLayout(nameToSave)
    } catch(e) {
        store.savedLayouts.activeId = originalId 
    }
  } else {
    store.saveCurrentLayout(nameToSave)
  }

  if (props.intent === 'NEW') {
    store.clearAll()
  }
  
  emit('close')
}

const handleDiscard = () => {
  store.clearAll()
  emit('close')
}

</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
    <div class="w-full max-w-md bg-slate-800 border border-slate-600 rounded-lg shadow-2xl flex flex-col overflow-hidden transition-all duration-300">
      
      <div class="flex justify-between items-center px-6 py-4 border-b border-slate-700 bg-slate-900/30">
        <div class="flex items-center gap-3">
          <svg v-if="intent === 'NEW'" class="w-6 h-6 text-amber-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <svg v-else class="w-6 h-6 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          </svg>
          <h3 class="text-lg font-bold text-white tracking-wide">
            {{ dialogTitle }}
          </h3>
        </div>
        
        <button 
          @click="$emit('close')"
          class="text-slate-400 hover:text-white transition p-1 hover:bg-slate-700 rounded"
        >
          <svg class="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div class="p-6">
        <p v-if="dialogMessage" class="text-slate-300 mb-4 leading-relaxed white-space-pre">
          {{ dialogMessage }}
        </p>

        <div v-if="showInput" class="animate-expand mb-4">
          <label class="block text-xs font-bold text-slate-400 uppercase mb-2 ml-1">
            {{ t('ui.label_layout_name') }}
          </label>
          <input 
            ref="inputRef"
            v-model="inputName"
            @keyup.enter="handlePrimaryAction"
            type="text" 
            class="w-full bg-slate-900 border border-slate-600 text-white rounded px-4 py-2 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition placeholder-slate-600"
            :placeholder="t('ui.placeholder_enter_name')"
          />
        </div>

        <div v-if="intent === 'NEW' && !isNewPlan" class="flex items-center gap-2">
          <input 
            type="checkbox" 
            id="saveAsCopy" 
            v-model="isSaveAsExpanded"
            class="w-4 h-4 accent-cyan-500 cursor-pointer"
          />
          <label for="saveAsCopy" class="text-sm text-slate-300 cursor-pointer select-none">
            {{ t('ui.btn_save_as_copy') }}
          </label>
        </div>
      </div>

      <div class="px-6 py-4 bg-slate-900/20 border-t border-slate-700 flex justify-end gap-3">
        <button 
          v-if="intent === 'NEW'" 
          @click="handleDiscard"
          class="btn-base bg-red-600 hover:bg-red-500 shadow-red-900/20"
        >
          {{ t('ui.btn_discard_and_new') }}
        </button>

        <button 
          @click="handlePrimaryAction"
          class="btn-base bg-cyan-600 hover:bg-cyan-500 shadow-cyan-900/20"
        >
          <span v-if="intent === 'NEW'">
             {{ (showInput || isNewPlan) ? t('ui.btn_save_new_and_create') : t('ui.btn_overwrite_and_create') }}
          </span>
          <span v-else>
             {{ t('ui.btn_save') }}
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes fade-in {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
.animate-fade-in {
  animation: fade-in 0.2s ease-out;
}

.animate-expand {
  animation: expand 0.2s ease-out;
}
@keyframes expand {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 统一按钮基础样式，只通过 tailwind utility 类改变颜色 */
.btn-base {
  @apply px-4 py-2 rounded text-sm font-bold text-white shadow-lg transition whitespace-nowrap;
}
.white-space-pre {
  white-space: pre-line;
}
</style>
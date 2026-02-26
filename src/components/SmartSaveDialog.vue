<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useLogicFlowStore } from '@/store/useLogicFlowStore'
import { useEmpireStore } from '@/store/useEmpireStore'
import { useShipBuildStore } from '@/store/useShipBuildStore'
import { useI18n } from 'vue-i18n'
import type { LogicFlowPlan } from '@/types/x4';

const props = defineProps<{
  isOpen: boolean
  intent: 'NEW' | 'SAVE_AS'
  initialName?: string
  storeType?: 'station' | 'logicFlow' | 'ship-build'
  mode?: 'default' | 'import'
}>()

const emit = defineEmits(['close', 'confirm-primary', 'confirm-secondary'])
const logicFlowStore = useLogicFlowStore()
const empireStore = useEmpireStore()
const shipBuildStore = useShipBuildStore()
const { t } = useI18n()

const isSaveAsExpanded = ref(false)
const inputName = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

const defaultNameKey = computed(() => {
  if (props.storeType === 'ship-build') return 'shipBuild.default_blueprint_name'
  if (props.storeType === 'logicFlow') return 'menu.default_flow_name'
  return 'empire.new_empire_name'
})

watch(() => props.isOpen, (val) => {
  if (val) {
    isSaveAsExpanded.value = false
    if (props.initialName) {
      inputName.value = props.initialName
    } else if (props.intent === 'SAVE_AS') {
      const baseName = props.storeType === 'logicFlow' 
        ? (logicFlowStore.savedPlans.activeId ? logicFlowStore.savedPlans.list.find((l: LogicFlowPlan) => l.id === logicFlowStore.savedPlans.activeId)?.name : '')
        : empireStore.activeEmpire?.name
      inputName.value = baseName ? `${baseName} ${t('menu.copy_suffix')}` : t(defaultNameKey.value)
    } else {
      inputName.value = t(defaultNameKey.value)
    }

    if (showInput.value) {
      nextTick(() => inputRef.value?.select())
    }
  }
})

const isNewPlan = computed(() => {
  if (props.storeType === 'ship-build') {
    return !shipBuildStore.blueprint
  }
  if (props.storeType === 'logicFlow') {
    return !logicFlowStore.savedPlans.activeId
  }
  return !empireStore.activeEmpire
})

const currentPlanName = computed(() => {
  if (props.storeType === 'ship-build') {
    return shipBuildStore.blueprint?.name || ''
  }
  if (props.storeType === 'logicFlow') {
    if (logicFlowStore.savedPlans.activeId) {
      return logicFlowStore.savedPlans.list.find((l: LogicFlowPlan) => l.id === logicFlowStore.savedPlans.activeId)?.name || ''
    }
    return ''
  }
  return empireStore.activeEmpire?.name || ''
})

const dialogTitle = computed(() => {
  if (props.mode === 'import') {
    return t('logicFlowImport.empire_confirm_title')
  }
  if (props.intent === 'SAVE_AS') {
    return t('menu.dialog_title_save_as')
  }
  if (isNewPlan.value) {
    return t('menu.dialog_title_save_new_plan')
  } else {
    return t('menu.dialog_title_save_changes')
  }
})

const dialogMessage = computed(() => {
  if (props.mode === 'import') {
    return t('logicFlowImport.empire_confirm_message')
  }
  if (props.intent === 'SAVE_AS') return null

  if (!isNewPlan.value) {
    return t('menu.dialog_msg_save_changes_to', { name: currentPlanName.value })
  }
  return t('menu.dialog_msg_unsaved_new_plan')
})

const showInput = computed(() => {
  if (props.mode === 'import') return false
  if (props.intent === 'SAVE_AS') return true
  if (props.intent === 'NEW' && isNewPlan.value) return true
  if (props.intent === 'NEW' && !isNewPlan.value && isSaveAsExpanded.value) return true
  return false
})

const handlePrimaryAction = () => {
  if (props.mode === 'import') {
    emit('confirm-primary')
    emit('close')
    return
  }

  const nameToSave = showInput.value ? inputName.value : currentPlanName.value

  if (!nameToSave.trim()) return

  if (props.storeType === 'ship-build') {
    if (props.intent === 'SAVE_AS' || isNewPlan.value) {
      shipBuildStore.saveAsBlueprint(nameToSave)
    } else {
      shipBuildStore.saveBlueprint()
    }
    emit('close')
    return
  }

  if (props.storeType === 'logicFlow') {
    if (isNewPlan.value || showInput.value) {
      const originalId = logicFlowStore.savedPlans.activeId
      if (showInput.value) {
        logicFlowStore.savedPlans.activeId = null
      }
      try {
        logicFlowStore.saveCurrentPlan(nameToSave)
      } catch (e) {
        logicFlowStore.savedPlans.activeId = originalId
      }
    } else {
      logicFlowStore.saveCurrentPlan(nameToSave)
    }

    if (props.intent === 'NEW') {
      logicFlowStore.clearAll()
    }
  } else {
    if (props.intent === 'SAVE_AS') {
      if (empireStore.activeEmpire) {
        const newEmpire = JSON.parse(JSON.stringify(empireStore.activeEmpire))
        newEmpire.id = crypto.randomUUID()
        newEmpire.name = nameToSave
        newEmpire.stations.forEach((s: any) => { s.id = crypto.randomUUID() })
        
        empireStore.activeEmpire = newEmpire
        empireStore.saveEmpire()
      }
    } else if (props.intent === 'NEW') {
      if (empireStore.activeEmpire) {
        empireStore.updateEmpireName(nameToSave)
        empireStore.saveEmpire()
      }
      empireStore.createEmpire(t('menu.default_empire_name'))
    }
  }

  emit('close')
}

const handleDiscard = () => {
  if (props.mode === 'import') {
    emit('confirm-secondary')
    emit('close')
    return
  }

  if (props.storeType === 'logicFlow') {
    logicFlowStore.clearAll()
  } else {
    empireStore.createEmpire(t('menu.default_empire_name'))
  }
  emit('close')
}

</script>

<template>
  <div v-if="isOpen"
    class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
    <div
      class="w-full max-w-md bg-slate-800 border border-slate-600 rounded-lg shadow-2xl flex flex-col overflow-hidden transition-all duration-300">

      <div class="flex justify-between items-center px-6 py-4 border-b border-slate-700 bg-slate-900/30">
        <div class="flex items-center gap-3">
          <svg v-if="intent === 'NEW'" class="w-6 h-6 text-amber-400" xmlns="http://www.w3.org/2000/svg" fill="none"
            viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <svg v-else class="w-6 h-6 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
            stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          </svg>
          <h3 class="text-lg font-bold text-white tracking-wide">
            {{ dialogTitle }}
          </h3>
        </div>

        <button @click="$emit('close')"
          class="text-slate-400 hover:text-white transition p-1 hover:bg-slate-700 rounded">
          <svg class="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="p-6">
        <p v-if="dialogMessage" class="text-slate-300 mb-4 leading-relaxed white-space-pre">
          {{ dialogMessage }}
        </p>

        <div v-if="showInput" class="animate-expand mb-4">
          <label class="block text-xs font-bold text-slate-400 uppercase mb-2 ml-1">
            {{ t('menu.label_layout_name') }}
          </label>
          <input ref="inputRef" v-model="inputName" @keyup.enter="handlePrimaryAction" type="text"
            class="dialog-input w-full bg-slate-900 border border-slate-600 text-white rounded px-4 py-2 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition placeholder-slate-600"
            :placeholder="t('menu.placeholder_enter_name')" />
        </div>

        <div v-if="mode !== 'import' && intent === 'NEW' && !isNewPlan" class="flex items-center gap-2">
          <input type="checkbox" id="saveAsCopy" v-model="isSaveAsExpanded"
            class="w-4 h-4 accent-cyan-500 cursor-pointer" />
          <label for="saveAsCopy" class="text-sm text-slate-300 cursor-pointer select-none">
            {{ t('menu.btn_save_as_copy') }}
          </label>
        </div>
      </div>

      <div class="px-6 py-4 bg-slate-900/20 border-t border-slate-700 flex justify-end gap-3">
        <button v-if="intent === 'NEW' || mode === 'import'" @click="handleDiscard"
          class="btn-base bg-red-600 hover:bg-red-500 shadow-red-900/20">
          <span v-if="mode === 'import'">{{ t('logicFlowImport.empire_action_discard_import') }}</span>
          <span v-else>{{ t('menu.btn_discard_and_new') }}</span>
        </button>

        <button @click="handlePrimaryAction" class="btn-base bg-cyan-600 hover:bg-cyan-500 shadow-cyan-900/20">
          <span v-if="mode === 'import'">
            {{ t('logicFlowImport.empire_action_save_import') }}
          </span>
          <span v-else-if="intent === 'NEW'">
            {{ (showInput || isNewPlan) ? t('menu.btn_save_new_and_create') : t('menu.btn_overwrite_and_create') }}
          </span>
          <span v-else>
            {{ t('menu.btn_save') }}
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
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

.animate-expand {
  animation: expand 0.2s ease-out;
}

@keyframes expand {
  from {
    opacity: 0;
    transform: translateY(5px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.btn-base {
  @apply px-4 py-2 rounded text-sm font-bold text-white shadow-lg transition whitespace-nowrap;
}

.white-space-pre {
  white-space: pre-line;
}
</style>

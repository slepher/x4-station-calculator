<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useX4I18n } from '@/utils/UseX4I18n'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const { t } = useI18n()
const gameData = useGameDataStore()
const { translateDlc } = useX4I18n()

const draftActiveDlcs = ref<string[]>([])
const draftEnforceDlcActivation = ref(false)

const availableDlcs = computed(() => gameData.availableDlcs)

watch(() => props.visible, (visible) => {
  if (!visible) return
  draftActiveDlcs.value = [...gameData.activeDlcs]
  draftEnforceDlcActivation.value = gameData.enforceDlcActivation
}, { immediate: true })

function handleBackdropClick(event: MouseEvent) {
  if (event.target === event.currentTarget) {
    emit('close')
  }
}

function handleToggleDlc(id: string, checked: boolean) {
  if (checked) {
    if (!draftActiveDlcs.value.includes(id)) {
      draftActiveDlcs.value = [...draftActiveDlcs.value, id]
    }
    return
  }
  draftActiveDlcs.value = draftActiveDlcs.value.filter(item => item !== id)
}

function handleSelectAll() {
  draftActiveDlcs.value = availableDlcs.value.map(dlc => dlc.id)
}

function handleClearAll() {
  draftActiveDlcs.value = []
}

function handleSave() {
  gameData.saveDlcSetting({
    activeDlcs: draftActiveDlcs.value,
    enforceDlcActivation: draftEnforceDlcActivation.value
  })
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="modal-backdrop"
      data-testid="dlc-settings-modal-backdrop"
      @click="handleBackdropClick"
    >
      <div class="modal-content" data-testid="dlc-settings-modal">
        <div class="modal-header">
          <h3 class="modal-title">{{ t('settings.dlc.title') }}</h3>
          <button
            type="button"
            class="modal-close"
            data-testid="dlc-settings-close"
            @click="emit('close')"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div class="modal-body">
          <div class="action-row">
            <button
              type="button"
              class="text-action"
              data-testid="dlc-settings-select-all"
              @click="handleSelectAll"
            >
              {{ t('settings.dlc.selectAll') }}
            </button>
            <button
              type="button"
              class="text-action"
              data-testid="dlc-settings-clear-all"
              @click="handleClearAll"
            >
              {{ t('settings.dlc.clearAll') }}
            </button>
          </div>

          <div class="dlc-list" data-testid="dlc-settings-list">
            <label
              v-for="dlc in availableDlcs"
              :key="dlc.id"
              class="dlc-item"
              :data-testid="`dlc-settings-item-${dlc.id}`"
            >
              <input
                :checked="draftActiveDlcs.includes(dlc.id)"
                type="checkbox"
                @change="handleToggleDlc(dlc.id, ($event.target as HTMLInputElement).checked)"
              >
              <span class="dlc-label">{{ translateDlc(dlc) }}</span>
              <span class="dlc-meta">{{ t('settings.dlc.requiredVersion', { version: dlc.dependencyVersion }) }}</span>
            </label>
          </div>

          <label class="dlc-item strategy-toggle" data-testid="dlc-settings-enforce-toggle">
            <input v-model="draftEnforceDlcActivation" type="checkbox">
            <span class="strategy-copy">
              <span class="strategy-title">{{ t('settings.dlc.enforceTitle') }}</span>
              <span class="strategy-hint">{{ t('settings.dlc.enforceHint') }}</span>
            </span>
          </label>
        </div>

        <div class="modal-footer">
          <button
            type="button"
            class="footer-btn footer-btn-cancel"
            data-testid="dlc-settings-cancel"
            @click="emit('close')"
          >
            {{ t('common.cancel') }}
          </button>
          <button
            type="button"
            class="footer-btn footer-btn-save"
            data-testid="dlc-settings-save"
            @click="handleSave"
          >
            {{ t('common.save') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-backdrop {
  @apply fixed inset-0 z-[1200] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center px-4;
}

.modal-content {
  @apply w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden;
}

.modal-header {
  @apply flex items-center justify-between px-6 py-4 border-b border-slate-800;
}

.modal-title {
  @apply text-lg font-semibold text-slate-100;
}

.modal-close {
  @apply inline-flex items-center justify-center rounded-md p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200;
}

.modal-body {
  @apply px-6 py-5 space-y-4;
}

.action-row {
  @apply flex items-center gap-4;
}

.text-action {
  @apply text-sm font-medium text-cyan-300 transition-colors hover:text-cyan-200;
}

.dlc-list {
  @apply rounded-xl border border-slate-800 bg-slate-950/60 divide-y divide-slate-800;
}

.dlc-item {
  @apply flex items-center justify-between gap-3 px-4 py-3 text-sm text-slate-200;
}

.dlc-label {
  @apply flex-1;
}

.dlc-meta {
  @apply text-xs text-slate-500;
}

.dlc-item input {
  @apply mr-1;
}

.strategy-toggle input {
  @apply mr-1;
}

.strategy-toggle {
  @apply rounded-xl border border-slate-800 bg-slate-950/40;
}

.strategy-title {
  @apply block font-medium text-slate-100;
}

.strategy-copy {
  @apply flex-1;
}

.strategy-hint {
  @apply mt-1 block text-xs leading-5 text-slate-400;
}

.modal-footer {
  @apply flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800 bg-slate-950/40;
}

.footer-btn {
  @apply rounded-lg px-4 py-2 text-sm font-medium transition-colors;
}

.footer-btn-cancel {
  @apply bg-slate-800 text-slate-200 hover:bg-slate-700;
}

.footer-btn-save {
  @apply bg-cyan-500 text-slate-950 hover:bg-cyan-400;
}
</style>

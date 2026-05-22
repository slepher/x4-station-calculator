<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSaveStore } from '@/store/useSaveStore'
import { useSaveBindingStore } from '@/store/useSaveBindingStore'
import { useActiveViewStore } from '@/store/useActiveViewStore'
import type { ArchiveGroup } from '@/types/saveArchive'

const { t } = useI18n()
const saveStore = useSaveStore()
const saveBindingStore = useSaveBindingStore()
const activeViewStore = useActiveViewStore()

const sortedGroups = computed<ArchiveGroup[]>(() => {
  return [...saveStore.archiveGroups].sort((a, b) => {
    return a.playerName.localeCompare(b.playerName)
  })
})

const bindingPlans = computed(() => saveBindingStore.bindings)

const showDeleteConfirm = ref(false)
const deleteTarget = ref<{ guid: string; time: number; filename: string } | null>(null)

function formatTime(time: number): string {
  const hours = Math.floor(time / 3600)
  const minutes = Math.floor((time % 3600) / 60)
  return `${hours}h ${minutes}m`
}

async function selectArchive(guid: string, time: number) {
  await saveStore.selectArchive(guid, time)
}

function requestRemoveArchive(guid: string, time: number, filename: string) {
  deleteTarget.value = { guid, time, filename }
  showDeleteConfirm.value = true
}

function executeDelete() {
  if (!deleteTarget.value) return
  saveStore.removeArchive(deleteTarget.value.guid, deleteTarget.value.time)
  showDeleteConfirm.value = false
  deleteTarget.value = null
}

function cancelDelete() {
  showDeleteConfirm.value = false
  deleteTarget.value = null
}

function isSelected(guid: string, time: number): boolean {
  return saveStore.selectedArchive?.meta.guid === guid && saveStore.selectedArchive?.meta.time === time
}

function getBindingPlan(guid: string) {
  return bindingPlans.value.find((plan) => plan.gameGuid === guid) || null
}

function getLatestTime(group: ArchiveGroup): number | null {
  return group.saves.find((s) => s.isValid)?.meta.time ?? null
}

function isGuidLevelBinding(group: ArchiveGroup): boolean {
  const plan = getBindingPlan(group.guid)
  return Boolean(plan) && (plan?.selectedArchiveTime === null || plan?.selectedArchiveTime === undefined)
}

function isTimeLevelBinding(group: ArchiveGroup, time: number): boolean {
  const plan = getBindingPlan(group.guid)
  return plan?.selectedArchiveTime === time
}

function shouldShowBindActive(group: ArchiveGroup, time: number): boolean {
  return isTimeLevelBinding(group, time) || (isGuidLevelBinding(group) && getLatestTime(group) === time)
}

async function bindArchive(guid: string, time: number | null) {
  saveBindingStore.createOrOpenBinding(guid, time)

  const group = sortedGroups.value.find((g) => g.guid === guid)
  const effectiveTime = time ?? group?.saves.find((s) => s.isValid)?.meta.time ?? null

  if (time === null) {
    await saveStore.selectArchiveGroup(guid)
  } else if (effectiveTime !== null) {
    await saveStore.selectArchive(guid, effectiveTime)
  }

  activeViewStore.isSavePanelOpen = true
  activeViewStore.mapSavePanelLayer = 'binding-sector'
  activeViewStore.mapBindingGameGuid = guid
  activeViewStore.setActiveView('maps')
}
</script>

<template>
  <div class="save-list">
    <div v-if="sortedGroups.length === 0" class="empty-hint">
      {{ t('save_import.no_archives') }}
    </div>
    
    <div v-else class="archive-groups">
      <div v-for="group in sortedGroups" :key="group.guid" class="archive-group" :class="{ 'archive-group--bound': isGuidLevelBinding(group) }">
        <div class="group-header">
          <span class="player-name">{{ group.playerName }}</span>
          <div class="group-actions">
            <button
              class="action-btn bind-btn"
              :class="{ 'bind-btn--active': isGuidLevelBinding(group) }"
              :title="t('map.save_archive_bind')"
              @click.stop="bindArchive(group.guid, null)"
            >
              <svg class="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.5 13.5L13.5 10.5" />
                <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.25 15.75a3.182 3.182 0 0 1-4.5 0 3.182 3.182 0 0 1 0-4.5l3-3a3.182 3.182 0 0 1 4.5 0" />
                <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.75 8.25a3.182 3.182 0 0 1 4.5 0 3.182 3.182 0 0 1 0 4.5l-3 3a3.182 3.182 0 0 1-4.5 0" />
              </svg>
            </button>
            <button class="action-btn invisible pointer-events-none">
              <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" />
            </button>
          </div>
        </div>

        <div class="save-items">
          <div
            v-for="archive in group.saves"
            :key="archive.meta.time"
            class="save-item"
            :class="{ 'save-item-selected': isSelected(group.guid, archive.meta.time) }"
            @click="selectArchive(group.guid, archive.meta.time)"
          >
            <div class="save-info">
              <div class="save-time">{{ formatTime(archive.meta.time) }}</div>
              <div class="save-meta">
                <span v-if="!archive.isValid" class="invalid-warning">
                  {{ t('save_import.invalid_archive') }}
                </span>
                <span v-if="!archive.isCompatible" class="version-warning">
                  {{ t('save_import.version_mismatch') }}
                </span>
                <span class="save-filename">{{ archive.meta.filename }}</span>
              </div>
            </div>

            <div class="save-actions">
              <button
                v-if="archive.isValid"
                class="action-btn bind-btn"
                :class="{ 'bind-btn--active': shouldShowBindActive(group, archive.meta.time) }"
                :title="t('map.save_archive_bind')"
                @click.stop="bindArchive(group.guid, archive.meta.time)"
              >
                <svg class="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M10.5 13.5L13.5 10.5" />
                  <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M8.25 15.75a3.182 3.182 0 0 1-4.5 0 3.182 3.182 0 0 1 0-4.5l3-3a3.182 3.182 0 0 1 4.5 0" />
                  <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M15.75 8.25a3.182 3.182 0 0 1 4.5 0 3.182 3.182 0 0 1 0 4.5l-3 3a3.182 3.182 0 0 1-4.5 0" />
                </svg>
              </button>
              <button
                class="action-btn remove-btn"
                :title="t('save_import.remove_archive')"
                @click.stop="requestRemoveArchive(group.guid, archive.meta.time, archive.meta.filename)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <Transition name="fade">
      <div v-if="showDeleteConfirm" class="modal-backdrop" @click="cancelDelete">
        <div class="modal-card" @click.stop>
          <div class="modal-header">
            <span class="text-amber-400 text-lg">⚠️</span>
            <h3>{{ t('sector.confirm_delete') }}</h3>
          </div>
          <p class="text-slate-400 text-sm mb-6 ml-1">
            {{ t('save_import.confirm_remove', { filename: deleteTarget?.filename || '' }) }}
          </p>
          <div class="flex justify-end gap-3">
            <button class="btn-cancel" @click="cancelDelete">{{ t('ui.cancel') }}</button>
            <button class="btn-danger" @click="executeDelete">{{ t('ui.delete') }}</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.save-list {
  @apply flex flex-col gap-2;
}

.empty-hint {
  @apply text-sm text-slate-500 text-center py-4;
}

.archive-groups {
  @apply flex flex-col gap-3;
}

.archive-group {
  @apply flex flex-col gap-1 rounded border border-slate-700/40 p-2;
}

.archive-group--bound {
  @apply border-blue-400/30 bg-blue-500/5;
}

.group-header {
  @apply flex items-center justify-between px-2 py-1 text-xs;
}

.group-header--bound {
  @apply bg-amber-500/5 border-l-2 border-amber-500/30;
}

.player-name {
  @apply font-semibold text-slate-300;
}

.group-actions {
  @apply flex items-center gap-1;
}

.save-items {
  @apply flex flex-col gap-1;
}

.save-item {
  @apply flex items-center justify-between rounded border border-slate-700/30 bg-slate-800/30 p-2 cursor-pointer hover:border-slate-600/40 hover:bg-slate-800/50 transition-colors;
}

.save-item-selected {
  @apply bg-blue-600/20 border border-blue-500/30;
}

.save-info {
  @apply flex flex-col gap-0.5;
}

.save-time {
  @apply text-sm text-slate-200;
}

.save-meta {
  @apply flex items-center gap-2 text-xs;
}

.version-warning {
  @apply text-amber-400;
}

.invalid-warning {
  @apply text-red-400;
}

.save-version {
  @apply text-slate-500;
}

.save-actions {
  @apply flex items-center gap-1;
}

.action-btn {
  @apply p-1 rounded transition-colors;
}

.bind-btn {
  @apply text-amber-200/35 hover:text-amber-50 hover:bg-amber-500/10;
}

.bind-btn--active {
  @apply text-amber-100;
}

.remove-btn {
  @apply text-slate-400 hover:text-red-400 hover:bg-red-500/10;
}

.modal-backdrop {
  @apply fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm;
}
.modal-card {
  @apply bg-slate-800 border border-slate-600 rounded-xl p-5 shadow-2xl max-w-sm w-full;
}
.modal-header {
  @apply flex items-center gap-2 mb-2 font-bold text-slate-200;
}

.btn-cancel {
  @apply px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors;
}
.btn-danger {
  @apply px-4 py-1.5 text-xs font-bold bg-red-600 text-white rounded hover:bg-red-500 shadow-lg shadow-red-900/20 transition-all;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSaveStore } from '@/store/useSaveStore'
import type { ArchiveGroup } from '@/types/saveArchive'

const { t } = useI18n()
const saveStore = useSaveStore()

const sortedGroups = computed<ArchiveGroup[]>(() => {
  return [...saveStore.archiveGroups].sort((a, b) => {
    return a.playerName.localeCompare(b.playerName)
  })
})

function formatTime(time: number): string {
  const hours = Math.floor(time / 3600)
  const minutes = Math.floor((time % 3600) / 60)
  return `${hours}h ${minutes}m`
}

async function selectArchive(guid: string, time: number) {
  await saveStore.selectArchive(guid, time)
}

async function downloadArchive(guid: string, time: number) {
  await saveStore.exportToJson(guid, time)
}

function removeArchive(guid: string, time: number) {
  saveStore.removeArchive(guid, time)
}

function isSelected(guid: string, time: number): boolean {
  return saveStore.selectedArchive?.meta.guid === guid && saveStore.selectedArchive?.meta.time === time
}
</script>

<template>
  <div class="save-list">
    <div v-if="sortedGroups.length === 0" class="empty-hint">
      {{ t('save_import.no_archives') }}
    </div>
    
    <div v-else class="archive-groups">
      <div v-for="group in sortedGroups" :key="group.guid" class="archive-group">
        <div class="group-header">
          <span class="player-name">{{ group.playerName }}</span>
          <span class="archive-count">{{ group.saves.length }} {{ t('save_import.saves') }}</span>
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
                <span v-if="!archive.isCompatible" class="version-warning">
                  {{ t('save_import.version_mismatch') }}
                </span>
                <span class="save-filename">{{ archive.meta.filename }}</span>
              </div>
            </div>

            <div class="save-actions">
              <button
                class="action-btn download-btn"
                :title="t('save_import.download_json')"
                @click.stop="downloadArchive(group.guid, archive.meta.time)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
              <button
                class="action-btn remove-btn"
                :title="t('save_import.remove_archive')"
                @click.stop="removeArchive(group.guid, archive.meta.time)"
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
  @apply flex flex-col gap-1;
}

.group-header {
  @apply flex items-center justify-between px-2 py-1 text-xs;
}

.player-name {
  @apply font-semibold text-slate-300;
}

.archive-count {
  @apply text-slate-500;
}

.save-items {
  @apply flex flex-col gap-1;
}

.save-item {
  @apply flex items-center justify-between p-2 rounded cursor-pointer bg-slate-800/30 hover:bg-slate-800/50 transition-colors;
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

.save-version {
  @apply text-slate-500;
}

.save-actions {
  @apply flex items-center gap-1;
}

.action-btn {
  @apply p-1 rounded transition-colors;
}

.download-btn {
  @apply text-slate-400 hover:text-blue-400 hover:bg-blue-500/10;
}

.remove-btn {
  @apply text-slate-400 hover:text-red-400 hover:bg-red-500/10;
}
</style>
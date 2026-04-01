<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSaveStore } from '@/store/useSaveStore'
import SaveUploadPanel from '@/components/save/SaveUploadPanel.vue'
import type { ArchiveGroup } from '@/types/saveArchive'

const emit = defineEmits<{
  (e: 'select', payload: { guid: string; time: number }): void
}>()

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

function onArchiveClick(group: ArchiveGroup, time: number) {
  emit('select', { guid: group.guid, time })
}
</script>

<template>
  <div class="save-archive-list">
    <SaveUploadPanel @upload-complete="() => {}" />

    <div class="archive-stats">
      {{ saveStore.totalArchiveCount }} {{ t('map.save_archives_loaded') }}
    </div>

    <div v-if="sortedGroups.length === 0" class="empty-hint">
      {{ t('map.save_no_archives') }}
    </div>

    <div v-else class="archive-groups">
      <div v-for="group in sortedGroups" :key="group.guid" class="archive-group">
        <div class="group-header">
          <span class="player-name">{{ group.playerName }}</span>
          <span class="archive-count">{{ group.saves.length }} {{ t('map.save_saves') }}</span>
        </div>

        <div class="save-items">
          <div
            v-for="archive in group.saves"
            :key="archive.meta.time"
            class="save-item"
            @click="onArchiveClick(group, archive.meta.time)"
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
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.save-archive-list {
  @apply flex flex-col gap-3;
}

.archive-stats {
  @apply text-sm text-amber-100/60;
}

.empty-hint {
  @apply text-sm text-amber-100/50 text-center py-4;
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
  @apply font-semibold text-amber-50;
}

.archive-count {
  @apply text-amber-100/55;
}

.save-items {
  @apply flex flex-col gap-1;
}

.save-item {
  @apply flex items-center justify-between p-2 rounded cursor-pointer bg-black/45 border border-amber-300/15 hover:bg-amber-200/5 hover:border-amber-200/45 transition-colors;
}

.save-info {
  @apply flex flex-col gap-0.5;
}

.save-time {
  @apply text-sm text-amber-50;
}

.save-meta {
  @apply flex items-center gap-2 text-xs;
}

.version-warning {
  @apply text-amber-400;
}

.save-filename {
  @apply text-amber-100/55 truncate;
}
</style>

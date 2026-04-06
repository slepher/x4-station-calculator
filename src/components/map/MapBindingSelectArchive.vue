<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSaveStore } from '@/store/useSaveStore'
import { useEmpireStore } from '@/store/useEmpireStore'

const emit = defineEmits<{
  (e: 'select', payload: { gameGuid: string; time: number | null }): void
}>()

const { t } = useI18n()
const saveStore = useSaveStore()
const empireStore = useEmpireStore()

const bindingPlans = computed(() => empireStore.activeEmpire?.saveBindings || [])

const sortedArchiveGroups = computed(() => {
  return [...saveStore.archiveGroups].sort((a, b) => {
    return a.playerName.localeCompare(b.playerName)
  })
})

function formatTime(time: number): string {
  const hours = Math.floor(time / 3600)
  const minutes = Math.floor((time % 3600) / 60)
  return `${hours}h ${minutes}m`
}

function hasExistingBinding(gameGuid: string): boolean {
  return bindingPlans.value.some((p) => p.gameGuid === gameGuid)
}

function getExistingBindingPlan(gameGuid: string) {
  return bindingPlans.value.find((p) => p.gameGuid === gameGuid) || null
}

function selectOrCreateBinding(gameGuid: string, time: number | null) {
  emit('select', { gameGuid, time })
}
</script>

<template>
  <div class="binding-select-archive">
    <div v-if="sortedArchiveGroups.length === 0" class="map-binding-panel__empty">
      {{ t('map.binding_no_saves') }}
    </div>

    <div v-else class="archive-groups">
      <div
        v-for="group in sortedArchiveGroups"
        :key="group.guid"
        class="archive-group"
      >
        <button
          class="archive-group-header"
          type="button"
          @click="selectOrCreateBinding(group.guid, null)"
        >
          <span class="player-name">{{ group.playerName }}</span>
          <span class="archive-count">{{ group.saves.length }} {{ t('map.binding_station_count', { count: group.saves.length }) }}</span>
          <span v-if="hasExistingBinding(group.guid)" class="bound-badge">{{ t('map.binding_sector_bound') }}</span>
        </button>

        <div class="archive-items">
          <button
            v-for="archive in group.saves"
            :key="archive.meta.time"
            class="archive-item"
            :class="{ 'archive-item--bound': getExistingBindingPlan(group.guid)?.selectedArchiveTime === archive.meta.time }"
            type="button"
            @click="selectOrCreateBinding(group.guid, archive.meta.time)"
          >
            <div class="archive-info">
              <div class="archive-time">{{ formatTime(archive.meta.time) }}</div>
              <div class="archive-meta">{{ archive.meta.filename }}</div>
            </div>
            <span v-if="getExistingBindingPlan(group.guid)?.selectedArchiveTime === archive.meta.time" class="bound-tag">
              {{ t('map.binding_sector_bound') }}
            </span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.binding-select-archive {
  @apply flex flex-col gap-2;
}

.archive-groups {
  @apply flex flex-col gap-2;
}

.archive-group {
  @apply flex flex-col gap-1;
}

.archive-group-header {
  @apply flex items-center gap-2 rounded-lg border border-amber-300/20 bg-amber-200/5 px-3 py-2 text-left transition-colors hover:border-amber-200/40 hover:bg-amber-200/10;
}

.player-name {
  @apply flex-1 text-sm font-medium text-amber-50;
}

.archive-count {
  @apply text-xs text-amber-100/60;
}

.bound-badge {
  @apply rounded-full bg-amber-200/20 px-2 py-0.5 text-xs text-amber-100;
}

.archive-items {
  @apply ml-4 flex flex-col gap-1;
}

.archive-item {
  @apply flex items-center justify-between gap-2 rounded border border-amber-300/15 bg-black/30 px-3 py-2 text-left transition-colors hover:border-amber-200/30 hover:bg-amber-200/5;
}

.archive-item--bound {
  @apply border-amber-200/40 bg-amber-200/10;
}

.archive-info {
  @apply flex flex-col gap-0.5;
}

.archive-time {
  @apply text-sm text-amber-50;
}

.archive-meta {
  @apply text-xs text-amber-100/50;
}

.bound-tag {
  @apply rounded bg-amber-200/20 px-2 py-0.5 text-xs text-amber-100;
}
</style>
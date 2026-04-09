<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSaveStore } from '@/store/useSaveStore'
import { useEmpireStore } from '@/store/useEmpireStore'

const props = defineProps<{
  previewGameGuid: string | null
  previewTime: number | null
}>()

const emit = defineEmits<{
  (e: 'preview', payload: { gameGuid: string; time: number }): void
  (e: 'bind', payload: { gameGuid: string; time: number | null }): void
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

function getLatestArchiveTime(gameGuid: string): number | null {
  const group = sortedArchiveGroups.value.find((item) => item.guid === gameGuid)
  return group?.saves[0]?.meta.time ?? null
}

function isPreviewed(gameGuid: string, time: number): boolean {
  return props.previewGameGuid === gameGuid && props.previewTime === time
}

function isTitleBoundToLatest(gameGuid: string): boolean {
  const plan = getExistingBindingPlan(gameGuid)
  return Boolean(plan) && (plan?.selectedArchiveTime === null || plan?.selectedArchiveTime === undefined)
}

function isTitleBoundToSpecificTime(gameGuid: string): boolean {
  const plan = getExistingBindingPlan(gameGuid)
  return Boolean(plan) && plan?.selectedArchiveTime !== null && plan?.selectedArchiveTime !== undefined
}

function isTimeBoundToSpecificTime(gameGuid: string, time: number): boolean {
  const plan = getExistingBindingPlan(gameGuid)
  return plan?.selectedArchiveTime === time
}

function isLatestTimeMirroringTitleBinding(gameGuid: string, time: number): boolean {
  return isTitleBoundToLatest(gameGuid) && getLatestArchiveTime(gameGuid) === time
}

function previewArchive(gameGuid: string, time: number) {
  emit('preview', { gameGuid, time })
}

function bindArchive(gameGuid: string, time: number | null) {
  emit('bind', { gameGuid, time })
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
        <div
          class="archive-group-header"
        >
          <span class="player-name">{{ group.playerName }}</span>
          <span class="archive-count">{{ group.saves.length }} {{ t('map.binding_station_count', { count: group.saves.length }) }}</span>
          <span
            v-if="hasExistingBinding(group.guid)"
            data-testid="binding-archive-title-bound"
            class="bound-badge"
            :class="{
              'bound-badge--solid': isTitleBoundToLatest(group.guid),
              'bound-badge--dashed': isTitleBoundToSpecificTime(group.guid)
            }"
          >
            {{ t('map.binding_sector_bound') }}
          </span>
          <button
            class="archive-bind-action"
            data-testid="binding-archive-bind-latest"
            type="button"
            @click.stop="bindArchive(group.guid, null)"
          >
            {{ t('map.binding_bind') }}
          </button>
        </div>

        <div class="archive-items">
          <div
            v-for="archive in group.saves"
            :key="archive.meta.time"
            class="archive-item"
            :class="{
              'archive-item--preview': isPreviewed(group.guid, archive.meta.time),
              'archive-item--bound': isTimeBoundToSpecificTime(group.guid, archive.meta.time)
            }"
            data-testid="binding-archive-time"
            role="button"
            tabindex="0"
            @click="previewArchive(group.guid, archive.meta.time)"
          >
            <div class="archive-info">
              <div class="archive-time">{{ formatTime(archive.meta.time) }}</div>
              <div class="archive-meta">{{ archive.meta.filename }}</div>
            </div>
            <span
              v-if="isTimeBoundToSpecificTime(group.guid, archive.meta.time) || isLatestTimeMirroringTitleBinding(group.guid, archive.meta.time)"
              data-testid="binding-archive-time-bound"
              class="bound-tag"
              :class="{
                'bound-tag--solid': isTimeBoundToSpecificTime(group.guid, archive.meta.time),
                'bound-tag--dashed': isLatestTimeMirroringTitleBinding(group.guid, archive.meta.time)
              }"
            >
              {{ t('map.binding_sector_bound') }}
            </span>
            <button
              class="archive-bind-action archive-bind-action--item"
              data-testid="binding-archive-bind-time"
              type="button"
              @click.stop="bindArchive(group.guid, archive.meta.time)"
            >
              {{ t('map.binding_bind') }}
            </button>
          </div>
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
  @apply rounded-full border border-amber-300/35 bg-amber-200/20 px-2 py-0.5 text-xs text-amber-100;
}

.bound-badge--solid {
  @apply border-solid;
}

.bound-badge--dashed {
  @apply border-dashed;
}

.archive-items {
  @apply ml-4 flex flex-col gap-1;
}

.archive-item {
  @apply flex items-center justify-between gap-2 rounded border border-amber-300/15 bg-black/30 px-3 py-2 text-left transition-colors hover:border-amber-200/30 hover:bg-amber-200/5;
  position: relative;
}

.archive-item--bound {
  @apply border-amber-200/40 bg-amber-200/10;
}

.archive-item--preview {
  @apply border-amber-200/45 bg-amber-200/10;
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
  @apply rounded border border-amber-300/35 bg-amber-200/20 px-2 py-0.5 text-xs text-amber-100;
}

.bound-tag--solid {
  @apply border-solid;
}

.bound-tag--dashed {
  @apply border-dashed;
}

.archive-bind-action {
  @apply rounded border border-amber-300/30 bg-black/40 px-2 py-1 text-xs text-amber-100 opacity-0 transition-opacity duration-150 hover:border-amber-200/50 hover:text-amber-50;
}

.archive-group-header:hover .archive-bind-action,
.archive-item:hover .archive-bind-action {
  @apply opacity-100;
}

.archive-bind-action--item {
  @apply shrink-0;
}
</style>

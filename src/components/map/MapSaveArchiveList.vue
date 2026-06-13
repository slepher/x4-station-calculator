<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSaveStore } from '@/store/useSaveStore'
import { useSaveBindingStore } from '@/store/useSaveBindingStore'
import SaveUploadPanel from '@/components/save/SaveUploadPanel.vue'
import type { ArchiveGroup } from '@/types/saveArchive'

const emit = defineEmits<{
  (e: 'select', payload: { guid: string; time: number } | null): void
  (e: 'select-group', payload: { guid: string }): void
  (e: 'navigate', payload: { guid: string; time: number | null }): void
  (e: 'bind', payload: { guid: string; time: number | null }): void
}>()

const { t } = useI18n()
const saveStore = useSaveStore()
const saveBindingStore = useSaveBindingStore()

const sortedGroups = computed<ArchiveGroup[]>(() => {
  return [...saveStore.archiveGroups].sort((a, b) => a.playerName.localeCompare(b.playerName))
})

const activeArchiveId = computed(() => saveStore.savedArchivesState.activeArchiveId)
const bindingPlans = computed(() => saveBindingStore.bindings)

function createArchiveId(guid: string, time: number): string {
  return `${guid}_${time}`
}

function formatTime(time: number): string {
  const hours = Math.floor(time / 3600)
  const minutes = Math.floor((time % 3600) / 60)
  return `${hours}h ${minutes}m`
}

function getLatestTime(group: ArchiveGroup): number | null {
  return group.saves.find((s) => s.isValid)?.meta.time ?? null
}

function getBindingPlan(guid: string) {
  return bindingPlans.value.find((plan) => plan.gameGuid === guid) || null
}

function canSelectArchive(valid: boolean): boolean {
  return valid
}

function isGuidLevelActive(group: ArchiveGroup): boolean {
  return activeArchiveId.value === group.guid
}

function isTimeLevelActive(group: ArchiveGroup, time: number): boolean {
  return activeArchiveId.value === createArchiveId(group.guid, time)
}

function isLatestTimeMirroringGuidActive(group: ArchiveGroup, time: number): boolean {
  return isGuidLevelActive(group) && getLatestTime(group) === time
}

function isGuidLevelBinding(group: ArchiveGroup): boolean {
  const plan = getBindingPlan(group.guid)
  return Boolean(plan) && (plan?.selectedArchiveTime === null || plan?.selectedArchiveTime === undefined)
}

function isTimeLevelBinding(group: ArchiveGroup, time: number): boolean {
  const plan = getBindingPlan(group.guid)
  return plan?.selectedArchiveTime === time
}

function shouldShowGroupPoiActive(group: ArchiveGroup): boolean {
  return isGuidLevelActive(group)
}

function shouldShowGroupBindActive(group: ArchiveGroup): boolean {
  return isGuidLevelBinding(group)
}

function shouldShowTimePoiActive(group: ArchiveGroup, time: number): boolean {
  return isTimeLevelActive(group, time) || isLatestTimeMirroringGuidActive(group, time)
}

function shouldShowTimeBindActive(group: ArchiveGroup, time: number): boolean {
  return isTimeLevelBinding(group, time) || (isGuidLevelBinding(group) && getLatestTime(group) === time)
}

function onDefaultMapClick() {
  emit('select', null)
}

function onArchiveClick(group: ArchiveGroup, time: number) {
  const archive = group.saves.find((item) => item.meta.time === time)
  if (!archive || !archive.isValid) return
  emit('select', { guid: group.guid, time })
}

function onArchiveNavigate(group: ArchiveGroup, time: number | null) {
  if (time === null) {
    emit('navigate', { guid: group.guid, time: null })
    return
  }

  const archive = group.saves.find((item) => item.meta.time === time)
  if (!archive || !archive.isValid) return
  emit('navigate', { guid: group.guid, time })
}

function onArchiveBind(group: ArchiveGroup, time: number | null) {
  emit('bind', { guid: group.guid, time })
}

function onGroupTitleClick(group: ArchiveGroup) {
  emit('select-group', { guid: group.guid })
}
</script>

<template>
  <div class="save-archive-list">
    <SaveUploadPanel @upload-complete="() => {}" />

    <div class="archive-stats">
      {{ saveStore.totalArchiveCount }} {{ t('map.save_archives_loaded') }}
    </div>

    <div class="archive-groups">
      <div
        class="save-item default-map-item"
        :class="{ 'save-item-active': !activeArchiveId }"
        @click="onDefaultMapClick"
      >
        <div class="save-info">
          <div class="save-time">{{ t('map.save_default_map') }}</div>
          <div class="save-meta">
            <span class="save-filename">{{ t('map.save_default_map_hint') }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="sortedGroups.length === 0" class="empty-hint">
      {{ t('map.save_no_archives') }}
    </div>

    <div v-else class="archive-groups">
      <div
        v-for="group in sortedGroups"
        :key="group.guid"
        class="archive-group"
        :class="{
          'archive-group--active': shouldShowGroupPoiActive(group)
        }"
        :data-testid="shouldShowGroupPoiActive(group) ? 'save-group-active' : 'save-group'"
        role="button"
        tabindex="0"
        @click="onGroupTitleClick(group)"
      >
        <div
          class="group-header"
          data-testid="save-group-header"
        >
          <div
            class="group-header-main"
            data-testid="save-group-title"
          >
            <span class="player-name">{{ group.playerName }}</span>
            <span class="archive-count">{{ group.saves.length }} {{ t('map.save_saves') }}</span>
          </div>
          <div class="group-actions">
            <button
              class="save-icon-action"
              :class="{ 'save-icon-action--active': shouldShowGroupPoiActive(group) }"
              :data-testid="shouldShowGroupPoiActive(group) ? 'save-group-poi-active' : 'save-group-poi'"
              type="button"
              :aria-label="`${group.playerName} poi`"
              :title="t('map.save_archive_open_poi')"
              @click.stop="onArchiveNavigate(group, null)"
            >
              <svg class="save-icon-svg" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 6.5L9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20V6.5Z" />
                <path d="M9 4v13.5" />
                <path d="M15 6.5V20" />
              </svg>
            </button>
            <button
              class="save-icon-action"
              :class="{ 'save-icon-action--active': shouldShowGroupBindActive(group) }"
              :data-testid="shouldShowGroupBindActive(group) ? 'save-group-bind-active' : 'save-group-bind'"
              type="button"
              :aria-label="`${group.playerName} bind`"
              :title="t('save_import.bind_to_latest_save')"
              @click.stop="onArchiveBind(group, null)"
            >
              <svg class="save-icon-svg" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M10.5 13.5L13.5 10.5" />
                <path d="M8.25 15.75a3.182 3.182 0 0 1-4.5 0 3.182 3.182 0 0 1 0-4.5l3-3a3.182 3.182 0 0 1 4.5 0" />
                <path d="M15.75 8.25a3.182 3.182 0 0 1 4.5 0 3.182 3.182 0 0 1 0 4.5l-3 3a3.182 3.182 0 0 1-4.5 0" />
              </svg>
            </button>
          </div>
        </div>

        <div class="save-items" @click.stop>
          <div
            v-for="archive in group.saves"
            :key="archive.meta.time"
            class="save-item"
            :class="{
              'save-item-disabled': !canSelectArchive(archive.isValid),
              'save-item-active': activeArchiveId === createArchiveId(group.guid, archive.meta.time) || isLatestTimeMirroringGuidActive(group, archive.meta.time)
            }"
            :title="!archive.isValid ? t('map.save_invalid_archive_hint') : undefined"
          >
            <div class="save-info" @click="onArchiveClick(group, archive.meta.time)">
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

            <div v-if="canSelectArchive(archive.isValid)" class="save-item-actions">
              <button
                class="save-icon-action"
                :class="{ 'save-icon-action--active': shouldShowTimePoiActive(group, archive.meta.time) }"
                :data-testid="shouldShowTimePoiActive(group, archive.meta.time) ? 'save-time-poi-active' : 'save-time-poi'"
                type="button"
                :aria-label="`${formatTime(archive.meta.time)} poi`"
                :title="t('map.save_archive_open_poi')"
                @click.stop="onArchiveNavigate(group, archive.meta.time)"
              >
                <svg class="save-icon-svg" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 6.5L9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20V6.5Z" />
                  <path d="M9 4v13.5" />
                  <path d="M15 6.5V20" />
                </svg>
              </button>
              <button
                class="save-icon-action"
                :class="{ 'save-icon-action--active': shouldShowTimeBindActive(group, archive.meta.time) }"
                :data-testid="shouldShowTimeBindActive(group, archive.meta.time) ? 'save-time-bind-active' : 'save-time-bind'"
                type="button"
                :aria-label="`${formatTime(archive.meta.time)} bind`"
              :title="t('save_import.bind_to_specific_save')"
              @click.stop="onArchiveBind(group, archive.meta.time)"
              >
                <svg class="save-icon-svg" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M10.5 13.5L13.5 10.5" />
                  <path d="M8.25 15.75a3.182 3.182 0 0 1-4.5 0 3.182 3.182 0 0 1 0-4.5l3-3a3.182 3.182 0 0 1 4.5 0" />
                  <path d="M15.75 8.25a3.182 3.182 0 0 1 4.5 0 3.182 3.182 0 0 1 0 4.5l-3 3a3.182 3.182 0 0 1-4.5 0" />
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
.save-archive-list {
  @apply flex flex-col gap-3;
}

.archive-stats {
  @apply text-sm text-amber-100/60;
}

.empty-hint {
  @apply py-4 text-center text-sm text-amber-100/50;
}

.archive-groups {
  @apply flex flex-col gap-3;
}

.archive-group {
  @apply flex flex-col gap-1 rounded border border-amber-300/10 bg-amber-200/5 p-2;
}

.archive-group--active {
  @apply border-amber-400/25 bg-amber-500/10;
}

.group-header {
  @apply flex items-center justify-between px-2 py-1 text-xs transition-colors;
}

.group-header-main {
  @apply flex items-center gap-2;
}

.group-actions {
  @apply flex items-center gap-1;
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
  @apply flex cursor-pointer items-center justify-between rounded border border-amber-300/15 bg-black/45 p-2 transition-colors hover:border-amber-200/45 hover:bg-amber-200/5;
}

.save-item-active {
  @apply border-amber-400/60 bg-amber-500/15;
}

.save-item-active:hover {
  @apply border-amber-400/60 bg-amber-500/15;
}

.save-item-disabled {
  @apply cursor-not-allowed opacity-60;
}

.save-item-disabled:hover {
  @apply border-amber-300/15 bg-black/45;
}

.default-map-item {
  @apply mb-2;
}

.save-info {
  @apply flex flex-1 cursor-pointer flex-col gap-0.5;
}

.save-item-actions {
  @apply flex items-center gap-1;
}

.save-icon-action {
  @apply inline-flex h-7 w-7 items-center justify-center rounded text-sm text-amber-200/45 opacity-0 transition-all duration-150 hover:text-amber-50;
}

.save-icon-svg {
  @apply h-4 w-4 fill-none stroke-current;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.75;
}

.group-header:hover .save-icon-action,
.save-item:hover .save-icon-action {
  @apply opacity-100;
}

.save-icon-action--active {
  @apply text-amber-100 opacity-100;
}

.save-icon-action--active:hover {
  @apply text-amber-100 opacity-100;
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

.invalid-warning {
  @apply text-red-400;
}

.save-filename {
  @apply truncate text-amber-100/55;
}
</style>

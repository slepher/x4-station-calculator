<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SaveArchive, SectorData } from '@/types/saveArchive'

const props = defineProps<{
  archive: SaveArchive | null
}>()

const { t } = useI18n()

const sortedSectors = computed(() => {
  if (!props.archive) return []

  return Object.entries(props.archive.sectors)
    .map(([macro, data]) => ({ macro, ...data }))
    .sort((a, b) => a.name.localeCompare(b.name))
})

function formatCoord(value: number): string {
  return (value / 1000).toFixed(1) + 'km'
}

function countItems(sector: SectorData): number {
  return sector.stations.length + sector.datavaults.length + sector.erlkingVaults.length + sector.abandonedShips.length
}
</script>

<template>
  <div class="save-detail-panel">
    <div v-if="!archive" class="empty-state">
      <svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <span class="empty-text">{{ t('save_import.select_archive_hint') }}</span>
    </div>

    <div v-else class="detail-content">
      <div class="detail-header">
        <div class="meta-info">
          <span class="player-name">{{ archive.meta.playerName }}</span>
          <span v-if="!archive.isCompatible" class="version-badge warning">
            {{ t('save_import.version_mismatch') }} ({{ archive.meta.version }})
          </span>
          <span v-else class="version-badge">
            v{{ archive.meta.version }}
          </span>
        </div>
      </div>

      <div class="sector-list">
        <div v-for="sector in sortedSectors" :key="sector.macro" class="sector-item">
          <div class="sector-header">
            <span class="sector-name">{{ sector.name }}</span>
            <span class="sector-count">{{ countItems(sector) }}</span>
          </div>

          <div class="sector-content">
            <div v-if="sector.stations.length > 0" class="item-group">
              <div class="group-title">{{ t('save_import.stations') }} ({{ sector.stations.length }})</div>
              <div class="item-list">
                <div v-for="station in sector.stations" :key="station.code" class="item-row">
                  <span class="item-owner">{{ station.owner || 'neutral' }}</span>
                  <span class="item-coords">({{ formatCoord(station.x) }}, {{ formatCoord(station.z) }})</span>
                  <span v-if="station.is_wreck" class="item-tag wreck">{{ t('save_import.wreck') }}</span>
                  <span v-if="station.is_headquarter" class="item-tag hq">HQ</span>
                </div>
              </div>
            </div>

            <div v-if="sector.datavaults.length > 0" class="item-group">
              <div class="group-title">{{ t('save_import.datavaults') }} ({{ sector.datavaults.length }})</div>
              <div class="item-list">
                <div v-for="vault in sector.datavaults" :key="vault.code" class="item-row">
                  <span class="item-owner">{{ vault.owner || 'neutral' }}</span>
                  <span class="item-coords">({{ formatCoord(vault.x) }}, {{ formatCoord(vault.z) }})</span>
                </div>
              </div>
            </div>

            <div v-if="sector.erlkingVaults.length > 0" class="item-group">
              <div class="group-title">{{ t('save_import.erlking_vaults') }} ({{ sector.erlkingVaults.length }})</div>
              <div class="item-list">
                <div v-for="vault in sector.erlkingVaults" :key="vault.code" class="item-row">
                  <span class="item-owner">{{ vault.owner || 'neutral' }}</span>
                  <span class="item-coords">({{ formatCoord(vault.x) }}, {{ formatCoord(vault.z) }})</span>
                </div>
              </div>
            </div>

            <div v-if="sector.abandonedShips.length > 0" class="item-group">
              <div class="group-title">{{ t('save_import.abandoned_ships') }} ({{ sector.abandonedShips.length }})</div>
              <div class="item-list">
                <div v-for="ship in sector.abandonedShips" :key="ship.code" class="item-row">
                  <span class="item-class">{{ ship.class }}</span>
                  <span class="item-coords">({{ formatCoord(ship.x) }}, {{ formatCoord(ship.z) }})</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.save-detail-panel {
  @apply flex flex-col h-full bg-slate-900/50 rounded-lg border border-slate-700;
}

.empty-state {
  @apply flex flex-col items-center justify-center gap-3 h-full py-12;
}

.empty-text {
  @apply text-sm text-slate-500;
}

.detail-content {
  @apply flex flex-col h-full overflow-hidden;
}

.detail-header {
  @apply p-3 border-b border-slate-700;
}

.meta-info {
  @apply flex items-center gap-2;
}

.player-name {
  @apply font-semibold text-slate-200;
}

.version-badge {
  @apply px-2 py-0.5 text-xs rounded bg-slate-700 text-slate-400;
}

.version-badge.warning {
  @apply bg-amber-500/20 text-amber-400;
}

.sector-list {
  @apply flex-1 overflow-y-auto p-2;
}

.sector-item {
  @apply mb-2 rounded bg-slate-800/30;
}

.sector-header {
  @apply flex items-center justify-between px-3 py-2 bg-slate-800/50 rounded-t;
}

.sector-name {
  @apply text-sm font-medium text-slate-300;
}

.sector-count {
  @apply px-1.5 py-0.5 text-xs rounded bg-slate-700 text-slate-400;
}

.sector-content {
  @apply p-2;
}

.item-group {
  @apply mb-2;
}

.group-title {
  @apply text-xs text-slate-500 mb-1;
}

.item-list {
  @apply flex flex-col gap-1;
}

.item-row {
  @apply flex items-center gap-2 text-xs py-1 px-2 rounded hover:bg-slate-700/30;
}

.item-owner {
  @apply text-blue-400;
}

.item-class {
  @apply text-purple-400;
}

.item-coords {
  @apply text-slate-500;
}

.item-tag {
  @apply px-1.5 py-0.5 text-xs rounded;
}

.item-tag.wreck {
  @apply bg-red-500/20 text-red-400;
}

.item-tag.hq {
  @apply bg-emerald-500/20 text-emerald-400;
}
</style>
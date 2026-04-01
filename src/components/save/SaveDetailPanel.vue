<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import ViewTabUI from '@/components/common/ViewTabUI.vue'
import { useSaveStore } from '@/store/useSaveStore'
import type { SaveArchive, SavePoiCategory, StationEntry, DatavaultEntry, AbandonedShipEntry } from '@/types/saveArchive'

const props = defineProps<{
  archive: SaveArchive | null
}>()

const { t } = useI18n()
const saveStore = useSaveStore()
const activeTab = ref('player-stations')

const tabs = computed(() => [
  { key: 'player-stations', label: t('save_import.tab_player_stations') },
  { key: 'npc-stations', label: t('save_import.tab_npc_stations') },
  { key: 'abandoned-ships', label: t('save_import.tab_abandoned_ships') },
  { key: 'datavaults', label: t('save_import.tab_datavaults') },
  { key: 'erlking-vaults', label: t('save_import.tab_erlking_vaults') },
])

function formatCoord(value: number): string {
  return (value / 1000).toFixed(1) + 'km'
}

const categoryData = computed(() => saveStore.getArchivePoiCategories(props.archive))
const tabData = computed(() => ({
  'player-stations': categoryData.value.playerStation.groups,
  'npc-stations': categoryData.value.npcStation.groups,
  'abandoned-ships': categoryData.value.abandonedShip.groups,
  'datavaults': categoryData.value.datavault.groups,
  'erlking-vaults': categoryData.value.erlkingVault.groups,
}))

type TabKey = keyof typeof tabData.value
type CategoryKeyByTab = Record<TabKey, SavePoiCategory>
const categoryKeyByTab: CategoryKeyByTab = {
  'player-stations': 'playerStation',
  'npc-stations': 'npcStation',
  'abandoned-ships': 'abandonedShip',
  datavaults: 'datavault',
  'erlking-vaults': 'erlkingVault'
}

const currentTabData = computed(() => tabData.value[activeTab.value as TabKey] || [])
const hasData = computed(() => currentTabData.value.length > 0)
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
        <ViewTabUI
          v-model="activeTab"
          :views="tabs"
          ui-key="save-detail"
          color-style="sky"
        />
      </div>

      <div class="tab-content">
        <div v-if="!hasData" class="empty-tab">
          {{ t('save_import.empty_tab') }}
        </div>

        <div v-else class="sector-list">
          <div v-for="sector in currentTabData" :key="sector.sectorMacro" class="sector-group">
            <div class="sector-header">
              <span class="sector-name">{{ sector.sectorName }}</span>
              <span class="sector-count">{{ sector.items.length }}</span>
            </div>

            <div class="item-list">
              <template v-if="categoryKeyByTab[activeTab as TabKey] === 'playerStation'">
                <div v-for="item in sector.items" :key="(item as StationEntry).code" class="item-row">
                  <span class="item-code">{{ (item as StationEntry).code }}</span>
                  <span class="item-coords">({{ formatCoord((item as StationEntry).x) }}, {{ formatCoord((item as StationEntry).z) }})</span>
                  <span v-if="(item as StationEntry).is_headquarter" class="item-tag hq">{{ t('save_import.hq_badge') }}</span>
                </div>
              </template>

              <template v-if="categoryKeyByTab[activeTab as TabKey] === 'npcStation'">
                <div v-for="item in sector.items" :key="(item as StationEntry).code" class="item-row">
                  <span class="item-owner">{{ (item as StationEntry).owner || 'neutral' }}</span>
                  <span class="item-coords">({{ formatCoord((item as StationEntry).x) }}, {{ formatCoord((item as StationEntry).z) }})</span>
                </div>
              </template>

              <template v-if="categoryKeyByTab[activeTab as TabKey] === 'abandonedShip'">
                <div v-for="item in sector.items" :key="(item as AbandonedShipEntry).code" class="item-row">
                  <span class="item-class">{{ (item as AbandonedShipEntry).class }}</span>
                  <span class="item-coords">({{ formatCoord((item as AbandonedShipEntry).x) }}, {{ formatCoord((item as AbandonedShipEntry).z) }})</span>
                </div>
              </template>

              <template v-if="categoryKeyByTab[activeTab as TabKey] === 'datavault' || categoryKeyByTab[activeTab as TabKey] === 'erlkingVault'">
                <div v-for="item in sector.items" :key="(item as DatavaultEntry).code" class="item-row">
                  <span class="item-coords">({{ formatCoord((item as DatavaultEntry).x) }}, {{ formatCoord((item as DatavaultEntry).z) }})</span>
                  <div class="item-marks">
                    <span v-if="(item as DatavaultEntry).has_blueprints" class="mark-badge">{{ t('save_import.has_blueprints') }}</span>
                    <span v-if="(item as DatavaultEntry).has_wares" class="mark-badge">{{ t('save_import.has_wares') }}</span>
                    <span v-if="(item as DatavaultEntry).has_signalleak" class="mark-badge">{{ t('save_import.has_signalleak') }}</span>
                  </div>
                </div>
              </template>
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
  @apply flex items-center justify-between p-3 border-b border-slate-700 gap-2;
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

.tab-content {
  @apply flex-1 overflow-y-auto p-2;
}

.empty-tab {
  @apply text-sm text-slate-500 text-center py-4;
}

.sector-list {
  @apply flex flex-col gap-2;
}

.sector-group {
  @apply rounded bg-slate-800/30;
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

.item-list {
  @apply p-2 flex flex-col gap-1;
}

.item-row {
  @apply flex items-center gap-2 text-xs py-1 px-2 rounded hover:bg-slate-700/30;
}

.item-code {
  @apply text-slate-300;
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

.item-tag.hq {
  @apply bg-emerald-500/20 text-emerald-400;
}

.item-marks {
  @apply flex items-center gap-1;
}

.mark-badge {
  @apply px-1.5 py-0.5 text-xs rounded bg-sky-500/20 text-sky-400;
}
</style>

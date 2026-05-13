<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import ViewTabUI from '@/components/common/ViewTabUI.vue'
import type {
  SaveArchive,
  PlayerStationEntry,
  NpcStationEntry,
  FactionStationEntry,
  DatavaultEntry,
  AbandonedShipEntry,
  CodeMap
} from '@/types/saveArchive'

const props = defineProps<{
  archive: SaveArchive | null
}>()

const { t } = useI18n()
const activeTab = ref('player-stations')

const tabs = computed(() => [
  { key: 'player-stations', label: t('save_import.tab_player_stations') },
  { key: 'xenon-stations', label: t('save_import.tab_xenon_stations') },
  { key: 'khaak-stations', label: t('save_import.tab_khaak_stations') },
  { key: 'npc-stations', label: t('save_import.tab_npc_stations') },
  { key: 'abandoned-ships', label: t('save_import.tab_abandoned_ships') },
  { key: 'datavaults', label: t('save_import.tab_datavaults') },
  { key: 'erlking-vaults', label: t('save_import.tab_erlking_vaults') },
])

function formatCoord(value: number): string {
  return (value / 1000).toFixed(1) + 'km'
}

function recordValues<T>(record: CodeMap<T> | undefined): T[] {
  return record ? Object.values(record) : []
}

type DetailTabKey =
  | 'player-stations'
  | 'xenon-stations'
  | 'khaak-stations'
  | 'npc-stations'
  | 'abandoned-ships'
  | 'datavaults'
  | 'erlking-vaults'

type DetailSectorGroup<T> = {
  sectorMacro: string
  sectorName: string
  sectorOwner?: string
  items: T[]
}

function buildSectorGroups<T>(extractor: (sector: NonNullable<SaveArchive['sectors'][string]>) => T[]): DetailSectorGroup<T>[] {
  const sectors = props.archive?.sectors || {}
  return Object.entries(sectors)
    .map(([sectorMacro, sector]) => ({
      sectorMacro,
      sectorName: sector.name,
      sectorOwner: sector.owner,
      items: extractor(sector)
    }))
    .filter((group) => group.items.length > 0)
}

const tabData = computed<Record<DetailTabKey, DetailSectorGroup<unknown>[]>>(() => ({
  'player-stations': buildSectorGroups((sector) => recordValues(sector.player_stations)),
  'xenon-stations': buildSectorGroups((sector) => recordValues(sector.xenon_stations)),
  'khaak-stations': buildSectorGroups((sector) => recordValues(sector.khaak_stations)),
  'npc-stations': buildSectorGroups((sector) => recordValues(sector.npc_stations)),
  'abandoned-ships': buildSectorGroups((sector) => recordValues(sector.abandoned_ships)),
  'datavaults': buildSectorGroups((sector) => recordValues(sector.datavaults)),
  'erlking-vaults': buildSectorGroups((sector) => recordValues(sector.erlking_vaults))
}))

const currentTabData = computed(() => tabData.value[activeTab.value as DetailTabKey] || [])
const hasData = computed(() => currentTabData.value.length > 0)

function formatWares(wares: DatavaultEntry['wares'] | undefined): string {
  if (!wares || wares.length === 0) return ''
  return wares.map((entry) => `${entry.ware} x${entry.amount}`).join(', ')
}

function formatNpcModules(modules: NpcStationEntry['modules'] | undefined): string {
  const values = modules ? Object.values(modules) : []
  if (values.length === 0) return ''
  return values.map((entry) => `${entry.ref} x${entry.amount}`).join(', ')
}

function formatStationFlags(item: NpcStationEntry | FactionStationEntry): string {
  const flags = [
    item.isShipyard ? t('save_import.station_flag_shipyard') : '',
    item.isWharf ? t('save_import.station_flag_wharf') : '',
    item.isEquipmentdock ? t('save_import.station_flag_equipmentdock') : '',
    item.isTradestation ? t('save_import.station_flag_tradestation') : '',
    item.isNest ? t('save_import.station_flag_nest') : '',
    item.isHive ? t('save_import.station_flag_hive') : ''
  ].filter(Boolean)
  return flags.join(' · ')
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
          <span v-if="!archive.isValid" class="version-badge invalid">
            {{ t('save_import.invalid_archive') }}
          </span>
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
        <div v-if="!archive.isValid" class="invalid-note">
          {{ t('save_import.invalid_archive_detail') }}
        </div>
        <div v-if="!hasData" class="empty-tab">
          {{ t('save_import.empty_tab') }}
        </div>

        <div v-else class="sector-list">
          <div v-for="sector in currentTabData" :key="sector.sectorMacro" class="sector-group">
            <div class="sector-header">
              <div class="sector-heading">
                <span class="sector-name">{{ sector.sectorName }}</span>
                <span v-if="sector.sectorOwner" class="sector-owner">{{ sector.sectorOwner }}</span>
              </div>
              <span class="sector-count">{{ sector.items.length }}</span>
            </div>

            <div class="item-list">
              <template v-if="activeTab === 'player-stations'">
                <div v-for="item in sector.items" :key="(item as PlayerStationEntry).code" class="item-row">
                  <span class="item-code">{{ (item as PlayerStationEntry).code }}</span>
                  <span class="item-coords">({{ formatCoord((item as PlayerStationEntry).position.x) }}, {{ formatCoord((item as PlayerStationEntry).position.z) }})</span>
                  <span v-if="(item as PlayerStationEntry).is_headquarter" class="item-tag hq">{{ t('save_import.hq_badge') }}</span>
                </div>
              </template>

              <template v-if="activeTab === 'xenon-stations' || activeTab === 'khaak-stations'">
                <div v-for="item in sector.items" :key="(item as FactionStationEntry).code" class="item-row item-row-stacked">
                  <div class="item-primary">
                    <span class="item-owner">{{ (item as FactionStationEntry).owner || 'neutral' }}</span>
                    <span class="item-coords">({{ formatCoord((item as FactionStationEntry).position.x) }}, {{ formatCoord((item as FactionStationEntry).position.z) }})</span>
                  </div>
                  <span v-if="formatNpcModules((item as FactionStationEntry).modules)" class="item-secondary">{{ formatNpcModules((item as FactionStationEntry).modules) }}</span>
                  <span v-if="formatStationFlags(item as FactionStationEntry)" class="item-secondary">{{ formatStationFlags(item as FactionStationEntry) }}</span>
                </div>
              </template>

              <template v-if="activeTab === 'npc-stations'">
                <div v-for="item in sector.items" :key="(item as NpcStationEntry).code" class="item-row item-row-stacked">
                  <div class="item-primary">
                    <span class="item-owner">{{ (item as NpcStationEntry).owner || 'neutral' }}</span>
                    <span class="item-coords">({{ formatCoord((item as NpcStationEntry).position.x) }}, {{ formatCoord((item as NpcStationEntry).position.z) }})</span>
                  </div>
                  <span v-if="formatNpcModules((item as NpcStationEntry).modules)" class="item-secondary">{{ formatNpcModules((item as NpcStationEntry).modules) }}</span>
                  <span v-if="formatStationFlags(item as NpcStationEntry)" class="item-secondary">{{ formatStationFlags(item as NpcStationEntry) }}</span>
                </div>
              </template>

              <template v-if="activeTab === 'abandoned-ships'">
                <div v-for="item in sector.items" :key="(item as AbandonedShipEntry).code" class="item-row">
                  <span class="item-class">{{ (item as AbandonedShipEntry).class }}</span>
                  <span class="item-coords">({{ formatCoord((item as AbandonedShipEntry).position.x) }}, {{ formatCoord((item as AbandonedShipEntry).position.z) }})</span>
                </div>
              </template>

              <template v-if="activeTab === 'datavaults' || activeTab === 'erlking-vaults'">
                <div v-for="item in sector.items" :key="(item as DatavaultEntry).code" class="item-row item-row-stacked">
                  <div class="item-primary">
                    <span class="item-coords">({{ formatCoord((item as DatavaultEntry).position.x) }}, {{ formatCoord((item as DatavaultEntry).position.z) }})</span>
                    <span class="item-tag" :class="(item as DatavaultEntry).unlocked ? 'item-tag-unlocked' : 'item-tag-locked'">
                      {{ (item as DatavaultEntry).unlocked ? t('save_import.unlocked') : t('save_import.locked') }}
                    </span>
                  </div>
                  <div class="item-marks">
                    <span v-if="(item as DatavaultEntry).has_blueprints" class="mark-badge">{{ t('save_import.has_blueprints') }}</span>
                    <span v-if="(item as DatavaultEntry).has_wares" class="mark-badge">{{ t('save_import.has_wares') }}</span>
                    <span v-if="(item as DatavaultEntry).has_signalleak" class="mark-badge">{{ t('save_import.has_signalleak') }}</span>
                  </div>
                  <span v-if="formatWares((item as DatavaultEntry).wares)" class="item-secondary">{{ formatWares((item as DatavaultEntry).wares) }}</span>
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

.version-badge.invalid {
  @apply bg-red-500/20 text-red-300;
}

.tab-content {
  @apply flex-1 overflow-y-auto p-2;
}

.empty-tab {
  @apply text-sm text-slate-500 text-center py-4;
}

.invalid-note {
  @apply mb-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200;
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

.sector-heading {
  @apply flex items-center gap-2;
}

.sector-name {
  @apply text-sm font-medium text-slate-300;
}

.sector-owner {
  @apply text-xs text-slate-500 uppercase;
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

.item-row-stacked {
  @apply flex-col items-start;
}

.item-primary {
  @apply flex items-center gap-2;
}

.item-secondary {
  @apply text-[11px] text-slate-500 break-all;
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

.item-tag-unlocked {
  @apply bg-emerald-500/20 text-emerald-400;
}

.item-tag-locked {
  @apply bg-rose-500/20 text-rose-400;
}

.item-marks {
  @apply flex items-center gap-1;
}

.mark-badge {
  @apply px-1.5 py-0.5 text-xs rounded bg-sky-500/20 text-sky-400;
}
</style>

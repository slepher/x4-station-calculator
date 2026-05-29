<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useX4I18n } from '@/utils/UseX4I18n'
import type { ArchiveStationPosition } from '@/types/saveArchive'

const gameDataStore = useGameDataStore()
const { t, te } = useI18n()
const { translateWare } = useX4I18n()

const props = defineProps<{
  hqStationName: string
  stationCode: string
  sectorName: string
  sectorNameId?: string
  position?: ArchiveStationPosition
  sectorResources: string[]
  sectorSunlight: number
  singleBerthThroughput: number
  hasHqStation: boolean
}>()

const showSectorPopover = ref(false)
const showResourcesPopover = ref(false)

const displaySectorName = computed(() => {
  if (props.sectorNameId && te(props.sectorNameId)) {
    return t(props.sectorNameId)
  }
  return props.sectorName || '-'
})

const formatKm = (value: number): string => {
  const km = value / 1000
  if (Number.isInteger(km)) {
    return km.toString()
  }
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1
  }).format(km)
}

const positionKm = computed(() => {
  if (!props.position) return null
  const { x, y, z } = props.position
  return {
    x: formatKm(x),
    y: formatKm(y),
    z: formatKm(z)
  }
})

const getResourceName = (wareId: string): string => {
  const ware = gameDataStore.waresMap[wareId]
  if (ware) {
    return translateWare(ware)
  }
  return wareId
}

const formatThroughput = (n: number) => new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1
}).format(n)
</script>

<template>
  <div class="live-toolbar">
    <div class="toolbar-content w-full flex items-center h-full">

      <div class="toolbar-section">
        <div class="input-group">
          <label class="group-label">{{ t('toolbar.station_name') }}</label>
          <div class="readonly-pill">{{ props.hqStationName || '-' }}</div>
        </div>

        <div class="input-group ml-4">
          <label class="group-label">{{ t('toolbar.station_code') }}</label>
          <div class="readonly-pill">{{ props.stationCode || '-' }}</div>
        </div>
      </div>

      <div class="separator mx-6"></div>

      <div class="toolbar-section">
        <div class="relative">
          <div
            class="input-group cursor-pointer hover:text-sky-400 transition-colors"
            @click="showSectorPopover = !showSectorPopover"
          >
            <label class="group-label cursor-pointer">{{ t('toolbar.sector') }}</label>
            <div class="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded px-2 min-w-[80px] justify-center h-6">
              <span class="text-xs font-bold text-sky-400 truncate">{{ displaySectorName }}</span>
            </div>
          </div>

          <div v-if="showSectorPopover" class="sector-popover">
            <div class="popover-header">{{ displaySectorName }}</div>
            <div class="popover-content">
              <template v-if="positionKm">
                <div class="position-row">
                  <span class="text-xs text-slate-400">X</span>
                  <span class="text-xs font-mono text-sky-400 position-value">{{ positionKm.x }}</span>
                  <span class="text-xs text-slate-500">km</span>
                </div>
                <div class="position-row">
                  <span class="text-xs text-slate-400">Y</span>
                  <span class="text-xs font-mono text-sky-400 position-value">{{ positionKm.y }}</span>
                  <span class="text-xs text-slate-500">km</span>
                </div>
                <div class="position-row">
                  <span class="text-xs text-slate-400">Z</span>
                  <span class="text-xs font-mono text-sky-400 position-value">{{ positionKm.z }}</span>
                  <span class="text-xs text-slate-500">km</span>
                </div>
              </template>
              <div v-else class="text-xs text-slate-500 text-center py-2">
                {{ t('toolbar.no_position') }}
              </div>
            </div>
            <div class="fixed inset-0 z-[-1]" @click="showSectorPopover = false"></div>
          </div>
        </div>

        <div class="relative ml-6">
          <div
            class="input-group cursor-pointer hover:text-sky-400 transition-colors"
            @click="showResourcesPopover = !showResourcesPopover"
          >
            <label class="group-label cursor-pointer">{{ t('toolbar.sector_resources') }}</label>
            <div class="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded px-2 min-w-[60px] justify-center h-6">
              <span class="text-xs text-slate-500" v-if="props.sectorResources.length === 0">{{ t('toolbar.no_resources') }}</span>
              <template v-else>
                <span class="text-xs">💎</span>
                <span class="text-xs font-bold font-mono text-sky-400">{{ props.sectorResources.length }}</span>
              </template>
            </div>
          </div>

          <div v-if="showResourcesPopover" class="resources-popover">
            <div class="popover-header">{{ t('toolbar.sector_resources') }}</div>
            <div class="popover-content resources-list">
              <div class="resource-item" v-for="r in props.sectorResources" :key="r">
                <span class="text-xs text-slate-300">{{ getResourceName(r) }}</span>
              </div>
              <div v-if="props.sectorResources.length === 0" class="text-xs text-slate-500 text-center py-2">
                {{ t('toolbar.no_resources') }}
              </div>
            </div>
            <div class="fixed inset-0 z-[-1]" @click="showResourcesPopover = false"></div>
          </div>
        </div>

        <div class="input-group ml-6">
          <label class="group-label">{{ t('toolbar.sunlight_efficiency') }}</label>
          <div class="count-pill min-w-[60px] justify-end">
            <span class="text-xs font-mono font-bold text-sky-400">{{ props.sectorSunlight }}</span>
            <span class="text-[10px] text-slate-500 ml-1">%</span>
          </div>
        </div>

        <div class="input-group ml-6">
          <label class="group-label">{{ t('toolbar.single_berth_throughput') }}</label>
          <div class="count-pill min-w-[120px] justify-end">
            <span class="text-xs font-mono font-bold text-sky-400">{{ formatThroughput(props.singleBerthThroughput) }}</span>
            <span class="text-[10px] text-slate-500 ml-1">m³/h</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.live-toolbar {
  @apply w-full h-16 shrink-0 bg-slate-950 border-b border-slate-800 flex px-6 select-none relative z-10;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.toolbar-section {
  @apply flex items-center h-full;
}

.separator {
  @apply h-8 w-px bg-slate-800 mx-3;
}

.group-label {
  @apply text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1 whitespace-nowrap block leading-none;
}

.input-group {
  @apply flex flex-col justify-end h-10;
}

.readonly-pill {
  @apply flex items-center bg-slate-800/50 border border-slate-700 rounded px-2 h-6 text-xs text-slate-400 font-mono min-w-[80px] justify-center;
}

.count-pill {
  @apply flex items-center bg-slate-900 border border-slate-800 rounded px-2 h-7;
}

.sector-popover,
.resources-popover {
  @apply absolute top-full left-0 mt-1 z-50 bg-slate-800 border border-slate-600 rounded-lg shadow-xl min-w-[140px];
}
.popover-header {
  @apply px-3 py-2 text-[10px] font-bold text-slate-400 border-b border-slate-700 uppercase;
}
.popover-content {
  @apply p-1 max-h-48 overflow-y-auto;
}
.resources-list {
  @apply max-h-none overflow-visible;
}
.position-row {
  @apply flex items-center justify-between px-2 py-1.5 gap-2;
}
.position-value {
  @apply ml-2;
}
.resource-item {
  @apply px-2 py-1.5 text-xs text-slate-300;
}
</style>

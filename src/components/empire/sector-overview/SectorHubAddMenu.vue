<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { X4Map } from '@/types/x4'

interface SectorDisplayItem {
  sectorMacro: string
  sectorName: string
  rawSectorName: string
  clusterId: string
  clusterName: string
  hasPlayerStation: boolean
  isAnchor: boolean
}

const props = defineProps<{
  maps: X4Map | null | undefined
  playerSectorMacros: string[]
  existingAnchorSectorMacros: Set<string>
  stationCounts: Record<string, number>
  showMapButton?: boolean
}>()

const emit = defineEmits<{
  (e: 'add-hub', sectorMacro: string): void
  (e: 'close'): void
  (e: 'focus-sector', sectorMacro: string): void
}>()

const { t, te } = useI18n()

const searchQuery = ref('')

const normalizedQuery = computed(() => searchQuery.value.trim().toLowerCase())

function getSectorDisplayName(sectorMacro: string): string {
  if (!props.maps) return sectorMacro
  for (const cluster of Object.values(props.maps.clusters)) {
    for (const sectorId of cluster.sectors) {
      const sector = props.maps.sectors[sectorId]
      if (!sector) continue
      const macro = (sector.macro || sector.id).toLowerCase()
      if (macro === sectorMacro.toLowerCase()) {
        const nameId = (sector as any).nameId
        if (nameId && te(nameId)) return t(nameId)
        return (sector as any).name || sectorMacro
      }
    }
  }
  return sectorMacro
}

function getClusterDisplayName(clusterId: string): string {
  if (!props.maps) return clusterId
  const cluster = props.maps.clusters[clusterId]
  if (!cluster) return clusterId
  const nameId = (cluster as any).nameId
  if (nameId && te(nameId)) return t(nameId)
  return (cluster as any).name || clusterId
}

function getAllMapSectorMacros(): string[] {
  if (!props.maps) return []
  const macros: string[] = []
  for (const cluster of Object.values(props.maps.clusters)) {
    for (const sectorId of cluster.sectors) {
      const sector = props.maps.sectors[sectorId]
      if (!sector) continue
      macros.push((sector.macro || sector.id).toLowerCase())
    }
  }
  return macros
}

function findClusterId(sectorMacro: string): string | null {
  if (!props.maps) return null
  const normalizedMacro = sectorMacro.toLowerCase()
  for (const [clusterId, cluster] of Object.entries(props.maps.clusters)) {
    for (const sectorId of cluster.sectors) {
      const sector = props.maps.sectors[sectorId]
      if (!sector) continue
      const macro = ((sector.macro || sector.id)).toLowerCase()
      if (macro === normalizedMacro) return clusterId
    }
  }
  return null
}

const defaultItems = computed<SectorDisplayItem[]>(() => {
  return props.playerSectorMacros.map((sectorMacro) => {
    const clusterId = findClusterId(sectorMacro)
    return {
      sectorMacro,
      sectorName: getSectorDisplayName(sectorMacro),
      rawSectorName: sectorMacro,
      clusterId: clusterId ?? '',
      clusterName: clusterId ? getClusterDisplayName(clusterId) : '',
      hasPlayerStation: true,
      isAnchor: props.existingAnchorSectorMacros.has(sectorMacro)
    }
  })
})

const searchResultItems = computed<SectorDisplayItem[]>(() => {
  if (!normalizedQuery.value) return []
  const q = normalizedQuery.value
  const allMacros = getAllMapSectorMacros()
  const results: SectorDisplayItem[] = []

  for (const macro of allMacros) {
    const hasStation = (props.stationCounts[macro] ?? 0) > 0
    const name = getSectorDisplayName(macro)
    const clusterId = findClusterId(macro)
    const clusterName = clusterId ? getClusterDisplayName(clusterId) : ''
    if (
      name.toLowerCase().includes(q) ||
      macro.toLowerCase().includes(q) ||
      clusterName.toLowerCase().includes(q)
    ) {
      results.push({
        sectorMacro: macro,
        sectorName: name,
        rawSectorName: macro,
        clusterId: clusterId ?? '',
        clusterName,
        hasPlayerStation: hasStation,
        isAnchor: props.existingAnchorSectorMacros.has(macro)
      })
    }
  }
  return results
})

const displayedItems = computed<SectorDisplayItem[]>(() => {
  return normalizedQuery.value ? searchResultItems.value : defaultItems.value
})

interface ClusterGroup {
  clusterId: string
  clusterName: string
  sectors: SectorDisplayItem[]
}

const clusterGroups = computed<ClusterGroup[]>(() => {
  const groups = new Map<string, ClusterGroup>()
  for (const item of displayedItems.value) {
    const key = item.clusterId || '__unknown__'
    if (!groups.has(key)) {
      groups.set(key, {
        clusterId: item.clusterId,
        clusterName: item.clusterName,
        sectors: []
      })
    }
    groups.get(key)!.sectors.push(item)
  }
  return Array.from(groups.values())
})

function onAddHub(sectorMacro: string) {
  emit('add-hub', sectorMacro)
}

function onClose() {
  emit('close')
}

function onOverlayClick(e: MouseEvent) {
  if ((e.target as HTMLElement).classList.contains('hub-add-overlay')) {
    onClose()
  }
}
</script>

<template>
  <div class="hub-add-overlay" @click="onOverlayClick">
    <div class="hub-add-menu">
      <div class="hub-add-menu-header">
        <span class="hub-add-menu-title">{{ t('sector.add_hub') }}</span>
        <button class="hub-add-menu-close" type="button" @click="onClose">×</button>
      </div>
      <div class="hub-add-menu-search">
        <input
          v-model="searchQuery"
          class="hub-add-menu-search-input"
          type="text"
          name="hub-sector-search"
          :placeholder="t('map.save_coord_search_placeholder')"
        />
        <button
          v-if="searchQuery"
          class="hub-add-menu-search-clear"
          type="button"
          @click="searchQuery = ''"
        >
          ×
        </button>
      </div>

      <div v-if="searchQuery && displayedItems.length === 0" class="hub-add-menu-empty">
        {{ t('map.binding_no_unbound_sectors') }}
      </div>

      <div class="hub-add-menu-scroll">
        <div
          v-for="group in clusterGroups"
          :key="group.clusterId"
          class="hub-add-menu-group"
        >
          <div class="hub-add-menu-group-title">
            {{ group.clusterName || t('map.binding_visible_sector_candidates') }}
          </div>
          <button
            v-for="item in group.sectors"
            :key="item.sectorMacro"
            type="button"
            class="hub-add-menu-item"
            :class="{ 'opacity-50': item.isAnchor }"
          >
            <span class="hub-station-indicator" :class="item.hasPlayerStation ? 'text-emerald-400' : 'text-slate-600'">
              {{ item.hasPlayerStation ? '●' : '○' }}
            </span>
            <span class="sector-name">{{ item.sectorName }}</span>
            <span class="hub-add-menu-actions">
              <button
                v-if="!item.isAnchor"
                type="button"
                class="hub-add-menu-plus-btn"
                :title="t('map.binding_anchor_sector')"
                @click.stop="onAddHub(item.sectorMacro)"
              >
                +
              </button>
            </span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hub-add-overlay {
  @apply fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm;
}

.hub-add-menu {
  @apply flex flex-col w-96 max-h-[80vh] bg-slate-900 border border-slate-600/60 rounded-lg shadow-2xl;
}

.hub-add-menu-header {
  @apply flex items-center justify-between px-4 py-3 border-b border-slate-700/50;
}

.hub-add-menu-title {
  @apply text-sm font-semibold text-slate-200;
}

.hub-add-menu-close {
  @apply text-slate-400 hover:text-slate-200 text-lg leading-none px-1;
}

.hub-add-menu-search {
  @apply relative px-4 pt-3 pb-2;
}

.hub-add-menu-search-input {
  @apply w-full rounded border border-slate-600/50 bg-slate-800/50 px-3 py-1.5 text-sm text-slate-200 outline-none placeholder:text-slate-500;
}

.hub-add-menu-search-clear {
  @apply absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200;
}


.hub-add-menu-empty {
  @apply px-4 py-2 text-xs text-slate-500 text-center;
}

.hub-add-menu-scroll {
  @apply flex flex-col overflow-y-auto max-h-[400px] pb-2;
}

.hub-add-menu-group {
  @apply px-2;
}

.hub-add-menu-group-title {
  @apply px-2 py-1 text-xs font-semibold uppercase tracking-wider text-slate-400;
}

.hub-add-menu-item {
  @apply flex items-center gap-2 w-full rounded px-2 py-2 text-left text-sm text-slate-200 transition-colors hover:bg-slate-700/30;
}

.hub-station-indicator {
  @apply shrink-0 text-xs;
}

.sector-name {
  @apply truncate;
}


.hub-add-menu-actions {
  @apply ml-auto flex items-center gap-1 shrink-0;
}

.hub-add-menu-plus-btn {
  @apply flex items-center justify-center w-5 h-5 rounded text-xs font-bold text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10;
  background: none;
  border: 1px solid currentColor;
  cursor: pointer;
}
</style>

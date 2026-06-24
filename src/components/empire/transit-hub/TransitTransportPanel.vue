<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TransitTransportPanelState } from '@/components/empire/presenters/useTransitTransportPresenter'
import type { TransitRouteSegment } from '@/store/logic/transitRouteBuilder'

const props = defineProps<{
  panel: TransitTransportPanelState
}>()

const { t } = useI18n()
const expandedSectorGroups = ref<Set<string>>(new Set())
const expandedStationSectors = ref<Set<string>>(new Set())

const hasSectorGroups = computed(() => props.panel.sectorGroupRows.length > 0)
const hasStationGroups = computed(() => props.panel.stationSectorGroups.length > 0)
const hasProblems = computed(() => props.panel.problems.length > 0)

type RouteBlock = {
  sectorName: string
  items: Array<{
    key: string
    label: string
    distanceText: string | null
  }>
}

function toggleSectorGroup(id: string) {
  expandedSectorGroups.value = toggledSet(expandedSectorGroups.value, id)
}

function toggleStationSector(id: string) {
  expandedStationSectors.value = toggledSet(expandedStationSectors.value, id)
}

function toggledSet(source: Set<string>, id: string): Set<string> {
  const next = new Set(source)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  return next
}

function formatKm(value: number): string {
  if (value > 0 && value < 0.1) return '<0.1 km'
  return `${value.toFixed(1)} km`
}

function formatCoord(value: number): string {
  return `${value.toFixed(1)}`
}

function hasRouteDetails(segments: unknown[]): boolean {
  return segments.length > 0
}

function hasDistance(value: number): boolean {
  return value > 0
}

function hasGates(value: number): boolean {
  return value > 0
}

function sectorGroupTargetText(row: { targetSectorName: string; targetStationName: string }): string {
  if (row.targetStationName && row.targetStationName !== row.targetSectorName) {
    return `${row.targetStationName} · ${row.targetSectorName}`
  }
  return row.targetSectorName || row.targetStationName
}

function routeBlocks(segments: TransitRouteSegment[]): RouteBlock[] {
  const blocks: RouteBlock[] = []

  function ensureBlock(sectorName: string): RouteBlock {
    const last = blocks[blocks.length - 1]
    if (last?.sectorName === sectorName) return last
    const block = { sectorName, items: [] }
    blocks.push(block)
    return block
  }

  segments.forEach((segment, index) => {
    if (segment.kind === 'station-to-gate') {
      ensureBlock(segment.toLabel).items.push({
        key: `${index}:depart`,
        label: t('transit_transport.route_action.depart_to_gate'),
        distanceText: formatKm(segment.distanceKm)
      })
      return
    }

    if (segment.kind === 'gate-transit') {
      ensureBlock(segment.fromLabel).items.push({
        key: `${index}:jump`,
        label: t('transit_transport.route_action.jump_to', { sector: segment.toLabel }),
        distanceText: null
      })
      return
    }

    if (segment.kind === 'gate-to-gate') {
      ensureBlock(segment.fromLabel).items.push({
        key: `${index}:transfer`,
        label: t('transit_transport.route_action.in_sector_transfer'),
        distanceText: formatKm(segment.distanceKm)
      })
      return
    }

    if (segment.kind === 'superhighway') {
      ensureBlock(segment.fromLabel).items.push({
        key: `${index}:superhighway`,
        label: t('transit_transport.route_action.superhighway_to', { sector: segment.toLabel }),
        distanceText: formatKm(segment.distanceKm)
      })
      return
    }

    if (segment.kind === 'gate-to-station') {
      ensureBlock(segment.fromLabel).items.push({
        key: `${index}:arrive`,
        label: t('transit_transport.route_action.arrive_to_station'),
        distanceText: formatKm(segment.distanceKm)
      })
    }
  })

  return blocks
}
</script>

<template>
  <section class="transport-panel panel-card">
    <header class="panel-header">
      <h3>{{ t('transit_transport.title') }}</h3>
    </header>

    <div class="panel-content custom-scrollbar">
      <div v-if="panel.empty" class="empty-state">
        {{ t('transit_transport.empty') }}
      </div>

      <section class="transport-section">
        <h4>{{ t('transit_transport.sector_group') }}</h4>
        <div v-if="!hasSectorGroups" class="empty-line">{{ t('transit_transport.no_sector_groups') }}</div>
        <article
          v-for="row in panel.sectorGroupRows"
          :key="row.id"
          class="route-row"
        >
          <button class="route-summary" type="button" @click="toggleSectorGroup(row.id)">
            <span class="route-title">{{ row.groupName }}</span>
            <span class="route-meta route-target">{{ sectorGroupTargetText(row) }}</span>
            <span class="route-stat">{{ formatKm(row.summary.normalDistanceKm) }}</span>
            <span class="route-stat">{{ t('transit_transport.gates_value', { count: row.summary.gateCount }) }}</span>
          </button>
          <div v-if="expandedSectorGroups.has(row.id)" class="route-details">
            <div class="terminal-line">
              {{ t('transit_transport.terminal') }}: {{ row.terminal.label }}
            </div>
            <div
              v-for="block in routeBlocks(row.segments)"
              :key="`${row.id}:${block.sectorName}`"
              class="route-block"
            >
              <div class="route-sector">{{ block.sectorName }}</div>
              <div
                v-for="item in block.items"
                :key="item.key"
                class="route-action-row"
              >
                <span class="route-action-label">{{ item.label }}</span>
                <span class="route-action-distance">{{ item.distanceText || '' }}</span>
              </div>
            </div>
            <div v-if="row.summary.superhighwayDistanceKm > 0" class="terminal-line">
              {{ t('transit_transport.superhighway') }}: {{ formatKm(row.summary.superhighwayDistanceKm) }}
            </div>
          </div>
        </article>
      </section>

      <section class="transport-section">
        <h4>{{ t('transit_transport.station') }}</h4>
        <div v-if="!hasStationGroups" class="empty-line">{{ t('transit_transport.no_stations') }}</div>
        <article
          v-for="group in panel.stationSectorGroups"
          :key="group.id"
          class="sector-block"
        >
          <button
            class="route-summary"
            type="button"
            :class="{ 'not-expandable': !hasRouteDetails(group.segments) }"
            @click="hasRouteDetails(group.segments) && toggleStationSector(group.id)"
          >
            <span class="route-title">{{ group.sectorName }}</span>
            <span v-if="hasDistance(group.summary.normalDistanceKm)" class="route-stat">{{ formatKm(group.summary.normalDistanceKm) }}</span>
            <span v-if="hasGates(group.summary.gateCount)" class="route-stat">{{ t('transit_transport.gates_value', { count: group.summary.gateCount }) }}</span>
            <span class="route-meta">{{ group.stations.length }} {{ t('transit_transport.station_count') }}</span>
          </button>
          <div v-if="hasRouteDetails(group.segments) && expandedStationSectors.has(group.id)" class="route-details">
            <div
              v-for="block in routeBlocks(group.segments)"
              :key="`${group.id}:${block.sectorName}`"
              class="route-block"
            >
              <div class="route-sector">{{ block.sectorName }}</div>
              <div
                v-for="item in block.items"
                :key="item.key"
                class="route-action-row"
              >
                <span class="route-action-label">{{ item.label }}</span>
                <span class="route-action-distance">{{ item.distanceText || '' }}</span>
              </div>
            </div>
          </div>
          <div class="station-list">
            <div
              v-for="station in group.stations"
              :key="station.id"
              class="station-row"
            >
              <div class="station-main">
                <strong>{{ station.stationName }}</strong>
                <span>{{ station.stationCode }}</span>
              </div>
              <div class="station-metrics">
                <span>{{ t('transit_transport.station_coord') }}: {{ formatCoord(station.coordinateKm.x) }}, {{ formatCoord(station.coordinateKm.y) }}, {{ formatCoord(station.coordinateKm.z) }} km</span>
                <span>{{ t(hasRouteDetails(group.segments) ? 'transit_transport.terminal_distance' : 'transit_transport.station_to_station') }}: {{ formatKm(station.terminalDistanceKm) }}</span>
                <span>{{ t('transit_transport.total_normal_distance') }}: {{ formatKm(station.totalNormalDistanceKm) }}</span>
                <span>{{ t('transit_transport.production_lines') }}: {{ station.productionLineCount }}</span>
              </div>
            </div>
          </div>
        </article>
      </section>

      <section v-if="hasProblems" class="transport-section">
        <h4>{{ t('transit_transport.problems') }}</h4>
        <div
          v-for="problem in panel.problems"
          :key="problem.id"
          class="problem-row"
        >
          <div class="station-main">
            <strong>{{ problem.targetName }}</strong>
            <span>{{ t(`transit_transport.target_type.${problem.targetType}`) }} · {{ problem.sectorName }}</span>
          </div>
          <div class="problem-list">{{ problem.problems.join(', ') }}</div>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.transport-panel {
  @apply bg-slate-900/40 rounded-lg border border-slate-800 shadow-xl overflow-hidden;
}

.panel-header {
  @apply h-12 flex items-center px-4 text-slate-200 text-sm font-semibold border-b border-slate-700/50 bg-slate-800/30;
}

.panel-content {
  @apply p-3 flex flex-col gap-4 max-h-[calc(100vh-12rem)] overflow-y-auto;
}

.transport-section {
  @apply flex flex-col gap-2;
}

.transport-section h4 {
  @apply text-xs font-semibold uppercase text-slate-400 tracking-wide;
}

.route-row,
.sector-block,
.problem-row {
  @apply rounded-md border border-slate-800 bg-slate-950/30;
}

.route-summary {
  @apply w-full grid grid-cols-2 gap-2 items-center px-3 py-2 text-left text-xs text-slate-300 hover:bg-slate-800/50;
}

.route-summary.not-expandable {
  @apply cursor-default hover:bg-transparent;
}

.route-title {
  @apply col-span-2 text-sm font-semibold text-slate-100;
}

.route-meta {
  @apply text-slate-400 truncate;
}

.route-target {
  @apply col-span-2;
}

.route-stat {
  @apply text-sky-200 font-medium;
}

.route-details {
  @apply border-t border-slate-800 px-3 py-2 flex flex-col gap-1 bg-slate-950/40;
}

.route-block {
  @apply flex flex-col gap-1 py-1;
}

.route-sector {
  @apply text-xs font-semibold text-slate-200;
}

.route-action-row {
  @apply grid grid-cols-[minmax(0,1fr)_4.5rem] gap-2 pl-3 text-xs text-slate-400;
}

.route-action-label {
  @apply truncate;
}

.route-action-distance {
  @apply text-right text-slate-200;
}

.terminal-line,
.empty-line,
.empty-state,
.problem-list {
  @apply text-xs text-slate-400;
}

.empty-state {
  @apply rounded-md border border-slate-800 px-3 py-4 text-center;
}

.station-list {
  @apply flex flex-col divide-y divide-slate-800;
}

.station-row {
  @apply px-3 py-2 flex flex-col gap-2;
}

.station-main {
  @apply flex items-center justify-between gap-3 text-sm text-slate-200;
}

.station-main span {
  @apply text-xs text-slate-500 truncate;
}

.station-metrics {
  @apply grid gap-1 text-xs text-slate-400;
}

.problem-row {
  @apply px-3 py-2 flex flex-col gap-2;
}
</style>

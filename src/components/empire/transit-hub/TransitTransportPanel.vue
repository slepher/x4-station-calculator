<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TransitTransportPanelState, TransportRouteSegmentView } from '@/components/empire/presenters/useTransitTransportPresenter'

const props = defineProps<{
  panel: TransitTransportPanelState
}>()

const { t } = useI18n()
const expandedSectorGroups = ref<Set<string>>(new Set())
const expandedStationSectors = ref<Set<string>>(new Set())
const expandedStations = ref<Set<string>>(new Set())

const hasSectorGroups = computed(() => props.panel.sectorGroupRows.length > 0)
const hasStationGroups = computed(() => props.panel.stationSectorGroups.length > 0)
const hasProblems = computed(() => props.panel.problems.length > 0)

type RouteBlock = {
  sectorName: string
  items: Array<{
    key: string
    label: string
    distanceText: string | null
    timeText: string | null
  }>
}

type EffectiveRouteSegment = TransportRouteSegmentView | NonNullable<TransportRouteSegmentView['highwayAlternative']>[number]

type RouteOperationTimes = {
  loadingTimeSec?: number
  unloadingTimeSec?: number
}

function toggleSectorGroup(id: string) {
  expandedSectorGroups.value = toggledSet(expandedSectorGroups.value, id)
}

function toggleStationSector(id: string) {
  expandedStationSectors.value = toggledSet(expandedStationSectors.value, id)
}

function toggleStation(id: string) {
  expandedStations.value = toggledSet(expandedStations.value, id)
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

function hasRouteDetails(segments: unknown[]): boolean {
  return segments.length > 0
}

function hasStationDetails(station: { segments: unknown[] }): boolean {
  return station.segments.length > 0
}

function hasStationProducts(station: { products: { items: unknown[] } }): boolean {
  return station.products.items.length > 0
}

function hasDistance(value: number): boolean {
  return value > 0
}

function hasGates(value: number): boolean {
  return value > 0
}

function sectorGroupTargetText(row: { groupName: string; targetSectorName: string; targetStationName: string }): string {
  const target = row.targetStationName && row.targetStationName !== row.targetSectorName
    ? `${row.targetStationName} · ${row.targetSectorName}`
    : row.targetSectorName || row.targetStationName
  if (target.trim() === row.groupName.trim()) {
    return ''
  }
  return target
}

function stationTargetText(station: { stationName: string; stationCode: string }): string {
  const code = station.stationCode.trim()
  if (!code) return ''
  if (code === station.stationName.trim()) return ''
  return code
}

function routeBlocks(
  segments: TransportRouteSegmentView[],
  operations?: RouteOperationTimes,
  opts?: { unloadAfterFinalHighwayExit?: boolean }
): RouteBlock[] {
  const blocks: RouteBlock[] = []

  function ensureBlock(sectorName: string): RouteBlock {
    const last = blocks[blocks.length - 1]
    if (last?.sectorName === sectorName) return last
    const block = { sectorName, items: [] }
    blocks.push(block)
    return block
  }

  function segmentFromLabel(segment: EffectiveRouteSegment): string {
    if ('fromLabel' in segment) return segment.fromLabel
    return ''
  }

  function highwayBlockLabel(segment: TransportRouteSegmentView, effectiveSegment: EffectiveRouteSegment): string {
    if (segment.highwayAlternative && segment.highwayAlternative.length > 0) {
      return segment.highwayAlternative[0]!.fromLabel
    }
    return segmentFromLabel(effectiveSegment)
  }

  function pushOperationItem(block: RouteBlock, key: string, labelKey: string, timeSec: number | undefined) {
    if (!timeSec || timeSec <= 0) return
    block.items.push({
      key,
      label: t(labelKey),
      distanceText: null,
      timeText: formatTransportDuration(timeSec)
    })
  }

  function emitBlockItems(segList: TransportRouteSegmentView[], startIndex: number) {
    let activeHighwayBlockLabel: string | null = null

    segList.forEach((segment, i) => {
      const index = startIndex + i
      const effectiveSegments = segment.highwayAlternative ?? [segment]

      for (const es of effectiveSegments) {
        const segKind = 'kind' in es ? es.kind : ''
        if (segKind === 'station-to-gate') {
          activeHighwayBlockLabel = null
          const block = ensureBlock(('toLabel' in es ? es.toLabel : '') || '')
          pushOperationItem(block, `${index}:load-cargo`, 'transit_transport.route_action.load_cargo', operations?.loadingTimeSec)
          block.items.push({
            key: `${index}:depart`,
            label: t('transit_transport.route_action.depart_to_gate'),
            distanceText: formatKm(('distanceKm' in es ? es.distanceKm : 0) || 0),
            timeText: ('travel' in es && es.travel) ? es.travel.formattedTime : null
          })
          continue
        }

        if (segKind === 'gate-transit') {
          activeHighwayBlockLabel = null
          ensureBlock(('fromLabel' in es ? es.fromLabel : '') || '').items.push({
            key: `${index}:jump`,
            label: t('transit_transport.route_action.jump_to', { sector: ('toLabel' in es ? es.toLabel : '') || '' }),
            distanceText: null,
            timeText: null
          })
          continue
        }

        if (segKind === 'gate-to-gate') {
          activeHighwayBlockLabel = null
          ensureBlock(('fromLabel' in es ? es.fromLabel : '') || '').items.push({
            key: `${index}:transfer`,
            label: t('transit_transport.route_action.in_sector_transfer'),
            distanceText: formatKm(('distanceKm' in es ? es.distanceKm : 0) || 0),
            timeText: ('travel' in es && es.travel) ? es.travel.formattedTime : null
          })
          continue
        }

        if (segKind === 'superhighway') {
          activeHighwayBlockLabel = null
          ensureBlock(('fromLabel' in es ? es.fromLabel : '') || '').items.push({
            key: `${index}:superhighway`,
            label: t('transit_transport.route_action.superhighway_to', { sector: ('toLabel' in es ? es.toLabel : '') || '' }),
            distanceText: formatKm(('distanceKm' in es ? es.distanceKm : 0) || 0),
            timeText: null
          })
          continue
        }

        if (segKind === 'highway-approach') {
          const blockLabel = highwayBlockLabel(segment, es)
          activeHighwayBlockLabel = blockLabel
          ensureBlock(blockLabel).items.push({
            key: `${index}:hw-approach`,
            label: t('transit_transport.segment.highway-approach'),
            distanceText: formatKm(('distanceKm' in es ? es.distanceKm : 0) || 0),
            timeText: ('travel' in es && es.travel) ? es.travel.formattedTime : null
          })
          continue
        }

        if (segKind === 'highway') {
          const blockLabel = activeHighwayBlockLabel ?? highwayBlockLabel(segment, es)
          activeHighwayBlockLabel = blockLabel
          ensureBlock(blockLabel).items.push({
            key: `${index}:highway`,
            label: t('transit_transport.segment.highway'),
            distanceText: formatKm(('distanceKm' in es ? es.distanceKm : 0) || 0),
            timeText: ('travel' in es && es.travel) ? es.travel.formattedTime : null
          })
          continue
        }

        if (segKind === 'highway-exit') {
          const blockLabel = activeHighwayBlockLabel ?? highwayBlockLabel(segment, es)
          activeHighwayBlockLabel = null
          const block = ensureBlock(blockLabel)
          block.items.push({
            key: `${index}:hw-exit`,
            label: t('transit_transport.segment.highway-exit'),
            distanceText: formatKm(('distanceKm' in es ? es.distanceKm : 0) || 0),
            timeText: ('travel' in es && es.travel) ? es.travel.formattedTime : null
          })
          if (opts?.unloadAfterFinalHighwayExit && i === segList.length - 1) {
            pushOperationItem(block, `${index}:unload-cargo`, 'transit_transport.route_action.unload_cargo', operations?.unloadingTimeSec)
          }
          continue
        }

        if (segKind === 'gate-to-station') {
          activeHighwayBlockLabel = null
          const block = ensureBlock(('fromLabel' in es ? es.fromLabel : '') || '')
          block.items.push({
            key: `${index}:arrive`,
            label: t('transit_transport.route_action.arrive_to_station'),
            distanceText: formatKm(('distanceKm' in es ? es.distanceKm : 0) || 0),
            timeText: ('travel' in es && es.travel) ? es.travel.formattedTime : null
          })
          pushOperationItem(block, `${index}:unload-cargo`, 'transit_transport.route_action.unload_cargo', operations?.unloadingTimeSec)
        }
      }
    })
  }

  emitBlockItems(segments, 0)

  return blocks
}

function formatTransportDuration(timeSec: number): string {
  const rounded = Math.max(0, Math.round(timeSec))
  if (rounded < 3600) {
    const minutes = Math.floor(rounded / 60)
    const seconds = rounded % 60
    return `${minutes}m ${seconds}s`
  }
  const hours = Math.floor(rounded / 3600)
  const minutes = Math.floor((rounded % 3600) / 60)
  return `${hours}h ${minutes}m`
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
            <span v-if="sectorGroupTargetText(row)" class="route-subtitle">{{ sectorGroupTargetText(row) }}</span>
            <span class="route-metrics">
              <span class="route-stat">{{ formatKm(row.summary.normalDistanceKm) }}</span>
              <span v-if="row.travel" class="route-stat">{{ row.travel.formattedTime }}</span>
              <span v-else class="route-stat">{{ t('transit_transport.gates_value', { count: row.summary.gateCount }) }}</span>
              <span v-if="row.travel?.formattedThroughput" class="route-stat">{{ row.travel.formattedThroughput }}</span>
              <span v-if="row.travel" class="route-stat">{{ t('transit_transport.gates_value', { count: row.summary.gateCount }) }}</span>
            </span>
          </button>
          <div v-if="expandedSectorGroups.has(row.id)" class="route-details">
            <div class="terminal-line">
              {{ t('transit_transport.terminal') }}: {{ row.terminal.label }}
            </div>
            <div
              v-for="block in routeBlocks(row.segments, row.travel)"
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
                <span class="route-action-time">{{ item.timeText || '' }}</span>
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
            :class="{ 'not-expandable': !hasRouteDetails(group.segments), 'compact-summary': !hasDistance(group.summary.normalDistanceKm) && !group.travel || group.hideSectorHeader }"
            @click="hasRouteDetails(group.segments) && toggleStationSector(group.id)"
          >
            <span class="route-title">{{ group.sectorName }}</span>
            <span v-if="group.hideSectorHeader" class="route-metrics">
              <span class="route-stat">{{ group.stations.length }} {{ t('transit_transport.station_count') }}</span>
            </span>
            <span v-else class="route-metrics">
              <span v-if="hasDistance(group.summary.normalDistanceKm)" class="route-stat">{{ formatKm(group.summary.normalDistanceKm) }}</span>
              <span v-else class="route-stat route-stat-empty"></span>
              <span v-if="group.travel" class="route-stat">{{ group.travel.formattedTime }}</span>
              <span v-else class="route-stat">{{ hasGates(group.summary.gateCount) ? t('transit_transport.gates_value', { count: group.summary.gateCount }) : `${group.stations.length} ${t('transit_transport.station_count')}` }}</span>
              <span v-if="group.travel && hasGates(group.summary.gateCount)" class="route-stat">{{ t('transit_transport.gates_value', { count: group.summary.gateCount }) }}</span>
              <span v-if="group.travel || hasGates(group.summary.gateCount)" class="route-stat">{{ group.stations.length }} {{ t('transit_transport.station_count') }}</span>
            </span>
          </button>
          <div v-if="hasRouteDetails(group.segments) && expandedStationSectors.has(group.id)" class="route-details">
            <div
              v-for="block in routeBlocks(group.segments, group.travel)"
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
                <span class="route-action-time">{{ item.timeText || '' }}</span>
              </div>
            </div>
          </div>
          <div class="station-list">
            <div
              v-for="station in group.stations"
              :key="station.id"
              class="station-row"
            >
              <button
                class="route-summary station-summary"
                type="button"
                :class="{ 'not-expandable': !hasStationDetails(station) }"
                @click="hasStationDetails(station) && toggleStation(station.id)"
              >
                <span class="route-title">{{ station.stationName }}</span>
                <span v-if="stationTargetText(station)" class="route-subtitle">{{ stationTargetText(station) }}</span>
                <span class="station-product-summary">{{ station.products.label }}</span>
                <span class="route-metrics">
                  <span class="route-stat">{{ formatKm(station.summary.normalDistanceKm) }}</span>
                  <span v-if="station.travel" class="route-stat">{{ station.travel.formattedTotalTime }}</span>
                  <span v-if="station.travel?.formattedThroughput" class="route-stat">{{ station.travel.formattedThroughput }}</span>
                </span>
              </button>
              <div v-if="hasStationDetails(station) && expandedStations.has(station.id)" class="route-details">
                <div
                  v-for="block in routeBlocks(station.segments, station.travel, { unloadAfterFinalHighwayExit: true })"
                  :key="`${station.id}:${block.sectorName}`"
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
                    <span class="route-action-time">{{ item.timeText || '' }}</span>
                  </div>
                </div>
                <div v-if="hasStationProducts(station)" class="station-products-detail">
                  <div class="route-sector">{{ t('transit_transport.products') }}</div>
                  <ul class="station-products-list">
                    <li
                      v-for="product in station.products.items"
                      :key="product.wareId"
                    >
                      {{ product.name }}
                    </li>
                  </ul>
                </div>
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
  @apply mb-4 bg-slate-900/40 rounded-lg border border-slate-800 shadow-xl overflow-hidden;
}

.panel-header {
  @apply h-12 flex items-center px-4 text-slate-200 text-sm font-semibold border-b border-slate-700/50 bg-slate-800/30;
}

.panel-content {
  @apply p-3 flex flex-col gap-4;
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
  @apply w-full flex flex-col gap-2 px-3 py-2 text-left text-xs text-slate-300 hover:bg-slate-800/50;
}

.route-summary.not-expandable {
  @apply cursor-default hover:bg-transparent;
}

.route-title {
  @apply text-sm font-semibold text-slate-100;
}

.route-subtitle,
.route-meta {
  @apply text-slate-400 truncate;
}

.route-subtitle {
  @apply -mt-1;
}

.route-metrics {
  @apply grid grid-cols-[minmax(0,1fr)_minmax(9rem,1fr)] gap-x-6 gap-y-1;
}

.compact-summary {
  @apply grid grid-cols-[minmax(0,1fr)_minmax(9rem,1fr)] gap-x-6 items-center;
  row-gap: 0;
}

.compact-summary .route-title {
  @apply col-start-1 leading-5;
}

.compact-summary .route-metrics {
  @apply col-start-2 flex items-center justify-start p-0;
}

.compact-summary .route-stat {
  @apply flex items-center leading-5;
}

.compact-summary .route-stat-empty {
  @apply hidden;
}

.route-stat {
  @apply text-sky-200 font-medium min-h-5;
}

.route-stat-empty {
  @apply invisible;
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
  @apply grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem] gap-2 pl-3 text-xs text-slate-400;
}

.route-action-label {
  @apply truncate;
}

.route-action-distance {
  @apply text-right text-slate-200;
}

.route-action-time {
  @apply text-right text-sky-200;
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
  @apply flex flex-col divide-y divide-slate-800 border-t border-slate-800;
}

.station-row {
  @apply flex flex-col;
}

.station-summary {
  @apply px-3 py-2;
}

.station-product-summary {
  @apply text-xs text-slate-400 truncate;
}

.station-products-detail {
  @apply flex flex-col gap-1 py-1;
}

.station-products-list {
  @apply list-disc pl-7 text-xs text-slate-400 space-y-1;
}

.station-main {
  @apply flex items-center justify-between gap-3 text-sm text-slate-200;
}

.station-main span {
  @apply text-xs text-slate-500 truncate;
}

.problem-row {
  @apply px-3 py-2 flex flex-col gap-2;
}
</style>

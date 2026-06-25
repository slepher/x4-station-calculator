<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { TransportShipSelectorState } from '@/components/empire/presenters/useTransitTransportPresenter'
import type { TransportShipTravelProfile } from '@/store/logic/transitTransportShip'

const props = defineProps<{
  selector: TransportShipSelectorState
}>()

const emit = defineEmits<{
  (event: 'select', blueprintId: string): void
  (event: 'go-ship-build'): void
}>()

const { t } = useI18n()

function formatSpeed(value: number): string {
  return `${Math.round(value)} m/s`
}

function formatSeconds(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return `${rounded}s`
}

function formatDistance(value: number): string {
  return `${value.toFixed(1)} km`
}

function metricChips(profile: TransportShipTravelProfile) {
  return [
    [
      { key: 'speed', label: t('transit_transport.ship_selector.speed'), value: formatSpeed(profile.baseSpeedMps) },
      { key: 'travel', label: t('transit_transport.ship_selector.travel_speed'), value: formatSpeed(profile.travelSpeedMps) },
      { key: 'charge', label: t('transit_transport.ship_selector.charge'), value: formatSeconds(profile.chargeSec) }
    ],
    [
      { key: 'attack', label: t('transit_transport.ship_selector.attack'), value: formatSeconds(profile.attackSec) },
      { key: 'attack_distance', label: t('transit_transport.ship_selector.attack_distance'), value: formatDistance(profile.attackDistanceKm) }
    ],
    [
      { key: 'release', label: t('transit_transport.ship_selector.release'), value: formatSeconds(profile.releaseSec) },
      { key: 'decel_distance', label: t('transit_transport.ship_selector.decel_distance'), value: formatDistance(profile.decelDistanceKm) }
    ]
  ]
}

function shipTypeLabel(type: string): string {
  const key = `transit_transport.ship_selector.ship_type.${type}`
  return t(key) === key ? type : t(key)
}
</script>

<template>
  <section class="transport-ship-selector panel-card" data-testid="transit-transport-ship-selector">
    <header class="panel-header">
      <h3>{{ t('transit_transport.ship_selector.title') }}</h3>
    </header>

    <div class="panel-content">
      <div v-if="!selector.hasCandidates" class="selector-empty">
        <p>{{ t('transit_transport.ship_selector.empty') }}</p>
        <button class="selector-action" type="button" @click="emit('go-ship-build')">
          {{ t('transit_transport.ship_selector.go_ship_build') }}
        </button>
      </div>

      <template v-else>
        <div v-if="!selector.selectedProfile" class="selector-hint">
          {{ t('transit_transport.ship_selector.pick_hint') }}
        </div>

        <div class="ship-group-list">
          <section
            v-for="group in selector.groups"
            :key="group.shipId"
            class="ship-group"
          >
            <div class="ship-group-title">
              <span>{{ group.shipName }} · {{ shipTypeLabel(group.shipType) }}</span>
              <span>{{ group.containerCapacityM3.toLocaleString() }} m3</span>
            </div>
            <button
              v-for="blueprint in group.blueprints"
              :key="blueprint.id"
              class="blueprint-row"
              :class="{ selected: selector.selectedBlueprintId === blueprint.id }"
              type="button"
              @click="emit('select', blueprint.id)"
            >
              <ul class="blueprint-engines">
                <li v-for="engine in blueprint.profile.engines" :key="engine.equipmentId" class="engine-item">
                  {{ engine.name }} &times; {{ engine.count }}
                </li>
              </ul>
              <span class="blueprint-chips">
                <span
                  v-for="(row, rowIdx) in metricChips(blueprint.profile)"
                  :key="rowIdx"
                  class="blueprint-chip-row"
                >
                  <span
                    v-for="chip in row"
                    :key="chip.key"
                    class="metric-chip"
                  >
                    <span>{{ chip.label }}</span>
                    <strong>{{ chip.value }}</strong>
                  </span>
                </span>
              </span>
            </button>
          </section>
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.transport-ship-selector {
  @apply mt-3 bg-slate-900/40 rounded-lg border border-slate-800 shadow-xl overflow-hidden;
}

.panel-header {
  @apply h-10 flex items-center px-4 text-slate-200 text-sm font-semibold border-b border-slate-700/50 bg-slate-800/30;
}

.panel-content {
  @apply p-2.5 flex flex-col gap-2.5;
}

.selector-empty {
  @apply flex flex-col gap-3 rounded-md border border-slate-800 bg-slate-950/30 px-3 py-4 text-xs text-slate-400;
}

.selector-action {
  @apply self-start rounded border border-sky-500/40 px-3 py-1.5 text-xs font-medium text-sky-200 hover:bg-sky-500/10;
}

.selector-hint {
  @apply rounded border border-sky-500/20 bg-sky-500/10 px-2.5 py-1.5 text-xs text-sky-100;
}

.ship-group-list {
  @apply flex flex-col gap-2.5;
}

.ship-group {
  @apply flex flex-col gap-1.5;
}

.ship-group-title {
  @apply flex items-center justify-between gap-3 text-xs font-semibold uppercase text-slate-400;
}

.blueprint-row {
  @apply flex flex-col gap-1.5 rounded-md border border-slate-800 bg-slate-950/30 px-2.5 py-2 text-left hover:border-sky-500/40 hover:bg-sky-500/10;
}

.blueprint-row.selected {
  @apply border-sky-500/60 bg-sky-500/15;
}

.blueprint-engines {
  @apply list-none text-sm font-medium text-slate-100;
}

.engine-item {
  @apply py-0.5;
}

.blueprint-chips {
  @apply flex flex-col gap-1;
}

.blueprint-chip-row {
  @apply flex flex-wrap gap-1;
}

.metric-chip {
  @apply inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-900/70 px-1.5 py-0.5 text-[11px] leading-tight text-slate-400;
}

.metric-chip strong {
  @apply font-semibold text-slate-100;
}
</style>

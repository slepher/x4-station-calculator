<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import X4NumberInput from '@/components/common/X4NumberInput.vue'
import type { FleetGoalView } from '@/types/build-plan'

const props = defineProps<{
  fleetView: FleetGoalView
}>()

const emit = defineEmits<{
  removeFleetEntry: [blueprintId: string]
  clearFleetGroup: [groupType: 'shipyard_l' | 'shipyard_xl' | 'wharf']
  updateFleetBuildTime: [seconds: number]
  updateFleetBuildTimeMode: [mode: 'actual' | 'planned']
  updateFleetEntryQuantity: [blueprintId: string, qty: number]
  updateFleetShipyardCount: [groupType: 'shipyard_l' | 'shipyard_xl' | 'wharf', count: number]
}>()

const { t } = useI18n()
const expandedEntries = ref<Record<string, boolean>>({})

const toggleEntry = (blueprintId: string, isBlueprintMissing: boolean) => {
  if (isBlueprintMissing) return
  expandedEntries.value[blueprintId] = !expandedEntries.value[blueprintId]
}

const isEntryExpanded = (blueprintId: string) => {
  return !!expandedEntries.value[blueprintId]
}

const formatQty = (qty: number) => {
  return new Intl.NumberFormat('en-US').format(Math.round(qty))
}

const formatTime = (seconds: number) => {
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return m > 0 ? `${h}h${m}m` : `${h}h`
}
</script>

<template>
  <div class="fleet-goal-card" data-testid="fleet-goal-card">
    <div class="fleet-header">
      <span class="fleet-title">{{ t('build_plan.fleet_title') }}</span>
      <select
        class="fleet-mode-select"
        :value="fleetView.buildTimeMode"
        @change="emit('updateFleetBuildTimeMode', ($event.target as HTMLSelectElement).value as 'actual' | 'planned')"
      >
        <option value="actual">{{ t('build_plan.fleet_actual_time') }} ({{ formatTime(fleetView.actualTotalBuildTime) }})</option>
        <option value="planned">{{ t('build_plan.fleet_effective_time') }} ({{ formatTime(fleetView.buildTime) }})</option>
      </select>
      <div v-if="fleetView.buildTimeMode === 'planned'" class="fleet-build-time-group">
        <X4NumberInput
          data-testid="fleet-build-time-input"
          :modelValue="fleetView.buildTime"
          :min="600"
          widthClass="w-20"
          @update:modelValue="emit('updateFleetBuildTime', $event)"
        />
        <span class="fleet-build-time-label">s</span>
      </div>
    </div>

    <div class="fleet-groups">
      <div
        v-for="group in fleetView.groups"
        :key="group.type"
        v-show="group.entries.length > 0"
        class="fleet-group"
      >
        <div class="fleet-group-header">
          <span class="fleet-group-label">{{ group.label }}</span>
          <span class="fleet-group-time">{{ formatTime(group.groupTotalBuildTime) }}</span>
          <div class="fleet-group-count">
            <X4NumberInput
              :modelValue="group.shipyardCount"
              :min="1"
              widthClass="w-16"
              :data-testid="`fleet-shipyard-count-${group.type}`"
              @update:modelValue="emit('updateFleetShipyardCount', group.type, $event)"
            />
          </div>
          <button
            class="fleet-group-clear"
            :data-testid="`fleet-group-clear-${group.type}`"
            @click="emit('clearFleetGroup', group.type)"
          >&#10005;</button>
        </div>

        <div class="fleet-entries">
          <div
            v-for="entry in group.entries"
            :key="entry.blueprintId"
            class="fleet-entry"
            :class="{ 'fleet-entry--missing': entry.isBlueprintMissing }"
          >
            <div
              class="fleet-entry-header"
              :class="{ 'fleet-entry-header--disabled': entry.isBlueprintMissing }"
              @click="toggleEntry(entry.blueprintId, entry.isBlueprintMissing)"
            >
              <span
                class="fleet-entry-arrow"
                :class="{
                  'expanded': isEntryExpanded(entry.blueprintId),
                  'fleet-entry-arrow--hidden': entry.isBlueprintMissing,
                }"
              >&#9654;</span>
              <span v-if="entry.isBlueprintMissing" class="fleet-entry-warning" data-testid="fleet-entry-warning" :title="t('build_plan.fleet_blueprint_missing')">&#9888;</span>
              <span class="fleet-entry-name">
                {{ entry.blueprintName }}
                <span v-if="!entry.isBlueprintMissing" class="fleet-entry-total-time">{{ formatTime(entry.totalBuildTime) }}</span>
              </span>
              <div @click.stop class="fleet-entry-qty-group">
                <span
                  v-if="entry.isBlueprintMissing"
                  class="fleet-entry-qty-readonly"
                  :data-testid="`fleet-entry-qty-${entry.blueprintId}`"
                >{{ formatQty(entry.quantity) }}</span>
                <X4NumberInput
                  v-else
                  :modelValue="entry.quantity"
                  :min="1"
                  widthClass="w-16"
                  :data-testid="`fleet-entry-qty-${entry.blueprintId}`"
                  @update:modelValue="emit('updateFleetEntryQuantity', entry.blueprintId, $event)"
                />
              </div>
              <button
                class="fleet-entry-remove"
                :data-testid="`fleet-entry-remove-${entry.blueprintId}`"
                @click.stop="emit('removeFleetEntry', entry.blueprintId)"
              >&#10005;</button>
            </div>

            <div v-if="isEntryExpanded(entry.blueprintId)" class="fleet-entry-detail">
              <div class="fleet-entry-build-time">
                <span class="fleet-detail-label">{{ t('build_plan.fleet_single_build_time') }}:</span>
                <span class="fleet-detail-value">{{ formatTime(entry.buildTime) }}</span>
              </div>
              <div class="fleet-entry-materials">
                <div
                  v-for="mat in entry.materials"
                  :key="mat.wareId"
                  class="fleet-material-row"
                >
                  <span class="fleet-material-name">{{ mat.wareName }}</span>
                  <span class="fleet-material-qty">{{ formatQty(mat.totalQty) }}</span>
                </div>
                <div v-if="entry.materials.length === 0" class="fleet-material-empty">
                  {{ entry.isBlueprintMissing ? t('build_plan.fleet_blueprint_missing') : t('build_plan.fleet_no_materials') }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="fleet-rates" data-testid="fleet-rates">
      <div class="fleet-rates-title">{{ t('build_plan.fleet_rates') }}</div>
      <div class="space-y-1">
        <div
          v-for="rate in fleetView.mergedRates"
          :key="rate.wareId"
          class="fleet-rate-row"
        >
          <span class="fleet-rate-name">{{ rate.wareName }} &times; {{ formatQty(rate.totalQty) }}</span>
          <span class="fleet-rate-value">{{ rate.ratePerHour }}/h</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fleet-goal-card {
  @apply bg-slate-800/50 border border-amber-700/40 rounded overflow-hidden;
}

.fleet-header {
  @apply flex items-center gap-2 px-3 py-2 bg-slate-800/80 border-b border-slate-700/50;
}

.fleet-title {
  @apply text-sm font-semibold text-amber-400;
}

.fleet-mode-select {
  @apply text-[11px] text-slate-300 bg-slate-700 border border-slate-600 rounded px-1.5 py-0.5 cursor-pointer;
}

.fleet-build-time-group {
  @apply flex items-center gap-1 ml-auto;
}

.fleet-build-time-label {
  @apply text-xs text-slate-400;
}

.fleet-groups {
  @apply divide-y divide-slate-700/30;
}

.fleet-group {
}

.fleet-group-header {
  @apply flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/40;
}

.fleet-group-label {
  @apply text-xs font-semibold text-slate-300;
}

.fleet-group-time {
  @apply text-[11px] text-slate-400 font-mono;
}

.fleet-group-count {
  @apply ml-auto;
}

.fleet-group-clear,
.fleet-entry-remove {
  @apply w-5 h-5 flex items-center justify-center rounded text-xs text-slate-500 hover:text-red-400 hover:bg-red-900/30 transition-colors shrink-0;
}

.fleet-entries {
  @apply divide-y divide-slate-700/20;
}

.fleet-entry {
  @apply px-3 hover:bg-slate-600/20;
}

.fleet-entry--missing {
  @apply bg-red-900/10;
}

.fleet-entry--missing:hover {
  @apply bg-red-900/20;
}

.fleet-entry-header {
  @apply flex items-center gap-1.5 py-1.5 cursor-pointer;
}

.fleet-entry-header--disabled {
  @apply cursor-default;
}

.fleet-entry-arrow {
  @apply text-[10px] text-slate-500 transition-transform duration-100;
}

.fleet-entry-arrow--hidden {
  @apply opacity-0;
}

.fleet-entry-arrow.expanded {
  @apply rotate-90;
}

.fleet-entry-warning {
  @apply text-xs text-red-400;
}

.fleet-entry-name {
  @apply text-xs text-slate-300 truncate flex-1 min-w-0;
}

.fleet-entry-total-time {
  @apply text-[11px] text-slate-400 font-mono ml-2 shrink-0;
}

.fleet-entry-qty-group {
  @apply shrink-0;
}

.fleet-entry-qty-readonly {
  @apply inline-flex items-center justify-end min-w-16 px-2 py-1 rounded border border-slate-700 bg-slate-900/40 text-sm text-slate-300 font-mono;
}

.fleet-entry-remove {
  @apply w-5 h-5 flex items-center justify-center rounded text-xs text-slate-500 hover:text-red-400 hover:bg-red-900/30 transition-colors;
}

.fleet-entry-detail {
  @apply pl-6 pb-2 space-y-1;
}

.fleet-entry-build-time {
  @apply flex items-center gap-1 text-[11px];
}

.fleet-detail-label {
  @apply text-slate-500;
}

.fleet-detail-value {
  @apply text-slate-300 font-mono;
}

.fleet-entry-materials {
  @apply space-y-0.5;
}

.fleet-material-row {
  @apply flex items-center w-full bg-slate-800/40 border border-slate-700/50 px-2 py-1 rounded;
}

.fleet-material-name {
  @apply flex-1 min-w-0 truncate text-xs text-slate-300;
}

.fleet-material-qty {
  @apply text-xs text-slate-400 font-mono shrink-0;
}

.fleet-material-empty {
  @apply text-xs text-slate-500 italic;
}

.fleet-rates {
  @apply px-3 py-2 border-t border-slate-700/50;
}

.fleet-rates-title {
  @apply text-[10px] uppercase text-slate-500 font-bold mb-1;
}

.fleet-rate-row {
  @apply flex items-center bg-slate-800/60 border border-slate-700 px-2 py-1 rounded;
}

.fleet-rate-name {
  @apply flex-1 min-w-0 truncate text-xs text-slate-300;
}

.fleet-rate-value {
  @apply text-xs text-amber-300 font-mono shrink-0;
}
</style>

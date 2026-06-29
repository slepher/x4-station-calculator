<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed } from 'vue'
import type { SectorAssignment, GroupDraftInfo, BridgePlanOption, BridgePlanUnit } from '@/store/logic/autoGroup'
import { sortAssignmentsForDisplay } from '@/store/logic/autoGroup'
import { resolveMapSectorByMacro } from '@/components/map/utils/mapSectorMacro'
import type { X4MapCluster, X4MapSector } from '@/types/x4'

const props = withDefaults(defineProps<{
  assignments: SectorAssignment[]
  bridgePlans: BridgePlanOption[]
  groups: GroupDraftInfo[]
  maps: { clusters: Record<string, X4MapCluster>; sectors: Record<string, X4MapSector> } | null | undefined
  stationCounts: Record<string, number>
  disabled?: boolean
  view?: 'map' | 'live'
}>(), {
  view: 'live'
})

const emit = defineEmits<{
  (e: 'select-option', sectorMacro: string, optionIndex: number): void
  (e: 'select-bridge-plan', planId: string): void
  (e: 'select-bridge-center', planId: string, unitId: string, sectorMacro: string): void
  (e: 'focus-sector', sectorMacro: string): void
}>()

const { t, te } = useI18n()

function getGroupName(groupId: string): string {
  return props.groups.find((g) => g.id === groupId)?.name || groupId.slice(0, 8)
}

function getSectorDisplayName(sectorMacro: string): string {
  if (props.maps) {
    const resolved = resolveMapSectorByMacro(props.maps, sectorMacro)
    if (resolved) {
      const nameId = (resolved.sector as any).nameId
      if (nameId && te(nameId)) {
        return t(nameId)
      }
      const name = (resolved.sector as any).name
      if (name) return name
    }
  }
  return sectorMacro
}

function getClusterDisplayName(clusterMacro: string): string {
  const cluster = props.maps?.clusters[clusterMacro]
  if (!cluster) return clusterMacro
  if (cluster.nameId && te(cluster.nameId)) return t(cluster.nameId)
  return cluster.name || clusterMacro
}

function getOptionLabel(opt: SectorAssignment['options'][number]): string {
  if (opt.type === 'standalone') return t('sector.independent_group')
  const groupName = opt.targetGroupId ? getGroupName(opt.targetGroupId) : '-'
  const parts = [groupName]
  if (opt.extendsRange) parts.push(`(${t('sector.extends_range', { dist: opt.distance })})`)
  else parts.push(`(${t('sector.distance_n', { n: opt.distance })})`)
  return parts.join(' ')
}

function getStationCount(macro: string): number {
  return props.stationCounts[macro] || 0
}

function getUnitLabel(unit: BridgePlanUnit): string {
  if (unit.candidates.length === 1) return getSectorDisplayName(unit.candidates[0]!.sectorMacro)
  return getClusterDisplayName(unit.label)
}

function getPlanTitle(plan: BridgePlanOption): string {
  return plan.units.map(getUnitLabel).join(' + ')
}

function getReachDisplayName(sectorMacro: string, fallback: string): string {
  const displayName = getSectorDisplayName(sectorMacro)
  return displayName === sectorMacro ? fallback : displayName
}

const hasPendingBridgePlans = computed(() =>
  props.bridgePlans.length > 1 && !props.bridgePlans.some((plan) => plan.selected)
)

const sortedAssignments = computed(() => {
  return sortAssignmentsForDisplay(props.assignments, props.groups)
})

</script>

<template>
  <div class="allocation-list" :class="{ 'allocation-list--map': view === 'map' }">
    <div v-if="hasPendingBridgePlans" class="bridge-plan-list">
      <div class="bridge-plan-title">{{ t('sector.bridge_plans') }}</div>
      <div
        v-for="plan in bridgePlans"
        :key="plan.id"
        class="bridge-plan-card"
        :class="{ 'bridge-plan-card--recommended': plan.recommended }"
      >
        <div class="bridge-plan-header">
          <span class="option-radio">
            {{ plan.selected ? '●' : '○' }}
          </span>
          <span class="bridge-plan-name">{{ getPlanTitle(plan) }}</span>
          <span v-if="plan.recommended" class="bridge-plan-badge">{{ t('sector.recommended') }}</span>
        </div>
        <div class="bridge-plan-meta">
          {{ t('sector.bridge_plan_score', { score: Math.round(plan.planScore), total: plan.totalJump, max: plan.maxJump }) }}
        </div>
        <div class="bridge-plan-units">
          <div
            v-for="unit in plan.units"
            :key="unit.unitId"
            class="bridge-unit"
          >
            <div class="bridge-unit-title">
              <span @click="view === 'map' && unit.candidates[0] && emit('focus-sector', unit.candidates[0].sectorMacro)">{{ getUnitLabel(unit) }}</span>
            </div>
            <div v-if="unit.reaches.length > 0" class="bridge-unit-reaches">
              <span
                v-for="reach in unit.reaches"
                :key="reach.nodeId"
                class="bridge-reach-pill"
                @click="view === 'map' && emit('focus-sector', reach.sectorMacro)"
              >
                {{ getReachDisplayName(reach.sectorMacro, reach.label) }} ({{ reach.jump }})
              </span>
            </div>
            <div v-if="unit.candidates.length > 1" class="bridge-unit-candidates">
              <button
                v-for="candidate in unit.candidates"
                :key="candidate.sectorMacro"
                type="button"
                class="bridge-sector-option"
                :class="{ 'bridge-sector-option--selected': unit.selectedSectorMacro === candidate.sectorMacro }"
                :disabled="disabled"
                @click.stop="!disabled && emit('select-bridge-center', plan.id, unit.unitId, candidate.sectorMacro)"
              >
                <span>{{ unit.selectedSectorMacro === candidate.sectorMacro ? '●' : '○' }}</span>
                <span>{{ getSectorDisplayName(candidate.sectorMacro) }}</span>
              </button>
            </div>
          </div>
        </div>
        <button type="button" class="bridge-plan-select" :disabled="disabled" @click="!disabled && emit('select-bridge-plan', plan.id)">
          {{ t('sector.select_bridge_plan') }}
        </button>
      </div>
    </div>

    <div v-else-if="assignments.length === 0" class="empty-hint">
      {{ t('sector.no_assignments') }}
    </div>

    <template v-if="!hasPendingBridgePlans">
      <div
        v-for="assignment in sortedAssignments"
        :key="assignment.sectorMacro"
        class="allocation-card"
        :class="{
          'card-uncertain': assignment.status === 'uncertain_tie' || assignment.status === 'uncertain_extend',
          'card-auto': assignment.status === 'auto',
          'card-standalone': assignment.status === 'standalone'
        }"
      >
        <div class="card-header">
          <span
            class="card-sector-name"
            :class="{ 'cursor-pointer hover:text-sky-300': view === 'map' }"
            @click="view === 'map' && emit('focus-sector', assignment.sectorMacro)"
          >{{ getSectorDisplayName(assignment.sectorMacro) }}</span>
          <span class="card-station-count">{{ getStationCount(assignment.sectorMacro) }} {{ t('sector.stations_count') }}</span>
          <span v-if="assignment.status === 'auto'" class="card-badge badge-auto">{{ t('sector.auto_assigned') }}</span>
          <span v-else-if="assignment.status === 'uncertain_tie'" class="card-badge badge-uncertain">{{ t('sector.uncertain_tie') }}</span>
          <span v-else-if="assignment.status === 'uncertain_extend'" class="card-badge badge-uncertain">{{ t('sector.uncertain_extend') }}</span>
          <span v-else-if="assignment.status === 'standalone'" class="card-badge badge-standalone">{{ t('sector.standalone') }}</span>
          <span v-else class="card-badge badge-bad">{{ t('sector.exception') }}</span>
        </div>

        <div class="card-options">
          <div
            v-for="(opt, idx) in assignment.options"
            :key="idx"
            class="option-row"
            :class="{
              'option-selected': assignment.selectedOptionIndex === idx,
              'option-hoverable': assignment.selectedOptionIndex !== idx && assignment.options.length > 1
            }"
            @click="!disabled && assignment.options.length > 1 && assignment.selectedOptionIndex !== idx && emit('select-option', assignment.sectorMacro, idx)"
          >
            <span class="option-radio" :class="{ 'radio-checked': assignment.selectedOptionIndex === idx }">
              {{ assignment.selectedOptionIndex === idx ? '●' : '○' }}
            </span>
            <span class="option-label">{{ getOptionLabel(opt) }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.allocation-list {
  @apply flex flex-col gap-2;
}

.bridge-plan-list {
  @apply flex flex-col gap-2;
}

.bridge-plan-title {
  @apply text-sm font-semibold text-slate-200;
}

.bridge-plan-card {
  @apply rounded border border-cyan-500/30 bg-cyan-500/5 p-3 flex flex-col gap-2;
}

.bridge-plan-card--recommended {
  @apply border-sky-400/40 bg-sky-500/10;
}

.bridge-plan-header {
  @apply flex items-center gap-2;
}

.bridge-plan-name {
  @apply text-sm font-semibold text-slate-100;
}

.bridge-plan-badge {
  @apply text-xs px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 ml-auto;
}

.bridge-plan-meta {
  @apply text-xs text-slate-400;
}

.bridge-plan-units {
  @apply flex flex-col gap-2;
}

.bridge-unit {
  @apply rounded border border-slate-700/50 bg-slate-900/30 p-2;
}

.bridge-unit-title {
  @apply text-xs text-slate-200;
}

.bridge-unit-reaches {
  @apply mt-1 flex flex-wrap gap-1;
}

.bridge-reach-pill {
  @apply inline-flex items-center rounded-full border border-emerald-300/30 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-200;
}

.bridge-unit-candidates {
  @apply mt-1 flex flex-col gap-1;
}

.bridge-sector-option {
  @apply flex items-center gap-2 rounded px-2 py-1 text-xs text-slate-300 hover:bg-slate-700/40 disabled:cursor-not-allowed disabled:opacity-60;
}

.bridge-sector-option--selected {
  @apply bg-sky-500/20 text-sky-200;
}

.bridge-plan-select {
  @apply self-start rounded border border-sky-400/30 bg-sky-500/10 px-2 py-1 text-xs text-sky-200 hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-sky-500/10;
}

.empty-hint {
  @apply text-sm text-slate-500 text-center py-4;
}

.allocation-card {
  @apply bg-slate-800/40 rounded border border-slate-700/50 p-3 transition-colors;
}

.card-uncertain {
  @apply border-amber-500/30 bg-amber-500/5;
}

.card-auto {
  @apply border-green-500/20 bg-green-500/5;
}

.card-standalone {
  @apply border-purple-500/20 bg-purple-500/5;
}

.card-header {
  @apply flex items-center gap-2 mb-2 flex-wrap;
}

.card-sector-name {
  @apply text-sm font-semibold text-slate-200;
}

.card-station-count {
  @apply text-xs text-slate-500 ml-auto;
}

.card-badge {
  @apply text-xs px-1.5 py-0.5 rounded;
}

.badge-auto {
  @apply bg-green-500/20 text-green-400;
}

.badge-uncertain {
  @apply bg-amber-500/20 text-amber-400;
}

.badge-standalone {
  @apply bg-purple-500/20 text-purple-400;
}

.badge-bad {
  @apply bg-red-500/20 text-red-400;
}

.card-options {
  @apply flex flex-col gap-0.5;
}

.option-row {
  @apply flex items-center gap-2 px-2 py-1 rounded text-xs cursor-pointer transition-colors;
  @apply hover:bg-slate-700/40;
}

.option-selected {
  @apply bg-sky-500/20 text-sky-300;
}

.option-radio {
  @apply text-slate-500 text-sm;
}

.radio-checked {
  @apply text-sky-400;
}

.option-label {
  @apply text-slate-300;
}

.option-selected .option-label {
  @apply text-sky-200;
}

/* === Map compact styles === */
.allocation-list--map .bridge-plan-card {
  @apply p-2;
}

.allocation-list--map .bridge-unit {
  @apply p-1.5;
}

.allocation-list--map .bridge-sector-option {
  @apply text-[11px] py-0.5;
}

.allocation-list--map .allocation-card {
  @apply p-2;
}

.allocation-list--map .card-header {
  @apply gap-1;
}

.allocation-list--map .card-sector-name {
  @apply text-xs;
}

.allocation-list--map .option-row {
  @apply text-[11px] py-0.5;
}
</style>

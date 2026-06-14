<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { GroupDraftInfo, SectorAssignment } from '@/store/logic/autoGroup'
import { resolveMapSectorByMacro } from '@/components/map/utils/mapSectorMacro'
import { getCoverageSectors } from '@/store/logic/saveBindingUtils'
import JumpInput from '@/components/common/JumpInput.vue'
import type { X4MapSector } from '@/types/x4'

const props = defineProps<{
  groups: GroupDraftInfo[]
  assignments: SectorAssignment[]
  maps: { clusters: Record<string, { sectors?: string[] }>; sectors: Record<string, X4MapSector> } | null | undefined
  sectorGraph: Record<string, string[]>
  sectorClusterMap: Record<string, string>
  playerSectorMacros: string[]
  editable: boolean
  baselineCoverageByGroupId?: Record<string, string[]>
  baselineConnectedByGroupId?: Record<string, string[]>
  baselineAnchorSectorMacros?: string[]
}>()

const emit = defineEmits<{
  (e: 'cycle-recalc-state', groupId: string): void
  (e: 'update-jump-range', groupId: string, range: number): void
  (e: 'toggle-coverage-input', groupId: string, sectorMacro: string): void
  (e: 'toggle-connected-input', groupId: string, connectedGroupId: string): void
  (e: 'add-candidate-coverage', groupId: string, sectorMacro: string): void
  (e: 'delete-group', groupId: string): void
}>()

const { t, te } = useI18n()

const activeTabByGroup = ref<Record<string, 'coverage' | 'candidates' | 'connected'>>({})

function getTab(groupId: string): 'coverage' | 'candidates' | 'connected' {
  return activeTabByGroup.value[groupId] || 'coverage'
}

function setTab(groupId: string, tab: 'coverage' | 'candidates' | 'connected') {
  activeTabByGroup.value[groupId] = tab
}

function getSectorName(macro: string): string {
  if (props.maps) {
    const resolved = resolveMapSectorByMacro(props.maps, macro)
    if (resolved) {
      const nameId = (resolved.sector as any).nameId
      if (nameId && te(nameId)) return t(nameId)
      const name = (resolved.sector as any).name
      if (name) return name
    }
  }
  return macro
}

function isBaselineCoverage(groupId: string, sectorMacro: string): boolean {
  return (props.baselineCoverageByGroupId?.[groupId] ?? []).includes(sectorMacro)
}

function isBaselineConnection(groupId: string, connectedGroupId: string): boolean {
  return (props.baselineConnectedByGroupId?.[groupId] ?? []).includes(connectedGroupId)
}

function isBaselineAnchor(sectorMacro: string): boolean {
  return (props.baselineAnchorSectorMacros ?? []).includes(sectorMacro)
}

void isBaselineCoverage
void isBaselineConnection
void isBaselineAnchor

function getCoverageByJump(group: GroupDraftInfo): Map<number, Array<{ macro: string; connected: boolean; active: boolean; connectedGroupId?: string; isBaseline: boolean }>> {
  const byJump = new Map<number, Array<{ macro: string; connected: boolean; active: boolean; connectedGroupId?: string; isBaseline: boolean }>>()
  if (!group.sectorMacro) return byJump

  const distances = getCoverageSectors(
    group.sectorMacro, 99,
    props.sectorGraph, props.sectorClusterMap
  )
  const distMap = new Map(distances.map(d => [d.sectorMacro, d.distance]))

  for (const sector of group.coverageSectorMacros) {
    if (sector === group.sectorMacro) continue
    const jump = distMap.get(sector) ?? 0
    if (!byJump.has(jump)) byJump.set(jump, [])
    byJump.get(jump)!.push({
      macro: sector,
      connected: false,
      active: !group.excludedDefaultAssignmentSectorMacros.includes(sector),
      isBaseline: isBaselineCoverage(group.id, sector)
    })
  }

  for (const connId of group.connectedGroupIds) {
    const connGroup = props.groups.find(g => g.id === connId)
    if (!connGroup?.sectorMacro || connGroup.sectorMacro === group.sectorMacro) continue
    const jump = distMap.get(connGroup.sectorMacro) ?? 0
    if (!byJump.has(jump)) byJump.set(jump, [])
    byJump.get(jump)!.push({
      macro: connGroup.sectorMacro,
      connected: true,
      active: !group.excludedDefaultConnectedGroupIds.includes(connId),
      connectedGroupId: connId,
      isBaseline: isBaselineConnection(group.id, connId)
    })
  }

  return byJump
}

function getCoverageJumps(group: GroupDraftInfo): number[] {
  return Array.from(getCoverageByJump(group).keys()).sort((a, b) => a - b)
}

function getCandidatesForGroup(group: GroupDraftInfo): Array<{ macro: string; isAnchor: boolean; isActive: boolean }> {
  if (!group.sectorMacro) return []
  const allAnchorSectors = new Set(props.groups.filter(g => g.sectorMacro).map(g => g.sectorMacro!))
  const distances = getCoverageSectors(group.sectorMacro, group.jumpRange, props.sectorGraph, props.sectorClusterMap)
  const activeCoverage = new Set(group.coverageSectorMacros.filter(
    m => !group.excludedDefaultAssignmentSectorMacros.includes(m)
  ))
  const inactiveCoverage = new Set(group.coverageSectorMacros.filter(
    m => group.excludedDefaultAssignmentSectorMacros.includes(m)
  ))

  return distances
    .filter(d => props.playerSectorMacros.includes(d.sectorMacro) && d.sectorMacro !== group.sectorMacro)
    .filter(d => !inactiveCoverage.has(d.sectorMacro))
    .map(d => ({
      macro: d.sectorMacro,
      isAnchor: allAnchorSectors.has(d.sectorMacro),
      isActive: activeCoverage.has(d.sectorMacro)
    }))
}

function getConnectedEntries(group: GroupDraftInfo) {
  return group.connectedGroupIds.map(connId => {
    const connGroup = props.groups.find(g => g.id === connId)
    return {
      groupId: connId,
      name: connGroup ? (connGroup.sectorMacro ? getSectorName(connGroup.sectorMacro) : connGroup.name) : connId.slice(0, 8),
      active: !group.excludedDefaultConnectedGroupIds.includes(connId),
      isBaseline: isBaselineConnection(group.id, connId)
    }
  })
}

function getPinnedTitle(group: GroupDraftInfo): string {
  return group.isPinned ? t('sector.recalc_state_pin') : t('sector.recalc_state_normal')
}

function canEditJumpRange(group: GroupDraftInfo): boolean {
  if (!props.editable) return false
  return group.isPinned
}

function canEditPinnedInput(group: GroupDraftInfo): boolean {
  return props.editable && group.isPinned
}

function getUncertainCount(groupId: string): number {
  return props.assignments.filter((a) =>
    (a.status === 'uncertain_tie' || a.status === 'uncertain_extend') && a.defaultGroupId === groupId
  ).length
}

function hasPlayerStation(sectorMacro: string): boolean {
  return props.playerSectorMacros.includes(sectorMacro)
}

function getPillClass(entry: {
  connected: boolean
  active: boolean
  isBaseline: boolean
  isAnchor?: boolean
}) {
  return {
    'pill--coverage': !entry.connected,
    'pill--connected': entry.connected,
    'pill--inactive': !entry.active,
    'pill--baseline': entry.isBaseline,
    'pill--anchor': entry.isAnchor
  }
}
</script>

<template>
  <div class="group-list">
    <div v-if="groups.length === 0" class="empty-hint">
      {{ t('sector.no_groups') }}
    </div>

    <div
      v-for="group in groups"
      :key="group.id"
      class="group-item"
      :class="{
        'group-item--new': group.isNew,
        'group-item--pinned': group.isPinned,
        'group-item--unpinned': !group.isPinned && group.baseline
      }"
    >
      <div class="group-header">
        <div class="group-title-row">
          <span class="group-name">{{ group.name }}</span>
        </div>
        <div class="group-actions">
          <button
            v-if="props.editable && !group.enteredOtherGroupCoverage"
            class="action-btn state-btn"
            :class="group.isPinned ? 'state-btn--pinned' : 'state-btn--unpinned'"
            :title="getPinnedTitle(group)"
            @click="emit('cycle-recalc-state', group.id)"
          >
            <svg class="state-icon" :class="group.isPinned ? 'state-icon--pinned' : 'state-icon--unpinned'" viewBox="0 0 24 24" fill="none">
              <template v-if="group.isPinned">
                <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" fill="currentColor"/>
              </template>
              <template v-else>
                <circle cx="12" cy="12" r="7" stroke="currentColor" stroke-width="2"/>
                <circle cx="12" cy="12" r="2" fill="currentColor"/>
              </template>
            </svg>
          </button>
          <button
            v-else-if="group.enteredOtherGroupCoverage"
            class="action-btn state-btn state-btn--unpinned opacity-30 cursor-not-allowed"
            :title="t('sector.entered_other_coverage')"
          >
            <svg class="state-icon state-icon--unpinned" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="7" stroke="currentColor" stroke-width="2"/>
              <path d="M7 17L17 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
          <button
            v-if="props.editable && group.isNew && !group.baseline"
            class="action-btn state-btn state-btn--delete"
            :title="t('sector.delete_hub')"
            @click="emit('delete-group', group.id)"
          >
            <svg class="state-icon" viewBox="0 0 24 24" fill="none">
              <path d="M6 7h12l-1 14H7L6 7z" stroke="currentColor" stroke-width="1.5"/>
              <path d="M9 7V4h6v3" stroke="currentColor" stroke-width="1.5"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="group-config">
        <div class="config-row">
          <label class="config-label">{{ t('map.binding_anchor_sector') }}</label>
          <div class="config-value">
            <span class="pill pill--anchor">
              {{ getSectorName(group.sectorMacro || '') }}
            </span>
            <div class="jump-control">
              <template v-if="!canEditJumpRange(group)">
                <span class="jump-readonly">{{ group.jumpRange }}</span>
              </template>
              <JumpInput
                v-else
                :model-value="group.jumpRange"
                :min="0"
                :max="5"
                @update:model-value="(v: number) => emit('update-jump-range', group.id, v)"
              />
            </div>
          </div>
        </div>

        <!-- Tab selectors (edit mode only) -->
        <div v-if="props.editable" class="tab-bar">
          <button
            class="tab-btn"
            :class="{ 'tab-btn--active': getTab(group.id) === 'coverage' }"
            @click="setTab(group.id, 'coverage')"
          >{{ t('sector.tab_coverage') }}</button>
          <button
            class="tab-btn"
            :class="{ 'tab-btn--active': getTab(group.id) === 'candidates' }"
            @click="setTab(group.id, 'candidates')"
          >{{ t('sector.tab_candidates') }}</button>
          <button
            class="tab-btn"
            :class="{ 'tab-btn--active': getTab(group.id) === 'connected' }"
            @click="setTab(group.id, 'connected')"
          >{{ t('sector.tab_connected') }}</button>
        </div>

        <!-- Coverage tab -->
        <div v-if="!props.editable || getTab(group.id) === 'coverage'">
          <div v-if="getCoverageJumps(group).length > 0" class="config-row">
            <div v-for="jump in getCoverageJumps(group)" :key="jump" class="jump-group-grid">
              <span class="jump-number">{{ jump }}{{ t('map.resource_filter_jump_suffix') }}</span>
              <div class="pill-list">
                <span
                  v-for="entry in getCoverageByJump(group).get(jump)!"
                  :key="`${entry.connected ? 'link' : 'coverage'}:${entry.macro}`"
                  class="pill"
                  :class="getPillClass(entry)"
                >
                  {{ getSectorName(entry.macro) }}
                  <button
                    v-if="canEditPinnedInput(group)"
                    type="button"
                    class="pill-toggle"
                    :title="entry.active ? t('sector.pill_inactive') : ''"
                    @click.stop="entry.connected && entry.connectedGroupId
                      ? emit('toggle-connected-input', group.id, entry.connectedGroupId)
                      : emit('toggle-coverage-input', group.id, entry.macro)"
                  >
                    {{ entry.active ? 'x' : '+' }}
                  </button>
                </span>
              </div>
            </div>
          </div>
          <div v-else class="empty-tab">
            {{ t('sector.no_groups') }}
          </div>
        </div>

        <!-- Candidates tab -->
        <div v-if="props.editable && getTab(group.id) === 'candidates'">
          <div v-if="getCandidatesForGroup(group).length > 0" class="config-row">
            <div class="pill-list">
              <span
                v-for="cand in getCandidatesForGroup(group)"
                :key="cand.macro"
                class="pill"
                :class="getPillClass({ connected: false, active: cand.isActive, isBaseline: false, isAnchor: cand.isAnchor })"
              >
                <span class="pill-dot" :class="hasPlayerStation(cand.macro) ? 'pill-dot--filled' : 'pill-dot--empty'"></span>
                {{ getSectorName(cand.macro) }}
                <button
                  v-if="!cand.isAnchor && !cand.isActive"
                  type="button"
                  class="pill-toggle"
                  @click.stop="emit('add-candidate-coverage', group.id, cand.macro)"
                >+</button>
              </span>
            </div>
          </div>
          <div v-else class="empty-tab">
            {{ t('sector.no_groups') }}
          </div>
        </div>

        <!-- Connected tab -->
        <div v-if="props.editable && getTab(group.id) === 'connected'">
          <div v-if="getConnectedEntries(group).length > 0" class="config-row">
            <div class="pill-list">
              <span
                v-for="entry in getConnectedEntries(group)"
                :key="entry.groupId"
                class="pill pill--connected"
                :class="getPillClass({ connected: true, active: entry.active, isBaseline: entry.isBaseline })"
              >
                {{ entry.name }}
                <button
                  v-if="canEditPinnedInput(group)"
                  type="button"
                  class="pill-toggle"
                  @click.stop="emit('toggle-connected-input', group.id, entry.groupId)"
                >
                  {{ entry.active ? 'x' : '+' }}
                </button>
              </span>
            </div>
          </div>
          <div v-else class="empty-tab">
            {{ t('sector.no_groups') }}
          </div>
        </div>

        <div class="group-stats">
          <span>{{ group.coverageSectorMacros.length + 1 }} {{ t('map.binding_sector_count') }}</span>
          <span v-if="getUncertainCount(group.id) > 0" class="text-amber-400">
            {{ t('sector.uncertain') }}: {{ getUncertainCount(group.id) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.group-list {
  @apply flex flex-col gap-2 pb-2;
}

.empty-hint {
  @apply text-sm text-slate-500 text-center py-4;
}

.empty-tab {
  @apply text-xs text-slate-600 text-center py-2;
}

.action-btn {
  @apply text-xs p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700/50;
}


.group-item {
  @apply rounded border border-slate-700/50 bg-slate-800/40 p-2;
}

.group-item--new {
  @apply border-sky-500/20 bg-sky-500/5;
}

.group-item--pinned {
  @apply border-blue-500/30 bg-blue-500/5;
}

.group-item--unpinned {
  @apply border-slate-600/30 bg-slate-500/5;
}

.group-header {
  @apply flex items-center justify-between gap-2 mb-1;
}

.group-title-row {
  @apply flex min-w-0 flex-1 items-center gap-2;
}

.group-name {
  @apply truncate text-sm text-slate-200;
}

.group-actions {
  @apply flex items-center gap-1;
}

.action-btn {
  @apply text-xs p-1 rounded hover:bg-amber-500/10;
}

.state-btn--pinned {
  @apply text-sky-400;
}

.state-btn--unpinned {
  @apply text-slate-400;
}

.state-btn--delete {
  @apply text-rose-400 hover:text-rose-300;
}

.state-icon {
  @apply w-4 h-4 transition-transform;
}

.state-icon--pinned {
  transform: rotate(0deg);
}

.state-icon--unpinned {
  transform: rotate(0deg);
}

.group-config {
  @apply flex flex-col;
}

.config-row {
  @apply flex flex-col gap-2 mb-2;
}

.config-label {
  @apply text-xs font-semibold uppercase tracking-wider text-slate-400;
}

.config-value {
  @apply flex items-center gap-2;
}

.pill {
  @apply inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs;
  height: var(--binding-pill-height);
  line-height: var(--binding-pill-height);
}

.pill--anchor {
  @apply border-amber-200/40 bg-amber-200/15 text-amber-50 text-sm;
  max-width: none;
}

.pill--coverage {
  @apply border-amber-300/30 bg-amber-200/10 text-amber-100;
}

.pill--connected {
  @apply border-emerald-300/30 bg-emerald-500/10 text-emerald-200;
}

.pill--inactive {
  @apply border-dashed opacity-45;
}

.pill--baseline {
  @apply border-2;
}

.pill-toggle {
  @apply inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] leading-none text-current hover:bg-white/10;
}

.pill-dot {
  @apply inline-flex h-1.5 w-1.5 rounded-full;
}

.pill-dot--filled {
  @apply bg-emerald-400;
}

.pill-dot--empty {
  @apply border border-slate-500 bg-transparent;
}

.jump-control {
  @apply ml-auto;
}

.jump-readonly {
  @apply text-xs text-slate-400;
}

.jump-list {
  @apply flex flex-col gap-0.5;
}

.jump-group-grid {
  @apply grid items-start;
  grid-template-columns: max-content minmax(0, 1fr);
  --binding-pill-height: 1.375rem;
  column-gap: 0.375rem;
}

.jump-number {
  @apply text-xs text-slate-500 shrink-0;
  height: var(--binding-pill-height);
  line-height: var(--binding-pill-height);
}

.pill-list {
  @apply flex min-w-0 flex-wrap items-center gap-2;
}

.group-stats {
  @apply flex items-center gap-3 text-xs text-slate-500;
}

.tab-bar {
  @apply flex items-center gap-0.5 mb-2 border-b border-slate-700/50;
}

.tab-btn {
  @apply px-2 py-1 text-xs text-slate-500 hover:text-slate-300 transition-colors border-b-2 border-transparent;
}

.tab-btn--active {
  @apply text-sky-400 border-sky-500;
}
</style>

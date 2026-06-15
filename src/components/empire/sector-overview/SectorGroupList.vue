<script setup lang="ts">
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
  baselineConnectedGroupIdsByGroupId?: Record<string, string[]>
}>()

const emit = defineEmits<{
  (e: 'cycle-recalc-state', groupId: string): void
  (e: 'update-jump-range', groupId: string, range: number): void
  (e: 'toggle-coverage-input', groupId: string, sectorMacro: string): void
  (e: 'toggle-connected-input', groupId: string, connectedGroupId: string): void
  (e: 'add-candidate-coverage', groupId: string, sectorMacro: string): void
  (e: 'delete-group', groupId: string): void
  (e: 'toggle-retain-coverage', groupId: string): void
  (e: 'toggle-retain-connection', groupId: string): void
}>()

const { t, te } = useI18n()

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

function getPinnedTitle(group: GroupDraftInfo): string {
  return group.isPinned ? t('sector.recalc_state_pin') : t('sector.recalc_state_normal')
}

function canEditJumpRange(group: GroupDraftInfo): boolean {
  if (!props.editable) return false
  return group.isPinned
}

interface UnifiedPillEntry {
  type: 'coverage' | 'candidate' | 'connected'
  macro: string
  jump: number
  baseline: boolean
  removed: boolean
  wasInBaseline: boolean
  hasPlayerStation: boolean
  connectedGroupId?: string
  connectedGroupName?: string
  action: 'add' | 'transfer' | 'remove' | null
  covered?: boolean
}

function buildUnifiedPills(group: GroupDraftInfo): Map<number, UnifiedPillEntry[]> {
  const byJump = new Map<number, UnifiedPillEntry[]>()
  if (!group.sectorMacro) return byJump

  const allAnchorSectors = new Set(props.groups.filter(g => g.sectorMacro).map(g => g.sectorMacro!))
  const distMap = new Map<string, number>()
  const distances = getCoverageSectors(group.sectorMacro, 99, props.sectorGraph, props.sectorClusterMap)
  for (const d of distances) distMap.set(d.sectorMacro, d.distance)

  const otherActiveCoverage = new Map<string, string>()
  for (const other of props.groups) {
    if (other.id === group.id) continue
    for (const m of other.coverageSectorMacros) {
      otherActiveCoverage.set(m, other.id)
    }
  }

  const canEdit = props.editable && group.isPinned
  const baselineCov = new Set(props.baselineCoverageByGroupId?.[group.id] ?? [])

  // Coverage + candidate pills — single BFS pass, covered sectors get both entries
  for (const d of distances) {
    if (d.sectorMacro === group.sectorMacro) continue

    const isCovered = group.coverageSectorMacros.includes(d.sectorMacro)
    if (isCovered) {
      if (!byJump.has(d.distance)) byJump.set(d.distance, [])
      byJump.get(d.distance)!.push({
        type: 'coverage',
        macro: d.sectorMacro,
        jump: d.distance,
        baseline: baselineCov.has(d.sectorMacro),
        removed: false,
        wasInBaseline: false,
        hasPlayerStation: props.playerSectorMacros.includes(d.sectorMacro),
        action: canEdit && group.coverageRetainEnabled ? 'remove' : null
      })
    }
    if (d.distance <= group.jumpRange && !allAnchorSectors.has(d.sectorMacro) && props.editable && group.isPinned && group.coverageRetainEnabled) {
      // Candidate pill (semi-gold) — for covered sectors, shown only when retain off
      const isOtherCoverage = otherActiveCoverage.has(d.sectorMacro)
      if (!byJump.has(d.distance)) byJump.set(d.distance, [])
      byJump.get(d.distance)!.push({
        type: 'candidate',
        macro: d.sectorMacro,
        jump: d.distance,
        baseline: false,
        removed: false,
        wasInBaseline: baselineCov.has(d.sectorMacro),
        hasPlayerStation: props.playerSectorMacros.includes(d.sectorMacro),
        action: canEdit && group.coverageRetainEnabled ? (isOtherCoverage ? 'transfer' : 'add') : null,
        covered: isCovered
      })
    }
  }

  // Connected pills (green)
  const connectedSet = new Set(group.connectedGroupIds)
  const baselineConns = new Set(props.baselineConnectedGroupIdsByGroupId?.[group.id] ?? [])
  for (const other of props.groups) {
    if (other.id === group.id) continue
    if (!other.sectorMacro) continue
    const jump = distMap.get(other.sectorMacro)
    if (jump === undefined) continue

    const isConnected = connectedSet.has(other.id)
    if (isConnected) {
      if (!byJump.has(jump)) byJump.set(jump, [])
      byJump.get(jump)!.push({
        type: 'connected',
        macro: other.sectorMacro,
        jump,
        baseline: baselineConns.has(other.id),
        removed: false,
        wasInBaseline: false,
        hasPlayerStation: props.playerSectorMacros.includes(other.sectorMacro),
        connectedGroupId: other.id,
        connectedGroupName: other.sectorMacro ? getSectorName(other.sectorMacro) : other.name,
        action: canEdit && group.connectionRetainEnabled ? 'remove' : null
      })
    } else if (canEdit && group.connectionRetainEnabled && jump <= 5) {
      if (!byJump.has(jump)) byJump.set(jump, [])
      byJump.get(jump)!.push({
        type: 'connected',
        macro: other.sectorMacro,
        jump,
        baseline: false,
        removed: false,
        wasInBaseline: baselineConns.has(other.id),
        hasPlayerStation: props.playerSectorMacros.includes(other.sectorMacro),
        connectedGroupId: other.id,
        connectedGroupName: other.sectorMacro ? getSectorName(other.sectorMacro) : other.name,
        action: 'add'
      })
    }
  }

  // In result mode: add removed baseline coverage/connection pills (dashed)
  if (!props.editable && props.baselineCoverageByGroupId) {
    const currentCov = new Set(group.coverageSectorMacros)
    const currentConn = new Set(group.connectedGroupIds)
    const baselineCovEntries = props.baselineCoverageByGroupId[group.id] ?? []
    const baselineConnEntries = props.baselineConnectedGroupIdsByGroupId?.[group.id] ?? []

    // Removed coverage pills (dashed gold)
    for (const sectorMacro of baselineCovEntries) {
      if (currentCov.has(sectorMacro)) continue
      const jump = distMap.get(sectorMacro)
      if (jump === undefined) continue

      // If this removed coverage sector is now a connected target, skip — already shown as normal connected pill
      if (props.groups.some(g => g.sectorMacro === sectorMacro && connectedSet.has(g.id))) continue

      if (!byJump.has(jump)) byJump.set(jump, [])
      byJump.get(jump)!.push({
        type: 'coverage',
        macro: sectorMacro,
        jump,
        baseline: false,
        removed: true,
        wasInBaseline: false,
        hasPlayerStation: props.playerSectorMacros.includes(sectorMacro),
        action: null
      })
    }

    // Removed connected pills (dashed green)
    for (const connId of baselineConnEntries) {
      if (currentConn.has(connId)) continue
      const targetGroup = props.groups.find(g => g.id === connId)
      if (!targetGroup || !targetGroup.sectorMacro) continue
      const jump = distMap.get(targetGroup.sectorMacro)
      if (jump === undefined) continue

      if (!byJump.has(jump)) byJump.set(jump, [])
      byJump.get(jump)!.push({
        type: 'connected',
        macro: targetGroup.sectorMacro,
        jump,
        baseline: false,
        removed: true,
        wasInBaseline: false,
        hasPlayerStation: props.playerSectorMacros.includes(targetGroup.sectorMacro),
        connectedGroupId: connId,
        connectedGroupName: targetGroup.sectorMacro ? getSectorName(targetGroup.sectorMacro) : targetGroup.name,
        action: null
      })
    }
  }

  return byJump
}

function getPillJumps(group: GroupDraftInfo): number[] {
  return Array.from(buildUnifiedPills(group).keys()).sort((a, b) => a - b)
}

function getUncertainCount(groupId: string): number {
  return props.assignments.filter((a) =>
    (a.status === 'uncertain_tie' || a.status === 'uncertain_extend') && a.defaultGroupId === groupId
  ).length
}

function onPillAction(entry: UnifiedPillEntry, groupId: string) {
  if (!props.editable) return
  if (entry.action === 'remove') {
    if (entry.type === 'connected' && entry.connectedGroupId) {
      emit('toggle-connected-input', groupId, entry.connectedGroupId)
    } else if (entry.type === 'coverage') {
      emit('toggle-coverage-input', groupId, entry.macro)
    }
  } else if (entry.action === 'add') {
    if (entry.type === 'connected' && entry.connectedGroupId) {
      emit('toggle-connected-input', groupId, entry.connectedGroupId)
    } else {
      emit('add-candidate-coverage', groupId, entry.macro)
    }
  } else if (entry.action === 'transfer') {
    emit('add-candidate-coverage', groupId, entry.macro)
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
        'group-item--unpinned': !group.isPinned && group.baseline,
        'group-item--baseline': group.baseline && !editable
      }"
    >
      <div class="group-header">
        <div class="group-title-row">
          <span class="group-name">{{ group.name }}</span>
        </div>
        <div class="group-actions">
          <label v-if="props.editable" class="retain-chk" :title="t('sector.coverage_retain')">
            <input type="checkbox" class="bar-checkbox" :checked="group.coverageRetainEnabled" :disabled="!group.isPinned" @change="emit('toggle-retain-coverage', group.id)" />
            <span class="retain-label">{{ t('sector.group_coverage_jump_short') }}</span>
          </label>
          <label v-if="props.editable" class="retain-chk" :title="t('sector.bridge_retain')">
            <input type="checkbox" class="bar-checkbox" :checked="group.connectionRetainEnabled" :disabled="!group.isPinned" @change="emit('toggle-retain-connection', group.id)" />
            <span class="retain-label">{{ t('sector.tab_connected') }}</span>
          </label>
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
              <span class="pill-dot" :class="playerSectorMacros.includes(group.sectorMacro || '') ? 'pill-dot--filled' : 'pill-dot--empty'"/>
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

        <div v-if="getPillJumps(group).length > 0" class="config-row">
          <div v-for="jump in getPillJumps(group)" :key="jump" class="jump-group-grid">
            <span class="jump-number">{{ jump }}{{ t('map.resource_filter_jump_suffix') }}</span>
            <div class="pill-list">
              <span
                v-for="entry in buildUnifiedPills(group).get(jump)!"
                :key="`${entry.type}:${entry.connectedGroupId || entry.macro}:${entry.removed}`"
                v-show="entry.type !== 'candidate' || !entry.covered || !group.coverageRetainEnabled"
                class="pill"
                :class="{
                  'pill--coverage': entry.type === 'coverage',
                  'pill--candidate': entry.type === 'candidate',
                  'pill--connected': entry.type === 'connected',
                  'pill--baseline': entry.baseline,
                  'pill--new': entry.wasInBaseline || (!entry.baseline && !entry.removed && entry.type !== 'candidate' && entry.action !== 'add'),
                  'pill--removed': entry.removed
                }"
              >
                <span class="pill-dot" :class="entry.hasPlayerStation ? 'pill-dot--filled' : 'pill-dot--empty'"/>
                {{ entry.type === 'connected' && entry.connectedGroupName ? entry.connectedGroupName : getSectorName(entry.macro) }}
                <button
                  v-if="entry.action && props.editable"
                  type="button"
                  class="pill-action"
                  :class="{
                    'pill-action--remove': entry.action === 'remove',
                    'pill-action--add': entry.action === 'add',
                    'pill-action--transfer': entry.action === 'transfer'
                  }"
                  @click.stop="onPillAction(entry, group.id)"
                >
                  {{ entry.action === 'remove' ? 'x' : entry.action === 'transfer' ? '→' : '+' }}
                </button>
              </span>
            </div>
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

.group-item {
  @apply rounded border border-slate-700/50 bg-slate-800/40 p-2;
}

.group-item--new {
  @apply border-sky-500/20 bg-sky-500/5 border-2 border-l-[3px] border-l-sky-400;
}

.group-item--pinned {
  @apply border-blue-500/30 bg-blue-500/5;
}

.group-item--unpinned {
  @apply border-slate-600/30 bg-slate-500/5;
}

.group-item--baseline {
  /* baseline groups keep default style */
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

.pill--candidate {
  @apply border-amber-300/20 bg-amber-200/5 text-amber-200/70;
}

.pill--baseline {
  border-width: 1px;
}

.pill--new {
  @apply border-2;
  box-shadow: inset 5px 0 0 0 rgb(56 189 248 / 0.35);
}

.pill--removed {
  @apply border-dashed opacity-60;
}

.pill--connected {
  @apply border-emerald-300/30 bg-emerald-500/10 text-emerald-200;
}


.pill-action--remove {
  @apply text-rose-300;
}

.pill-action--add {
  @apply text-emerald-400;
}

.pill-action--transfer {
  @apply text-amber-400;
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

.retain-chk {
  @apply inline-flex items-center gap-0.5 cursor-pointer;
}

.retain-label {
  @apply text-[10px] text-slate-500;
}
</style>

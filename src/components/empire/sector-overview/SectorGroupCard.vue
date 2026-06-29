<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { SketchPicker } from 'vue-color'
import { HUB_PALETTE } from '@/store/logic/hubColor'
import type { GroupDraftInfo, SectorAssignment } from '@/store/logic/autoGroup'
import { resolveMapSectorByMacro } from '@/components/map/utils/mapSectorMacro'
import { getCoverageSectors, getReachableCoverageSectors } from '@/store/logic/saveBindingUtils'
import JumpInput from '@/components/common/JumpInput.vue'
import type { SectorReachability, X4MapSector } from '@/types/x4'

const props = withDefaults(defineProps<{
  group: GroupDraftInfo
  groups: GroupDraftInfo[]
  assignments: SectorAssignment[]
  maps: { clusters: Record<string, { sectors?: string[] }>; sectors: Record<string, X4MapSector> } | null | undefined
  sectorGraph: Record<string, string[]>
  sectorClusterMap: Record<string, string>
  sectorReachability?: SectorReachability
  playerSectorMacros: string[]
  editable: boolean
  retainEditable?: boolean
  diffEnabled: boolean
  view?: 'map' | 'live'
  showSelectGroupButton?: boolean
  showDragHandle?: boolean
  showRecalcStateButton?: boolean
  structureDisabled?: boolean
  baselineCoverageByGroupId?: Record<string, string[]>
  baselineConnectedGroupIdsByGroupId?: Record<string, string[]>
  tradeStationCaps?: Record<string, number>
}>(), {
  view: 'live',
  retainEditable: false,
  showSelectGroupButton: false,
  showDragHandle: false,
  showRecalcStateButton: true,
  structureDisabled: false
})

const emit = defineEmits<{
  (e: 'cycle-recalc-state', groupId: string): void
  (e: 'update-jump-range', groupId: string, range: number): void
  (e: 'toggle-coverage-input', groupId: string, sectorMacro: string): void
  (e: 'toggle-connected-input', groupId: string, connectedGroupId: string): void
  (e: 'add-candidate-coverage', groupId: string, sectorMacro: string): void
  (e: 'delete-group', groupId: string): void
  (e: 'toggle-retain-coverage', groupId: string): void
  (e: 'toggle-retain-connection', groupId: string): void
  (e: 'toggle-retain-trade-station', groupId: string): void
  (e: 'focus-sector', sectorMacro: string): void
  (e: 'select-group', sectorGroupId: string): void
  (e: 'color-change', groupId: string, color: string | undefined): void
}>()

const { t, te } = useI18n()

const showColorPicker = ref(false)

function onColorChipClick() {
  if (!props.editable) return
  showColorPicker.value = !showColorPicker.value
}

function onColorUpdate(hex: string) {
  // vue-color SketchPicker may emit object or string
  const color = typeof hex === 'string' ? hex : '#3b82f6'
  emit('color-change', props.group.id, color)
  showColorPicker.value = false
}

function onPresetClick(e: MouseEvent) {
  const target = (e.target as HTMLElement).closest('.preset-color')
  if (target) {
    const hex = target.getAttribute('data-color')
    if (hex === 'transparent') {
      emit('color-change', props.group.id, undefined)
    } else if (hex) {
      emit('color-change', props.group.id, hex)
    }
    showColorPicker.value = false
  }
}

function onPickerOverlayClick() {
  showColorPicker.value = false
}

function onEsc(e: KeyboardEvent) {
  if (e.key === 'Escape') showColorPicker.value = false
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

function getPinnedTitle(group: GroupDraftInfo): string {
  return group.isPinned ? t('sector.recalc_state_pin') : t('sector.recalc_state_normal')
}

function canEditJumpRange(group: GroupDraftInfo): boolean {
  if (!props.editable) return false
  return group.isPinned
}

function getBaselineKey(group: GroupDraftInfo): string {
  return group.sectorMacro || group.id
}

function getBaselineCoverage(group: GroupDraftInfo): string[] {
  const coverageByGroupId = props.baselineCoverageByGroupId
  if (!coverageByGroupId) return []
  return coverageByGroupId[getBaselineKey(group)] ?? coverageByGroupId[group.id] ?? []
}

function getBaselineConnectedGroupIds(group: GroupDraftInfo): string[] {
  const connectedByGroupId = props.baselineConnectedGroupIdsByGroupId
  if (!connectedByGroupId) return []
  return connectedByGroupId[getBaselineKey(group)] ?? connectedByGroupId[group.id] ?? []
}

function isNewComparedToBaseline(group: GroupDraftInfo): boolean {
  if (!props.diffEnabled) return false
  const baselineCoverage = props.baselineCoverageByGroupId
  if (!baselineCoverage) return false
  return !Object.prototype.hasOwnProperty.call(baselineCoverage, getBaselineKey(group)) &&
    !Object.prototype.hasOwnProperty.call(baselineCoverage, group.id)
}

function emitToggleTradeStationRetain(groupId: string) {
  emit('toggle-retain-trade-station', groupId)
}

const tradeStationCap = computed<number | null>(() => {
  const caps = props.tradeStationCaps
  if (!caps) return null
  return caps[props.group.id] ?? null
})

function formatCapM(cap: number): string {
  return Math.floor(cap / 1_000_000) + 'M'
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
  const distances = getReachableCoverageSectors(props.sectorReachability, group.sectorMacro, 5)
    || getCoverageSectors(group.sectorMacro, 5, props.sectorGraph, props.sectorClusterMap)
  for (const d of distances) distMap.set(d.sectorMacro, d.distance)

  const otherActiveCoverage = new Map<string, string>()
  for (const other of props.groups) {
    if (other.id === group.id) continue
    for (const m of other.coverageSectorMacros) {
      otherActiveCoverage.set(m, other.id)
    }
  }

  const canEdit = props.editable && group.isPinned
  const baselineCov = new Set(getBaselineCoverage(group))

  for (const d of distances) {
    if (d.sectorMacro === group.sectorMacro) continue
    const isCovered = group.coverageSectorMacros.includes(d.sectorMacro)
    if (isCovered) {
      if (!byJump.has(d.distance)) byJump.set(d.distance, [])
      byJump.get(d.distance)!.push({
        type: 'coverage', macro: d.sectorMacro, jump: d.distance,
        baseline: baselineCov.has(d.sectorMacro), removed: false, wasInBaseline: false,
        hasPlayerStation: props.playerSectorMacros.includes(d.sectorMacro),
        action: canEdit && group.coverageRetainEnabled ? 'remove' : null
      })
    }
    if (d.distance <= Math.min(group.jumpRange, 5) && !allAnchorSectors.has(d.sectorMacro) && props.editable && group.isPinned && group.coverageRetainEnabled) {
      const isOtherCoverage = otherActiveCoverage.has(d.sectorMacro)
      if (!byJump.has(d.distance)) byJump.set(d.distance, [])
      byJump.get(d.distance)!.push({
        type: 'candidate', macro: d.sectorMacro, jump: d.distance,
        baseline: false, removed: false, wasInBaseline: baselineCov.has(d.sectorMacro),
        hasPlayerStation: props.playerSectorMacros.includes(d.sectorMacro),
        action: canEdit && group.coverageRetainEnabled ? (isOtherCoverage ? 'transfer' : 'add') : null,
        covered: isCovered
      })
    }
  }

  const connectedSet = new Set(group.connectedGroupIds)
  const baselineConns = new Set(getBaselineConnectedGroupIds(group))
  for (const other of props.groups) {
    if (other.id === group.id) continue
    if (!other.sectorMacro) continue
    const jump = distMap.get(other.sectorMacro)
    if (jump === undefined) continue
    const isConnected = connectedSet.has(other.id)
    if (isConnected) {
      if (!byJump.has(jump)) byJump.set(jump, [])
      byJump.get(jump)!.push({
        type: 'connected', macro: other.sectorMacro, jump,
        baseline: baselineConns.has(other.id) || (!!other.sectorMacro && baselineConns.has(other.sectorMacro)), removed: false, wasInBaseline: false,
        hasPlayerStation: props.playerSectorMacros.includes(other.sectorMacro),
        connectedGroupId: other.id,
        connectedGroupName: other.sectorMacro ? getSectorName(other.sectorMacro) : other.name,
        action: canEdit && group.connectionRetainEnabled ? 'remove' : null
      })
    } else if (canEdit && group.connectionRetainEnabled && jump <= 5) {
      if (!byJump.has(jump)) byJump.set(jump, [])
      byJump.get(jump)!.push({
        type: 'connected', macro: other.sectorMacro, jump,
        baseline: false, removed: false, wasInBaseline: baselineConns.has(other.id) || (!!other.sectorMacro && baselineConns.has(other.sectorMacro)),
        hasPlayerStation: props.playerSectorMacros.includes(other.sectorMacro),
        connectedGroupId: other.id,
        connectedGroupName: other.sectorMacro ? getSectorName(other.sectorMacro) : other.name,
        action: 'add'
      })
    }
  }

  if (!props.editable && props.diffEnabled && props.baselineCoverageByGroupId) {
    const currentCov = new Set(group.coverageSectorMacros)
    const currentConn = new Set(group.connectedGroupIds)
    const baselineCovEntries = getBaselineCoverage(group)
    const baselineConnEntries = getBaselineConnectedGroupIds(group)

    for (const sectorMacro of baselineCovEntries) {
      if (currentCov.has(sectorMacro)) continue
      const jump = distMap.get(sectorMacro)
      if (jump === undefined) continue
      if (props.groups.some(g => g.sectorMacro === sectorMacro && connectedSet.has(g.id))) continue
      if (!byJump.has(jump)) byJump.set(jump, [])
      byJump.get(jump)!.push({
        type: 'coverage', macro: sectorMacro, jump,
        baseline: false, removed: true, wasInBaseline: false,
        hasPlayerStation: props.playerSectorMacros.includes(sectorMacro),
        action: null
      })
    }

    const currentConnSectorMacros = new Set(
      group.connectedGroupIds
        .map((connId) => props.groups.find((g) => g.id === connId)?.sectorMacro)
        .filter((sectorMacro): sectorMacro is string => !!sectorMacro)
    )
    for (const connId of baselineConnEntries) {
      if (currentConn.has(connId) || currentConnSectorMacros.has(connId)) continue
      const targetGroup = props.groups.find(g => g.id === connId || g.sectorMacro === connId)
      if (!targetGroup || !targetGroup.sectorMacro) continue
      const jump = distMap.get(targetGroup.sectorMacro)
      if (jump === undefined) continue
      if (!byJump.has(jump)) byJump.set(jump, [])
      byJump.get(jump)!.push({
        type: 'connected', macro: targetGroup.sectorMacro, jump,
        baseline: false, removed: true, wasInBaseline: false,
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

function onPillClick(entry: UnifiedPillEntry) {
  if (props.view === 'map') {
    emit('focus-sector', entry.macro)
  }
}

function onAnchorPillClick(macro: string) {
  if (props.view === 'map' && macro) {
    emit('focus-sector', macro)
  }
}
</script>

<template>
  <div
    class="group-item"
    @keydown="onEsc"
    :class="{
      'group-item--new': isNewComparedToBaseline(group),
      'group-item--pinned': group.isPinned,
      'group-item--unpinned': !group.isPinned && group.baseline,
      'group-item--baseline': group.baseline && !editable,
      'group-item--map': view === 'map'
    }"
  >
    <div class="group-header">
      <div class="group-title-row">
        <div v-if="showDragHandle" class="drag-handle">
          <svg class="drag-handle-icon" viewBox="0 0 8 12" fill="currentColor" width="8" height="12">
            <circle cx="2" cy="2" r="1"/><circle cx="6" cy="2" r="1"/>
            <circle cx="2" cy="6" r="1"/><circle cx="6" cy="6" r="1"/>
            <circle cx="2" cy="10" r="1"/><circle cx="6" cy="10" r="1"/>
          </svg>
        </div>
        <span class="group-name">{{ group.name }}</span>
        <button
          class="color-chip"
          :class="{ 'color-chip--empty': !group.color }"
          :style="{ background: group.color || 'transparent' }"
          :disabled="!editable"
          :title="editable ? t('sector.hub_color') : ''"
          @click="onColorChipClick"
        />
      </div>
      <div class="group-actions">
        <label v-if="props.retainEditable" class="retain-chk" :title="t('sector.bridge_retain')">
          <input type="checkbox" class="bar-checkbox" :checked="group.connectionRetainEnabled" :disabled="!group.isPinned" @change="emit('toggle-retain-connection', group.id)" />
          <span class="retain-label">{{ t('sector.connected') }}</span>
        </label>
        <label v-if="props.retainEditable" class="retain-chk" :title="t('sector.coverage_retain')">
          <input type="checkbox" class="bar-checkbox" :checked="group.coverageRetainEnabled" :disabled="!group.isPinned" @change="emit('toggle-retain-coverage', group.id)" />
          <span class="retain-label">{{ t('sector.group_coverage_jump_short') }}</span>
        </label>
        <label v-if="props.retainEditable" class="retain-chk" :title="t('sector.trade_station_retain')">
          <input type="checkbox" class="bar-checkbox" :checked="!!group.tradeStationRetainEnabled" :disabled="!group.isPinned" @change="emitToggleTradeStationRetain(group.id)" />
          <span class="retain-label">{{ t('sector.trade_station_short') }}</span>
        </label>
        <button
          v-if="props.showRecalcStateButton && !group.enteredOtherGroupCoverage"
          class="action-btn state-btn"
          :class="group.isPinned ? 'state-btn--pinned' : 'state-btn--unpinned'"
          :disabled="props.structureDisabled"
          :title="getPinnedTitle(group)"
          @click="!props.structureDisabled && emit('cycle-recalc-state', group.id)"
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
          :disabled="props.structureDisabled"
          :title="t('sector.delete_hub')"
          @click="!props.structureDisabled && emit('delete-group', group.id)"
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
          <span
            class="pill pill--anchor"
            :class="{ 'cursor-pointer': view === 'map' }"
          >
            <span class="pill-dot" :class="playerSectorMacros.includes(group.sectorMacro || '') ? 'pill-dot--filled' : 'pill-dot--empty'"/>
            <span class="pill-label" @click.stop="onAnchorPillClick(group.sectorMacro || '')">
              {{ getSectorName(group.sectorMacro || '') }}
            </span>
          </span>
          <span
            v-if="group.selectedTradeStation"
            class="pill pill--trade-station"
            :class="{ 'cursor-pointer hover:text-sky-300': view === 'map' }"
          >
            <span class="pill-dot pill-dot--small" :class="group.selectedTradeStation.type === 'virtual' ? 'pill-dot--empty' : 'pill-dot--filled'"/>
            <span class="pill-label" @click.stop="view === 'map' && group.sectorMacro && emit('focus-sector', group.sectorMacro)">
              <template v-if="group.selectedTradeStation.type === 'virtual'">{{ t('sector.virtual_trade_station') }}</template>
              <template v-else>{{ group.selectedTradeStation.stationCode }}<span v-if="tradeStationCap !== null">&nbsp;{{ formatCapM(tradeStationCap) }}</span></template>
            </span>
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
                'pill--baseline': props.diffEnabled && entry.baseline,
                'pill--new': props.diffEnabled && (entry.wasInBaseline || (!entry.baseline && !entry.removed && entry.type !== 'candidate' && entry.action !== 'add')),
                'pill--removed': props.diffEnabled && entry.removed,
                'cursor-pointer': view === 'map'
              }"
            >
              <span class="pill-dot" :class="entry.hasPlayerStation ? 'pill-dot--filled' : 'pill-dot--empty'"/>
              <span class="pill-label" @click.stop="onPillClick(entry)">
                {{ entry.type === 'connected' && entry.connectedGroupName ? entry.connectedGroupName : getSectorName(entry.macro) }}
              </span>
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

    <Teleport to="body">
      <div v-if="showColorPicker" class="color-picker-overlay" @click="onPickerOverlayClick" />
      <div v-if="showColorPicker" class="color-picker-popper" @click="onPresetClick" @keydown="onEsc">
        <SketchPicker
          :model-value="group.color || '#3b82f6'"
          :preset-colors="HUB_PALETTE"
          :disable-alpha="true"
          @update:model-value="onColorUpdate"
        />
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.group-item {
  @apply rounded border border-slate-700/50 bg-slate-800/40 p-2;
}

.group-item--new {
  @apply border-sky-500/20 bg-sky-500/5 border-2;
  border-left: 3px solid #38bdf8 !important;
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
  height: var(--binding-pill-height, 1.375rem);
  line-height: var(--binding-pill-height, 1.375rem);
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

.pill--connected {
  @apply border-emerald-300/30 bg-emerald-500/10 text-emerald-200;
}

.pill--anchor {
  border-color: #fde68a66;
  background-color: #fde68a26;
  color: #fffbeb;
  font-size: 0.875rem;
  line-height: 1.25rem;
  max-width: none;
}

.pill--coverage {
  border-color: #fcd34d4d;
  background-color: #fcd34d1a;
  color: #fef3c7;
}

.pill--candidate {
  border-color: #fcd34d33;
  background-color: #fcd34d0d;
  color: #fef3c7b3;
}

.pill--baseline {
  border-width: 1px;
}

.pill--new {
  @apply border-2;
}

.pill--new.pill--coverage {
  box-shadow: inset 5px 0 0 0 rgb(252 211 77 / 0.30);
}

.pill--new.pill--connected {
  box-shadow: inset 5px 0 0 0 rgb(110 231 183 / 0.30);
}

.pill--new.pill--candidate {
  box-shadow: inset 5px 0 0 0 rgb(252 211 77 / 0.20);
}

.pill--removed {
  @apply border-dashed opacity-60;
}

.pill--connected {
  border-color: #6ee7b74d;
  background-color: #10b9811a;
  color: #a7f3d0;
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

.pill-label {
  @apply cursor-pointer;
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

.pill--trade-station {
  @apply inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-xs text-sky-200;
}

.pill-dot--small {
  @apply h-1 w-1;
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

/* Drag handle */
.drag-handle {
  @apply cursor-grab text-slate-500 select-none shrink-0;
  user-select: none;
}

.drag-handle:active {
  @apply cursor-grabbing;
}

/* Station binding icon button */
.station-bind-icon-btn {
  @apply inline-flex h-7 w-7 items-center justify-center rounded text-amber-100/65 transition-colors hover:bg-amber-200/10 hover:text-amber-50 shrink-0;
}

.station-bind-svg {
  @apply w-4 h-4;
}

/* Map compact */
.group-item--map {
  @apply p-1.5;
}

.group-item--map .group-header {
  @apply mb-0.5;
}

.group-item--map .config-row {
  @apply mb-1.5;
}

.group-item--map .config-label {
  @apply text-[11px];
}

.group-item--map .pill {
  font-size: 11px;
}

.group-item--map .jump-group-grid {
  column-gap: 0.25rem;
}

.group-item--map .pill-list {
  @apply gap-1;
}

.bar-checkbox {
  @apply h-3.5 w-3.5 accent-sky-500;
}

.color-chip {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border: 1px solid #475569;
  cursor: pointer;
  flex-shrink: 0;
  transition: transform .15s;
}

.color-chip:hover {
  transform: scale(1.15);
}

.color-chip--empty {
  border-style: dashed;
  border-color: #64748b;
  background: transparent;
}

.color-chip:disabled {
  cursor: default;
  pointer-events: none;
}

.color-picker-overlay {
  position: fixed;
  inset: 0;
  z-index: 999;
}

.color-picker-popper {
  position: fixed;
  z-index: 1000;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.color-picker-popper :deep(.vc-sketch-picker) {
  width: 260px;
}

.color-picker-popper :deep(.presets) {
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: 3px;
  padding: 10px 10px 8px;
}

.color-picker-popper :deep(.preset-color) {
  width: 100% !important;
  height: auto !important;
  aspect-ratio: 1;
  margin: 0 !important;
}

.color-picker-popper :deep(.preset-color[aria-selected="true"]) {
  box-shadow: 0 0 0 2px #1e293b, 0 0 0 4px #60a5fa !important;
  z-index: 1;
}
</style>

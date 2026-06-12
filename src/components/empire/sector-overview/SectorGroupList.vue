<script setup lang="ts">
import { computed } from 'vue'
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
}>()

const emit = defineEmits<{
  (e: 'toggle-pin', groupId: string): void
  (e: 'update-jump-range', groupId: string, range: number): void
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

function getCoverageByJump(group: GroupDraftInfo): Map<number, Array<{ macro: string; connected: boolean }>> {
  const byJump = new Map<number, Array<{ macro: string; connected: boolean }>>()
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
    byJump.get(jump)!.push({ macro: sector, connected: false })
  }

  for (const connId of group.connectedGroupIds) {
    const connGroup = props.groups.find(g => g.id === connId)
    if (!connGroup?.sectorMacro || connGroup.sectorMacro === group.sectorMacro) continue
    const jump = distMap.get(connGroup.sectorMacro) ?? 0
    if (!byJump.has(jump)) byJump.set(jump, [])
    byJump.get(jump)!.push({ macro: connGroup.sectorMacro, connected: true })
  }

  return byJump
}

function getCoverageJumps(group: GroupDraftInfo): number[] {
  return Array.from(getCoverageByJump(group).keys()).sort((a, b) => a - b)
}

function getUncertainCount(groupId: string): number {
  return props.assignments.filter((a) =>
    (a.status === 'uncertain_tie' || a.status === 'uncertain_extend') && a.defaultGroupId === groupId
  ).length
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
      :class="{ 'group-item--new': group.isNew, 'group-item--pinned': group.isPinned }"
    >
      <div class="group-header">
        <div class="group-title-row">
          <span class="group-name">{{ group.name }}</span>
        </div>
        <div class="group-actions">
          <button
            v-if="group.isNew && props.editable"
            class="action-btn pin-btn"
            :class="{ 'pin-btn--active': group.isPinned }"
            :title="t('sector.pin_group')"
            @click="emit('toggle-pin', group.id)"
          >
            <svg class="pin-icon" :class="{ 'pin-icon--active': group.isPinned }" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/>
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
              <template v-if="!props.editable || (!group.isPinned && group.isNew)">
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

        <div v-if="getCoverageJumps(group).length > 0" class="config-row">
          <div v-for="jump in getCoverageJumps(group)" :key="jump" class="jump-group-grid">
            <span class="jump-number">{{ jump }}{{ t('map.resource_filter_jump_suffix') }}</span>
            <div class="pill-list">
              <span
                v-for="entry in getCoverageByJump(group).get(jump)!"
                :key="entry.macro"
                class="pill"
                :class="entry.connected ? 'pill--connected' : 'pill--coverage'"
              >
                {{ getSectorName(entry.macro) }}
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

.pin-btn--active {
  @apply text-sky-400;
}

.pin-icon {
  @apply w-4 h-4 transition-transform;
  transform: rotate(-90deg);
}

.pin-icon--active {
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
</style>

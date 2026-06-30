<script setup lang="ts">
import draggable from 'vuedraggable'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { GroupDraftInfo, SectorAssignment } from '@/store/logic/autoGroup'
import type { SectorReachability, X4MapSector } from '@/types/x4'
import SectorGroupCard from './SectorGroupCard.vue'

const props = withDefaults(defineProps<{
  groups: GroupDraftInfo[]
  assignments: SectorAssignment[]
  maps: { clusters: Record<string, { sectors?: string[] }>; sectors: Record<string, X4MapSector> } | null | undefined
  sectorGraph: Record<string, string[]>
  sectorClusterMap: Record<string, string>
  sectorReachability?: SectorReachability
  playerSectorMacros: string[]
  editable: boolean
  retainEditable?: boolean
  jumpRangeEditable?: boolean
  forceUnpinned?: boolean
  pinDisabled?: boolean
  diffEnabled: boolean
  view?: 'map' | 'live'
  showSelectGroupButton?: boolean
  showRecalcStateButton?: boolean
  draggable?: boolean
  structureDisabled?: boolean
  baselineCoverageByGroupId?: Record<string, string[]>
  baselineConnectedGroupIdsByGroupId?: Record<string, string[]>
  tradeStationCaps?: Record<string, number>
}>(), {
  view: 'live',
  retainEditable: false,
  jumpRangeEditable: false,
  forceUnpinned: false,
  pinDisabled: false,
  showSelectGroupButton: false,
  showRecalcStateButton: true,
  draggable: false,
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
  (e: 'reorder', groups: GroupDraftInfo[]): void
  (e: 'color-change', groupId: string, color: string | undefined): void
}>()
const { t } = useI18n()

const cardBase = computed(() => ({
  assignments: props.assignments,
  maps: props.maps,
  sectorGraph: props.sectorGraph,
  sectorClusterMap: props.sectorClusterMap,
  sectorReachability: props.sectorReachability,
  playerSectorMacros: props.playerSectorMacros,
  editable: props.editable,
  retainEditable: props.retainEditable,
  jumpRangeEditable: props.jumpRangeEditable,
  forceUnpinned: props.forceUnpinned,
  pinDisabled: props.pinDisabled,
  diffEnabled: props.diffEnabled,
  view: props.view,
  showSelectGroupButton: props.showSelectGroupButton,
  showRecalcStateButton: props.showRecalcStateButton,
  structureDisabled: props.structureDisabled,
  baselineCoverageByGroupId: props.baselineCoverageByGroupId,
  baselineConnectedGroupIdsByGroupId: props.baselineConnectedGroupIdsByGroupId,
  tradeStationCaps: props.tradeStationCaps ?? {}
}))

function onUpdateJumpRange(groupId: string, range: number) { emit('update-jump-range', groupId, range) }
function onToggleCoverageInput(groupId: string, sectorMacro: string) { emit('toggle-coverage-input', groupId, sectorMacro) }
function onToggleConnectedInput(groupId: string, connectedGroupId: string) { emit('toggle-connected-input', groupId, connectedGroupId) }
function onAddCandidateCoverage(groupId: string, sectorMacro: string) { emit('add-candidate-coverage', groupId, sectorMacro) }
function onCycleRecalcState(groupId: string) { emit('cycle-recalc-state', groupId) }
function onDeleteGroup(groupId: string) { emit('delete-group', groupId) }
function onToggleRetainCoverage(groupId: string) { emit('toggle-retain-coverage', groupId) }
function onToggleRetainConnection(groupId: string) { emit('toggle-retain-connection', groupId) }
function onToggleRetainTradeStation(groupId: string) { emit('toggle-retain-trade-station', groupId) }
function onFocusSector(sectorMacro: string) { emit('focus-sector', sectorMacro) }
function onSelectGroup(sectorGroupId: string) { emit('select-group', sectorGroupId) }
function onColorChange(groupId: string, color: string | undefined) { emit('color-change', groupId, color) }
</script>

<template>
  <div class="group-list" :class="{ 'group-list--map': view === 'map' }">
    <div v-if="groups.length === 0" class="empty-hint">
      {{ t('sector.no_groups') }}
    </div>

    <draggable
      v-if="draggable"
      :list="groups"
      item-key="id"
      class="flex flex-col gap-2"
      handle=".drag-handle"
      :animation="200"
      :force-fallback="true"
      :fallback-on-body="true"
      :fallback-tolerance="0"
      :scroll="true"
      :scroll-sensitivity="100"
      :scroll-speed="15"
      ghost-class="drag-placeholder"
      @change="emit('reorder', groups)"
    >
      <template #item="{ element: group }">
        <SectorGroupCard
          :key="`drag:${group.id}`"
          :group="group"
          :groups="groups"
          v-bind="cardBase"
          :show-drag-handle="true"
          @cycle-recalc-state="onCycleRecalcState"
          @update-jump-range="onUpdateJumpRange"
          @toggle-coverage-input="onToggleCoverageInput"
          @toggle-connected-input="onToggleConnectedInput"
          @add-candidate-coverage="onAddCandidateCoverage"
          @delete-group="onDeleteGroup"
          @toggle-retain-coverage="onToggleRetainCoverage"
          @toggle-retain-connection="onToggleRetainConnection"
          @toggle-retain-trade-station="onToggleRetainTradeStation"
          @focus-sector="onFocusSector"
          @select-group="onSelectGroup"
          @color-change="onColorChange"
        />
      </template>
    </draggable>

    <div v-else class="flex flex-col gap-2">
      <SectorGroupCard
        v-for="group in groups"
        :key="`static:${group.id}`"
        :group="group"
        :groups="groups"
        v-bind="cardBase"
        :show-drag-handle="false"
        @cycle-recalc-state="onCycleRecalcState"
        @update-jump-range="onUpdateJumpRange"
        @toggle-coverage-input="onToggleCoverageInput"
        @toggle-connected-input="onToggleConnectedInput"
        @add-candidate-coverage="onAddCandidateCoverage"
        @delete-group="onDeleteGroup"
        @toggle-retain-coverage="onToggleRetainCoverage"
        @toggle-retain-connection="onToggleRetainConnection"
        @toggle-retain-trade-station="onToggleRetainTradeStation"
        @focus-sector="onFocusSector"
        @select-group="onSelectGroup"
        @color-change="onColorChange"
      />
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

:deep(.drag-placeholder) {
  @apply border-2 border-dashed border-sky-500/60 rounded bg-sky-500/10;
  min-height: 48px;
}

/* === Map view compact styles === */
.group-list--map {
  --binding-pill-height: 22px;
  --binding-pill-gap: 4px;
  --group-card-padding: 8px;
}

.group-list--map .group-item--map .group-header {
  @apply mb-0.5;
}
</style>

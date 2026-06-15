<script setup lang="ts">
import draggable from 'vuedraggable'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { GroupDraftInfo, SectorAssignment } from '@/store/logic/autoGroup'
import type { TradeStationSelection } from '@/store/logic/tradeStationSelection'
import type { X4MapSector } from '@/types/x4'
import SectorGroupCard from './SectorGroupCard.vue'

const props = withDefaults(defineProps<{
  groups: GroupDraftInfo[]
  assignments: SectorAssignment[]
  maps: { clusters: Record<string, { sectors?: string[] }>; sectors: Record<string, X4MapSector> } | null | undefined
  sectorGraph: Record<string, string[]>
  sectorClusterMap: Record<string, string>
  playerSectorMacros: string[]
  editable: boolean
  diffEnabled: boolean
  view?: 'map' | 'live'
  showSelectGroupButton?: boolean
  draggable?: boolean
  baselineCoverageByGroupId?: Record<string, string[]>
  baselineConnectedGroupIdsByGroupId?: Record<string, string[]>
  selectedTradeStations?: Record<string, TradeStationSelection>
}>(), {
  view: 'live',
  showSelectGroupButton: false,
  draggable: false
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
}>()

const { t } = useI18n()

const cardBase = computed(() => ({
  assignments: props.assignments,
  maps: props.maps,
  sectorGraph: props.sectorGraph,
  sectorClusterMap: props.sectorClusterMap,
  playerSectorMacros: props.playerSectorMacros,
  editable: props.editable,
  diffEnabled: props.diffEnabled,
  view: props.view,
  showSelectGroupButton: props.showSelectGroupButton,
  baselineCoverageByGroupId: props.baselineCoverageByGroupId,
  baselineConnectedGroupIdsByGroupId: props.baselineConnectedGroupIdsByGroupId
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
    >
    >
      <template #item="{ element: group }">
        <SectorGroupCard
          :key="`drag:${group.id}`"
          :group="group"
          :groups="groups"
          v-bind="cardBase"
          :show-drag-handle="true"
          :selected-trade-station="(selectedTradeStations ?? {})[group.id] ?? null"
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
        :selected-trade-station="(selectedTradeStations ?? {})[group.id] ?? null"
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

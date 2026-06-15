<script setup lang="ts">
import draggable from 'vuedraggable'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { GroupDraftInfo, SectorAssignment } from '@/store/logic/autoGroup'
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
  (e: 'focus-sector', sectorMacro: string): void
  (e: 'select-group', sectorGroupId: string): void
  (e: 'reorder-groups', groups: GroupDraftInfo[]): void
}>()

const { t } = useI18n()

const dragGroups = ref<GroupDraftInfo[]>([...props.groups])

watch(
  () => props.groups,
  (groups) => {
    dragGroups.value = [...groups]
  },
  { immediate: true }
)

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
function onFocusSector(sectorMacro: string) { emit('focus-sector', sectorMacro) }
function onSelectGroup(sectorGroupId: string) { emit('select-group', sectorGroupId) }
function onMoveGroup() {
  return props.draggable
}
function onReorderGroups(groups: GroupDraftInfo[]) {
  dragGroups.value = [...groups]
  if (!props.draggable) return
  emit('reorder-groups', groups)
}
</script>

<template>
  <div class="group-list" :class="{ 'group-list--map': view === 'map' }">
    <div v-if="groups.length === 0" class="empty-hint">
      {{ t('sector.no_groups') }}
    </div>

    <div v-if="draggable" key="draggable">
    <draggable
      :model-value="dragGroups"
      item-key="id"
      class="flex flex-col gap-2"
      handle=".drag-handle"
      :animation="200"
      :disabled="!draggable"
      :sort="draggable"
      :move="onMoveGroup"
      @update:modelValue="onReorderGroups"
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
          @focus-sector="onFocusSector"
          @select-group="onSelectGroup"
        />
      </template>
    </draggable>
    </div>

    <div v-else key="static" class="static-group-list flex flex-col gap-2">
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

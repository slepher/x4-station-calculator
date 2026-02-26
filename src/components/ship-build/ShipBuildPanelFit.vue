<script setup lang="ts">
import ShipBuildFitCandidate from '@/components/ShipBuildFitCandidate.vue'
import type { FitMode, FitConnectionRow, FitGroupRow } from '@/components/ship-build/fitTypes'

const props = defineProps<{
  mode: FitMode
  canSwitchToGroup: boolean
  conflictReason: string
  connectionRows: FitConnectionRow[]
  groupRows: FitGroupRow[]
  selectedByConnection: Record<string, string | null>
}>()

const emit = defineEmits<{
  'update:mode': [mode: FitMode]
  'assign-connection': [payload: { connectionKey: string; equipmentId: string | null }]
  'assign-group': [payload: { groupKey: string; equipmentId: string | null }]
}>()

const setFitMode = (mode: FitMode) => {
  emit('update:mode', mode)
}

const applyConnectionAssignment = (payload: { connectionKey: string; equipmentId: string | null }) => {
  emit('assign-connection', payload)
}

const applyGroupAssignment = (payload: { groupKey: string; equipmentId: string | null }) => {
  emit('assign-group', payload)
}
</script>

<template>
  <div class="col-span-12 lg:col-span-4 panel-card" data-testid="ship-build-panel-fit">
    <div class="panel-header">
      <span>{{ $t('ship_build.panel_fit') }}</span>
    </div>
    <div class="fit-panel-content" data-testid="ship-build-fit-panel">
      <ShipBuildFitCandidate
        :mode="mode"
        :can-switch-to-group="canSwitchToGroup"
        :conflict-reason="conflictReason"
        :connection-rows="connectionRows"
        :group-rows="groupRows"
        :selected-by-connection="selectedByConnection"
        @update:mode="setFitMode"
        @assign-connection="applyConnectionAssignment"
        @assign-group="applyGroupAssignment"
      />
    </div>
  </div>
</template>

<style scoped>
.panel-card {
  @apply bg-slate-900/40 rounded-lg border border-slate-800 shadow-xl overflow-hidden;
}

.panel-header {
  @apply flex items-center justify-between px-4 py-3 text-slate-200 text-sm font-semibold border-b border-slate-800/70 bg-slate-900/50;
}

.fit-panel-content {
  @apply p-4;
}
</style>

<script setup lang="ts">
import { computed } from 'vue'
import { useEmpireStore } from '@/store/useEmpireStore'
import type { EmpireGroupedFlows } from '@/types/x4'
import EmpireWareFlowsDashboard from './EmpireWareFlowsDashboard.vue'

const props = defineProps<{
  sectorId: string | null
}>()

const empireStore = useEmpireStore()

const sectorGroupedFlows = computed<EmpireGroupedFlows>(() => {
  if (!props.sectorId) {
    return {
      flows: [],
      empireGroups: {
        operations: [],
        supply: []
      }
    }
  }
  return empireStore.getSectorInternalData(props.sectorId).localGroupedFlows
})
</script>

<template>
  <div class="supply-panel">
    <div v-if="!sectorId" class="empty-select">
      {{ $t('sectorManagement.supply_select_sector') }}
    </div>

    <div v-else class="panel-grid">
      <section class="panel-col build-col">
        <h4 class="col-title">{{ $t('sectorManagement.supply_build_zone') }}</h4>
        <div class="placeholder">
          {{ $t('sectorManagement.supply_build_placeholder') }}
        </div>
      </section>

      <section class="resource-col">
        <EmpireWareFlowsDashboard :grouped-flows="sectorGroupedFlows" />
      </section>

      <section class="panel-col material-col">
        <h4 class="col-title">{{ $t('sectorManagement.supply_material_zone') }}</h4>
        <div class="placeholder">
          {{ $t('sectorManagement.supply_material_placeholder') }}
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.supply-panel {
  @apply bg-slate-900/40 rounded-lg border border-slate-800 shadow-xl min-h-[400px] flex flex-col;
}
.empty-select {
  @apply p-6 text-sm text-slate-400;
}
.panel-grid {
  @apply grid grid-cols-12 gap-8 p-3;
}
.panel-col {
  @apply col-span-12 bg-slate-800/30 border border-slate-700/60 rounded p-3;
}
.build-col {
  @apply lg:col-span-3;
}
.resource-col {
  @apply col-span-12 lg:col-span-5;
}
.material-col {
  @apply lg:col-span-4;
}
.col-title {
  @apply text-xs uppercase tracking-wider text-slate-300 font-bold mb-3;
}
.placeholder {
  @apply text-xs text-slate-400 bg-slate-900/40 border border-slate-700/60 rounded p-3 min-h-[180px];
}
.resource-col :deep(.list-wrapper) {
  @apply border-slate-700/60;
}
</style>

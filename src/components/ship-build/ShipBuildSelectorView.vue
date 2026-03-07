<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useShipBuildStore } from '@/store/useShipBuildStore'
import ShipBuildSelector from '@/components/ship-build/ShipBuildSelector.vue'

const { t } = useI18n()

const shipBuildStore = useShipBuildStore()
const { selectedShipId } = storeToRefs(shipBuildStore)
const { setSelectedShipId, cancelShipSelector } = shipBuildStore

const handleSelectedShipIdChange = (value: string | null) => {
  setSelectedShipId(value)
}

const handleCancelShipChange = () => {
  cancelShipSelector()
}
</script>

<template>
  <div class="panel-card" data-testid="ship-build-filters">
    <div class="panel-header">
      <div class="flex items-center gap-2">
        <span class="text-emerald-300 text-xs font-semibold">{{ t('ship_build.title') }}</span>
        <span class="text-slate-400 text-xs">{{ t('ship_build.select_ship') }}</span>
      </div>
      <div class="text-xs text-slate-500">{{ t('ship_build.filters') }}</div>
    </div>

    <ShipBuildSelector
      :selected-ship-id="selectedShipId"
      @update:selected-ship-id="handleSelectedShipIdChange"
      @cancel-ship-change="handleCancelShipChange"
    />
  </div>
</template>

<style scoped>
.panel-card {
  @apply bg-slate-900/40 rounded-lg border border-slate-800 shadow-xl overflow-hidden;
}

.panel-header {
  @apply flex items-center justify-between px-4 py-3 text-slate-200 text-sm font-semibold border-b border-slate-800/70 bg-slate-900/50;
}
</style>

<script setup lang="ts">
import { computed } from 'vue'
import StationDashboard from '../StationDashboard.vue'
import type { SavedModule } from '@/types/x4'

const props = defineProps<{
  modules: SavedModule[]
  buildingModules?: SavedModule[]
  buildPriceMultiplier: number
  useHQ: boolean
}>()

const combinedModules = computed(() => {
  const result: SavedModule[] = []
  const counts = new Map<string, number>()
  
  for (const m of props.modules) {
    counts.set(m.id, (counts.get(m.id) || 0) + m.count)
  }
  for (const m of props.buildingModules || []) {
    counts.set(m.id, (counts.get(m.id) || 0) + m.count)
  }
  
  for (const [id, count] of counts.entries()) {
    result.push({ id, count })
  }
  return result
})

const dashboardSettings = computed(() => ({
  transportShipCapacity: 20000,
  workforceAuto: true,
  manualWorkforce: 0,
  useHQ: props.useHQ
}))

const emit = defineEmits<{
  updateBuildPriceMultiplier: [value: number]
  updateUseHq: [value: boolean]
}>()

const handleUpdateBuildPriceMultiplier = (value: number) => {
  emit('updateBuildPriceMultiplier', value)
}

const handleUpdateUseHQ = (value: boolean) => {
  emit('updateUseHq', value)
}
</script>

<template>
  <section data-testid="transit-hub-materials-panel">
    <StationDashboard
      :modules="combinedModules"
      :hide-workers-view="true"
      :settings="dashboardSettings"
      :current-efficiency="1"
      :actual-workforce="0"
      :build-price-multiplier="buildPriceMultiplier"
      @update-build-price-multiplier="handleUpdateBuildPriceMultiplier"
      @update-use-hq="handleUpdateUseHQ"
    />
  </section>
</template>
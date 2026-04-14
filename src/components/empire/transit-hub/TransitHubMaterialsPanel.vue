<script setup lang="ts">
import { computed } from 'vue'
import StationDashboard from '../StationDashboard.vue'
import { useGameDataStore } from '@/store/useGameDataStore'
import { analyzeStation } from '@/store/logic/analyzeStation'
import type { SavedModule } from '@/types/x4'

const props = defineProps<{
  plannedModulesOverride: SavedModule[]
  buildPriceMultiplier: number
  useHQ: boolean
}>()

const gameDataStore = useGameDataStore()

const stationAnalysis = computed(() => {
  return analyzeStation(
    props.plannedModulesOverride,
    gameDataStore.modulesMap,
    gameDataStore.waresMap,
    props.buildPriceMultiplier,
    props.useHQ
  )
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
  <section>
    <StationDashboard
      :planned-modules="[]"
      :planned-modules-override="plannedModulesOverride"
      :hide-workers-view="true"
      :station-analysis="stationAnalysis"
      :settings="dashboardSettings"
      :current-efficiency="1"
      :actual-workforce="0"
      :build-price-multiplier="buildPriceMultiplier"
      @update-build-price-multiplier="handleUpdateBuildPriceMultiplier"
      @update-use-hq="handleUpdateUseHQ"
    />
  </section>
</template>
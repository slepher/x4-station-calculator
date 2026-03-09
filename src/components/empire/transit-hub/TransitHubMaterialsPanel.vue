<script setup lang="ts">
import StationDashboard from '../StationDashboard.vue'
import type { SavedModule } from '@/types/x4'

defineProps<{
  plannedModulesOverride: SavedModule[]
}>()
</script>

<template>
  <section>
    <StationDashboard
      :planned-modules-override="plannedModulesOverride"
      :hide-workers-view="true"
    />
  </section>
</template>

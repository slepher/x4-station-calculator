<script setup lang="ts">
import StationPlanner from './components/StationPlanner.vue'
import { useStationStore } from '@/store/useStationStore'
const store = useStationStore()

if (import.meta.env.DEV) {
  (window as any).store = store
}
</script>

<template>
  <StationPlanner />
</template>
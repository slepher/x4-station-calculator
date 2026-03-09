<script setup lang="ts">
import EmpireWareFlowGroup from '../EmpireWareFlowGroup.vue'
import EmptyState from '@/components/common/EmptyState.vue'

defineProps<{
  groups: Array<{ key: string; title: string; items: any[] }>
  hasData: boolean
}>()
</script>

<template>
  <div class="volume-groups-container">
    <EmpireWareFlowGroup
      v-for="group in groups"
      :key="group.key"
      :title="group.title"
      :items="group.items"
      viewMode="quantity"
    />
    <EmptyState v-if="!hasData" />
  </div>
</template>

<style scoped>
.volume-groups-container {
  @apply space-y-1;
}
</style>

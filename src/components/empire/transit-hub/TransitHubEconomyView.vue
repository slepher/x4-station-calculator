<script setup lang="ts">
import EmpireWareFlowGroup from '../EmpireWareFlowGroup.vue'
import EmptyState from '@/components/common/EmptyState.vue'

defineProps<{
  groups: Array<{ key: string; title: string; items: any[]; sumText: string; sumClass: string }>
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
      viewMode="economy"
    >
      <span :class="['economy-group-sum', group.sumClass]">{{ group.sumText }} Cr</span>
    </EmpireWareFlowGroup>
    <EmptyState v-if="!hasData" />
  </div>
</template>

<style scoped>
.volume-groups-container {
  @apply space-y-1;
}
.economy-group-sum {
  @apply text-sm font-mono font-bold;
}
.economy-group-sum.positive {
  @apply text-emerald-400;
}
.economy-group-sum.negative {
  @apply text-red-400;
}
</style>

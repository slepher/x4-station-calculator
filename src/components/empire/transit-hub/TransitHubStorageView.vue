<script setup lang="ts">
import EmptyState from '@/components/common/EmptyState.vue'
import type { DerivedFlowContribution } from '@/types/production-flow'
import TransitHubStorageFlowItem from './TransitHubStorageFlow.vue'

defineProps<{
  items: Array<{
    wareId: string
    name: string
    totalOccupiedCount: number
    contributions: DerivedFlowContribution[]
  }>
  hasData: boolean
}>()
</script>

<template>
  <div class="volume-groups-container">
    <template v-if="hasData">
      <div class="storage-group-header">
        <h4 class="storage-group-title">{{ $t('wareflow.volume_view') }}</h4>
      </div>

      <TransitHubStorageFlowItem
        v-for="item in items"
        :key="item.wareId"
        :resource-id="item.wareId"
        :name="item.name"
        :total-occupied-count="item.totalOccupiedCount"
        :contributions="item.contributions"
      />
    </template>

    <EmptyState v-else />
  </div>
</template>

<style scoped>
.volume-groups-container {
  @apply space-y-1;
}
.storage-group-header {
  @apply flex justify-between items-center h-8 px-3 py-0.5 bg-slate-800/40 rounded mb-1;
}
.storage-group-title {
  @apply text-sm font-bold text-slate-300;
}
.storage-group-value {
  @apply text-sm font-mono text-blue-300 flex items-center gap-2;
}
</style>

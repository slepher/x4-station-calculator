<script setup lang="ts">
import EmptyState from '@/components/common/EmptyState.vue'
import TransitHubStorageFlowItem from './TransitHubStorageFlow.vue'

defineProps<{
  items: Array<{
    wareId: string
    name: string
    unitVolume: number
    totalRequiredStorageVolume: number
    details: any[]
  }>
  totalVolume: number
  hasData: boolean
}>()

const formatVolume = (n: number) => new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1
}).format(n)
</script>

<template>
  <div class="volume-groups-container">
    <div class="storage-group-header">
      <h4 class="storage-group-title">{{ $t('wareflow.volume_view') }}</h4>
      <span class="storage-group-value">
        {{ formatVolume(totalVolume) }}m³
        <svg class="w-3.5 h-3.5 text-blue-300/70" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
          <path d="m3.3 7 8.7 5 8.7-5"/>
          <path d="M12 22V12"/>
        </svg>
      </span>
    </div>

    <TransitHubStorageFlowItem
      v-for="item in items"
      :key="item.wareId"
      :resource-id="item.wareId"
      :name="item.name"
      :unit-volume="item.unitVolume"
      :total-required-storage-volume="item.totalRequiredStorageVolume"
      :details="item.details"
    />

    <EmptyState v-if="!hasData" />
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

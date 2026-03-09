<script setup lang="ts">
import EmptyState from '@/components/common/EmptyState.vue'
import TransitHubTransportFlowItem from './TransitHubTransportFlow.vue'

defineProps<{
  items: Array<{
    wareId: string
    name: string
    totalTransportVolume: number
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
      <h4 class="storage-group-title">{{ $t('wareflow.transport_view') }}</h4>
      <span class="storage-group-value">
        {{ formatVolume(totalVolume) }}m³
        <svg class="w-3.5 h-3.5 text-blue-300/70" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="1" y="3" width="15" height="13"></rect>
          <path d="M16 8h4l3 3v5h-7z"></path>
          <circle cx="5.5" cy="18.5" r="2.5"></circle>
          <circle cx="18.5" cy="18.5" r="2.5"></circle>
        </svg>
      </span>
    </div>

    <TransitHubTransportFlowItem
      v-for="item in items"
      :key="item.wareId"
      :resource-id="item.wareId"
      :name="item.name"
      :total-transport-volume="item.totalTransportVolume"
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

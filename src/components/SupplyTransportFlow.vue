<script setup lang="ts">
import { computed } from 'vue'
import CollapsibleDetailList from './common/CollapsibleDetailList.vue'

interface TransportDetail {
  stationId: string
  stationName: string
  stationCount: number
  transportVolume: number
}

const props = defineProps<{
  resourceId: string
  name: string
  totalTransportVolume: number
  details: TransportDetail[]
}>()

const formatNum = (n: number, digits: number = 1) => new Intl.NumberFormat('en-US', {
  maximumFractionDigits: digits,
  minimumFractionDigits: digits
}).format(n)

const formattedTotal = computed(() => `${formatNum(props.totalTransportVolume, 1)}m³`)

const formattedDetails = computed(() => {
  return [...props.details].sort((a, b) => b.transportVolume - a.transportVolume)
})
</script>

<template>
  <div class="flow-content" :data-resource-id="resourceId">
    <CollapsibleDetailList
      :data="formattedDetails"
      :isPositive="true"
    >
      <template #title>
        <span class="header-name">{{ name }}</span>
      </template>
      <template #header>
        <div class="value value-pos">
          {{ formattedTotal }}
          <svg class="w-3.5 h-3.5 text-blue-300/70" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="1" y="3" width="15" height="13"></rect>
            <path d="M16 8h4l3 3v5h-7z"></path>
            <circle cx="5.5" cy="18.5" r="2.5"></circle>
            <circle cx="18.5" cy="18.5" r="2.5"></circle>
          </svg>
        </div>
      </template>

      <template #row="{ item }">
        <span class="item-name">
          <span class="qty">{{ item.stationCount }}</span>
          <span class="symbol">x</span>
          <span class="name">{{ item.stationName }}</span>
        </span>
        <div class="item-val-group">
          <span class="item-val">{{ formatNum(item.transportVolume, 1) }}m³</span>
        </div>
      </template>
    </CollapsibleDetailList>
  </div>
</template>

<style scoped>
.flow-content {
  @apply min-w-0;
}

.header-name {
  @apply text-sm font-medium text-slate-200;
}

.value {
  @apply text-sm font-bold min-w-[70px] text-right font-mono flex items-center justify-end gap-2;
}

.value-pos {
  @apply text-blue-300;
}

.item-name {
  @apply flex items-center gap-1;
}

.item-name .qty {
  @apply font-mono text-slate-500;
}

.item-name .symbol {
  @apply opacity-30 scale-90 text-slate-500;
}

.item-name .name {
  @apply text-xs font-normal text-slate-400;
}

.item-val-group {
  @apply flex items-center gap-3;
}

.item-val {
  @apply font-mono font-medium text-blue-300;
}
</style>

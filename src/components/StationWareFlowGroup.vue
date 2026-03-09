<script setup lang="ts">
import CollapsibleDetailList from './common/CollapsibleDetailList.vue'
import StationWareFlow from './StationWareFlow.vue'
import { useStationStore } from '@/store/useStationStore'

defineProps<{
  title: string
  items: any[]
  viewMode: 'quantity' | 'volume' | 'economy' | 'transport'
}>()

const store = useStationStore()
</script>

<template>
  <div v-if="items.length > 0" class="group-container">
    <CollapsibleDetailList>
      <template #title>
        <h4 class="group-title">{{ title }}</h4>
      </template>
      <template #header>
        <slot></slot>
          <div class="w-20 flex-none"></div>
      </template>
    </CollapsibleDetailList>

    <StationWareFlow
      v-for="item in items"
      :key="item.id"
      :resourceId="item.id"
      :name="item.name"
      :netRate="viewMode === 'quantity' ? item.netRate : 0"
      :netVolume="item.netVolume"
      :transportDemand="item.transportDemand"
      :netValue="item.netValue"
      :transportType="item.transportType"
      :unitVolume="item.unitVolume"
      :totalOccupiedVolume="item.totalOccupiedVolume"
      :totalOccupiedCount="item.totalOccupiedCount"
      :totalOccupiedConsumptionCount="item.totalOccupiedConsumptionCount"
      :details="item.contributions"
      :locked="store.isWareLocked(item.id)"
      :priorityLevel="store.getResolvedLevel(item.id)"
      :viewMode="viewMode"
      :transportMinutes="store.settings.transportMinutes"
      @update:locked="store.toggleWareLock(item.id)"
      @update:priorityLevel="store.toggleWarePriority(item.id)"
    />
  </div>
</template>

<style scoped>
.group-container {
  @apply mb-1;
}

.group-title {
  @apply text-sm font-bold text-slate-300;
}
</style>

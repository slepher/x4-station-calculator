<script setup lang="ts">
import CollapsibleDetailList from '../common/CollapsibleDetailList.vue'
import StationWareFlow from './StationWareFlow.vue'

defineProps<{
  title: string
  items: any[]
  viewMode: 'quantity' | 'volume' | 'economy' | 'transport'
  isWareLocked?: (wareId: string) => boolean
  getResolvedLevel?: (wareId: string) => number
  isWareOperable?: (wareId: string) => boolean
  isPlannedWare?: (wareId: string) => boolean
  transportMinutes?: number
  resourceBufferHours?: number
  primaryProductBufferHours?: number
  secondaryProductBufferHours?: number
  modulesMap?: Record<string, any>
  onToggleWareLock?: (wareId: string) => void
  onToggleWarePriority?: (wareId: string) => void
}>()
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
      :locked="isWareLocked?.(item.id) ?? false"
      :priorityLevel="getResolvedLevel?.(item.id) ?? 0"
      :viewMode="viewMode"
      :transportMinutes="transportMinutes ?? 30"
      :nonOperable="!(isWareOperable?.(item.id) ?? true)"
      :isPlanned="isPlannedWare?.(item.id) ?? false"
      :resourceBufferHours="resourceBufferHours ?? 1"
      :primaryProductBufferHours="primaryProductBufferHours ?? 12"
      :secondaryProductBufferHours="secondaryProductBufferHours ?? 2"
      :modulesMap="modulesMap"
      @update:locked="onToggleWareLock?.(item.id)"
      @update:priorityLevel="onToggleWarePriority?.(item.id)"
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

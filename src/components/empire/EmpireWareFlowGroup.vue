<script setup lang="ts">
import CollapsibleDetailList from '../common/CollapsibleDetailList.vue'
import EmpireWareFlow from './EmpireWareFlow.vue'
import type { DerivedFlowContribution } from '@/types/production-flow'

interface EmpireWareFlowGroupItem {
  id: string
  name: string
  netRate: number
  netValue: number
  contributions: DerivedFlowContribution[]
  disableAdd?: boolean
  disableRemove?: boolean
}

defineProps<{
  title: string
  items: EmpireWareFlowGroupItem[]
  viewMode: 'quantity' | 'economy'
  showAddButton?: boolean
  showRemoveButton?: boolean
}>()

defineEmits<{
  add: [wareId: string]
  remove: [wareId: string]
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
      </template>
    </CollapsibleDetailList>

    <EmpireWareFlow
      v-for="item in items"
      :key="item.id"
      :resourceId="item.id"
      :name="item.name"
      :netRate="viewMode === 'quantity' ? item.netRate : 0"
      :netValue="item.netValue"
      :details="item.contributions"
      :viewMode="viewMode"
      :showAddButton="showAddButton"
      :showRemoveButton="showRemoveButton"
      :disableAdd="item.disableAdd"
      :disableRemove="item.disableRemove"
      @add="$emit('add', $event)"
      @remove="$emit('remove', $event)"
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

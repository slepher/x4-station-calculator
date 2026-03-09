<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import CollapsibleDetailList from '../common/CollapsibleDetailList.vue'
import type { SupplyStorageFlowDetail } from '@/types/x4'

const props = defineProps<{
  resourceId: string
  name: string
  unitVolume: number
  totalRequiredStorageVolume: number
  details: SupplyStorageFlowDetail[]
}>()

const { t } = useI18n()

const totalRequiredCount = computed(() => {
  if (!props.unitVolume || props.unitVolume <= 0) return 0
  return Math.ceil(props.totalRequiredStorageVolume / props.unitVolume)
})

const formattedDetails = computed(() => {
  return [...props.details]
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'production' ? -1 : 1
      return b.storageVolume - a.storageVolume
    })
    .map((detail) => ({
      ...detail,
      storageCount: (!props.unitVolume || props.unitVolume <= 0)
        ? 0
        : Math.ceil(detail.storageVolume / props.unitVolume),
      kindLabel: detail.kind === 'production'
        ? t('sectorManagement.supply_storage_production')
        : t('sectorManagement.supply_storage_consumption')
    }))
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
          {{ totalRequiredCount }}
          <svg class="w-3.5 h-3.5 text-blue-300/70" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
            <path d="m3.3 7 8.7 5 8.7-5"/>
            <path d="M12 22V12"/>
          </svg>
        </div>
      </template>

      <template #row="{ item }">
        <span class="item-name">
          <span class="qty">{{ item.stationCount }}</span>
          <span class="symbol">x</span>
          <span class="name">{{ item.stationName }}</span>
          <span :class="item.kind === 'production' ? 'kind-pos' : 'kind-neg'">
            {{ item.kindLabel }}
          </span>
        </span>
        <div class="item-val-group">
          <span class="item-count">{{ item.storageCount }}</span>
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

.kind-pos {
  @apply text-emerald-400/80 text-[10px];
}

.kind-neg {
  @apply text-red-400/80 text-[10px];
}

.item-val-group {
  @apply flex items-center gap-3;
}

.item-count {
  @apply font-mono font-bold text-blue-300;
}
</style>

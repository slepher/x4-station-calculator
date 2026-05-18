<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { LiveCargoOnlyItem, LiveVolumeAllocationGroup } from '@/types/production-workbench-contract'
import LiveStationAllocationRow from './LiveStationAllocationRow.vue'
import LiveStationCargoOnlyRow from './LiveStationCargoOnlyRow.vue'

const props = defineProps<{
  groups: LiveVolumeAllocationGroup[]
  cargoOnlyItems: LiveCargoOnlyItem[]
}>()

const { t } = useI18n()

const visibleGroups = computed(() => props.groups.filter((group) => group.items.length > 0))

function formatVolume(value: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(value))
}

function getGroupTitle(key: 'container' | 'solid' | 'liquid'): string {
  if (key === 'container') return t('wareflow.container_group')
  if (key === 'solid') return t('wareflow.solid_group')
  return t('wareflow.liquid_group')
}
</script>

<template>
  <div class="live-allocation-view">
    <section v-for="group in visibleGroups" :key="group.key" class="allocation-group">
      <div class="allocation-group-header">
        <div class="allocation-group-title">{{ getGroupTitle(group.key) }}</div>
        <div class="allocation-group-summary">
          <span>{{ t('wareflow.allocation_cur') }} {{ formatVolume(group.currentTotalVolume) }} m3</span>
          <span>{{ t('wareflow.allocation_tar') }} {{ formatVolume(group.targetTotalVolume) }} m3</span>
          <span>{{ t('wareflow.allocation_rec') }} {{ formatVolume(group.recommendedTotalVolume) }} m3</span>
        </div>
      </div>
      <div class="allocation-group-body">
        <LiveStationAllocationRow
          v-for="item in group.items"
          :key="item.wareId"
          :name="item.name"
          :current-count="item.currentCount"
          :target-count="item.targetCount"
          :recommended-count="item.recommendedCount"
          :scale-max-count="item.scaleMaxCount"
        />
      </div>
    </section>

    <section v-if="cargoOnlyItems.length > 0" class="allocation-group cargo-only-group">
      <div class="allocation-group-header">
        <div class="allocation-group-title">{{ t('wareflow.cargo_only_group') }}</div>
      </div>
      <div class="allocation-group-body">
        <LiveStationCargoOnlyRow
          v-for="item in cargoOnlyItems"
          :key="item.wareId"
          :name="item.name"
          :current-count="item.currentCount"
          :target-count="item.targetCount"
        />
      </div>
    </section>
  </div>
</template>

<style scoped>
.live-allocation-view {
  @apply space-y-3;
}

.allocation-group {
  @apply rounded-lg border border-slate-800 bg-slate-950/40 overflow-hidden;
}

.allocation-group-header {
  @apply flex items-center justify-between gap-3 px-3 py-2 bg-slate-900/70 border-b border-slate-800;
}

.allocation-group-title {
  @apply text-xs font-semibold uppercase tracking-wide text-slate-200;
}

.allocation-group-summary {
  @apply flex items-center gap-3 text-[11px] font-mono text-slate-400 whitespace-nowrap;
}

.allocation-group-body {
  @apply px-3 py-1;
}

.cargo-only-group .allocation-group-header {
  @apply border-b-slate-800/70;
}
</style>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { LiveCargoOnlyItem, LiveVolumeAllocationGroup } from '@/types/production-workbench-contract'
import CollapsibleDetailList from '../common/CollapsibleDetailList.vue'
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
    <section v-for="group in visibleGroups" :key="group.key" class="allocation-group" data-testid="wareflow-group">
      <CollapsibleDetailList :is-expandable="false">
        <template #title>
          <h4 class="allocation-group-title" data-testid="wareflow-group-title">{{ getGroupTitle(group.key) }}</h4>
        </template>
        <template #header>
          <div class="allocation-group-summary">
            <span>{{ t('wareflow.allocation_cur') }} {{ formatVolume(group.currentTotalVolume) }} m3</span>
            <span>{{ t('wareflow.allocation_tar') }} {{ formatVolume(group.targetTotalVolume) }} m3</span>
            <span>{{ t('wareflow.allocation_rec') }} {{ formatVolume(group.recommendedTotalVolume) }} m3</span>
          </div>
          <div class="group-header-spacer"></div>
        </template>
      </CollapsibleDetailList>

      <LiveStationAllocationRow
        v-for="item in group.items"
        :key="item.wareId"
        :name="item.name"
        :current-count="item.currentCount"
        :target-count="item.targetCount"
        :recommended-count="item.recommendedCount"
        :scale-max-count="item.scaleMaxCount"
        :detail-sections="item.detailSections"
      />
    </section>

    <section v-if="cargoOnlyItems.length > 0" class="allocation-group cargo-only-group" data-testid="wareflow-group">
      <CollapsibleDetailList :is-expandable="false">
        <template #title>
          <h4 class="allocation-group-title" data-testid="wareflow-group-title">{{ t('wareflow.cargo_only_group') }}</h4>
        </template>
        <template #header>
          <div class="group-header-spacer"></div>
        </template>
      </CollapsibleDetailList>

      <LiveStationCargoOnlyRow
        v-for="item in cargoOnlyItems"
        :key="item.wareId"
        :name="item.name"
        :current-count="item.currentCount"
        :target-count="item.targetCount"
      />
    </section>
  </div>
</template>

<style scoped>
.live-allocation-view {
  @apply space-y-1;
}

.allocation-group {
  @apply mb-1;
}

.allocation-group-title {
  @apply text-sm font-bold text-slate-300;
}

.allocation-group-summary {
  @apply flex items-center gap-3 text-[11px] font-mono text-slate-400 whitespace-nowrap;
}

.group-header-spacer {
  @apply w-20 flex-none;
}
</style>

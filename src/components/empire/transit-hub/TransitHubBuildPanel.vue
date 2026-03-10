<script setup lang="ts">
import type { TransitHubStorageModulePlan } from '@/types/x4'
import StationPlanningItem from '../StationPlanningItem.vue'

defineProps<{
  storageModulePlans: TransitHubStorageModulePlan[]
}>()
</script>

<template>
  <section>
    <div class="tier-section tier-auto">
      <div class="tier-header">
        <span class="tier-label">{{ $t('sectorManagement.supply_build_zone') }}</span>
      </div>
      <div class="module-list-scroll">
        <div class="auto-modules-container">
          <StationPlanningItem
            v-for="(item, index) in storageModulePlans"
            :key="item.id + '-' + index"
            :item="item.item"
            :info="item.info"
            :readonly="true"
            :no-click="true"
          />
        </div>
      </div>
    </div>
    <div class="build-list">
      <div v-if="storageModulePlans.length === 0" class="placeholder">
        {{ $t('sectorManagement.supply_build_placeholder') }}
      </div>
    </div>
  </section>
</template>

<style scoped>
.placeholder {
  @apply text-xs text-slate-400 bg-slate-900/40 border border-slate-700/60 rounded p-3 min-h-[180px];
}
.build-list {
  @apply min-h-[180px];
}
.module-list-scroll {
  @apply overflow-y-auto pr-1 scrollbar-thin;
}
.auto-modules-container {
  @apply space-y-2;
}
.tier-section {
  @apply space-y-2;
}
.tier-section.tier-auto {
  @apply opacity-90;
}
.tier-section.tier-auto .module-list-scroll {
  @apply border-l-2 border-dashed border-slate-600 pl-2;
}
.tier-header {
  @apply flex items-center justify-between px-3 h-8 bg-slate-800/40 rounded cursor-pointer hover:bg-slate-700/50 transition-colors border border-transparent w-full;
}
.tier-label {
  @apply text-xs font-semibold text-slate-400 uppercase tracking-wider leading-none;
}
.scrollbar-thin::-webkit-scrollbar {
  @apply w-1;
}
.scrollbar-thin::-webkit-scrollbar-thumb {
  @apply bg-slate-700 rounded-full;
}
</style>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useStationStore } from '@/store/useStationStore'

const props = defineProps<{
  resourceId: string
  amount: number
  name: string
}>()

const store = useStationStore()
const isOpen = ref(false)

const formatNum = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n))
const details = computed(() => isOpen.value ? store.getResourceDetails(props.resourceId) : [])
const isPositive = computed(() => props.amount >= 0)
</script>

<template>
  <div class="item-container">
    <div @click="isOpen = !isOpen" class="main-row group">
      <div class="row-label">
        <span class="arrow-icon" :class="isOpen ? 'rotate-90' : ''">▶</span>
        <span class="status-dot" :class="isPositive ? 'bg-emerald-500' : 'bg-red-500'"></span>
        <span class="resource-name group-hover:text-white">{{ name }}</span>
      </div>
      
      <div class="main-value" :class="isPositive ? 'text-emerald-400' : 'text-red-400'">
        {{ formatNum(amount) }}
      </div>
    </div>

    <div v-if="isOpen" class="details-panel">
      <div v-for="(detail, idx) in details" :key="idx" class="detail-row">
        <div class="detail-label">
          <span :class="detail.amount > 0 ? 'text-emerald-600' : 'text-red-600/80'">{{ detail.count }} x</span> 
          {{ detail.moduleName }}
          <span v-if="detail.efficiency" class="efficiency-tag">
            (at {{ Math.round(detail.efficiency * 100) }}%)
          </span>
        </div>

        <div class="detail-value" :class="detail.amount > 0 ? 'text-emerald-500' : 'text-red-500'">
          {{ formatNum(detail.amount) }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.item-container {
  @apply border-b border-slate-700/50 last:border-0;
}
.main-row {
  @apply grid grid-cols-2 py-2 px-3 hover:bg-slate-700/50 cursor-pointer transition select-none;
}
.row-label {
  @apply flex items-center text-slate-300 transition-colors;
}
.arrow-icon {
  @apply mr-2 text-[10px] text-slate-500 transform transition-transform duration-200;
}
.status-dot {
  @apply w-2 h-2 rounded-full mr-2;
}
.resource-name {
  @apply transition-colors;
}
.main-value {
  @apply text-right font-mono font-bold transition-colors;
}
.details-panel {
  @apply bg-slate-900/50 px-4 py-2 text-xs border-t border-slate-700/30 shadow-inner;
}
.detail-row {
  @apply flex justify-between items-center py-1 border-b border-slate-800/50 last:border-0;
}
.detail-label {
  @apply text-slate-400 font-medium;
}
.efficiency-tag {
  @apply text-slate-500 ml-1;
}
.detail-value {
  @apply font-mono;
}
</style>
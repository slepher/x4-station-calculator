<script setup lang="ts">
import { computed } from 'vue'
import CollapsibleDetailList from '../common/CollapsibleDetailList.vue'

const props = withDefaults(defineProps<{
  title: string
  value: number
  items: any[]
  variant?: 'summary' | 'module'
  count?: number
  unit?: string
  isTime?: boolean
  isWorkers?: boolean
  isVolume?: boolean
  badge?: string
}>(), {
  variant: 'module',
  count: 0,
  unit: 'Cr',
  isTime: false,
  isWorkers: false,
  isVolume: false,
  badge: ''
})

const formatNum = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n))

const formatTime = (seconds: number) => {
  if (!seconds) return '00:00:00'
  const d = Math.floor(seconds / (24 * 3600))
  const h = Math.floor((seconds % (24 * 3600)) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60

  const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  
  if (d >= 2) {
    return `${d}D ${timeStr}`
  }
  
  const totalHours = Math.floor(seconds / 3600)
  const totalTimeStr = `${String(totalHours).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return totalTimeStr
}

const formattedItems = computed(() => {
  return props.items.map(item => ({
    ...item,
    displayAmount: item.count,
    displayValue: props.isVolume ? item.volume : item.price // [修改]
  }))
})
</script>

<template>
  <div class="module-detail">
    <CollapsibleDetailList 
      :data="formattedItems"
    >
      <template #title>
        <div v-if="variant === 'summary'" class="group-title variant-summary">
          {{ title }}
          <span v-if="badge" class="badge-pill">{{ badge }}</span>
        </div>
        <div v-else class="group-title variant-module">
          <span class="name">{{ title }}</span>
          <span class="symbol">x</span>
          <span class="count">{{ count }}</span>
          <span v-if="badge" class="badge-pill">{{ badge }}</span>
        </div>
      </template>
      <template #header>
        <span v-if="isTime" class="total-value text-red-400">{{ formatTime(value) }}</span>
        <span v-else-if="isWorkers" class="total-value" :class="value >= 0 ? 'text-emerald-400' : 'text-red-400'">
          {{ Math.abs(value) }}
        </span>
        <span v-else-if="isVolume" class="total-value text-blue-400">{{ formatNum(value) }} m³</span>
        <span v-else class="total-value text-red-400">{{ formatNum(value) }} {{ unit }}</span>
      </template>
      <template #row="{ item }">
        <div class="material-row">
          <span class="material-name">
            <span v-if="!isWorkers && !isTime" class="qty">{{ formatNum(item.displayAmount) }}</span>
            <span v-if="!isWorkers && !isTime" class="symbol">x</span>
            <span class="name" :class="{ 
              'text-emerald-500/70': isWorkers && item.id === 'cap',
              'text-red-500/70': isWorkers && item.id === 'need',
              'text-red-400/70': isTime,
              'text-blue-400/70': isVolume
            }">{{ item.displayName }}</span>
          </span>
        </div>
        <span v-if="isWorkers" class="material-value" :class="{
          'text-emerald-500/70': item.id === 'cap',
          'text-red-500/70': item.id === 'need'
        }">{{ Math.abs(item.displayAmount) }}</span>
        <span v-else-if="isTime" class="material-value text-red-400/70">{{ formatTime(item.displayValue) }}</span>
        <span v-else-if="isVolume" class="material-value text-blue-400/70">{{ formatNum(item.displayValue) }} m³</span>
        <span v-else class="material-value text-red-400/70">{{ formatNum(item.displayValue) }} {{ unit }}</span>
      </template>
    </CollapsibleDetailList>
  </div>
</template>

<style scoped>
.module-detail {
  @apply mb-1;
}

.group-title {
  @apply flex items-center gap-1;
}

.group-title.variant-summary {
  @apply text-sm font-bold text-slate-300;
}

.group-title.variant-module {
  @apply text-sm;
}

.group-title.variant-module .count {
  @apply font-medium text-slate-200;
}

.group-title.variant-module .symbol {
  @apply opacity-30 scale-90 text-slate-500;
}

.group-title.variant-module .name {
  @apply font-medium text-slate-200;
}

.total-value {
  @apply text-sm font-bold font-mono;
}

.material-row {
  @apply flex items-center gap-2;
}

.material-name {
  @apply flex items-center gap-1;
}

.material-name .qty {
  @apply font-mono text-xs text-slate-500;
}

.material-name .symbol {
  @apply opacity-30 scale-90 text-slate-500 text-[10px];
}

.material-name .name {
  @apply text-xs font-normal text-slate-400;
}

.badge-pill {
  @apply text-[10px] font-bold uppercase text-amber-400 bg-amber-400/10 border border-amber-400/30 rounded-full px-2 py-0.5 ml-2;
}

.material-value {
  @apply font-mono text-xs font-bold;
}
</style>

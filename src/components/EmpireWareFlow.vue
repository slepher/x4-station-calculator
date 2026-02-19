<script setup lang="ts">
import { computed } from 'vue'
import CollapsibleDetailList from './common/CollapsibleDetailList.vue'

const props = defineProps<{
  resourceId: string
  netRate: number
  name: string
  details?: any[]
  netValue: number
  viewMode: 'quantity' | 'economy'
  showAddButton?: boolean
  showRemoveButton?: boolean
  disableAdd?: boolean
  disableRemove?: boolean
}>()

const emit = defineEmits<{
  add: [wareId: string]
}>()

const formatNum = (n: number, digits: number = 1) => new Intl.NumberFormat('en-US', {
  maximumFractionDigits: digits,
  minimumFractionDigits: digits
}).format(n)

const displayValue = computed(() => {
  if (props.viewMode === 'economy') {
    return props.netValue
  }
  return props.netRate
})

const displaySign = computed(() => {
  return displayValue.value >= 0 ? '+' : ''
})

const formattedDisplayValue = computed(() => {
  if (props.viewMode === 'economy') {
    return displaySign.value + formatNum(displayValue.value, 0) + ' Cr'
  }
  return displaySign.value + formatNum(displayValue.value)
})

const processedDetails = computed(() => {
  if (!props.details) return []
  return [...props.details].sort((a, b) => {
    return Math.abs(b.netRate) - Math.abs(a.netRate)
  })
})

const formattedDetails = computed(() => {
  if (!props.details) return []
  
  if (props.viewMode === 'economy') {
    return processedDetails.value.map(detail => ({
      ...detail,
      displayAmount: detail.netValue
    }))
  }
  
  return processedDetails.value.map(detail => ({
    ...detail,
    displayAmount: detail.netRate
  }))
})

const classWithSymbol = (displayValue: number, className: string) => [className, className + '-' + (displayValue >= 0 ? 'pos' : 'neg')]

const formatStationName = (detail: any) => {
  const stationName = detail.stationName || 'Unknown'
  const count = detail.stationCount || 1
  if (count > 1) {
    return `${stationName} (x${count})`
  }
  return stationName
}
</script>

<template>
  <div class="flow-wrapper" :data-resource-id="resourceId">
    <div class="flow-content">
      <CollapsibleDetailList
        :data="formattedDetails"
        :isPositive="displayValue >= 0"
      >
        <template #title>
          <span class="header-name">{{ name }}</span>
        </template>
        <template #header>
          <div :class="classWithSymbol(displayValue, 'value')">
            {{ formattedDisplayValue }}
          </div>
        </template>

        <template #row="{ item }">
          <span class="item-name">
            <span class="name">{{ formatStationName(item) }}</span>
          </span>
          <div class="item-val-group">
            <span class="item-val">
              {{ item.displayAmount > 0 ? '+' : '' }}{{ formatNum(item.displayAmount) }}
            </span>
          </div>
        </template>
      </CollapsibleDetailList>
    </div>
    <div v-if="showAddButton || showRemoveButton" class="flow-action-rail">
      <button
        v-if="showRemoveButton"
        class="action-btn remove-btn"
        type="button"
        :disabled="disableRemove"
        @click.stop="emit('remove', resourceId)"
      >
        -
      </button>
      <button
        v-if="showAddButton"
        class="action-btn add-btn"
        type="button"
        :disabled="disableAdd"
        @click.stop="emit('add', resourceId)"
      >
        +
      </button>
    </div>
  </div>
</template>

<style scoped>
.flow-wrapper {
  @apply flex items-start gap-1;
}

.flow-content {
  @apply flex-1 min-w-0;
}

.flow-action-rail {
  @apply w-20 h-8 flex-none flex items-center justify-center gap-2 bg-slate-800/40 rounded;
}

.action-btn {
  @apply w-7 h-7 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-600/30 transition-all font-bold;
}

.action-btn:disabled {
  @apply text-slate-600 bg-slate-900/40 cursor-not-allowed hover:text-slate-600 hover:bg-slate-900/40;
}

.remove-btn {
  @apply text-slate-500;
}

.header-name {
  @apply text-sm font-medium text-slate-200;
}

.value {
  @apply text-sm font-bold min-w-[70px] text-right font-mono;
}

.value-pos {
  @apply text-emerald-400;
}

.value-neg {
  @apply text-red-400;
}

.item-name {
  @apply flex items-center gap-1;
}

.item-name .name {
  @apply text-xs font-normal text-slate-400;
}

.item-val-group {
  @apply flex items-center gap-3;
}

.item-val {
  @apply font-mono font-medium;
}

.item-bonus {
  @apply text-sky-500/80;
}
</style>

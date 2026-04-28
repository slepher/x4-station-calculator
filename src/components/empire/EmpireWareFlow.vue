<script setup lang="ts">
import { computed } from 'vue'
import CollapsibleDetailList from '../common/CollapsibleDetailList.vue'
import type { DerivedFlowContribution } from '@/types/production-flow'

const props = defineProps<{
  resourceId: string
  netRate: number
  name: string
  details?: DerivedFlowContribution[]
  netValue: number
  viewMode: 'quantity' | 'economy'
  showAddButton?: boolean
  showRemoveButton?: boolean
  disableAdd?: boolean
  disableRemove?: boolean
}>()

const emit = defineEmits<{
  add: [wareId: string]
  remove: [wareId: string]
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
    const aExtra = a as unknown as Record<string, number>
    const bExtra = b as unknown as Record<string, number>
    const orderA = Number(aExtra.sortOrder)
    const orderB = Number(bExtra.sortOrder)
    const hasOrderA = Number.isFinite(orderA)
    const hasOrderB = Number.isFinite(orderB)
    if (hasOrderA || hasOrderB) {
      if (hasOrderA && hasOrderB && orderA !== orderB) return orderA - orderB
      if (hasOrderA && !hasOrderB) return -1
      if (!hasOrderA && hasOrderB) return 1
    }
    return Math.abs(b.amount) - Math.abs(a.amount)
  })
})

const formattedDetails = computed(() => {
  if (!props.details) return []
  
  if (props.viewMode === 'economy') {
    return processedDetails.value.map(detail => {
      const extra = detail as unknown as Record<string, number>
      return {
        ...detail,
        displayAmount: extra.netValue ?? detail.amount * 100
      }
    })
  }
  
  return processedDetails.value.map(detail => ({
    ...detail,
    displayAmount: detail.amount
  }))
})

const classWithSymbol = (displayValue: number, className: string) => [className, className + '-' + (displayValue >= 0 ? 'pos' : 'neg')]

const getStationName = (detail: DerivedFlowContribution) => detail.name || detail.id
const getStationCount = (detail: DerivedFlowContribution) => detail.count || 1
</script>

<template>
  <div class="flow-wrapper" data-testid="flow-wrapper" :data-resource-id="resourceId">
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
            <span class="qty">{{ getStationCount(item) }}</span>
            <span class="symbol">x</span>
            <span class="name">{{ getStationName(item) }}</span>
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
        data-testid="add-btn"
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

.item-name .qty {
  @apply font-mono text-slate-500;
}

.item-name .symbol {
  @apply opacity-30 scale-90 text-slate-500;
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

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import CollapsibleDetailList from './common/CollapsibleDetailList.vue'

const { t } = useI18n()
const props = withDefaults(defineProps<{
  title: string
  value: number
  items: any[]
  variant?: 'summary' | 'module'
  count?: number
}>(), {
  variant: 'module',
  count: 0
})

const formatNum = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n))

const formattedItems = computed(() => {
  return props.items.map(item => ({
    ...item,
    displayAmount: item.count,
    displayValue: item.price
  }))
})
</script>

<template>
  <div class="module-detail">
    <CollapsibleDetailList :data="formattedItems">
      <template #title>
        <div v-if="variant === 'summary'" class="group-title variant-summary">
          {{ title }}
        </div>
        <div v-else class="group-title variant-module">
          <span class="name">{{ title }}</span>
          <span class="symbol">x</span>
          <span class="count">{{ count }}</span>
        </div>
      </template>
      <template #header>
        <span class="total-value">{{ formatNum(value) }} {{ t('ui.credits') }}</span>
      </template>
      <template #row="{ item }">
        <div class="material-row">
          <span class="material-name">
            <span class="qty">{{ formatNum(item.displayAmount) }}</span>
            <span class="symbol">x</span>
            <span class="name">{{ item.displayName }}</span>
          </span>
        </div>
        <span class="material-value">{{ formatNum(item.displayValue) }} {{ t('ui.credits') }}</span>
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
  @apply text-sm font-bold text-red-400 font-mono;
}

.material-row {
  @apply flex items-center gap-2;
}

.material-name {
  @apply flex items-center gap-1;
}

.material-name .qty {
  @apply font-mono text-slate-500;
}

.material-name .symbol {
  @apply opacity-30 scale-90 text-slate-500;
}

.material-name .name {
  @apply text-xs font-normal text-slate-400;
}

.material-value {
  @apply font-mono text-sm font-bold text-red-400/70;
}
</style>

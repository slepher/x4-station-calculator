<script setup lang="ts">
import { ref, computed } from 'vue'
import { useX4I18n } from '@/utils/UseX4I18n'

const props = defineProps<{
  resourceId: string
  amount: number
  name: string
  details?: any[] 
}>()

const { translate } = useX4I18n()
const isOpen = ref(false)

const formatNum = (n: number) => new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1
}).format(n)

// 明细排序与处理
const processedDetails = computed(() => {
  if (!props.details) return []
  return [...props.details].sort((a, b) => {
    const aIsProd = a.type === 'production' ? 1 : 0
    const bIsProd = b.type === 'production' ? 1 : 0
    if (aIsProd !== bIsProd) return bIsProd - aIsProd
    return Math.abs(b.amount) - Math.abs(a.amount)
  })
})
</script>

<template>
  <div class="item-container">
    <div 
      class="main-row" 
      :class="[amount >= 0 ? 'status-pos' : 'status-neg', { 'is-active': isOpen }]"
      @click="isOpen = !isOpen"
    >
      <div class="label-group">
        <span class="arrow" :class="{ 'arrow-open': isOpen }">▶</span>
        <div class="dot" :class="amount >= 0 ? 'dot-pos' : 'dot-neg'"></div>
        <span class="name">{{ name }}</span>
      </div>
      <div class="value">
        {{ amount >= 0 ? '+' : '' }}{{ formatNum(amount) }}
      </div>
    </div>

    <Transition name="expand">
      <div v-if="isOpen" class="list-box">
        <div v-for="(det, idx) in processedDetails" :key="idx" 
             :class="['list-item', det.type === 'production' ? 'item-prod' : 'item-cons']">
          <span class="item-name">
            <span class="qty">{{ det.count }}</span>
            <span class="symbol">x</span>
            <span class="name">{{ translate(det.moduleId, det.nameId || det.moduleId, 'module') }}</span>
          </span>
          <div class="item-val-group">
            <span v-if="det.bonusPercent > 0" class="item-bonus">(+{{ det.bonusPercent }}%)</span>
            <span class="item-val">
              {{ det.amount > 0 ? '+' : '' }}{{ formatNum(det.amount) }}
            </span>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.item-container { @apply mb-1 select-none; }
.main-row { @apply flex justify-between items-center px-3 py-2 bg-slate-800/40 rounded cursor-pointer hover:bg-slate-700/50 transition-colors border border-transparent; }
.is-active { @apply border-slate-600/50 bg-slate-700/40; }

/* 基础图标与文字 */
.label-group { @apply flex items-center gap-2; }
.arrow { @apply text-[10px] text-slate-500 transition-transform duration-200; }
.arrow-open { @apply rotate-90 text-slate-300; }

.dot { @apply w-1.5 h-1.5 rounded-full; }
.dot-pos { @apply bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]; }
.dot-neg { @apply bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]; }

.name { @apply text-sm font-medium text-slate-200; }
.value { @apply text-sm font-bold min-w-[80px] text-right font-mono; }

/* 状态色彩封装 */
.status-pos .value { @apply text-emerald-400; }
.status-neg .value { @apply text-red-400; }

/* 明细列表布局 */
.list-box { @apply bg-slate-900/60 mx-1 px-4 py-2 text-[11px] rounded-b border-x border-b border-slate-700/30 overflow-hidden; }
.list-item { @apply flex justify-between items-center py-1.5 border-b border-slate-700/20 last:border-0; }

/* 三段式紧凑结构 */
.item-name { @apply flex items-center gap-1; }
.item-name .qty { @apply font-mono text-slate-500; }
.item-name .symbol { @apply opacity-30 scale-90 text-slate-500; }
.item-name .name { @apply text-xs font-normal text-slate-400; }

.item-val-group { @apply flex items-center gap-3; }
.item-val { @apply font-mono font-medium; }
.item-bonus { @apply text-sky-500/80; }

/* 明细项特定颜色 */
.item-prod .item-val { @apply text-emerald-500/70; }
.item-cons .item-val { @apply text-red-400/70; }

/* 动画 */
.expand-enter-active, .expand-leave-active { transition: all 0.2s ease-out; max-height: 500px; }
.expand-enter-from, .expand-leave-to { opacity: 0; max-height: 0; }
</style>
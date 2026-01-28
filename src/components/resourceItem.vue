<script setup lang="ts">
import { ref, computed } from 'vue'
import { useStationStore } from '@/store/useStationStore'
import { useX4I18n } from '@/utils/useX4I18n'

const props = defineProps<{
  resourceId: string
  amount: number
  name: string
  details?: any[] // 接收来自 Store 的实时明细数据
}>()

const store = useStationStore()
const { translate } = useX4I18n()
const isOpen = ref(false)

const formatNum = (n: number) => new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1
}).format(n)

// 明细排序与处理
const processedDetails = computed(() => {
  if (!props.details) return []
  // 1. 产出条目(production)优先 2. 数量大者优先
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
      :class="{ 'row-active': isOpen }"
      @click="isOpen = !isOpen"
    >
      <div class="label-group">
        <span class="arrow" :class="{ 'arrow-open': isOpen }">▶</span>
        <div class="dot" :class="amount >= 0 ? 'dot-pos' : 'dot-neg'"></div>
        <span class="name text-slate-200">{{ name }}</span>
      </div>
      <div class="value font-mono" :class="amount >= 0 ? 'text-emerald-400' : 'text-red-400'">
        {{ amount >= 0 ? '+' : '' }}{{ formatNum(amount) }}
      </div>
    </div>

    <Transition name="expand">
      <div v-if="isOpen" class="details-panel">
        <div v-for="(det, idx) in processedDetails" :key="idx" class="detail-row">
          <div class="det-info">
            <span class="det-name">{{ translate(det.moduleId, det.nameId || det.moduleId, 'module') }}</span>
            <span class="det-count text-slate-500">x{{ det.count }}</span>
          </div>
          <div class="det-values font-mono text-right">
            <span v-if="det.bonusPercent > 0" class="det-eff text-sky-500/80 mr-3">
              (+{{ det.bonusPercent }}%)
            </span>
            <span :class="det.type === 'production' ? 'text-emerald-500/70' : 'text-red-400/70'">
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
.row-active { @apply border-slate-600/50 bg-slate-700/40; }

.label-group { @apply flex items-center gap-2; }
.arrow { @apply text-[10px] text-slate-500 transition-transform duration-200; }
.arrow-open { @apply rotate-90 text-slate-300; }

.dot { @apply w-1.5 h-1.5 rounded-full; }
.dot-pos { @apply bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]; }
.dot-neg { @apply bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]; }

.name { @apply text-sm font-medium; }
.value { @apply text-sm font-bold min-w-[80px] text-right; } /* 确保主数值右对齐 */

.details-panel { @apply bg-slate-900/60 mx-1 px-4 py-2 text-[11px] rounded-b border-x border-b border-slate-700/30 overflow-hidden; }

/* 明细对齐逻辑 */
.detail-row { @apply flex justify-between items-center py-1.5 border-b border-slate-700/20 last:border-0; }
.det-info { @apply flex items-center gap-2 flex-1; }
.det-name { @apply text-slate-400; }
.det-values { @apply flex-1 flex justify-end items-center; } /* 强制数值列向右对齐 */

.expand-enter-active, .expand-leave-active { transition: all 0.2s ease-out; max-height: 500px; }
.expand-enter-from, .expand-leave-to { opacity: 0; max-height: 0; }
</style>
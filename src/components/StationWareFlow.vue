<script setup lang="ts">
import { computed } from 'vue'
import { useStationStore } from '@/store/useStationStore'
import CollapsibleDetailList from './common/CollapsibleDetailList.vue'
import LockButton from './common/LockButton.vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  resourceId: string
  netRate: number
  name: string
  details?: any[]
  locked?: boolean // 新增 locked 属性
  // 新增体积和经济数据
  netVolume: number
  netValue: number
  transportType: string
  unitVolume: number
  // 新增仓储规划数据
  totalOccupiedVolume: number
  totalOccupiedCount: number
  totalOccupiedConsumptionCount: number
  // 新增视图模式属性
  viewMode: 'quantity' | 'volume' | 'economy'
}>()

const emit = defineEmits<{
  (e: 'update:locked', value: boolean): void
}>()

const store = useStationStore()
const { t } = useI18n()

const translateModule = (moduleId: string) => {
    const store = useStationStore()
    const module = store.modules[moduleId]
    return module ? module.localeName : moduleId;
}

// 计算是否可操作
const nonOperable = computed(() => !store.isWareOperable(props.resourceId))

const formatNum = (n: number, digits: number = 1) => new Intl.NumberFormat('en-US', {
  maximumFractionDigits: digits,
  minimumFractionDigits: digits
}).format(n)

// 根据视图模式显示不同的主值
const displayValue = computed(() => {
  if (props.viewMode === 'economy' && props.netValue !== undefined) {
    return props.netValue
  }
  if (props.viewMode === 'volume' && props.netVolume !== undefined) {
    return props.netVolume
  }
  return props.netRate
})

// 根据视图模式显示不同的符号
const displaySign = computed(() => {
    return displayValue.value >= 0 ? '+' : ''
})

const formattedDisplayValue = computed(() => {
  if (props.viewMode === 'economy') {
    return displaySign.value + formatNum(displayValue.value, 0) + ' Cr'
  }
  if (props.viewMode === 'volume') {
    return displaySign.value + formatNum(displayValue.value, 0) + 'm³'
  }
  return displaySign.value + formatNum(displayValue.value)
})

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

// 根据视图模式格式化明细数据
const formattedDetails = computed(() => {
  if (!props.details) return []
  
  // 如果是经济视图，需要将明细数据转换为经济数据
  if (props.viewMode === 'economy') {
    return processedDetails.value.map(detail => {
      // 使用analyzeWareFlow函数计算的实际valueFlow数据
      const economicValue = detail.valueFlow !== undefined ? detail.valueFlow : detail.amount * 100
      return {
        ...detail,
        economicAmount: economicValue,
        displayAmount: economicValue
      }
    })
  }
  
  // 如果是体积视图，需要将明细数据转换为体积数据
  if (props.viewMode === 'volume') {
    return processedDetails.value.map(detail => {
      // 使用analyzeWareFlow函数计算的实际volumeFlow数据
      const volumeValue = detail.volumeFlow !== undefined ? detail.volumeFlow : detail.amount * (props.unitVolume || 0)
      return {
        ...detail,
        volumeAmount: volumeValue,
        displayAmount: volumeValue
      }
    })
  }
  
  // 默认视图模式，显示原始产量数据
  return processedDetails.value.map(detail => ({
    ...detail,
    displayAmount: detail.amount
  }))
})

const volumeTooltipContent = computed(() => {
  const netRateClass = props.netVolume >= 0 ? 'text-emerald-400' : 'text-red-400'
  return `
    <div class="volume-tooltip-grid">
      <span class="label">${t('ui.net_rate')}</span>
      <span class="value ${netRateClass}">${formatNum(props.netVolume)}</span>
      <span class="unit">m³</span>
      
      <span class="label">${t('ui.total_volume')}</span>
      <span class="value text-blue-400">${formatNum(props.totalOccupiedVolume)}</span>
      <span class="unit">m³</span>

      <span class="label">${t('ui.storage_slots')}</span>
      <span class="value text-blue-400">${Math.ceil(props.totalOccupiedCount)}</span>
      <span class="unit">${t('ui.unit_slots')}</span>
      
      <span class="label">${t('ui.storage_min_slots')}</span>
      <span class="value text-blue-400">${Math.ceil(props.totalOccupiedConsumptionCount)}</span>
      <span class="unit">${t('ui.unit_slots')}</span>
    </div>
  `
})

const classWithSymbol = (displayValue: number, className:string) => [className, className + '-' + (displayValue >= 0 ? 'pos' : 'neg')]
</script>

<template>
  <div class="flow-wrapper">
    <div class="flow-content">
      <CollapsibleDetailList
        :data="formattedDetails"
        :isPositive="displayValue >= 0"
      >
        <template #title>
          <div :class="classWithSymbol(displayValue, 'dot')"></div>
          <span class="name">{{ name }}</span>
        </template>
        <template #header>
          <div :class="classWithSymbol(displayValue, 'value')" v-if="viewMode === 'economy' || viewMode === 'quantity'">
            {{ formattedDisplayValue }}
          </div>
          <div class="volume-trigger-container" v-if="viewMode === 'volume'"  v-tippy="{ content: volumeTooltipContent, allowHTML: true, theme: 'tomato' }">
            <span class="volume-count-main text-blue-400 font-mono font-bold text-sm leading-none">
              {{ Math.ceil(totalOccupiedCount) }}
            </span>
            <div class="icon-anchor">
              <svg class="w-3.5 h-3.5 text-blue-300/60" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
                <path d="m3.3 7 8.7 5 8.7-5"/>
                <path d="M12 22V12"/>
              </svg>
            </div>
          </div>
        </template>

        <template #row="{ item }">
          <span class="item-name">
            <span class="qty">{{ item.count }}</span>
            <span class="symbol">x</span>
            <span class="name">{{ translateModule(item.moduleId) }}</span>
          </span>
          <div class="item-val-group">
            <span v-if="item.bonusPercent > 0" class="item-bonus">(+{{ item.bonusPercent }}%)</span>
            <span class="item-val">
              {{ item.displayAmount > 0 ? '+' : '' }}{{ formatNum(item.displayAmount) }}
            </span>
          </div>
        </template>
      </CollapsibleDetailList>
    </div>
    <div class="flow-action-rail">
      <LockButton 
        :locked="locked"
        :disabled="nonOperable"
        @update:locked="emit('update:locked', $event)"
      />
    </div>
  </div>
</template>

<style scoped>

.dot {
  @apply w-1.5 h-1.5 rounded-full;
}

.flow-wrapper {
  @apply flex items-start gap-1;
}

.flow-content {
  @apply flex-1 min-w-0;
}

.flow-action-rail {
  @apply w-10 h-8 flex-none flex items-center justify-center bg-slate-800/40 rounded;
  /* 微调 pt-2 以便更好地对齐左侧文字的视觉中心 */
}
.dot-pos { @apply bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]; }
.dot-neg { @apply bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]; }



/* 处于锁定但同时不可操作的情况（兜底样式） */
.lock-btn.is-locked.non-operable {
  @apply text-amber-500/30 bg-transparent;
}

.name {
  @apply text-sm font-medium text-slate-200;
}

.value {
  @apply text-sm font-bold min-w-[70px] text-right font-mono;
}

/* 状态色彩封装 */
.value-pos {
  @apply text-emerald-400;
}

.value-neg {
  @apply text-red-400;
}

/* 三段式紧凑结构 */
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

.volume-info {
  @apply text-[10px] text-slate-500 ml-1;
}

.volume-value {
  @apply flex items-center gap-2;
}

.volume-details {
  @apply text-[10px] text-slate-400 ml-1;
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

/* 明细项特定颜色 */
.item-prod .item-val {
  @apply text-emerald-500/70;
}

.item-cons .item-val {
  @apply text-red-400/70;
}

.volume-trigger-container {
  @apply flex items-end gap-2 cursor-help;
}

.icon-anchor {
  @apply flex items-center h-[14px];
}
</style>

<style>
/* Tooltip 内部网格布局 (非 Scoped 以便 Tippy 渲染) */
.volume-tooltip-grid {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 4px 12px;
  align-items: center;
  padding: 4px;
  font-size: 12px;
}
.volume-tooltip-grid .label { @apply text-slate-400; }
.volume-tooltip-grid .unit { @apply text-slate-500 text-[10px]; }

.tippy-box[data-theme~='tomato'] {
  background-color: #151C2C;
}
.tippy-box[data-theme~='tomato'][data-placement^='top'] > .tippy-arrow::before {
  border-top-color: #151C2C;
}
.tippy-box[data-theme~='tomato'][data-placement^='bottom']
  > .tippy-arrow::before {
  border-bottom-color: #151C2C;
}
.tippy-box[data-theme~='tomato'][data-placement^='left']
  > .tippy-arrow::before {
  border-left-color: #151C2C; 
}
.tippy-box[data-theme~='tomato'][data-placement^='right']
  > .tippy-arrow::before {
  border-right-color: #151C2C;
}
</style>
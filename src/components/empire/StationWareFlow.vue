<script setup lang="ts">
import { computed } from 'vue'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useI18n } from 'vue-i18n'
import CollapsibleDetailList from '../common/CollapsibleDetailList.vue'
import LockButton from '../common/LockButton.vue'
import FavoriteButton from '../common/FavoriteButton.vue'
import VolumeTooltip from '../common/VolumeTooltip.vue'
import type { DerivedFlowContribution } from '@/types/production-flow'

const { t } = useI18n()

const props = defineProps<{
  resourceId: string
  netRate: number
  name: string
  details?: DerivedFlowContribution[]
  locked?: boolean
  priorityLevel?: number
  netVolume: number
  transportDemand?: number
  netValue: number
  transportType: string
  unitVolume: number
  totalOccupiedVolume: number
  totalOccupiedCount: number
  totalOccupiedConsumptionCount: number
  viewMode: 'quantity' | 'volume' | 'economy' | 'transport'
  transportMinutes?: number
  nonOperable?: boolean
  isPlanned?: boolean
  resourceBufferHours?: number
  primaryProductBufferHours?: number
  secondaryProductBufferHours?: number
  modulesMap?: Record<string, any>
}>()

const emit = defineEmits<{
  (e: 'update:locked', value: boolean): void
  (e: 'update:priorityLevel', value: number): void
}>()

function handleToggleLock(value: boolean) {
  emit('update:locked', value)
}

function handleTogglePriority(value: number) {
  emit('update:priorityLevel', value)
}

const gameData = useGameDataStore()

const translateModule = (moduleId: string) => {
  const module = props.modulesMap?.[moduleId] || gameData.localizedModulesMap[moduleId]
  return module ? module.localeName : moduleId
}

const nonOperableComputed = computed(() => props.nonOperable ?? false)

const formatNum = (n: number, digits: number = 1) => new Intl.NumberFormat('en-US', {
  maximumFractionDigits: digits,
  minimumFractionDigits: digits
}).format(n)

const displayValue = computed(() => {
  if (props.viewMode === 'economy' && props.netValue !== undefined) {
    return props.netValue
  }
  if (props.viewMode === 'volume' && props.netVolume !== undefined) {
    return props.netVolume
  }
  if (props.viewMode === 'transport') {
    if (props.transportDemand !== undefined) return props.transportDemand
    const minutes = props.transportMinutes ?? 30
    return Math.abs(props.netRate) * (props.unitVolume || 0) * (minutes / 60)
  }
  return props.netRate
})

const displaySign = computed(() => displayValue.value >= 0 ? '+' : '')

const formattedDisplayValue = computed(() => {
  if (props.viewMode === 'economy') {
    return displaySign.value + formatNum(displayValue.value, 0) + ' Cr'
  }
  if (props.viewMode === 'volume') {
    return displaySign.value + formatNum(displayValue.value, 0) + 'm³'
  }
  if (props.viewMode === 'transport') {
    return formatNum(displayValue.value, 1) + 'm³'
  }
  return displaySign.value + formatNum(displayValue.value)
})

const processedDetails = computed(() => {
  if (!props.details) return []
  return [...props.details].sort((a, b) => {
    const aIsProd = a.type === 'production' ? 1 : 0
    const bIsProd = b.type === 'production' ? 1 : 0
    if (aIsProd !== bIsProd) return bIsProd - aIsProd
    return Math.abs(b.amount) - Math.abs(a.amount)
  })
})

const formattedDetails = computed(() => {
  if (!props.details) return []
  
  if (props.viewMode === 'economy') {
    return processedDetails.value.map(detail => ({
      ...detail,
      economicAmount: detail.valueContribution,
      displayAmount: detail.valueContribution
    }))
  }
  
  if (props.viewMode === 'volume') {
    return processedDetails.value.map(detail => ({
      ...detail,
      volumeAmount: detail.volumeContribution,
      displayAmount: detail.volumeContribution
    }))
  }

  if (props.viewMode === 'transport') {
    return processedDetails.value.map(detail => ({
      ...detail,
      displayAmount: detail.transportContribution
    }))
  }
  
  return processedDetails.value.map(detail => ({ ...detail, displayAmount: detail.amount }))
})

const hasProduction = computed(() => props.details?.some(d => d.amount > 0) ?? false)
const hasConsumption = computed(() => props.details?.some(d => d.type === 'consumption') ?? false)

const isPlannedComputed = computed(() => props.isPlanned ?? false)

const availableLevels = computed(() => {
  if (isPlannedComputed.value) {
    return [1, 2]
  } else if (hasProduction.value) {
    return [0, 1]
  } else {
    return [0]
  }
})

const favoriteDisabled = computed(() => availableLevels.value.length <= 1)

const classWithSymbol = (displayValue: number, className:string) => [className, className + '-' + (displayValue >= 0 ? 'pos' : 'neg')]
</script>

<template>
  <div class="flow-wrapper" data-testid="flow-wrapper" :data-resource-id="resourceId">
    <div class="flow-content">
      <CollapsibleDetailList
        :data="formattedDetails"
        :isPositive="displayValue >= 0"
      >
        <template #title>
          <span class="header-name" data-testid="flow-name">{{ name }}</span>
        </template>
        <template #header>
          <div :class="classWithSymbol(displayValue, 'value')" v-if="viewMode === 'economy' || viewMode === 'quantity'" data-testid="flow-value">
            {{ formattedDisplayValue }}
          </div>
          <div v-if="viewMode === 'transport'" class="value value-transport" data-testid="flow-value">
            {{ formattedDisplayValue }}
            <svg class="w-3.5 h-3.5 text-blue-300/70" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="1" y="3" width="15" height="13"></rect>
              <path d="M16 8h4l3 3v5h-7z"></path>
              <circle cx="5.5" cy="18.5" r="2.5"></circle>
              <circle cx="18.5" cy="18.5" r="2.5"></circle>
            </svg>
          </div>
          <tippy v-if="viewMode === 'volume'" theme="x4" :allowHTML="true" interactive>
            <div class="volume-trigger-container">
              <span class="volume-count-main text-blue-400 font-mono font-bold text-sm leading-none" data-testid="volume-count">
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
            <template #content>
              <VolumeTooltip
                :net-volume="netVolume"
                :total-occupied-volume="totalOccupiedVolume"
                :total-occupied-count="totalOccupiedCount"
                :total-occupied-consumption-count="totalOccupiedConsumptionCount"
              />
            </template>
          </tippy>
        </template>

        <template #row="{ item }">
          <span class="item-name">
            <span class="qty">{{ item.count }}</span>
            <span class="symbol">x</span>
            <span class="name">
              <template v-if="item.class === 'workforce'">
                {{ t(`race.${item.id}`) }} {{ t('station.workforce_label') }}
              </template>
              <template v-else>
                {{ translateModule(item.id) }}
              </template>
            </span>
          </span>
          <div class="item-val-group">
            <span v-if="item.bonusPercent > 0" class="item-bonus">(+{{ item.bonusPercent }}%)</span>
            <span class="item-val" :class="{ 'item-val-transport': viewMode === 'transport' }">
              <template v-if="viewMode === 'economy'">{{ (item.displayAmount > 0 ? '+' : '') }}{{ formatNum(item.displayAmount) }} Cr</template>
              <template v-else-if="viewMode === 'transport' || viewMode === 'volume'">{{ formatNum(item.displayAmount) }}</template>
              <template v-else>{{ (item.displayAmount > 0 ? '+' : '') }}{{ formatNum(item.displayAmount) }}</template>
            </span>
          </div>
        </template>
      </CollapsibleDetailList>
    </div>
    <div class="flow-action-rail">
      <FavoriteButton
        :level="priorityLevel ?? 0"
        :disabled="favoriteDisabled"
        :has-consumption="hasConsumption"
        :has-production="hasProduction"
        :resource-buffer-hours="resourceBufferHours ?? 1"
        :primary-product-buffer-hours="primaryProductBufferHours ?? 12"
        :secondary-product-buffer-hours="secondaryProductBufferHours ?? 2"
        :available-levels="availableLevels"
        @update:level="handleTogglePriority($event)"
      />
      <LockButton
        :locked="locked"
        :disabled="nonOperableComputed"
        @update:locked="handleToggleLock($event)"
      />
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
  /* 微调 pt-2 以便更好地对齐左侧文字的视觉中心 */
}

/* 处于锁定但同时不可操作的情况（兜底样式） */
.lock-btn.is-locked.non-operable {
  @apply text-amber-500/30 bg-transparent;
}

.header-name {
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

.value-transport {
  @apply text-blue-300 flex items-center justify-end gap-2;
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

.item-val-transport {
  @apply text-blue-300;
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
</style>

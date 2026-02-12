<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  netVolume: number
  totalOccupiedVolume: number
  totalOccupiedCount: number
  totalOccupiedConsumptionCount: number
}>()

const { t } = useI18n()

const formatNum = (n: number, digits: number = 1) => new Intl.NumberFormat('en-US', {
  maximumFractionDigits: digits,
  minimumFractionDigits: digits
}).format(n)

const netRateClass = computed(() => props.netVolume >= 0 ? 'text-emerald-400' : 'text-red-400')
</script>

<template>
  <div class="volume-tooltip-grid">
    <span class="label">{{ t('wareflow.net_volume') }}</span>
    <span class="value" :class="netRateClass">{{ formatNum(props.netVolume) }}</span>
    <span class="unit">m³</span>
    
    <span class="label">{{ t('wareflow.storage_volume') }}</span>
    <span class="value text-blue-400">{{ formatNum(props.totalOccupiedVolume) }}</span>
    <span class="unit">m³</span>

    <span class="label">{{ t('wareflow.storage_slots') }}</span>
    <span class="value text-blue-400">{{ Math.ceil(props.totalOccupiedCount) }}</span>
    <span class="unit">{{ t('wareflow.unit_slots') }}</span>
    
    <span class="label">{{ t('wareflow.storage_min_slots') }}</span>
    <span class="value text-blue-400">{{ Math.ceil(props.totalOccupiedConsumptionCount) }}</span>
    <span class="unit">{{ t('wareflow.unit_slots') }}</span>
  </div>
</template>

<style scoped>
.volume-tooltip-grid {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 4px 12px;
  align-items: center;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 12px;
  padding: 4px;
}

.label {
  color: rgba(255, 255, 255, 0.6);
}

.value {
  text-align: right;
  font-weight: 700;
}

.unit {
  color: rgba(255, 255, 255, 0.4);
}
</style>

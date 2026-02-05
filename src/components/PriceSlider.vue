<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  modelValue: number,
  label: string,
  type: 'buy' | 'sell'
}>()

const emit = defineEmits(['update:modelValue'])
const { t } = useI18n()

const priceText = computed(() => {
  return Math.abs(props.modelValue - 0.5) < 0.001
    ? t('profit.average')
    : `${Math.round(props.modelValue * 100)}%`
})

const updateValue = (e: Event) => {
  emit('update:modelValue', parseFloat((e.target as HTMLInputElement).value))
}
</script>

<template>
  <div class="slider-container">
    <div class="slider-wrapper">
      <div class="slider-header">
        <span class="slider-label uppercase whitespace-nowrap">{{ label }}</span>
        <span :class="['font-black uppercase whitespace-nowrap', type === 'buy' ? 'text-sky-400' : 'text-emerald-400']">
          {{ priceText }}
        </span>
      </div>
      <input type="range" :value="modelValue" @input="updateValue" min="0" max="1" step="0.05"
        :class="['custom-range', type === 'buy' ? 'range-buy' : 'range-sell']">
    </div>
  </div>
</template>

<style scoped>
/* 占满 flex 容器分配的 1/2 空间 */
.slider-container {
  @apply flex-1;
}

/* 核心：确保文字和滑块在一行内，并限制最大宽度防止过长 */
.slider-wrapper {
  @apply space-y-1.5;
  max-width: 240px;
  /* 固定一个合适的宽度值，确保在不同页面视觉一致 */
}

.slider-header {
  @apply flex justify-between text-[10px] text-slate-500 font-bold tracking-tighter;
}

.slider-label {
  @apply opacity-80;
}

.custom-range {
  @apply w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer focus:outline-none;
}

.range-buy {
  @apply accent-sky-500;
}

.range-sell {
  @apply accent-emerald-500;
}
</style>
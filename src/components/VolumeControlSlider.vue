<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  modelValue: number,
  label: string,
  type: 'resource' | 'product',
  max?: number,
  step?: number
}>()

const emit = defineEmits(['update:modelValue'])

// 默认最大值为24小时，步长为1小时
const maxValue = computed(() => props.max ?? 24)
const stepValue = computed(() => props.step ?? 1)

const hoursText = computed(() => {
  return `${Math.round(props.modelValue * 10) / 10}h` // 保留一位小数
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
        <span :class="['font-black uppercase whitespace-nowrap', type === 'resource' ? 'text-amber-400' : 'text-purple-400']">
          {{ hoursText }}
        </span>
      </div>
      <input type="range" :value="modelValue" @input="updateValue" 
        :min="0" :max="maxValue" :step="stepValue"
        :class="['custom-range', type === 'resource' ? 'range-resource' : 'range-product']">
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

.range-resource {
  @apply accent-amber-500;
}

.range-product {
  @apply accent-purple-500;
}
</style>
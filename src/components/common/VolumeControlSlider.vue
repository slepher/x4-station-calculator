<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  modelValue: number,
  label: string,
  type: 'resource' | 'product' | 'transport',
  min?: number,
  max?: number,
  step?: number,
  unit?: string
}>()

const emit = defineEmits(['update:modelValue'])

const draftValue = ref(props.modelValue)

watch(() => props.modelValue, (value) => {
  draftValue.value = value
})

// 默认最小值为0，最大值为24小时，步长为1小时
const minValue = computed(() => props.min ?? 0)
const maxValue = computed(() => props.max ?? 24)
const stepValue = computed(() => props.step ?? 1)
const unitText = computed(() => props.unit ?? 'h')

const displayValue = computed(() => {
  const rounded = Math.round(draftValue.value * 10) / 10
  // 如果单位是 m³，使用千分位分隔符
  if (unitText.value === 'm³') {
    return new Intl.NumberFormat('en-US').format(rounded) + unitText.value
  }
  return rounded + unitText.value
})

const updateValue = (e: Event) => {
  const nextValue = parseFloat((e.target as HTMLInputElement).value)
  draftValue.value = nextValue
}

const commitValue = (e: Event) => {
  const nextValue = parseFloat((e.target as HTMLInputElement).value)
  draftValue.value = nextValue
  emit('update:modelValue', nextValue)
}
</script>

<template>
  <div class="slider-container">
    <div class="slider-wrapper">
      <div class="slider-header">
        <span class="slider-label uppercase whitespace-nowrap">{{ label }}</span>
        <span :class="['font-black uppercase whitespace-nowrap', 
          type === 'resource' ? 'text-amber-400' : 
          type === 'transport' ? 'text-blue-400' : 'text-purple-400']">
          {{ displayValue }}
        </span>
      </div>
      <input type="range" :value="draftValue" @input="updateValue" @change="commitValue"
        :min="minValue" :max="maxValue" :step="stepValue"
        :class="['custom-range', 
          type === 'resource' ? 'range-resource' : 
          type === 'transport' ? 'range-transport' : 'range-product']">
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

.range-transport {
  @apply accent-blue-500;
}
</style>

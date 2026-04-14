<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  modelValue: number,
  label: string,
  type: 'buy' | 'sell'
}>()

const emit = defineEmits(['update:modelValue'])
const { t } = useI18n()

const draftValue = ref(props.modelValue)

watch(() => props.modelValue, (value) => {
  draftValue.value = value
})

const priceText = computed(() => {
  return Math.abs(draftValue.value - 0.5) < 0.001
    ? t('common.average')
    : `${Math.round(draftValue.value * 100)}%`
})

const updateValue = (e: Event) => {
  draftValue.value = parseFloat((e.target as HTMLInputElement).value)
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
        <span :class="['font-black uppercase whitespace-nowrap', type === 'buy' ? 'text-sky-400' : 'text-emerald-400']">
          {{ priceText }}
        </span>
      </div>
      <input type="range" :value="draftValue" @input="updateValue" @change="commitValue" min="0" max="1" step="0.05"
        :class="['custom-range', type === 'buy' ? 'range-buy' : 'range-sell']">
    </div>
  </div>
</template>

<style scoped>
.slider-container {
  @apply flex-1;
}

.slider-wrapper {
  @apply space-y-1.5;
  max-width: 240px;
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

.custom-range::-webkit-slider-thumb {
  @apply appearance-none w-4 h-4 rounded-full cursor-pointer;
}

.custom-range::-moz-range-thumb {
  @apply w-4 h-4 rounded-full border-0 cursor-pointer;
}

.range-buy {
  @apply accent-sky-500;
}

.range-buy::-webkit-slider-thumb {
  @apply bg-sky-500;
}

.range-buy::-moz-range-thumb {
  @apply bg-sky-500;
}

.range-sell {
  @apply accent-emerald-500;
}

.range-sell::-webkit-slider-thumb {
  @apply bg-emerald-500;
}

.range-sell::-moz-range-thumb {
  @apply bg-emerald-500;
}
</style>

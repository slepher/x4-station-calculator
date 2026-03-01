<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: number
  min?: number
  max?: number
  step?: number
  disabled?: boolean
}>(), {
  min: 0,
  max: 100,
  step: 1,
  disabled: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void
  (e: 'commit', value: number): void
}>()

const sliderRef = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)
const skipNextChange = ref(false)

const normalizedValue = computed(() => {
  const n = Number(props.modelValue)
  if (!Number.isFinite(n)) return props.min
  return Math.min(props.max, Math.max(props.min, n))
})

const fillStyle = computed(() => {
  const span = props.max - props.min
  if (span <= 0) return { width: '0%' }
  const percent = ((normalizedValue.value - props.min) / span) * 100
  return { width: `${Math.min(100, Math.max(0, percent))}%` }
})

const toNumber = (event: Event): number => {
  const input = event.target as HTMLInputElement
  const n = Number(input.value)
  if (!Number.isFinite(n)) return props.min
  return Math.min(props.max, Math.max(props.min, n))
}

const commitCurrent = () => {
  if (!sliderRef.value) return
  const n = Number(sliderRef.value.value)
  if (!Number.isFinite(n)) return
  emit('commit', Math.min(props.max, Math.max(props.min, n)))
}

const handleInput = (event: Event) => {
  emit('update:modelValue', toNumber(event))
}

const handleChange = () => {
  if (skipNextChange.value) {
    skipNextChange.value = false
    return
  }
  commitCurrent()
}

const beginDrag = () => {
  if (props.disabled) return
  isDragging.value = true
}

const endDrag = () => {
  if (!isDragging.value) return
  isDragging.value = false
  skipNextChange.value = true
  commitCurrent()
}

onMounted(() => {
  window.addEventListener('mouseup', endDrag)
  window.addEventListener('touchend', endDrag)
})

onBeforeUnmount(() => {
  window.removeEventListener('mouseup', endDrag)
  window.removeEventListener('touchend', endDrag)
})
</script>

<template>
  <div class="slider-container">
    <input
      ref="sliderRef"
      type="range"
      :value="normalizedValue"
      :min="min"
      :max="max"
      :step="step"
      :disabled="disabled"
      class="range-slider"
      @mousedown="beginDrag"
      @touchstart="beginDrag"
      @input="handleInput"
      @change="handleChange"
    >
    <div class="slider-track-bg">
      <div class="slider-fill" :style="fillStyle"></div>
    </div>
  </div>
</template>

<style scoped>
.slider-container {
  @apply relative w-full h-[12px] flex items-center;
}

.range-slider {
  @apply absolute z-10 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed;
}

.slider-track-bg {
  @apply w-full h-[8px] bg-slate-800 rounded border border-slate-700 overflow-hidden;
}

.slider-fill {
  @apply h-full bg-[#0a3c73] transition-all duration-200;
}
</style>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: number
  min?: number
  max?: number
  dragMax?: number
  step?: number
  disabled?: boolean
  trackBgColor?: string
  trackBorderColor?: string
  fillColor?: string
}>(), {
  min: 0,
  max: 100,
  step: 1,
  disabled: false,
  trackBgColor: '#1e293b',
  trackBorderColor: '#334155',
  fillColor: '#0a3c73',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void
  (e: 'commit', value: number): void
}>()

const sliderRef = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)
const skipNextChange = ref(false)

// Use dragMax for actual dragging limit, fallback to max
const effectiveMax = computed(() => props.dragMax ?? props.max)

// Input should cover full range (0 to max), not just 0 to effectiveMax
const inputMax = computed(() => props.max)

// Normalize value to effectiveMax
const normalizedValue = computed(() => {
  const n = Number(props.modelValue)
  if (!Number.isFinite(n)) return props.min
  return Math.min(effectiveMax.value, Math.max(props.min, n))
})

// Fill: 0 to value = green
const greenFillStyle = computed(() => {
  const span = props.max - props.min
  if (span <= 0) return { width: '0%' }
  const percent = ((normalizedValue.value - props.min) / span) * 100
  return {
    width: `${Math.min(100, Math.max(0, percent))}%`,
    backgroundColor: 'rgb(16 185 129 / 0.8)', // green
  }
})

// Fill: value to dragMax = blue (only when dragMax is set)
const hasDragMax = computed(() => props.dragMax !== undefined)

const blueFillStyle = computed(() => {
  if (!hasDragMax.value || normalizedValue.value >= effectiveMax.value) return { width: '0%' }
  const span = props.max - props.min
  if (span <= 0) return { width: '0%' }
  const startPercent = ((normalizedValue.value - props.min) / span) * 100
  const endPercent = ((effectiveMax.value - props.min) / span) * 100
  const widthPercent = endPercent - startPercent
  return {
    width: `${Math.min(100, Math.max(0, widthPercent))}%`,
    left: `${Math.min(100, Math.max(0, startPercent))}%`,
    backgroundColor: 'rgb(59 130 246 / 0.8)', // blue
  }
})

const trackStyle = computed(() => ({
  backgroundColor: props.trackBgColor,
  borderColor: props.trackBorderColor,
}))

const toNumber = (event: Event): number => {
  const input = event.target as HTMLInputElement
  const n = Number(input.value)
  if (!Number.isFinite(n)) return props.min
  // Clamp to effectiveMax (dragMax) to prevent going beyond available range
  return Math.min(effectiveMax.value, Math.max(props.min, n))
}

const commitCurrent = () => {
  if (!sliderRef.value) return
  const n = Number(sliderRef.value.value)
  if (!Number.isFinite(n)) return
  emit('commit', Math.min(effectiveMax.value, Math.max(props.min, n)))
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
    <!-- Input: full width (0 to max) so entire track is draggable -->
    <div ref="sliderContainerRef" class="slider-input-wrapper">
      <input
        ref="sliderRef"
        type="range"
        :value="normalizedValue"
        :min="min"
        :max="inputMax"
        :step="step"
        :disabled="disabled"
        class="range-slider"
        @mousedown="beginDrag"
        @touchstart="beginDrag"
        @input="handleInput"
        @change="handleChange"
      >
    </div>
    <!-- Background track: always 100% width (represents 0-max) -->
    <div
      class="slider-track-bg"
      :style="trackStyle"
    >
      <!-- Green fill: 0 to value -->
      <div class="slider-fill slider-fill-green" :style="greenFillStyle"></div>
      <!-- Blue fill: value to dragMax (only when dragMax is set) -->
      <div v-if="hasDragMax" class="slider-fill slider-fill-blue" :style="blueFillStyle"></div>
    </div>
  </div>
</template>

<style scoped>
.slider-container {
  @apply relative w-full h-[12px] flex items-center;
}

/* Input wrapper: full width to cover entire track */
.slider-input-wrapper {
  @apply absolute z-10 h-full w-full;
}

/* Full width slider inside truncated wrapper */
.range-slider {
  @apply w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed;
}

/* Background track: always 100% width */
.slider-track-bg {
  @apply absolute w-full h-[8px] rounded border overflow-hidden;
}

.slider-fill {
  @apply h-full absolute top-0 left-0;
}

.slider-fill-green {
  z-index: 2;
}

.slider-fill-blue {
  z-index: 1;
}
</style>

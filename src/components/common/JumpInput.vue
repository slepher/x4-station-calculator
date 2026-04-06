<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  modelValue: number
  min?: number
  max?: number
  suffix?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void
}>()

const { t } = useI18n()

const minValue = computed(() => props.min ?? 0)
const maxValue = computed(() => props.max ?? 8)
const suffixText = computed(() => props.suffix ?? t('map.resource_filter_jump_suffix'))

function step(delta: number) {
  const next = props.modelValue + delta
  if (next >= minValue.value && next <= maxValue.value) {
    emit('update:modelValue', next)
  }
}

function update(value: number) {
  const num = Math.max(minValue.value, Math.min(maxValue.value, value))
  emit('update:modelValue', num)
}
</script>

<template>
  <div class="jump-input-wrapper" :class="{ disabled }">
    <input
      :value="modelValue"
      class="jump-input"
      type="number"
      :min="minValue"
      :max="maxValue"
      :disabled="disabled"
      @input="update(Number(($event.target as HTMLInputElement).value || 0))"
    />
    <span class="jump-suffix">{{ suffixText }}</span>
    <div class="jump-stepper">
      <button type="button" class="jump-step-btn" :disabled="disabled || modelValue >= maxValue" @click="step(1)">▲</button>
      <button type="button" class="jump-step-btn" :disabled="disabled || modelValue <= minValue" @click="step(-1)">▼</button>
    </div>
  </div>
</template>

<style scoped>
.jump-input-wrapper {
  @apply flex items-center w-fit rounded border border-amber-300/30 bg-black/40 overflow-hidden;
}

.jump-input-wrapper.disabled {
  @apply opacity-50 cursor-not-allowed;
}

.jump-input {
  @apply w-7 h-8 bg-transparent px-1 text-center text-sm text-amber-50 outline-none;
  min-width: 0;
  -moz-appearance: textfield;
}

.jump-input::-webkit-outer-spin-button,
.jump-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.jump-input:disabled {
  @apply cursor-not-allowed;
}

.jump-suffix {
  @apply text-xs font-medium text-amber-100/80 mr-1;
}

.jump-stepper {
  @apply flex flex-col border-l border-amber-300/20 bg-black/40;
}

.jump-step-btn {
  @apply flex h-4 w-4 items-center justify-center text-[9px] leading-none text-amber-100/70 transition-colors duration-150 hover:bg-amber-200/10 hover:text-amber-50;
}

.jump-step-btn:disabled {
  @apply opacity-30 cursor-not-allowed hover:bg-transparent hover:text-amber-100/70;
}

.jump-step-btn + .jump-step-btn {
  @apply border-t border-amber-300/20;
}
</style>

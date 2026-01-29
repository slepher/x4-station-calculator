<script setup lang="ts">
/**
 * X4 风格通用数字输入组件 (交互增强版)
 * 解决：1. 长度固定不抖动 2. 箭头真实可点 3. 缝隙对齐
 */
interface Props {
  modelValue: number
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  widthClass?: string 
}

const props = withDefaults(defineProps<Props>(), {
  min: 0,
  max: Infinity,
  step: 1,
  disabled: false,
  widthClass: 'w-24'
})

const emit = defineEmits<{
  (e: 'update:modelValue', val: number): void
}>()

const updateValue = (delta: number) => {
  if (props.disabled) return
  const newVal = Math.max(props.min, Math.min(props.modelValue + delta, props.max))
  emit('update:modelValue', newVal)
}

const handleInput = (e: Event) => {
  const target = e.target as HTMLInputElement
  let val = parseInt(target.value) || 0
  const clamped = Math.max(props.min, Math.min(val, props.max))
  if (clamped !== val) target.value = clamped.toString()
  emit('update:modelValue', clamped)
}
</script>

<template>
  <div class="x4-input-container group" :class="[widthClass, { 'is-disabled': disabled }]">
    <input
      type="number"
      :value="modelValue"
      :disabled="disabled"
      @input="handleInput"
      class="x4-num-input"
    />
    
    <div class="x4-spin-buttons">
      <button class="spin-up" @click="updateValue(step)" tabindex="-1">
        <svg viewBox="0 0 16 8" class="spin-icon"><path d="M8 2l-4 4h8z" /></svg>
      </button>
      <button class="spin-down" @click="updateValue(-step)" tabindex="-1">
        <svg viewBox="0 0 16 8" class="spin-icon"><path d="M8 6l4-4H4z" /></svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.x4-input-container {
  @apply relative inline-flex items-center bg-slate-950/50 border border-slate-700 rounded transition-all;
  @apply focus-within:border-slate-500 h-6 overflow-hidden;
}

.x4-num-input {
  /* 移除原生属性 */
  -webkit-appearance: none;
  -moz-appearance: textfield;
  @apply bg-transparent border-none w-full px-1.5 text-sm font-mono font-bold transition-all outline-none;
  color: #a5d8ff; /* 淡蓝色文字 */
  padding-right: 20px; /* 预留固定空间，防止 hover 抖动 */
  height: 100%;
}

.x4-num-input::-webkit-inner-spin-button,
.x4-num-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

/* 调节按钮容器：绝对定位，不影响输入框长度 */
.x4-spin-buttons {
  @apply absolute right-0.5 inset-y-0 flex flex-col justify-center items-center opacity-0 transition-opacity duration-200 pointer-events-none;
  width: 16px;
}

/* 仅在 Container Hover 时显现，且启用点击 */
.x4-input-container:hover .x4-spin-buttons:not(.is-disabled) {
  @apply opacity-100 pointer-events-auto;
}

.x4-spin-buttons button {
  @apply flex items-center justify-center w-full h-2.5 hover:brightness-150 active:scale-95 transition-all;
}

/* 核心：实现 1px 的物理缝隙 */
.spin-up { margin-bottom: 0.5px; }
.spin-down { margin-top: 0.5px; }

.spin-icon {
  @apply w-3 h-2;
  fill: #a5d8ff; /* 图标颜色设为淡蓝 */
  opacity: 0.4;
}
</style>
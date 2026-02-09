<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = withDefaults(defineProps<{
  level?: number  // 0 = 无需求/空心, 1 = 副产物/半空心, 2 = 主产物/实心
  disabled?: boolean
}>(), {
  level: 0,
  disabled: false
})

const emit = defineEmits<{
  (e: 'update:level', value: number): void
}>()

const { t } = useI18n()

// Toggle priority level
const toggleLevel = () => {
  emit('update:level', props.level)
}

// SVG icons for tooltip
const emptyStarSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;vertical-align:middle;margin-right:4px;"><path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>`

const halfStarSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:14px;height:14px;vertical-align:middle;margin-right:4px;"><defs><linearGradient id="tipHalfStar" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="50%" stop-color="currentColor"/><stop offset="50%" stop-color="transparent"/></linearGradient></defs><path fill="none" stroke="currentColor" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/><path fill="url(#tipHalfStar)" stroke="none" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>`

const fullStarSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width:14px;height:14px;vertical-align:middle;margin-right:4px;"><path d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z"/></svg>`

// Tooltip content based on current level
const tooltipContent = computed(() => {
  const lines = [
    { 
      icon: fullStarSvg, 
      label: t('tooltip.priority_level_2_label'), 
      buffer: t('tooltip.priority_level_2_buffer'),
      active: props.level === 2 
    },
    { 
      icon: halfStarSvg, 
      label: t('tooltip.priority_level_1_label'), 
      buffer: t('tooltip.priority_level_1_buffer'),
      active: props.level === 1 
    },
    { 
      icon: emptyStarSvg, 
      label: t('tooltip.priority_level_0_label'), 
      buffer: t('tooltip.priority_level_0_buffer'),
      active: props.level === 0 
    }
  ]

  return lines.map(line => `
    <div class="priority-tooltip-row ${line.active ? 'is-active' : ''}">
      <span class="icon-cell">${line.icon}</span>
      <span class="label-cell">${line.label}</span>
      <span class="buffer-cell">${line.buffer}</span>
    </div>
  `).join('')
})
</script>

<template>
  <div
    class="favorite-btn"
    :class="{
      'level-0': level === 0,
      'level-1': level === 1,
      'level-2': level === 2,
      'disabled': disabled
    }"
    @click.stop="!disabled && toggleLevel()"
    v-tippy="{ content: tooltipContent, allowHTML: true, theme: 'x4' }"
  >
    <!-- Level 0: 空心五角星 -->
    <svg v-if="level === 0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-4 h-4">
      <path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
    
    <!-- Level 1: 半空心五角星（左半边实心，右半边空心） -->
    <svg v-else-if="level === 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-4 h-4">
      <defs>
        <linearGradient id="halfStar" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="50%" stop-color="currentColor" />
          <stop offset="50%" stop-color="transparent" />
        </linearGradient>
      </defs>
      <!-- 背景空心星 -->
      <path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      <!-- 左半边实心填充 -->
      <path fill="url(#halfStar)" stroke="none"
        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
    
    <!-- Level 2: 实心五角星 -->
    <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4">
      <path fill-rule="evenodd" clip-rule="evenodd"
        d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" />
    </svg>
  </div>
</template>

<style scoped>
/* 收藏按钮样式 */
.favorite-btn {
  @apply p-1.5 rounded-md text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-all cursor-pointer;
}

/* Level 0: 空心 - 默认样式 */
.favorite-btn.level-0 {
  @apply text-slate-500;
}

/* Level 1: 半空心 - 琥珀色 */
.favorite-btn.level-1 {
  @apply text-amber-400;
}

/* Level 2: 实心 - 琥珀色高亮 */
.favorite-btn.level-2 {
  @apply text-amber-500 bg-amber-500/10;
}

/* 禁用状态 */
.favorite-btn.disabled {
  @apply text-slate-500/30 bg-transparent cursor-default pointer-events-none;
}
</style>

<style>
/* Tooltip 内部表格布局 (非 Scoped) */
.priority-tooltip-row {
  display: grid;
  grid-template-columns: 24px 60px 1fr;
  align-items: center;
  padding: 4px 8px;
  gap: 8px;
  font-size: 12px;
  color: #94a3b8;
  transition: all 0.2s;
}

.priority-tooltip-row.is-active {
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.1);
  border-radius: 4px;
}

.priority-tooltip-row .icon-cell { @apply flex items-center justify-center; }
.priority-tooltip-row .label-cell { @apply font-medium; }
.priority-tooltip-row .buffer-cell { @apply text-[10px] opacity-60 text-right; }
</style>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = withDefaults(defineProps<{
  locked?: boolean
  disabled?: boolean
  placeholder?: boolean  // New prop to enable placeholder mode
}>(), {
  locked: false,
  disabled: false,
  placeholder: false
})

const emit = defineEmits<{
  (e: 'update:locked', value: boolean): void
}>()

const { t } = useI18n()

// Toggle lock function
const toggleLock = () => {
  emit('update:locked', !props.locked)
}

// SVG icons for tooltip
const unlockedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;vertical-align:middle;margin-right:4px;"><path stroke-linecap="round" stroke-linejoin="round" d="M18 1.5c2.9 0 5.25 2.35 5.25 5.25v3.75a.75.75 0 01-1.5 0V6.75a3.75 3.75 0 10-7.5 0v3a3 3 0 013 3v6.75a3 3 0 01-3 3H3.75a3 3 0 01-3-3v-6.75a3 3 0 013-3h9v-3c0-2.9 2.35-5.25 5.25-5.25z"/></svg>`

const lockedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width:14px;height:14px;vertical-align:middle;margin-right:4px;"><path fill-rule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clip-rule="evenodd"/></svg>`

// Tooltip content based on lock state
const tooltipContent = computed(() => {
  const lines = [
    { icon: unlockedSvg, text: t('tooltip.lock_unlocked'), active: !props.locked },
    { icon: lockedSvg, text: t('tooltip.lock_locked'), active: props.locked }
  ]

  return lines.map(line => `
    <div class="lock-tooltip-row ${line.active ? 'is-active' : ''}">
      <span class="icon-cell">${line.icon}</span>
      <span class="label-cell">${line.text.split(' - ')[0]}</span>
      <span class="desc-cell">${line.text.split(' - ')[1] || ''}</span>
    </div>
  `).join('')
})
</script>

<template>
  <!-- Placeholder mode: occupy the same physical space but show nothing -->
  <div 
    v-if="placeholder"
    class="lock-btn-placeholder"
  ></div>
  <!-- Normal mode: render the lock button -->
  <div
    v-else
    class="lock-btn"
    :class="{ 'is-locked': locked, 'non-operable': disabled }"
    @click.stop="!disabled && toggleLock()"
    v-tippy="{ content: tooltipContent, allowHTML: true, theme: 'x4' }"
  >
    <svg v-if="locked" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4">
      <path fill-rule="evenodd"
        d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z"
        clip-rule="evenodd" />
    </svg>
    <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4">
      <path
        d="M18 1.5c2.9 0 5.25 2.35 5.25 5.25v3.75a.75.75 0 01-1.5 0V6.75a3.75 3.75 0 10-7.5 0v3a3 3 0 013 3v6.75a3 3 0 01-3 3H3.75a3 3 0 01-3-3v-6.75a3 3 0 013-3h9v-3c0-2.9 2.35-5.25 5.25-5.25z" />
    </svg>
  </div>
</template>

<style>
/* Tooltip 内部表格布局 (全局样式以适配 Tippy) */
.lock-tooltip-row {
  display: grid;
  grid-template-columns: 20px 50px 1fr;
  align-items: center;
  padding: 4px 8px;
  gap: 4px;
  font-size: 12px;
  color: #94a3b8;
  min-width: 140px;
}

.lock-tooltip-row.is-active {
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.1);
  border-radius: 4px;
}

.lock-tooltip-row .icon-cell { display: flex; align-items: center; }
.lock-tooltip-row .label-cell { font-weight: 600; }
.lock-tooltip-row .desc-cell { opacity: 0.6; font-size: 11px; text-align: right; }
</style>

<style scoped>
/* 锁按钮样式 */
.lock-btn {
  @apply p-1.5 rounded-md text-slate-600 hover:text-slate-300 hover:bg-slate-600/30 transition-all cursor-pointer;
}

.lock-btn.is-locked {
  @apply text-amber-500 hover:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20;
}

/* 采集/上级资源不可操作状态：降低透明度并强制去色 */
.lock-btn.non-operable {
  @apply text-slate-500/40 bg-transparent cursor-default pointer-events-none;
}

/* 占位符模式：占据相同空间但不显示任何内容 */
.lock-btn-placeholder {
  @apply w-7 h-7; /* 匹配 lock-btn 的尺寸 */
}
</style>
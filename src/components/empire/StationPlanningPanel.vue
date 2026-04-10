<script setup lang="ts">
import { useStationStore } from '@/store/useStationStore'
import { useEmpireStore } from '@/store/useEmpireStore'
import { useSaveBindingStore } from '@/store/useSaveBindingStore'
import draggable from 'vuedraggable'
import { useI18n } from 'vue-i18n'
import StationPlanningItem from './StationPlanningItem.vue'
import StationModulePicker from './StationModulePicker.vue'
import { computed, ref, watch, nextTick } from 'vue'

const { t } = useI18n()
const store = useStationStore()
const empireStore = useEmpireStore()
const saveBindingStore = useSaveBindingStore()
const flashTime = 300; 0; // 闪烁动画时长（毫秒）
const isBindingMode = computed(() => empireStore.productionSource === 'save-binding')

// 规划区数量调整功能
// 应用缩放比例
const applyScale = (scale: number) => {
  // 更新所有规划模块的数量
  store.plannedModules.forEach((module: any, index: number) => {
    const newCount = Math.ceil(module.count * scale)
    store.updateModuleCount(index, newCount)
  })
}

// 跟踪需要高亮的模块，支持多个同时动画
const highlightedModuleIds = ref<Set<string>>(new Set())

// 跟踪需要数字闪烁的模块，支持多个同时动画
const flashingNumberModuleIds = ref<Set<string>>(new Set())

// 记录上一帧的模块数量状态，用于精准对比 { [id: string]: number }
const lastModuleCounts = ref<Record<string, number>>({})

// --- 动画控制函数 ---

const triggerHighlight = (id: string) => {
  highlightedModuleIds.value.add(id)
  setTimeout(() => {
    highlightedModuleIds.value.delete(id)
  }, flashTime)
}

const triggerNumberFlash = async (id: string) => {
  // 1. 先移除类名，强制中断当前动画
  flashingNumberModuleIds.value.delete(id)

  // 2. 等待 Vue 更新 DOM (关键：这确保了浏览器感知到类名被移除)
  await nextTick()

  // 3. 重新添加类名，触发新的一轮动画
  setTimeout(() => {
    flashingNumberModuleIds.value.add(id)
    // 4. 动画结束后清理
    setTimeout(() => {
      flashingNumberModuleIds.value.delete(id)
    }, flashTime)
  }, 10)
}

// --- 智能监听 ---

// 监听模块列表的深度变化，通过 ID 对比来精准触发闪烁
// 解决"删除模块导致后续模块错误闪烁"的问题
watch(() => store.plannedModules, (newVal) => {
  const currentCounts: Record<string, number> = {}

  newVal.forEach((m: any) => {
    currentCounts[m.id] = m.count
    const prevCount = lastModuleCounts.value[m.id]

    // 只有当 ID 存在且数量不一致时才触发 (避免了删除导致的索引错位)
    if (prevCount !== undefined && prevCount !== m.count) {
      triggerNumberFlash(m.id)
    }
  })

  // 更新历史状态
  lastModuleCounts.value = currentCounts
}, { deep: true, immediate: true })

// 监听模块列表变化，检测新添加的模块
watch(() => store.plannedModules.length, (newLength, oldLength) => {
  if (newLength > oldLength) {
    // 检测所有新添加的模块
    const newModules = store.plannedModules.slice(oldLength)

    newModules.forEach((module: any) => {
      if (module) {
        // 添加模块到高亮集合（整体边框动画）
        triggerHighlight(module.id)
      }
    })
  }
})
</script>

<template>
  <div class="module-list-container">
    <div v-if="isBindingMode" class="binding-save-row">
      <span class="binding-status" :class="{ dirty: saveBindingStore.isDirty }">
        {{ saveBindingStore.isDirty ? t('production.binding_unsaved') : t('production.binding_saved') }}
      </span>
      <button
        type="button"
        class="binding-save-button"
        :disabled="!saveBindingStore.activeBinding || !saveBindingStore.isDirty"
        @click="saveBindingStore.saveBinding()"
      >
        {{ t('production.save_binding') }}
      </button>
    </div>

    <div class="search-panel">
      <StationModulePicker />
    </div>

    <!-- Tier 1: 用户规划区 -->
    <div class="tier-section">
      <div class="tier-header">
        <span class="tier-label">{{ t('planning.tier_planned') }}</span>
        <div class="scale-buttons">
          <button 
            v-for="scale in [0.2, 0.333, 0.5, 2, 3, 5]" 
            :key="scale"
            class="scale-button"
            @click="applyScale(scale)"
          >
            {{ scale === 0.2 ? '1/5' : scale === 0.333 ? '1/3' : scale === 0.5 ? '1/2' : scale + 'x' }}
          </button>
        </div>
      </div>
      <div class="module-list-scroll">
        <draggable v-model="store.plannedModules" item-key="id" ghost-class="drag-ghost" filter=".ignore-drag"
          :prevent-on-filter="false" class="draggable-container">
          <template #item="{ element, index }">
            <StationPlanningItem :item="element" :info="store.getModuleInfo(element.id)!"
              :inactive-by-dlc="store.enforceDlcActivation && !store.isModuleDlcActive(element.id)"
              :count-disabled="!store.isModuleCountEditable(element.id)"
              :class="{ 'module-row--highlight': highlightedModuleIds.has(element.id) }"
              :is-number-flashing="flashingNumberModuleIds.has(element.id)"
              @update:count="(val: number) => store.updateModuleCount(index, val)" @remove="store.removeModule(index)" />
          </template>
        </draggable>
      </div>
    </div>

    <!-- Tier 2: 自动工业区 -->
    <div v-if="store.autoIndustryModules.length > 0" class="tier-section tier-auto">
        <div class="tier-header">
          <span class="tier-label">{{ t('planning.tier_industry') }}</span>
        </div>
      <div class="module-list-scroll">
        <div class="auto-modules-container">
          <StationPlanningItem v-for="(element, index) in store.autoIndustryModules" :key="element.id + '-' + index"
            :item="element" :info="store.getModuleInfo(element.id)!" :readonly="true"
            @transfer="store.transferModuleFromAutoIndustry(element)" />
        </div>
      </div>
    </div>

    <!-- 劳动力加成选项已移动到各自标题栏 -->
  </div>
</template>

<style scoped>
.header-row {
  @apply flex justify-between items-center mb-2 border-b border-slate-700 pb-2 h-9;
}

.header-title {
  @apply text-lg font-semibold text-slate-200 uppercase tracking-tight;
}

.header-label {
  @apply text-slate-500 text-[10px] uppercase font-bold tracking-widest leading-none;
}

.header-controls {
  @apply flex items-center gap-4;
}

.race-selector {
  @apply flex items-center gap-2;
  align-items: center; /* Ensure vertical alignment */
}

.race-select {
  @apply bg-slate-900 border border-slate-700 text-slate-200 text-[11px] rounded px-2 h-6 focus:border-sky-500 outline-none cursor-pointer hover:border-slate-600 transition-colors;
  min-width: 80px;
  padding: 0 8px;
  appearance: none;
}

.workforce-option {
  @apply flex items-end text-[8px] text-slate-600 uppercase font-bold tracking-tighter cursor-pointer hover:text-slate-500 transition-colors select-none;
}

.supply-workforce-option {
  @apply flex items-end text-[8px] text-slate-600 uppercase font-bold tracking-tighter cursor-pointer hover:text-slate-500 transition-colors select-none;
}

.option-icon {
  @apply text-[12px] leading-none;
}

.option-text {
  @apply whitespace-nowrap;
}

.x4-composite-input-wrapper {
  @apply flex items-center h-6 overflow-hidden rounded border border-slate-700 bg-slate-950/60 transition-colors duration-200;
}

:deep(.x4-nested-input .x4-input-container) {
  @apply border-none bg-transparent rounded-none h-full;
}

.x4-unit-suffix-box {
  @apply flex items-center justify-center px-1.5 h-full text-[10px] font-bold text-slate-500 border-l border-slate-700/50 bg-slate-900/40;
  min-width: 20px;
}

.module-list-scroll {
  @apply overflow-y-auto pr-1 scrollbar-thin;
}

.drag-ghost {
  @apply opacity-30 bg-slate-700 border-sky-500 border-dashed border-2;
}

.module-list-container {
  @apply space-y-2;
}

.binding-save-row {
  @apply flex items-center justify-between gap-3 rounded-md border border-slate-700 bg-slate-900/70 px-3 py-2;
}

.binding-status {
  @apply text-[11px] font-bold uppercase tracking-wide text-emerald-300;
}

.binding-status.dirty {
  @apply text-amber-300;
}

.binding-save-button {
  @apply rounded-md border border-sky-500/70 bg-sky-500 px-3 py-1 text-xs font-bold text-slate-950 transition-colors;
  @apply hover:bg-sky-400 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-500;
}

.sunlight-control {
  @apply flex items-center gap-2;
}

.draggable-container {
  @apply space-y-2;
}

.auto-modules-container {
  @apply space-y-2;
}

.supply-tier-header {
  @apply cursor-pointer;
}

.arrow {
  @apply mr-1;
}

.search-panel {
  @apply mb-4;
}

.module-controls-panel {
  @apply mt-4 pt-4 border-t border-slate-700 space-y-3;
}

auto-fill-section {
  @apply flex flex-col gap-1.5 items-start px-1;
}

.wf-config-note {
  @apply flex items-center gap-1.5 text-[8px] text-slate-600 uppercase font-bold tracking-tighter cursor-pointer hover:text-slate-500 transition-colors select-none;
}

.x4-checkbox-mini {
  @apply w-2.5 h-2.5 rounded-sm border-slate-800 bg-slate-950 text-sky-600 focus:ring-0 cursor-pointer m-0 p-0 flex-shrink-0;
}

.scrollbar-thin::-webkit-scrollbar {
  @apply w-1;
}

.scrollbar-thin::-webkit-scrollbar-thumb {
  @apply bg-slate-700 rounded-full;
}

.tier-section {
  @apply space-y-2;
}

.tier-section.tier-auto {
  @apply opacity-90;
}

.tier-section.tier-auto .module-list-scroll {
  @apply border-l-2 border-dashed border-slate-600 pl-2;
}

/* 规划区数量调整按钮样式 */
.scale-buttons {
  @apply flex gap-1 ml-auto;
}

.scale-button {
  @apply px-1 h-[18px] rounded text-[8px] font-bold uppercase tracking-tighter transition-all duration-200;
  @apply bg-slate-700 text-slate-400 border border-transparent flex items-center justify-center;
}

.scale-button:hover {
  @apply bg-amber-600 text-amber-50 border-amber-500;
}

.tier-header {
  @apply flex items-center justify-between px-3 h-8 bg-slate-800/40 rounded cursor-pointer hover:bg-slate-700/50 transition-colors border border-transparent w-full;
}

.tier-header-left {
  @apply flex items-center gap-2 h-full;
}

.tier-header.is-active {
  @apply border-slate-600/50 bg-slate-700/40;
}

.tier-label {
  @apply text-xs font-semibold text-slate-400 uppercase tracking-wider leading-none;
}

.tier-controls {
  @apply flex items-center gap-2;
}

</style>

<template>
  <div class="item-container">
    <div 
      :class="['main-row', isPositive ? 'status-pos' : 'status-neg', !isEmpty ? 'main-row-hover' : '', { 'is-active': isOpen && !isEmpty }]"
      @click="isOpen = !isOpen"
    >
      <div class="label-group">
        <span class="arrow" :class="{ 'arrow-open': isOpen }" v-if="!isEmpty">▶</span>
        <slot name="title"></slot>
      </div>
      <div class="right-group">
        <slot name="header"></slot>
      </div>
    </div>

    <Transition name="expand">
      <div v-if="isOpen && !isEmpty" class="list-box">
        <div 
          v-for="(item, index) in data" 
          :key="index" 
          class="list-item"
          :class="item.type === 'production' ? 'item-prod' : 'item-cons'"
        >
          <slot name="row" :item="item" :index="index"></slot>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const props = withDefaults(defineProps<{
  data?: any[],
  isPositive?: boolean
}>(), {
  data: () => [],
  isPositive: true
})

const isEmpty = computed(() => props.data.length == 0);

const isOpen = ref(false)
</script>

<style scoped>
/* 样式资产冻结：直接继承原组件的 UI 规范 */
.item-container { @apply mb-1 select-none; }
.main-row { @apply flex justify-between items-center h-8 px-3 py-0.5 bg-slate-800/40 rounded cursor-pointer transition-colors border border-transparent; }
.main-row-hover { @apply hover:bg-slate-700/50 }
.is-active { @apply border-slate-600/50 bg-slate-700/40; }

.arrow { @apply text-[10px] text-slate-500 transition-transform duration-200 }
.arrow-open { @apply rotate-90 text-slate-300; }

.list-box { @apply bg-slate-900/60 mx-1 px-4 py-2 text-[11px] rounded-b border-x border-b border-slate-700/30 overflow-hidden; }
.list-item { @apply flex justify-between items-center py-1.5 border-b border-slate-700/20 last:border-0; }

/* 动画定义 */
.expand-enter-active, .expand-leave-active { transition: all 0.2s ease-out; max-height: 500px; }
.expand-enter-from, .expand-leave-to { opacity: 0; max-height: 0; }

/* 基础图标与文字 */
.label-group {
  @apply flex items-center gap-2;
}

/* 核心修复：添加 flex 布局确保横向排列 */
.right-group {
  @apply flex items-center gap-1;
}
</style>
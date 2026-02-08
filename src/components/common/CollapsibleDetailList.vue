<template>
  <div class="item-container">
    <div 
      class="main-row" 
      :class="[isPositive ? 'status-pos' : 'status-neg', { 'is-active': isOpen }]"
      @click="isOpen = !isOpen"
    >
      <slot name="header" :isOpen="isOpen"></slot>
    </div>

    <Transition name="expand">
      <div v-if="isOpen" class="list-box">
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
import { ref } from 'vue'

defineProps<{
  data: any[]         // 列表数据源
  isPositive: boolean   // 决定 Header 状态点颜色
}>()

const isOpen = ref(false)
</script>

<style scoped>
/* 样式资产冻结：直接继承原组件的 UI 规范 */
.item-container { @apply mb-1 select-none; }
.main-row { @apply flex justify-between items-center px-3 py-0.5 bg-slate-800/40 rounded cursor-pointer hover:bg-slate-700/50 transition-colors border border-transparent; }
.is-active { @apply border-slate-600/50 bg-slate-700/40; }

.status-pos .dot { @apply bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]; }
.status-neg .dot { @apply bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]; }

.list-box { @apply bg-slate-900/60 mx-1 px-4 py-2 text-[11px] rounded-b border-x border-b border-slate-700/30 overflow-hidden; }
.list-item { @apply flex justify-between items-center py-1.5 border-b border-slate-700/20 last:border-0; }

/* 动画定义 */
.expand-enter-active, .expand-leave-active { transition: all 0.2s ease-out; max-height: 500px; }
.expand-enter-from, .expand-leave-to { opacity: 0; max-height: 0; }
</style>
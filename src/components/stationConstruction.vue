<script setup lang="ts">
import { ref, computed } from 'vue'
import { useStationStore } from '@/store/useStationStore'

const store = useStationStore()
const isPanelOpen = ref(true) 
const expandedRows = ref<Set<string>>(new Set())

const toggleRow = (id: string) => {
  if (expandedRows.value.has(id)) {
    expandedRows.value.delete(id)
  } else {
    expandedRows.value.add(id)
  }
}

const formatNum = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n))
const data = computed(() => store.constructionBreakdown)

const getMaterialValue = (matId: string, amountPerModule: number, moduleCount: number) => {
  const price = store.wares[matId]?.price || 0
  return amountPerModule * moduleCount * price
}
</script>

<template>
  <div class="panel-container">
    <div class="panel-header">
      <h3 class="header-title">Station Costs</h3>
      <span class="header-subtitle">Amount</span>
    </div>

    <div>
      <div @click="isPanelOpen = !isPanelOpen" class="row-clickable">
         <div class="row-label">
            <span class="arrow-icon" :class="isPanelOpen ? 'rotate-90' : ''">▶</span>
            Module Breakdown
         </div>
      </div>

      <div v-show="isPanelOpen" class="list-border">
        <div v-for="item in data.moduleList" :key="item.id">
          <div @click="toggleRow(item.id)" class="row-clickable group">
             <div class="row-label">
               <span class="arrow-icon group-hover:text-sky-400" 
                     :class="expandedRows.has(item.id) ? 'rotate-90' : ''">▶</span>
               <span>{{ item.count }} x {{ item.name }}</span>
             </div>
             <span class="value-text">{{ formatNum(item.cost) }}</span>
          </div>

          <div v-if="expandedRows.has(item.id)" class="sub-list-container">
             <template v-if="item.buildCost && Object.keys(item.buildCost).length > 0">
               <div v-for="(amount, matId) in item.buildCost" :key="matId" class="sub-row">
                 <span>
                   {{ formatNum(amount * item.count) }} x <span class="capitalize text-slate-400">{{ store.wares[matId]?.name || matId }}</span>
                 </span>
                 <span class="sub-value">
                   {{ formatNum(getMaterialValue(matId, amount, item.count)) }}
                 </span>
               </div>
             </template>
             <div v-else class="empty-tip">No build cost data available</div>
          </div>
        </div>
      </div>

      <div class="footer-container">
        <div class="footer-total-row">
          <span class="footer-label">Total:</span>
          <span class="value-text">{{ formatNum(data.totalCost) }}</span>
        </div>

        <div class="footer-materials-list">
          <div v-for="(amount, name) in data.totalMaterials" :key="name" class="footer-material-item">
            <span class="material-name">{{ store.wares[name]?.name || name }}</span>
            <span class="material-value">{{ formatNum(amount) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* --- 容器布局 --- */
.panel-container {
  @apply bg-slate-800 rounded border border-slate-700 overflow-hidden mt-4 text-sm;
}

/* --- 顶部 Header --- */
.panel-header {
  @apply flex justify-between items-center p-3 bg-slate-900 border-b border-slate-700;
}
.header-title {
  @apply font-bold text-slate-200;
}
.header-subtitle {
  @apply font-mono text-xs text-slate-400;
}

/* --- 通用行样式 --- */
.row-clickable {
  @apply flex justify-between px-3 py-2 bg-slate-800 hover:bg-slate-700 cursor-pointer border-b border-slate-700/50 select-none transition-colors;
}
.row-label {
  @apply flex items-center gap-2 text-slate-300 font-medium;
}
.arrow-icon {
  @apply text-[10px] text-slate-600 transform transition-transform duration-200;
}
.value-text {
  @apply font-mono text-slate-200;
}

/* --- 子列表 (展开部分) --- */
.list-border {
  @apply bg-slate-900/30 border-b border-slate-700/50;
}
.sub-list-container {
  @apply bg-slate-900/80 shadow-inner;
}
.sub-row {
  @apply flex justify-between items-center pl-8 pr-3 py-1 text-xs border-b border-slate-800/30 last:border-0 text-slate-500 hover:bg-slate-800/50;
}
.sub-value {
  @apply font-mono text-slate-600;
}
.empty-tip {
  @apply pl-8 py-1 text-xs text-slate-600 italic;
}

/* --- 底部 Footer (彻底清理) --- */
.footer-container {
  @apply p-3 bg-slate-800 space-y-2;
}
.footer-total-row {
  @apply flex justify-between font-bold border-b border-slate-600 pb-2;
}
.footer-label {
  @apply text-slate-300;
}
.footer-materials-list {
  @apply space-y-1 pt-1;
}
.footer-material-item {
  @apply flex justify-between text-xs;
}
.material-name {
  @apply text-slate-400 capitalize;
}
.material-value {
  @apply font-mono text-slate-300;
}
</style>
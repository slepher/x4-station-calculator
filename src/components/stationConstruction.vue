<script setup lang="ts">
import { ref, computed } from 'vue'
import { useStationStore } from '@/store/useStationStore'
import { useX4I18n } from '@/utils/useX4I18n'
import { useI18n } from 'vue-i18n'

const store = useStationStore()
const { translateModule, translateWare } = useX4I18n()
const { t } = useI18n()

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

/**
 * 格式化建设明细数据，注入翻译后的名称
 */
const data = computed(() => {
  const raw = store.constructionBreakdown
  return {
    ...raw,
    moduleList: raw.moduleList.map(item => ({
      ...item,
      // 使用 translateModule 翻译模块名
      displayName: store.modules[item.id] ? translateModule(store.modules[item.id]) : item.id
    }))
  }
})

const getMaterialValue = (matId: string, amountPerModule: number, moduleCount: number) => {
  const price = store.wares[matId]?.price || 0
  return amountPerModule * moduleCount * price
}
</script>

<template>
  <div class="panel-container">
    <div class="panel-header">
      <h3 class="header-title">{{ t('ui.station_costs') }}</h3>
      <span class="header-subtitle">Build Resources Required</span>
    </div>

    <div class="panel-content">
      <div @click="isPanelOpen = !isPanelOpen" class="main-toggle">
         <div class="toggle-label">
            <span :class="['arrow', { 'arrow-open': isPanelOpen }]">▶</span>
            Module Resource Breakdown
         </div>
      </div>

      <div v-show="isPanelOpen" class="module-list">
        <div v-for="item in data.moduleList" :key="item.id">
          <div @click="toggleRow(item.id)" class="module-row group">
             <div class="module-info">
               <span :class="['arrow-small', { 'arrow-open': expandedRows.has(item.id) }]">▶</span>
               <span class="module-text">{{ item.count }} x {{ item.displayName }}</span>
             </div>
             <span class="cost-value">{{ formatNum(item.cost) }} Cr</span>
          </div>

          <div v-if="expandedRows.has(item.id)" class="material-details">
             <template v-if="item.buildCost && Object.keys(item.buildCost).length > 0">
               <div v-for="(amount, matId) in item.buildCost" :key="matId" class="mat-row">
                 <span class="mat-label">
                   <span class="mat-count">{{ formatNum(amount * item.count) }}</span>
                   {{ store.wares[matId] ? translateWare(store.wares[matId]) : matId }}
                 </span>
                 <span class="mat-value">
                   {{ formatNum(getMaterialValue(matId, amount, item.count)) }}
                 </span>
               </div>
             </template>
             <div v-else class="empty-tip">Standard module - No materials required</div>
          </div>
        </div>
      </div>

      <div class="footer-area">
        <div class="total-row">
          <span class="total-label">Total Construction Cost:</span>
          <span class="total-value">{{ formatNum(data.totalCost) }} Credits</span>
        </div>

        <div class="summary-list">
          <div v-for="(amount, id) in data.totalMaterials" :key="id" class="summary-item">
            <span class="summary-name">
              {{ store.wares[id] ? translateWare(store.wares[id]) : id }}
            </span>
            <span class="summary-amount">{{ formatNum(amount) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel-container { @apply bg-slate-800 rounded border border-slate-700 overflow-hidden mt-4 text-sm; }
.panel-header { @apply flex justify-between items-center p-3 bg-slate-900 border-b border-slate-700; }
.header-title { @apply font-bold text-slate-200 uppercase tracking-widest text-xs; }
.header-subtitle { @apply font-mono text-[10px] text-slate-500 uppercase; }

.main-toggle { @apply flex justify-between px-3 py-2 bg-slate-800/50 hover:bg-slate-700 cursor-pointer border-b border-slate-700/50 select-none transition-colors; }
.toggle-label { @apply flex items-center gap-2 text-sky-400 font-bold text-[11px] uppercase; }
.arrow { @apply text-[10px] text-slate-600 transform transition-transform duration-200; }
.arrow-open { @apply rotate-90 text-sky-400; }

.module-list { @apply bg-slate-900/30 border-b border-slate-700/50; }
.module-row { @apply flex justify-between px-3 py-2 bg-slate-800 hover:bg-slate-700 cursor-pointer border-b border-slate-700/50 select-none; }
.module-info { @apply flex items-center gap-2 text-slate-300; }
.arrow-small { @apply text-[8px] text-slate-600 transition-all; }
.module-text { @apply font-medium; }
.cost-value { @apply font-mono text-slate-400 text-xs; }

.material-details { @apply bg-slate-950/50 shadow-inner; }
.mat-row { @apply flex justify-between items-center pl-8 pr-3 py-1 text-[11px] border-b border-slate-800/30 last:border-0 text-slate-500 hover:bg-slate-800/50; }
.mat-count { @apply font-mono text-slate-400 mr-1; }
.mat-value { @apply font-mono text-slate-600; }

.footer-area { @apply p-4 bg-slate-800 space-y-3; }
.total-row { @apply flex justify-between font-black border-b border-slate-600 pb-2 text-emerald-400 uppercase italic; }
.summary-list { @apply grid grid-cols-2 gap-x-6 gap-y-1; }
.summary-item { @apply flex justify-between text-[11px] border-b border-slate-700/30 pb-0.5; }
.summary-name { @apply text-slate-400; }
.summary-amount { @apply font-mono text-slate-300; }
.empty-tip { @apply pl-8 py-2 text-xs text-slate-600 italic; }
</style>
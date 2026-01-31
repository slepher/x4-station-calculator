<script setup lang="ts">
import { ref, computed } from 'vue'
import { useStationStore } from '@/store/useStationStore'
import { useX4I18n } from '@/utils/useX4I18n'
import { useI18n } from 'vue-i18n'
import PriceSlider from '@/components/PriceSlider.vue'

const store = useStationStore()
const { translateModule, translateWare } = useX4I18n()
const { t } = useI18n()

const isPanelOpen = ref(true) 
const isSummaryOpen = ref(true) 
const buildPriceMultiplier = ref(0.5) 
const expandedRows = ref<Set<string>>(new Set())

const getDynamicBuildPrice = (wareId: string) => {
  const ware = store.wares[wareId]
  if (!ware) return 0
  const m = buildPriceMultiplier.value
  return m <= 0.5 
    ? ware.minPrice + (ware.price - ware.minPrice) * (m * 2)
    : ware.price + (ware.maxPrice - ware.price) * ((m - 0.5) * 2)
}

const toggleRow = (id: string) => {
  if (expandedRows.value.has(id)) expandedRows.value.delete(id)
  else expandedRows.value.add(id)
}

const formatNum = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n))

const data = computed(() => {
  const raw = store.constructionBreakdown
  let totalCost = 0
  raw.moduleList.forEach(m => {
    for (const [id, qty] of Object.entries(m.buildCost)) {
      totalCost += qty * m.count * getDynamicBuildPrice(id)
    }
  })
  return {
    ...raw,
    totalCost,
    moduleList: raw.moduleList.map(item => ({
      ...item,
      displayName: store.modules[item.id] ? translateModule(store.modules[item.id]) : item.id,
      cost: Object.entries(item.buildCost).reduce((acc, [id, qty]) => acc + qty * getDynamicBuildPrice(id), 0) * item.count
    }))
  }
})

const getMaterialValue = (matId: string, amountPerModule: number, moduleCount: number) => {
  return amountPerModule * moduleCount * getDynamicBuildPrice(matId)
}
</script>

<template>
  <div class="panel-container">
    <div class="panel-header">
      <h3 class="header-title">{{ t('ui.station_costs') }}</h3>
      <span class="header-subtitle">{{ t('ui.build_res_required') }}</span>
    </div>

    <div class="panel-content">
      <div class="simulation-controls">
        <PriceSlider v-model="buildPriceMultiplier" :label="t('ui.build_res_price')" type="buy" />
      </div>

      <div @click="isPanelOpen = !isPanelOpen" class="main-toggle">
         <div class="toggle-label">
            <span :class="['arrow', { 'arrow-open': isPanelOpen }]">▶</span>
            {{ t('ui.module_breakdown') }}
         </div>
      </div>

      <div v-show="isPanelOpen" class="module-list">
        <div v-for="item in data.moduleList" :key="item.id">
          <div @click="toggleRow(item.id)" class="module-row group">
             <div class="module-info">
               <span :class="['arrow', { 'arrow-open': expandedRows.has(item.id) }]">▶</span>
               <span class="module-text">{{ formatNum(item.count) }} x {{ item.displayName }}</span>
             </div>
             <span class="cost-value">{{ formatNum(item.cost) }} Cr</span>
          </div>

          <div v-if="expandedRows.has(item.id)" class="material-details">
             <template v-if="item.buildCost && Object.keys(item.buildCost).length > 0">
               <div v-for="(amount, matId) in item.buildCost" :key="matId" class="mat-row">
                 <span class="mat-info">
                   <span class="qty">{{ formatNum(amount * item.count) }}</span>
                   <span class="symbol">x</span>
                   <span class="name">{{ store.wares[matId] ? translateWare(store.wares[matId]) : matId }}</span>
                 </span>
                 <span class="mat-value">{{ formatNum(getMaterialValue(matId, amount, item.count)) }} Cr</span>
               </div>
             </template>
             <div v-else class="empty-tip">{{ t('ui.no_materials') }}</div>
          </div>
        </div>
      </div>

      <div class="footer-area">
        <div @click.stop="isSummaryOpen = !isSummaryOpen" class="total-row-toggle group">
          <span class="total-label">
            <span :class="['arrow', { 'arrow-open': isSummaryOpen }]">▶</span>
            {{ t('ui.total_build_cost') }}:
          </span>
          <span class="total-value">{{ formatNum(data.totalCost) }} Cr</span>
        </div>

        <div v-show="isSummaryOpen" class="summary-details">
          <div v-for="(amount, id) in data.totalMaterials" :key="id" class="summary-item group">
            <span class="summary-info">
              <span class="qty">{{ formatNum(amount) }}</span>
              <span class="symbol">x</span>
              <span class="name">{{ store.wares[id] ? translateWare(store.wares[id]) : id }}</span>
            </span>
            <span class="summary-value">{{ formatNum(amount * getDynamicBuildPrice(id)) }} Cr</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel-container { @apply bg-slate-800 rounded border border-slate-700 overflow-hidden mt-4 text-sm shadow-2xl; }
.panel-header { @apply flex justify-between items-center p-3 bg-slate-900 border-b border-slate-700; }
.header-title { @apply font-bold text-slate-200 uppercase tracking-widest text-xs; }
.header-subtitle { @apply font-mono text-[10px] text-slate-500 uppercase; }
.simulation-controls { @apply p-4 bg-slate-900/50 border-b border-slate-700 flex; }

.main-toggle { @apply flex justify-between px-3 py-2 bg-slate-800/50 hover:bg-slate-700 cursor-pointer border-b border-slate-700/50 transition-colors select-none; }
.toggle-label { @apply flex items-center gap-2 text-sky-400 font-bold text-[11px] uppercase; }

/* 通用箭头规范：修复斜体偏移 */
.arrow { @apply text-[10px] text-slate-500 opacity-70 transform transition-all duration-200 mr-1; }
.arrow-open { @apply rotate-90 text-white opacity-100; }

.module-list { @apply bg-slate-900/30 border-b border-slate-700/50; }
.module-row { @apply flex justify-between px-3 py-2 bg-slate-800 hover:bg-slate-700 cursor-pointer border-b border-slate-700/50 select-none; }
.module-info { @apply flex items-center; }
.module-text { @apply font-medium text-slate-300; }
.cost-value { @apply font-mono text-slate-400 text-xs; }

.material-details { @apply bg-slate-950/50 shadow-inner; }
.mat-row { @apply flex justify-between items-center pl-8 pr-3 py-1 text-[11px] border-b border-slate-800/30 last:border-0 hover:bg-slate-800/50; }

/* 紧凑化样式 */
.mat-info, .summary-info { @apply flex items-center gap-1 text-slate-500; }
.mat-info .qty, .summary-info .qty { @apply font-mono text-slate-400; }
.mat-info .symbol, .summary-info .symbol { @apply text-slate-700 scale-90; }
.mat-value { @apply font-mono text-slate-600; }

/* 底部汇总：移除 italic (斜体)，恢复正常垂直对齐 */
.footer-area { @apply bg-slate-800; }
.total-row-toggle { @apply flex justify-between items-center px-3 py-3 font-black border-t border-slate-600 cursor-pointer transition-colors select-none hover:bg-slate-700 relative; }
.total-label { @apply flex items-center gap-2 text-emerald-400 uppercase leading-none; }
.total-value { @apply font-mono text-emerald-400; }

.summary-details { @apply bg-slate-950/50 shadow-inner overflow-hidden; }
.summary-item { @apply flex justify-between items-center pl-8 pr-3 py-1.5 text-[11px] border-b border-slate-800/30 last:border-0 hover:bg-slate-800/50 transition-colors; }
.summary-value { @apply font-mono text-slate-600; }
.empty-tip { @apply pl-8 py-2 text-xs text-slate-600 italic; }
</style>
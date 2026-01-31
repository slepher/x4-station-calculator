<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useStationStore } from '@/store/useStationStore'
import { useX4I18n } from '@/utils/useX4I18n'
import { useI18n } from 'vue-i18n'
import X4NumberInput from '@/components/common/X4NumberInput.vue'

const store = useStationStore()
const { t } = useI18n()
const { translate } = useX4I18n()

const showNeeded = ref(true)
const showCapacity = ref(true)
const formatNum = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n))

const data = computed(() => {
  const raw = store.workforceBreakdown || { needed: { total: 0, list: [] }, capacity: { total: 0, list: [] }, diff: 0 };
  const formatWF = (section: any) => {
    const list = section?.list || [];
    return list.map((item: any) => ({
      id: item.id,
      count: item.count ?? 0,
      value: item.value ?? 0,
      displayName: translate(item.id, item.nameId || item.id, 'module')
    }));
  };
  return {
    diff: raw.diff ?? 0,
    needed: { total: raw.needed?.total ?? 0, list: formatWF(raw.needed) },
    capacity: { total: raw.capacity?.total ?? 0, list: formatWF(raw.capacity) }
  };
})

const maxAllowedWorkforce = computed(() => {
  const needed = data.value.needed.total || 0;
  const capacity = data.value.capacity.total || 0;
  return Math.min(needed, capacity);
});

watch(() => maxAllowedWorkforce.value, (max) => {
  if (store.settings.manualWorkforce === 0 && max > 0) {
    store.settings.manualWorkforce = max;
  }
}, { immediate: true });

const saturationPercent = computed({
  get: () => {
    const capacity = data.value.capacity.total || 0;
    if (capacity === 0) return 0;
    const currentVal = store.settings.workforceAuto ? store.actualWorkforce : store.settings.manualWorkforce;
    return Math.round((currentVal / capacity) * 100);
  },
  set: (val: number) => {
    if (store.settings.workforceAuto) return;
    const capacity = data.value.capacity.total || 0;
    store.settings.manualWorkforce = Math.min(Math.round((val / 100) * capacity), capacity);
  }
})
</script>

<template>
  <div class="panel-container">
    <div class="panel-header">
      <div class="flex items-center gap-2">
        <h3 class="header-title">{{ t('ui.workforce_mgmt') }}</h3>
      </div>
      <div :class="['status-badge', data.diff >= 0 ? 'status-surplus' : 'status-shortage']">
        {{ data.diff >= 0 ? t('ui.surplus') : t('ui.shortage') }}: {{ formatNum(Math.abs(data.diff)) }}
      </div>
    </div>

    <div class="content">
      <div class="section section-needed">
        <div @click="showNeeded = !showNeeded" class="section-header">
          <div class="section-label">
            <span :class="['arrow', { 'arrow-open': showNeeded }]">▶</span>
            {{ t('ui.req_production') }}
          </div>
          <span class="total-val">{{ formatNum(data.needed.total) }}</span>
        </div>
        <div v-show="showNeeded" class="list-box">
          <div v-for="item in data.needed.list" :key="item.id" class="list-item">
            <span class="item-name">
              <span class="qty">{{ formatNum(item.count) }}</span>
              <span class="symbol">x</span>
              <span class="name">{{ item.displayName }}</span>
            </span>
            <span class="item-val">{{ formatNum(item.value) }}</span>
          </div>
        </div>
      </div>

      <div class="section section-capacity">
        <div @click="showCapacity = !showCapacity" class="section-header">
          <div class="section-label">
            <span :class="['arrow', { 'arrow-open': showCapacity }]">▶</span>
            {{ t('ui.hab_capacity') }}
          </div>
          <span class="total-val">{{ formatNum(data.capacity.total) }}</span>
        </div>
        <div v-show="showCapacity" class="list-box">
          <div v-for="item in data.capacity.list" :key="item.id" class="list-item">
            <span class="item-name">
              <span class="qty">{{ formatNum(item.count) }}</span>
              <span class="symbol">x</span>
              <span class="name">{{ item.displayName }}</span>
            </span>
            <span class="item-val">+{{ formatNum(item.value) }}</span>
          </div>
        </div>
      </div>

      <div class="footer">
        <div class="workforce-control-panel">
          <div class="control-header">
            <div class="flex items-center gap-2">
              <span class="text-[10px] text-slate-500 font-bold uppercase">{{ t('ui.actual_workforce') }}</span>
              
              <X4NumberInput 
                v-if="!store.settings.workforceAuto"
                v-model="store.settings.manualWorkforce"
                :max="data.capacity.total"
                width-class="w-24"
              />
              <span v-else class="val-text-display">
                {{ store.actualWorkforce }}
              </span>
            </div>
            <span class="percent-display">{{ Math.round((store.actualWorkforce / (data.capacity.total || 1)) * 100) }}%</span>
          </div>

          <div class="slider-container">
            <input type="range" v-model.number="saturationPercent" min="0" max="100" :disabled="store.settings.workforceAuto" class="range-slider">
            <div class="slider-track-bg">
               <div class="slider-fill" :style="{ width: `${saturationPercent}%` }"></div>
            </div>
          </div>

          <div class="flex items-center justify-between mt-2">
            <label class="auto-toggle group">
              <input type="checkbox" v-model="store.settings.workforceAuto" class="hidden">
              <div class="cb" :class="{ 'cb-active': store.settings.workforceAuto }">
                <div v-if="store.settings.workforceAuto" class="cb-inner"></div>
              </div>
              <span class="text-[11px] font-bold italic uppercase" :class="store.settings.workforceAuto ? 'text-sky-400' : 'text-slate-500'">
                {{ t('ui.auto_calc') }} ({{ t('ui.limit') }}: {{ formatNum(maxAllowedWorkforce) }})
              </span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" v-model="store.settings.useHQ" class="cb-sm">
              <span class="text-[9px] text-slate-500 uppercase font-bold">{{ t('ui.inc_phq') }}</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel-container { @apply bg-slate-800 rounded border border-slate-700 overflow-hidden text-sm shadow-xl; }
.panel-header { @apply flex justify-between items-center p-3 bg-slate-900 border-b border-slate-700; }
.header-title { @apply font-bold text-slate-200 uppercase tracking-widest text-xs; }

.status-badge { @apply px-2 py-0.5 rounded font-mono text-[10px] font-bold border border-current; }
.status-surplus { @apply bg-emerald-500/20 text-emerald-400; }
.status-shortage { @apply bg-red-500/20 text-red-400; }

.section-header { @apply flex justify-between px-3 py-2 bg-slate-800/50 hover:bg-slate-700 cursor-pointer border-b border-slate-700/50 select-none transition-colors; }
.section-label { @apply flex items-center gap-2 font-bold text-[10px] uppercase tracking-tighter; }
.arrow { @apply text-[8px] text-slate-500 mr-1 transition-transform duration-200; }
.arrow-open { @apply rotate-90; }
.total-val { @apply font-mono font-bold; }

.list-box { @apply bg-slate-950/30 border-b border-slate-700/50; }
.list-item { @apply flex justify-between items-center px-4 py-1.5 text-[11px] hover:bg-slate-800/50 transition-colors border-b border-slate-800/30 last:border-0; }

.item-name { @apply flex items-center gap-1; }
.item-name .qty { @apply font-mono; }
.item-name .symbol { @apply opacity-30 scale-90 text-slate-500; }
.item-val { @apply font-mono font-medium; }

.section-needed .section-label, .section-needed .total-val { @apply text-red-400; }
.section-needed .arrow-open { @apply text-red-400; }
.section-needed .list-item .item-name { @apply text-red-400/70; }
.section-needed .list-item .qty { @apply text-red-400/80; }
.section-needed .list-item .item-val { @apply text-red-500; }

.section-capacity .section-label, .section-capacity .total-val { @apply text-emerald-400; }
.section-capacity .arrow-open { @apply text-emerald-400; }
.section-capacity .list-item .item-name { @apply text-emerald-400/70; }
.section-capacity .list-item .qty { @apply text-emerald-400/80; }
.section-capacity .list-item .item-val { @apply text-emerald-500; }

/* 文本展示样式：与 X4NumberInput 视觉对齐 */
.val-text-display { 
  @apply text-sm font-mono font-bold text-sky-400/90 h-6 flex items-center px-1.5; 
}

.footer { @apply p-4 border-t border-slate-700 bg-slate-800; }
.workforce-control-panel { @apply bg-slate-900/50 p-3 rounded border border-slate-700/50; }
.control-header { @apply flex justify-between items-center mb-2; }
.percent-display { @apply text-sm font-mono text-slate-500 font-bold; }
.slider-container { @apply relative w-full h-6 flex items-center; }
.range-slider { @apply absolute z-10 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed; }
.slider-track-bg { @apply w-full h-2 bg-slate-800 rounded-full border border-slate-700 overflow-hidden; }
.slider-fill { @apply h-full bg-slate-500 transition-all duration-200; }
.auto-toggle { @apply flex items-center gap-2 cursor-pointer select-none; }
.cb { @apply w-4 h-4 rounded bg-slate-950 border border-slate-700 flex items-center justify-center transition-all; }
.cb-active { @apply border-sky-500/50 bg-sky-500/10; }
.cb-inner { @apply w-2 h-2 bg-sky-500 rounded-sm; }
.cb-sm { @apply w-3 h-3 rounded bg-slate-900 border-slate-700 accent-sky-500; }
</style>
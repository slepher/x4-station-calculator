<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useStationStore } from '@/store/useStationStore'
import { useX4I18n } from '@/utils/useX4I18n'
import { useI18n } from 'vue-i18n'

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

// 生产实际上限：min(需求, 容量)
const maxAllowedWorkforce = computed(() => {
  const needed = data.value.needed.total || 0;
  const capacity = data.value.capacity.total || 0;
  return Math.min(needed, capacity);
});

// 初始值逻辑
watch(() => maxAllowedWorkforce.value, (max) => {
  if (store.settings.manualWorkforce === 0 && max > 0) {
    store.settings.manualWorkforce = max;
  }
}, { immediate: true });

const saturationPercent = computed({
  get: () => {
    const capacity = data.value.capacity.total || 0;
    if (capacity === 0) return 0;
    // 开启 Auto 时跟随实际生效值，关闭时跟随人工设定值
    const currentVal = store.settings.workforceAuto ? store.actualWorkforce : store.settings.manualWorkforce;
    return Math.round((currentVal / capacity) * 100);
  },
  set: (val: number) => {
    if (store.settings.workforceAuto) return;
    const capacity = data.value.capacity.total || 0;
    // 允许拖动到满额居住容量
    store.settings.manualWorkforce = Math.min(Math.round((val / 100) * capacity), capacity);
  }
})

const handleWorkforceInput = (e: Event) => {
  const target = e.target as HTMLInputElement;
  let val = parseInt(target.value) || 0;
  // 允许填入到满额居住容量
  const clamped = Math.max(0, Math.min(val, data.value.capacity.total));
  store.settings.manualWorkforce = clamped;
  target.value = clamped.toString();
};
</script>

<template>
  <div class="panel-container">
    <div class="panel-header">
      <div class="flex items-center gap-2">
        <h3 class="header-title">{{ t('ui.workforce_mgmt') }}</h3>
      </div>
      <div :class="['status-badge', data.diff >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400']">
        {{ data.diff >= 0 ? t('ui.surplus') : t('ui.shortage') }}: {{ formatNum(Math.abs(data.diff)) }}
      </div>
    </div>

    <div class="content">
      <div class="section">
        <div @click="showNeeded = !showNeeded" class="section-header">
          <div class="label-group">
            <span :class="['arrow', { 'arrow-open': showNeeded }]">▶</span>
            <span>{{ t('ui.req_production') }}</span>
          </div>
          <span class="val-text text-red-400">{{ formatNum(data.needed.total) }}</span>
        </div>
        <div v-show="showNeeded" class="list-container">
          <div v-for="item in data.needed.list" :key="item.id" class="list-item">
            <span class="name-text">{{ item.displayName }} (x{{ item.count }})</span>
            <span class="val-small text-red-400/80">{{ formatNum(item.value) }}</span>
          </div>
        </div>
      </div>

      <div class="section">
        <div @click="showCapacity = !showCapacity" class="section-header">
          <div class="label-group">
            <span :class="['arrow', { 'arrow-open': showCapacity }]">▶</span>
            <span>{{ t('ui.hab_capacity') }}</span>
          </div>
          <span class="val-text text-emerald-400">{{ formatNum(data.capacity.total) }}</span>
        </div>
        <div v-show="showCapacity" class="list-container">
          <div v-for="item in data.capacity.list" :key="item.id" class="list-item">
            <span class="name-text">{{ item.displayName }} (x{{ item.count }})</span>
            <span class="val-small text-emerald-400/80">+{{ formatNum(item.value) }}</span>
          </div>
        </div>
      </div>

      <div class="footer">
        <div class="workforce-control-panel">
          <div class="control-header">
            <div class="flex items-baseline gap-2">
              <span class="text-[10px] text-slate-500 font-bold uppercase">{{ t('ui.actual_workforce') }}</span>
              <input 
                type="number" 
                :value="store.actualWorkforce"
                @input="handleWorkforceInput"
                :disabled="store.settings.workforceAuto"
                class="val-input-large"
              >
            </div>
            <span class="percent-display">{{ Math.round((store.actualWorkforce / (data.capacity.total || 1)) * 100) }}%</span>
          </div>

          <div class="slider-container">
            <input 
              type="range" 
              v-model.number="saturationPercent"
              min="0"
              max="100"
              :disabled="store.settings.workforceAuto"
              class="range-slider"
            >
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
              <span class="text-[11px] font-bold italic uppercase" 
                    :class="store.settings.workforceAuto ? 'text-sky-400' : 'text-slate-500'">
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
.section-header { @apply flex justify-between px-3 py-2 bg-slate-800/50 hover:bg-slate-700 cursor-pointer border-b border-slate-700/50 select-none transition-colors; }
.label-group { @apply flex items-center gap-2 font-bold text-[10px] uppercase tracking-tighter; }
.arrow { @apply text-[8px] text-slate-500 transform transition-transform; }
.arrow-open { @apply rotate-90 text-sky-400; }
.val-text { @apply font-mono font-bold; }
.list-container { @apply bg-slate-950/30 px-4 py-2 space-y-1 border-b border-slate-800; }
.list-item { @apply flex justify-between text-[11px] py-1 border-b border-white/5 last:border-0; }
.name-text { @apply text-slate-400; }
.val-small { @apply font-mono font-medium; }
.footer { @apply p-4 border-t border-slate-700 bg-slate-800; }
.workforce-control-panel { @apply bg-slate-900/50 p-3 rounded border border-slate-700/50; }
.val-input-large { @apply bg-transparent border-none p-0 text-xl font-mono font-bold text-sky-400 w-24 focus:ring-0 disabled:text-slate-500; }
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
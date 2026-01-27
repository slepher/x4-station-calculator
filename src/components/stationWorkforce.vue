<script setup lang="ts">
import { ref, computed } from 'vue'
import { useStationStore } from '@/store/useStationStore'

const store = useStationStore()
const showNeeded = ref(true)
const showCapacity = ref(true)

const formatNum = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n))
const data = computed(() => store.workforceBreakdown)
</script>

<template>
  <div class="panel-container">
    <div class="panel-header">
      <h3 class="header-title">Workforce</h3>
      <span class="header-status" :class="data.diff >= 0 ? 'text-green-400' : 'text-red-400'">
        {{ data.diff >= 0 ? 'Surplus' : 'Shortage' }}: {{ formatNum(data.diff) }}
      </span>
    </div>

    <div>
      <div>
        <div @click="showNeeded = !showNeeded" class="section-header group">
          <div class="section-label text-green-400">
            <span class="arrow-icon" :class="showNeeded ? 'rotate-90' : ''">▶</span>
            <span>Needed Workforce</span>
          </div>
          <span class="value-text">{{ formatNum(data.needed.total) }}</span>
        </div>
        
        <div v-show="showNeeded" class="list-container border-b border-slate-700/50">
          <div v-for="(item, idx) in data.needed.list" :key="idx" class="list-item">
             <span class="item-name">{{ item.count }} x {{ item.name }}</span>
             <span class="item-value text-red-400">{{ formatNum(item.value) }}</span>
          </div>
          <div v-if="data.needed.list.length === 0" class="empty-tip">None</div>
        </div>
      </div>

      <div>
        <div @click="showCapacity = !showCapacity" class="section-header group">
          <div class="section-label text-green-400">
            <span class="arrow-icon" :class="showCapacity ? 'rotate-90' : ''">▶</span>
            <span>Workforce Capacity</span>
          </div>
          <span class="value-text">{{ formatNum(data.capacity.total) }}</span>
        </div>

        <div v-show="showCapacity" class="list-container">
          <div v-for="(item, idx) in data.capacity.list" :key="idx" class="list-item">
             <span class="item-name">{{ item.count }} x {{ item.name }}</span>
             <span class="item-value text-green-400">+{{ formatNum(item.value) }}</span>
          </div>
          <div v-if="data.capacity.list.length === 0" class="empty-tip">None</div>
        </div>
      </div>

      <div class="footer-container">
        <label class="control-row">
          <input type="checkbox" v-model="store.settings.useHQ" class="checkbox-input">
          Headquarters (The HQ needs 200 workers)
        </label>

        <div>
          <div class="slider-label-row">
            <span>Actual Workforce: <span class="font-bold text-slate-200">{{ formatNum(Math.min(data.capacity.total, data.needed.total)) }}</span></span>
            <span>{{ store.settings.workforcePercent }}%</span>
          </div>
          <input type="range" v-model.number="store.settings.workforcePercent" 
                 :disabled="store.settings.workforceAuto" class="slider-input accent-sky-500">
        </div>
        
        <label class="control-row text-sky-400 font-bold">
          <input type="checkbox" v-model="store.settings.workforceAuto" class="checkbox-input">
          Auto
        </label>
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel-container {
  @apply bg-slate-800 rounded border border-slate-700 overflow-hidden text-sm;
}
.panel-header {
  @apply flex justify-between items-center p-3 bg-slate-900 border-b border-slate-700;
}
.header-title {
  @apply font-bold text-slate-200;
}
.header-status {
  @apply font-mono text-xs;
}
.section-header {
  @apply flex justify-between px-3 py-2 bg-slate-800/50 hover:bg-slate-700 cursor-pointer border-b border-slate-700/50 select-none transition-colors;
}
.section-label {
  @apply flex items-center gap-2;
}
.arrow-icon {
  @apply text-[10px] text-slate-500 transform transition-transform duration-200;
}
.value-text {
  @apply font-mono text-slate-200;
}
.list-container {
  @apply bg-slate-900/30 px-3 py-1 space-y-1;
}
.list-item {
  @apply flex justify-between text-xs py-0.5;
}
.item-name {
  @apply text-slate-400;
}
.item-value {
  @apply font-mono;
}
.empty-tip {
  @apply text-xs text-slate-600 italic pl-4;
}
.footer-container {
  @apply p-3 border-t border-slate-700 space-y-3 bg-slate-800;
}
.control-row {
  @apply flex items-center gap-2 cursor-pointer text-xs text-slate-300 hover:text-white transition-colors;
}
.checkbox-input {
  @apply rounded bg-slate-700 border-slate-500 text-sky-500 focus:ring-0;
}
.slider-label-row {
  @apply flex justify-between text-xs text-slate-400 mb-1;
}
.slider-input {
  @apply w-full h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer;
}
</style>
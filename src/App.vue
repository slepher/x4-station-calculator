<script setup lang="ts">
import StationPlanner from './components/StationPlanner.vue'
import { useStationStore } from '@/store/useStationStore'
const store = useStationStore()

if (import.meta.env.DEV) {
  (window as any).store = store
}
</script>

<template>
  <StationPlanner v-if="store.isReady"/>
</template>

<style>
/* Tooltip 内部网格布局 (非 Scoped 以便 Tippy 渲染) */
.tooltip-grid {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 4px 12px;
  align-items: center;
  padding: 4px;
  font-size: 12px;
}
.tooltip-grid .label { @apply text-slate-400; }
.tooltip-grid .unit { @apply text-slate-500 text-[10px]; }

.tippy-box[data-theme~='x4'] {
  background-color: #151C2C;
}
.tippy-box[data-theme~='x4'][data-placement^='top'] > .tippy-arrow::before {
  border-top-color: #151C2C;
}
.tippy-box[data-theme~='x4'][data-placement^='bottom']
  > .tippy-arrow::before {
  border-bottom-color: #151C2C;
}
.tippy-box[data-theme~='x4'][data-placement^='left']
  > .tippy-arrow::before {
  border-left-color: #151C2C; 
}
.tippy-box[data-theme~='x4'][data-placement^='right']
  > .tippy-arrow::before {
  border-right-color: #151C2C;
}
</style>
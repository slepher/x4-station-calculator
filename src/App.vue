<script setup lang="ts">
import { ref, onMounted } from 'vue'
import MainWorkbench from './components/MainWorkbench.vue'
import DragTestPage from './components/test/DragTestPage.vue'
import TestTemplateFlow from './components/test/GLM-Parent.vue'
import MetricPanelPlayground from './components/test/MetricPanelPlayground.vue'
import { useStationStore } from '@/store/useStationStore'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useLogicFlowStore } from '@/store/useLogicFlowStore'
import { useEmpireStore } from '@/store/useEmpireStore'
import { useShipBuildStore } from '@/store/useShipBuildStore'

const stationStore = useStationStore()
const gameDataStore = useGameDataStore()
const logicFlowStore = useLogicFlowStore()
const empireStore = useEmpireStore()
const shipBuildStore = useShipBuildStore()

const currentView = ref<'main' | 'drag-test' | 'template-flow' | 'metric-panel-test'>('main')

onMounted(() => {
  const params = new URLSearchParams(window.location.search)
  const view = params.get('view')
  const router = params.get('router')
  if (view === 'drag-test') {
    currentView.value = 'drag-test'
  } else if (view === 'template-flow') {
    currentView.value = 'template-flow'
  } else if (view === 'metric-panel-test') {
    currentView.value = 'metric-panel-test'
  } else if (router === 'maps') {
    shipBuildStore.activeView = 'maps'
  }
})

// 暴露 store 供测试使用
const checkExportStores = () => {
  const isTest = (window as any).isTestEnv || 
                 window.location.search.includes('test=true') || 
                 window.localStorage.getItem('isTestEnv') === 'true';

  if (import.meta.env.DEV || isTest) {
    if (!(window as any).stationStore) {
      console.log('[App] Exporting stores to window for test env');
      (window as any).stationStore = stationStore;
      (window as any).gameDataStore = gameDataStore;
      (window as any).logicFlowStore = logicFlowStore;
      (window as any).empireStore = empireStore;
      (window as any).shipBuildStore = shipBuildStore;
      (window as any).store = stationStore;
    }
    
    if (!gameDataStore.isReady) {
      console.log('[App] GameData not ready, initializing...');
      gameDataStore.initialize();
    }
    return true;
  }
  return false;
};

// 立即尝试暴露
checkExportStores();

// 延迟重试，处理某些极端情况下的加载顺序问题
setTimeout(checkExportStores, 100);
setTimeout(checkExportStores, 500);
</script>

<template>
  <div id="app-root">
    <DragTestPage v-if="currentView === 'drag-test'" />
    <TestTemplateFlow v-else-if="currentView === 'template-flow'" />
    <MetricPanelPlayground v-else-if="currentView === 'metric-panel-test'" />
    <MainWorkbench v-else-if="stationStore.isReady"/>
    <div v-else class="loading-gate">Initializing Station Store...</div>
  </div>
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

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import MainWorkbench from './components/MainWorkbench.vue'
import DragTestPage from './components/test/DragTestPage.vue'
import TestTemplateFlow from './components/test/GLM-Parent.vue'
import MetricPanelPlayground from './components/test/MetricPanelPlayground.vue'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useLogicFlowStore } from '@/store/useLogicFlowStore'
import { useShipBuildStore } from '@/store/useShipBuildStore'
import { useBlueprintProductionStore } from '@/store/useBlueprintProductionStore'
import { useLiveProductionStore } from '@/store/useLiveProductionStore'
import { useSaveStore } from '@/store/useSaveStore'
import { useMapStore } from '@/store/useMapStore'
import { useSaveBindingStore } from '@/store/useSaveBindingStore'
import { useActiveViewStore } from '@/store/useActiveViewStore'
import { saveArchiveToDB, createArchiveId, loadPlayerStationsByArchiveId } from '@/db/saveArchiveDB'

const gameDataStore = useGameDataStore()
const logicFlowStore = useLogicFlowStore()
const shipBuildStore = useShipBuildStore()
const blueprintStore = useBlueprintProductionStore()
const liveStore = useLiveProductionStore()
const saveStore = useSaveStore()
const mapStore = useMapStore()
const saveBindingStore = useSaveBindingStore()
const activeViewStore = useActiveViewStore()

const currentView = ref<'main' | 'drag-test' | 'template-flow' | 'metric-panel-test'>('main')
const isInitializing = ref(true)

async function initializeApp() {
  console.log('[App] Starting unified initialization...')
  isInitializing.value = true

  try {
    await gameDataStore.initialize()
    console.log('[App] GameData initialized')

    await saveStore.initialize()
    await saveBindingStore.initialize()
    
    await blueprintStore.initialize()
    await liveStore.initialize()
    
    await Promise.all([
      logicFlowStore.init(),
      mapStore.initialize(),
      shipBuildStore.initialize()
    ])

    console.log('[App] All stores initialized')
  } catch (e) {
    console.error('[App] Initialization failed:', e)
  } finally {
    isInitializing.value = false
  }
}

initializeApp()

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

const isReady = computed(() => blueprintStore.isReady && gameDataStore.isReady)

const checkExportStores = () => {
  const isTest = (window as any).isTestEnv ||
                 window.location.search.includes('test=true') ||
                 window.localStorage.getItem('isTestEnv') === 'true';

  if (import.meta.env.DEV || isTest) {
    if (!(window as any).blueprintStore) {
      console.log('[App] Exporting stores to window for test env');
      (window as any).blueprintStore = blueprintStore;
      (window as any).liveStore = liveStore;
      (window as any).gameDataStore = gameDataStore;
      (window as any).logicFlowStore = logicFlowStore;
      (window as any).shipBuildStore = shipBuildStore;
      (window as any).saveBindingStore = saveBindingStore;
      (window as any).saveStore = saveStore;
      (window as any).mapStore = mapStore;
      (window as any).activeViewStore = activeViewStore;
      (window as any).store = blueprintStore;
      (window as any).saveArchiveDB = { saveArchiveToDB, createArchiveId, loadPlayerStationsByArchiveId };
    }
    return true;
  }
  return false;
};

checkExportStores();

setTimeout(checkExportStores, 100);
setTimeout(checkExportStores, 500);
</script>

<template>
  <div id="app-root">
    <DragTestPage v-if="currentView === 'drag-test'" />
    <TestTemplateFlow v-else-if="currentView === 'template-flow'" />
    <MetricPanelPlayground v-else-if="currentView === 'metric-panel-test'" />
    <MainWorkbench v-else-if="isReady"/>
    <div v-else class="loading-gate">Initializing... (GameData: {{ gameDataStore.isReady }}, Blueprint: {{ blueprintStore.isReady }})</div>
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

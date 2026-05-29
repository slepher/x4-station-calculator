import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { StationActiveView } from './useShipBuildStore'

export type BindingStage = 'select-binding' | 'select-sector' | 'select-station'
export type MapSavePanelLayer = 'list' | 'category' | 'coord' | 'binding-sector' | 'binding-station'

export interface ActiveViewState {
  activeEmpireId: string | null
  activeEmpireStation: string | null
  activeBinding: string | null
  activeBindingStation: string | null
  activeBindingWorkbench: 'overview' | 'station' | 'transit' | 'terraforming' | 'tech-tree'
  activeTerraformingClusterId: string | null
  activeView: StationActiveView
  isResourcePanelOpen: boolean
  isSavePanelOpen: boolean
  mapBindingGameGuid: string | null
  mapBindingStage: BindingStage
  mapSavePanelLayer: MapSavePanelLayer
  mapSavePanelSectorGroupId: string | null
}

const STORAGE_KEY = 'x4_station_active_view'
const DEFAULT_STATE: ActiveViewState = {
  activeEmpireId: null,
  activeEmpireStation: null,
  activeBinding: null,
  activeBindingStation: null,
  activeBindingWorkbench: 'overview',
  activeTerraformingClusterId: null,
  activeView: 'blueprint-production',
  isResourcePanelOpen: false,
  isSavePanelOpen: false,
  mapBindingGameGuid: null,
  mapBindingStage: 'select-binding',
  mapSavePanelLayer: 'list',
  mapSavePanelSectorGroupId: null
}

function loadFromStorage(): ActiveViewState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_STATE }
    const parsed = JSON.parse(raw)
    const baseDefaults = { ...DEFAULT_STATE }
    if (parsed.activeEmpireId !== undefined || parsed.activeBinding !== undefined) {
      return {
        ...baseDefaults,
        activeEmpireId: parsed.activeEmpireId || null,
        activeEmpireStation: parsed.activeEmpireStation || null,
        activeBinding: parsed.activeBinding || null,
        activeBindingStation: parsed.activeBindingStation || null,
        activeBindingWorkbench: parsed.activeBindingWorkbench || 'overview',
        activeTerraformingClusterId: parsed.activeTerraformingClusterId || null,
        activeView: parsed.activeView || 'blueprint-production'
      }
    }
    return {
      ...baseDefaults,
      activeEmpireId: parsed.productionSource === 'empire' ? parsed.activeId : null,
      activeEmpireStation: parsed.productionSource === 'empire' ? parsed.activeStationId : null,
      activeBinding: parsed.productionSource === 'save-binding' ? parsed.activeId : null,
        activeBindingStation: parsed.productionSource === 'save-binding' ? parsed.activeStationId : null,
        activeBindingWorkbench: parsed.activeStationId ? 'station' : 'overview',
        activeView: parsed.activeView || 'blueprint-production'
    }
  } catch {
    return { ...DEFAULT_STATE }
  }
}

function saveToStorage(state: ActiveViewState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (e) {
    console.error('[ActiveViewStore] Failed to save:', e)
  }
}

export const useActiveViewStore = defineStore('activeView', () => {
  const state = ref<ActiveViewState>(loadFromStorage())

  const activeEmpireId = computed({
    get: () => state.value.activeEmpireId,
    set: (val: string | null) => {
      state.value.activeEmpireId = val
      saveToStorage(state.value)
    }
  })

  const activeEmpireStation = computed({
    get: () => state.value.activeEmpireStation,
    set: (val: string | null) => {
      state.value.activeEmpireStation = val
      saveToStorage(state.value)
    }
  })

  const activeBinding = computed({
    get: () => state.value.activeBinding,
    set: (val: string | null) => {
      state.value.activeBinding = val
      saveToStorage(state.value)
    }
  })

  const activeBindingStation = computed({
    get: () => state.value.activeBindingStation,
    set: (val: string | null) => {
      state.value.activeBindingStation = val
      if (val) {
        state.value.activeBindingWorkbench = 'station'
      } else if (state.value.activeBindingWorkbench === 'station') {
        state.value.activeBindingWorkbench = 'overview'
      }
      saveToStorage(state.value)
    }
  })

  const activeBindingWorkbench = computed<ActiveViewState['activeBindingWorkbench']>({
    get: () => state.value.activeBindingWorkbench,
    set: (val) => {
      state.value.activeBindingWorkbench = val
      saveToStorage(state.value)
    }
  })

  const activeView = computed({
    get: () => state.value.activeView,
    set: (val: StationActiveView) => {
      state.value.activeView = val
      saveToStorage(state.value)
    }
  })

  const productionSource = computed<'empire' | 'save-binding'>({
    get: () => {
      if (state.value.activeView === 'live-production') return 'save-binding'
      return 'empire'
    },
    set: (val: 'empire' | 'save-binding') => {
      if (val === 'save-binding') {
        state.value.activeView = 'live-production'
      } else {
        state.value.activeView = 'blueprint-production'
      }
      saveToStorage(state.value)
    }
  })

  const activeId = computed<string | null>({
    get: () => {
      if (productionSource.value === 'save-binding') return state.value.activeBinding
      return state.value.activeEmpireId
    },
    set: (val: string | null) => {
      if (productionSource.value === 'save-binding') {
        state.value.activeBinding = val
      } else {
        state.value.activeEmpireId = val
      }
      saveToStorage(state.value)
    }
  })

  const activeStationId = computed<string | null>({
    get: () => {
      if (productionSource.value === 'save-binding') return state.value.activeBindingStation
      return state.value.activeEmpireStation
    },
    set: (val: string | null) => {
      if (productionSource.value === 'save-binding') {
        state.value.activeBindingStation = val
      } else {
        state.value.activeEmpireStation = val
      }
      saveToStorage(state.value)
    }
  })

  const isResourcePanelOpen = computed({
    get: () => state.value.isResourcePanelOpen,
    set: (val: boolean) => {
      state.value.isResourcePanelOpen = val
      saveToStorage(state.value)
    }
  })

  const isSavePanelOpen = computed({
    get: () => state.value.isSavePanelOpen,
    set: (val: boolean) => {
      state.value.isSavePanelOpen = val
      saveToStorage(state.value)
    }
  })

  const mapBindingGameGuid = computed({
    get: () => state.value.mapBindingGameGuid,
    set: (val: string | null) => {
      state.value.mapBindingGameGuid = val
      saveToStorage(state.value)
    }
  })

  const mapBindingStage = computed({
    get: () => state.value.mapBindingStage,
    set: (val: BindingStage) => {
      state.value.mapBindingStage = val
      saveToStorage(state.value)
    }
  })

  const mapSavePanelLayer = computed({
    get: () => state.value.mapSavePanelLayer,
    set: (val: MapSavePanelLayer) => {
      state.value.mapSavePanelLayer = val
      saveToStorage(state.value)
    }
  })

  const mapSavePanelSectorGroupId = computed({
    get: () => state.value.mapSavePanelSectorGroupId,
    set: (val: string | null) => {
      state.value.mapSavePanelSectorGroupId = val
      saveToStorage(state.value)
    }
  })

  const isBindingPanelOpen = computed(() => state.value.mapBindingStage !== 'select-binding')

  const mapDragBindingSectorGroupId = computed(() =>
    state.value.mapBindingStage === 'select-station' ? state.value.mapSavePanelSectorGroupId : null
  )

  function setActiveId(id: string | null) {
    activeId.value = id
  }

  function setActiveStationId(id: string | null) {
    activeStationId.value = id
  }

  function setActiveView(view: StationActiveView) {
    state.value.activeView = view
    saveToStorage(state.value)
  }

  function setProductionSource(source: 'empire' | 'save-binding') {
    productionSource.value = source
  }

  function resetToOverview() {
    if (productionSource.value === 'save-binding') {
      state.value.activeBindingStation = null
    } else {
      state.value.activeEmpireStation = null
    }
    saveToStorage(state.value)
  }

  function switchToBinding(gameGuid: string) {
    state.value.activeBinding = gameGuid
    state.value.activeBindingStation = null
    state.value.activeBindingWorkbench = 'overview'
    state.value.activeView = 'live-production'
    saveToStorage(state.value)
  }

  function switchToEmpire(empireId: string | null) {
    state.value.activeEmpireId = empireId
    state.value.activeEmpireStation = null
    state.value.activeView = 'blueprint-production'
    saveToStorage(state.value)
  }

  function loadState(): ActiveViewState {
    state.value = loadFromStorage()
    return state.value
  }

  return {
    state,
    productionSource,
    activeId,
    activeStationId,
    activeEmpireId,
    activeEmpireStation,
    activeBinding,
    activeBindingStation,
    activeBindingWorkbench,
    activeTerraformingClusterId: computed({
      get: () => state.value.activeTerraformingClusterId,
      set: (val: string | null) => {
        state.value.activeTerraformingClusterId = val
        saveToStorage(state.value)
      }
    }),
    activeView,
    isResourcePanelOpen,
    isSavePanelOpen,
    isBindingPanelOpen,
    mapBindingGameGuid,
    mapBindingStage,
    mapDragBindingSectorGroupId,
    mapSavePanelLayer,
    mapSavePanelSectorGroupId,
    setProductionSource,
    setActiveId,
    setActiveStationId,
    setActiveView,
    resetToOverview,
    switchToBinding,
    switchToEmpire,
    loadState
  }
})
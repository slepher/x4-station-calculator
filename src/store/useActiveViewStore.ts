import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { StationActiveView } from './useShipBuildStore'

export type ProductionSourceKind = 'empire' | 'save-binding'

export interface ActiveViewState {
  productionSource: ProductionSourceKind
  activeId: string | null
  activeStationId: string | null
  activeView: StationActiveView
}

const STORAGE_KEY = 'x4_station_active_view'
const DEFAULT_STATE: ActiveViewState = {
  productionSource: 'empire',
  activeId: null,
  activeStationId: null,
  activeView: 'production'
}

function loadFromStorage(): ActiveViewState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_STATE }
    const parsed = JSON.parse(raw)
    return {
      productionSource: parsed.productionSource || 'empire',
      activeId: parsed.activeId || null,
      activeStationId: parsed.activeStationId || null,
      activeView: parsed.activeView || 'production'
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

  const productionSource = computed({
    get: () => state.value.productionSource,
    set: (val: ProductionSourceKind) => {
      state.value.productionSource = val
      saveToStorage(state.value)
    }
  })

  const activeId = computed({
    get: () => state.value.activeId,
    set: (val: string | null) => {
      state.value.activeId = val
      saveToStorage(state.value)
    }
  })

  const activeStationId = computed({
    get: () => state.value.activeStationId,
    set: (val: string | null) => {
      state.value.activeStationId = val
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

  function setProductionSource(source: ProductionSourceKind) {
    state.value.productionSource = source
    saveToStorage(state.value)
  }

  function setActiveId(id: string | null) {
    state.value.activeId = id
    saveToStorage(state.value)
  }

  function setActiveStationId(id: string | null) {
    state.value.activeStationId = id
    saveToStorage(state.value)
  }

  function setActiveView(view: StationActiveView) {
    state.value.activeView = view
    saveToStorage(state.value)
  }

  function resetToOverview() {
    state.value.activeStationId = null
    saveToStorage(state.value)
  }

  function switchToBinding(gameGuid: string) {
    state.value.productionSource = 'save-binding'
    state.value.activeId = gameGuid
    state.value.activeStationId = null
    saveToStorage(state.value)
  }

  function switchToEmpire(empireId: string | null) {
    state.value.productionSource = 'empire'
    state.value.activeId = empireId
    state.value.activeStationId = null
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
    activeView,
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
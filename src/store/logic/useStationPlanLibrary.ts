import { ref, watch } from 'vue'
import type { StationPlan } from '@/types/x4'
import { deepClone, getStationState } from './stationComputeService'

export interface SavedPlansState {
  version: number
  activeId: string | null
  list: StationPlan[]
}

const STORAGE_KEY = 'x4_station_data'

export function useStationPlanLibrary() {
  const savedPlans = ref<SavedPlansState>({ version: 1, activeId: null, list: [] })

  watch(savedPlans, (val) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
  }, { deep: true })

  function loadData(source: SavedPlansState) {
    savedPlans.value = deepClone(source)
  }

  function saveCurrentPlan(
    stationId: string,
    name: string,
    activeId: string | null
  ): StationPlan | null {
    const state = getStationState(stationId)
    if (!state) return null

    const finalName = name || 'Unnamed Plan'
    const planData: StationPlan = {
      id: activeId || crypto.randomUUID(),
      name: finalName,
      modules: deepClone(state.plannedModules),
      lockedWares: deepClone(state.lockedWares || []),
      settings: deepClone(state.settings),
      warePriority: deepClone(state.warePriority || {}),
      lastUpdated: Date.now()
    }

    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const remote = JSON.parse(stored)
        savedPlans.value.list = remote.list || []
      } catch (e) {}
    }

    const idx = savedPlans.value.list.findIndex(l => l.id === planData.id)
    if (idx !== -1) savedPlans.value.list[idx] = planData
    else savedPlans.value.list.push(planData)

    savedPlans.value.activeId = planData.id
    return planData
  }

  function loadPlan(index: number): StationPlan | null {
    const plan = savedPlans.value.list[index]
    if (!plan) return null
    savedPlans.value.activeId = plan.id
    return deepClone(plan)
  }

  function getPlanById(id: string): StationPlan | null {
    const plan = savedPlans.value.list.find(l => l.id === id)
    return plan ? deepClone(plan) : null
  }

  function deletePlan(index: number): boolean {
    if (index < 0 || index >= savedPlans.value.list.length) return false
    const planId = savedPlans.value.list[index]?.id
    if (planId === savedPlans.value.activeId) {
      savedPlans.value.activeId = null
    }
    savedPlans.value.list.splice(index, 1)
    return true
  }

  function deletePlanById(id: string): boolean {
    const index = savedPlans.value.list.findIndex(l => l.id === id)
    return deletePlan(index)
  }

  function getActivePlan(): StationPlan | null {
    if (!savedPlans.value.activeId) return null
    return getPlanById(savedPlans.value.activeId)
  }

  function setActivePlanId(id: string | null): void {
    savedPlans.value.activeId = id
  }

  function getPlans(): StationPlan[] {
    return savedPlans.value.list
  }

  function getPlansCount(): number {
    return savedPlans.value.list.length
  }

  return {
    savedPlans,
    loadData,
    saveCurrentPlan,
    loadPlan,
    getPlanById,
    deletePlan,
    deletePlanById,
    getActivePlan,
    setActivePlanId,
    getPlans,
    getPlansCount
  }
}
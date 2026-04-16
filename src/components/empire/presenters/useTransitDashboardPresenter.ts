import { computed, type ComputedRef } from 'vue'
import type { TransitPresenterContract } from '@/types/transit-presenter-contract'
import type { SavedModule, SupplyStorageFlow } from '@/types/x4'

export interface TransitDashboardPresenterProps {
  mode: ComputedRef<'planning' | 'live'>
  visualMode: ComputedRef<'planning' | 'live'>
  hasArchiveTradeStation: ComputedRef<boolean>
  plannedModules: ComputedRef<SavedModule[]>
  liveModules: ComputedRef<SavedModule[]>
  liveBuildingModules: ComputedRef<SavedModule[]>
  activeModules: ComputedRef<SavedModule[]>
  activeBuildingModules: ComputedRef<SavedModule[]>
  storageFlows: ComputedRef<SupplyStorageFlow[]>
}

export interface UseTransitDashboardPresenterReturn {
  props: TransitDashboardPresenterProps
  emits: {}
}

export function useTransitDashboardPresenter(store: TransitPresenterContract): UseTransitDashboardPresenterReturn {
  const sectorId = computed(() => store.getActiveTransitSectorId())
  const mode = computed(() => store.getTransitMode())
  const hasArchiveTradeStation = computed(() => store.getTransitHasArchiveTradeStation())

  const activeSource = computed(() => store.getActiveTransitPanelSource(sectorId.value))
  const planningSource = computed(() => store.getPlanningTransitPanelSource(sectorId.value))
  const liveSource = computed(() => store.getLiveTransitPanelSource(sectorId.value))

  const visualMode = computed<'planning' | 'live'>(() => activeSource.value.liveVisualState)

  const plannedModules = computed(() => planningSource.value.planning.modules)
  const liveModules = computed(() => liveSource.value.live.modules)
  const liveBuildingModules = computed(() => liveSource.value.live.buildingModules)
  const storageFlows = computed(() => activeSource.value.planning.supplyStorageFlows)

  const activeModules = computed<SavedModule[]>(() => {
    if (visualMode.value === 'planning') {
      return plannedModules.value
    }
    if (hasArchiveTradeStation.value) {
      return liveModules.value
    }
    return plannedModules.value
  })

  const activeBuildingModules = computed<SavedModule[]>(() => {
    if (visualMode.value === 'planning') {
      return []
    }
    if (hasArchiveTradeStation.value) {
      return liveBuildingModules.value
    }
    return []
  })

  const props: TransitDashboardPresenterProps = {
    mode,
    visualMode,
    hasArchiveTradeStation,
    plannedModules,
    liveModules,
    liveBuildingModules,
    activeModules,
    activeBuildingModules,
    storageFlows
  }

  return { props, emits: {} }
}
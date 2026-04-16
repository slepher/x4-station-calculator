import { computed, type ComputedRef } from 'vue'
import type { TransitPresenterContract } from '@/types/transit-presenter-contract'
import type { SavedModule, TransitHubStorageModulePlan } from '@/types/x4'

export interface TransitPlanningPresenterProps {
  mode: ComputedRef<'planning' | 'live'>
  visualMode: ComputedRef<'planning' | 'live'>
  hasArchiveTradeStation: ComputedRef<boolean>
  plannedModules: ComputedRef<SavedModule[]>
  modulePlans: ComputedRef<TransitHubStorageModulePlan[]>
  liveModules: ComputedRef<SavedModule[]>
  liveBuildingModules: ComputedRef<SavedModule[]>
}

export interface UseTransitPlanningPresenterReturn {
  props: TransitPlanningPresenterProps
  emits: {}
}

export function useTransitPlanningPresenter(store: TransitPresenterContract): UseTransitPlanningPresenterReturn {
  const activeSectorId = computed(() => store.getActiveTransitSectorId())
  const mode = computed(() => store.getTransitMode())
  const hasArchiveTradeStation = computed(() => store.getTransitHasArchiveTradeStation())

  const activeSource = computed(() => store.getActiveTransitPanelSource(activeSectorId.value))
  const planningSource = computed(() => store.getPlanningTransitPanelSource(activeSectorId.value))
  const liveSource = computed(() => store.getLiveTransitPanelSource(activeSectorId.value))

  const visualMode = computed<'planning' | 'live'>(() => activeSource.value.liveVisualState)

  const plannedModules = computed(() => planningSource.value.planning.modules)
  const modulePlans = computed(() => planningSource.value.planning.storageModulePlans)
  const liveModules = computed(() => liveSource.value.live.modules)
  const liveBuildingModules = computed(() => liveSource.value.live.buildingModules)

  const props: TransitPlanningPresenterProps = {
    mode,
    visualMode,
    hasArchiveTradeStation,
    plannedModules,
    modulePlans,
    liveModules,
    liveBuildingModules
  }

  return { props, emits: {} }
}
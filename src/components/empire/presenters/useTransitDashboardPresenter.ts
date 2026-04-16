import { computed, type ComputedRef } from 'vue'
import type { TransitPresenterContract } from '@/types/transit-presenter-contract'
import type { SavedModule } from '@/types/x4'

export interface TransitDashboardPresenterProps {
  mode: ComputedRef<'planning' | 'live'>
  visualMode: ComputedRef<'planning' | 'live'>
  hasArchiveTradeStation: ComputedRef<boolean>
  plannedModules: ComputedRef<SavedModule[]>
  liveModules: ComputedRef<SavedModule[]>
  liveBuildingModules: ComputedRef<SavedModule[]>
  activeModules: ComputedRef<SavedModule[]>
  activeBuildingModules: ComputedRef<SavedModule[]>
  buildPriceMultiplier: ComputedRef<number>
  useHQ: ComputedRef<boolean>
}

export interface TransitDashboardPresenterEmits {
  updateBuildPriceMultiplier: (value: number) => void
  updateUseHQ: (value: boolean) => void
}

export interface UseTransitDashboardPresenterReturn {
  props: TransitDashboardPresenterProps
  emits: TransitDashboardPresenterEmits
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

  const buildPriceMultiplier = computed(() => store.getBuildPriceMultiplier())
  const useHQ = computed(() => store.getUseHQ())

  const props: TransitDashboardPresenterProps = {
    mode,
    visualMode,
    hasArchiveTradeStation,
    plannedModules,
    liveModules,
    liveBuildingModules,
    activeModules,
    activeBuildingModules,
    buildPriceMultiplier,
    useHQ
  }

  const emits: TransitDashboardPresenterEmits = {
    updateBuildPriceMultiplier: (value: number) => store.updateBuildPriceMultiplier(value),
    updateUseHQ: (value: boolean) => store.updateUseHQ(value)
  }

  return { props, emits }
}
import { computed, type ComputedRef } from 'vue'
import type { ProductionWorkbenchStoreContract } from '@/types/production-workbench-contract'
import type { StationDashboardEmits } from '@/types/production-ui'
import type { SavedModule } from '@/types/x4'

export interface DashboardPresenterProps {
  workbenchMode: ComputedRef<'overview' | 'station' | 'transit'>
  visualMode: ComputedRef<'planning' | 'live'>
  plannedModules: ComputedRef<SavedModule[]>
  activeModules: ComputedRef<SavedModule[]>
  activeBuildingModules: ComputedRef<SavedModule[]>
  stationAnalysis: ComputedRef<{
    totalCost: number
    totalVolume: number
    totalNeeded: number
    totalCapacity: number
    totalTime: number
    playerHQNeeded: number
    totalWorkerDiff: number
    moduleGroups: any[]
    summaryItems: any[]
  }>
  settings: ComputedRef<{
    transportShipCapacity: number
    workforceAuto: boolean
    manualWorkforce: number
    useHQ: boolean
  }>
  currentEfficiency: ComputedRef<number>
  actualWorkforce: ComputedRef<number>
  buildPriceMultiplier: ComputedRef<number>
}

export interface UseProductionDashboardPresenterReturn {
  props: DashboardPresenterProps
  emits: StationDashboardEmits
}

export function useProductionDashboardPresenter(store: ProductionWorkbenchStoreContract): UseProductionDashboardPresenterReturn {
  const session = computed(() => store.getSessionState())
  const context = computed(() => store.getContextState())
  const props: DashboardPresenterProps = {
    workbenchMode: computed(() => session.value.workbenchMode),
    visualMode: computed(() => session.value.visualMode),
    plannedModules: computed(() => store.getResolvedModules()),
    activeModules: computed(() => {
      if (session.value.visualMode === 'live' && context.value.hasArchive) {
        return context.value.archiveModules
      }
      return store.getResolvedModules()
    }),
    activeBuildingModules: computed(() => {
      if (session.value.visualMode === 'live' && context.value.hasArchive) {
        return context.value.buildingModules
      }
      return []
    }),
    stationAnalysis: computed(() => store.getStationAnalysis()),
    settings: computed(() => store.getDashboardSettings()),
    currentEfficiency: computed(() => store.getCurrentEfficiency()),
    actualWorkforce: computed(() => store.getActualWorkforce()),
    buildPriceMultiplier: computed(() => store.getBuildPriceMultiplier())
  }

  const emits: StationDashboardEmits = {
    updateTransportShipCapacity: (value: number) => store.updateTransportShipCapacity(value),
    updateBuildPriceMultiplier: (value: number) => store.updateBuildPriceMultiplier(value),
    updateManualWorkforce: (value: number) => store.updateManualWorkforce(value),
    updateWorkforceAuto: (value: boolean) => store.updateWorkforceAuto(value),
    updateUseHQ: (value: boolean) => store.updateUseHQ(value)
  }

  return { props, emits }
}

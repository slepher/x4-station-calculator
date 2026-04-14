import { computed, type ComputedRef } from 'vue'
import type { ProductionWorkbenchStoreContract } from '@/types/production-workbench-contract'
import type { StationDashboardEmits } from '@/types/production-ui'
import type { SavedModule } from '@/types/x4'

export interface DashboardPresenterProps {
  plannedModules: ComputedRef<SavedModule[]>
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
  const props: DashboardPresenterProps = {
    plannedModules: computed(() => store.getPlannedModules()),
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
    updateUseHQ: (value: boolean) => {
      console.log('[DashboardPresenter] updateUseHQ called', { value })
      store.updateUseHQ(value)
    }
  }

  return { props, emits }
}
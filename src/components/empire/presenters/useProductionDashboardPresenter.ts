import { computed, type ComputedRef } from 'vue'
import type { ProductionSessionState, ProductionContextState, ProductionStationState } from '@/types/production-workbench-contract'
import type { SavedModule } from '@/types/x4'

const DEFAULT_DASHBOARD_SETTINGS = {
  transportShipCapacity: 62000,
  workforceAuto: true,
  manualWorkforce: 0,
  useHQ: false
}

export interface DashboardPresenterProps {
  workbenchMode: ComputedRef<'overview' | 'station' | 'transit'>
  visualMode: ComputedRef<'planning' | 'live'>
  modules: ComputedRef<SavedModule[]>
  activeModules: ComputedRef<SavedModule[]>
  activeBuildingModules: ComputedRef<SavedModule[]>
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

export interface DashboardPresenterEmits {
  updateTransportShipCapacity: (value: number) => void
  updateBuildPriceMultiplier: (value: number) => void
  updateManualWorkforce: (value: number) => void
  updateWorkforceAuto: (value: boolean) => void
  updateUseHQ: (value: boolean) => void
}

export interface UseProductionDashboardPresenterReturn {
  props: DashboardPresenterProps
  emits: DashboardPresenterEmits
}

export interface DashboardPresenterStore {
  session: ProductionSessionState
  context: ProductionContextState
  stationState: ProductionStationState | null
  settingActions: {
    updateTransportShipCapacity(value: number): void
    updateManualWorkforce(value: number): void
    updateWorkforceAuto(value: boolean): void
    updateUseHQ(value: boolean): void
  }
  updateBuildPriceMultiplier(value: number): void
}

export function useProductionDashboardPresenter(store: DashboardPresenterStore): UseProductionDashboardPresenterReturn {
  const props: DashboardPresenterProps = {
    workbenchMode: computed(() => store.session.workbenchMode),
    visualMode: computed(() => store.session.visualMode),
    modules: computed(() => store.stationState?.resolvedModules || []),
    activeModules: computed(() => {
      if (store.session.visualMode === 'live' && store.context.hasArchive) {
        return store.context.archiveModules
      }
      return store.stationState?.resolvedModules || []
    }),
    activeBuildingModules: computed(() => {
      if (store.session.visualMode === 'live' && store.context.hasArchive) {
        return store.context.buildingModules
      }
      return []
    }),
    settings: computed(() => {
      const s = store.stationState?.settings
      if (!s) return DEFAULT_DASHBOARD_SETTINGS
      const forceAuto = store.session.visualMode === 'live'
      return {
        transportShipCapacity: s.transportShipCapacity,
        workforceAuto: forceAuto ? true : s.workforceAuto,
        manualWorkforce: s.manualWorkforce,
        useHQ: s.useHQ
      }
    }),
    currentEfficiency: computed(() => store.stationState?.currentEfficiency || 0),
    actualWorkforce: computed(() => store.stationState?.actualWorkforce || 0),
    buildPriceMultiplier: computed(() => store.stationState?.buildPriceMultiplier || 0)
  }

  const emits: DashboardPresenterEmits = {
    updateTransportShipCapacity: (value: number) => store.settingActions.updateTransportShipCapacity(value),
    updateBuildPriceMultiplier: (value: number) => store.updateBuildPriceMultiplier(value),
    updateManualWorkforce: (value: number) => store.settingActions.updateManualWorkforce(value),
    updateWorkforceAuto: (value: boolean) => store.settingActions.updateWorkforceAuto(value),
    updateUseHQ: (value: boolean) => store.settingActions.updateUseHQ(value)
  }

  return { props, emits }
}

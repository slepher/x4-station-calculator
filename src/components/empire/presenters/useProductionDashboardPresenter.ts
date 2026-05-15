import { computed, type ComputedRef } from 'vue'
import type { ProductionSessionState, ProductionStationState } from '@/types/production-workbench-contract'
import type { SavedModule } from '@/types/x4'
import type { WareAmount } from '@/types/saveArchive'

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
  effectiveModules: ComputedRef<SavedModule[]>
  buildingCargo: ComputedRef<WareAmount[]>
  buildingReservation: ComputedRef<WareAmount[]>
  isBuildingScope: ComputedRef<boolean>
  buildingInProgress: ComputedRef<SavedModule | undefined>
  settings: ComputedRef<{
    transportShipCapacity: number
    workforceAuto: boolean
    manualWorkforce: number
    useHQ: boolean
  }>
  currentEfficiency: ComputedRef<number>
  actualWorkforce: ComputedRef<number>
  buildPriceMultiplier: ComputedRef<number>
  forceWorkforceAuto: ComputedRef<boolean>
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
  stationState: ProductionStationState | null
  moduleScope?: 'built' | 'building' | 'all'
  settingActions: {
    updateTransportShipCapacity(value: number): void
    updateManualWorkforce(value: number): void
    updateWorkforceAuto(value: boolean): void
    updateUseHQ(value: boolean): void
  }
  updateBuildPriceMultiplier(value: number): void
  buildingInProgress?: SavedModule
}

export function useProductionDashboardPresenter(store: DashboardPresenterStore): UseProductionDashboardPresenterReturn {
  const props: DashboardPresenterProps = {
    workbenchMode: computed(() => store.session.workbenchMode),
    visualMode: computed(() => store.session.visualMode),
    modules: computed(() => store.stationState?.modules || []),
    activeModules: computed(() => store.stationState?.modules || []),
    activeBuildingModules: computed(() => store.stationState?.buildingModules || []),
    effectiveModules: computed(() => {
      const scope = store.moduleScope ?? 'built'
      const modules = store.stationState?.modules || []
      const building = store.stationState?.buildingModules || []
      const inProgress = store.stationState?.buildingInProgress
      if (scope === 'building') {
        if (!inProgress) return building
        return building.reduce<SavedModule[]>((acc, m) => {
          if (m.id === inProgress.id) {
            const remaining = m.count - inProgress.count
            if (remaining > 0) acc.push({ ...m, count: remaining })
          } else {
            acc.push(m)
          }
          return acc
        }, [])
      }
      if (scope === 'all') return [...modules, ...building]
      return modules
    }),
    buildingCargo: computed(() => store.stationState?.buildingCargo || []),
    buildingReservation: computed(() => store.stationState?.buildingReservation || []),
    isBuildingScope: computed(() => store.moduleScope === 'building'),
    buildingInProgress: computed(() => store.stationState?.buildingInProgress || undefined),
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
    buildPriceMultiplier: computed(() => store.stationState?.buildPriceMultiplier || 0),
    forceWorkforceAuto: computed(() => store.session.visualMode === 'live')
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

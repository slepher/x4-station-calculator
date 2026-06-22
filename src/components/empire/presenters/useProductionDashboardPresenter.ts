import { computed, type ComputedRef } from 'vue'
import type { ProductionSessionState, ProductionStationState } from '@/types/production-workbench-contract'
import type { SavedModule } from '@/types/x4'
import type { ArchiveStationData, WareAmount } from '@/types/saveArchive'

const DEFAULT_DASHBOARD_SETTINGS = {
  transportShipCapacity: 62000,
  workforceAuto: true,
  manualWorkforce: 0,
  useHQ: false
}

export interface DashboardPresenterProps {
  workbenchMode: ComputedRef<'overview' | 'station' | 'transit' | 'terraforming' | 'tech-tree' | 'research' | 'blueprint-recipe' | 'auto-sector-group'>
  visualMode: ComputedRef<'planning' | 'live'>
  displayModules: ComputedRef<SavedModule[]>
  workerModules: ComputedRef<SavedModule[]>
  activeModules: ComputedRef<SavedModule[]>
  activeBuildingModules: ComputedRef<SavedModule[]>
  builtScopeModules: ComputedRef<SavedModule[]>
  buildingScopeModules: ComputedRef<SavedModule[]>
  allScopeModules: ComputedRef<SavedModule[]>
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
  archiveStation?: ArchiveStationData | null
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

function subtractSavedModules(source: SavedModule[], base: SavedModule[]): SavedModule[] {
  const baseCounts = new Map(base.map((module) => [module.id, module.count]))
  return source
    .map((module) => ({
      id: module.id,
      count: module.count - (baseCounts.get(module.id) || 0)
    }))
    .filter((module) => module.count > 0)
}

function subtractInProgressModule(modules: SavedModule[], inProgress?: SavedModule): SavedModule[] {
  if (!inProgress) return modules
  return modules.reduce<SavedModule[]>((acc, module) => {
    if (module.id === inProgress.id) {
      const remaining = module.count - inProgress.count
      if (remaining > 0) acc.push({ ...module, count: remaining })
      return acc
    }
    acc.push(module)
    return acc
  }, [])
}

export function useProductionDashboardPresenter(store: DashboardPresenterStore): UseProductionDashboardPresenterReturn {
  const scope = computed(() => store.moduleScope ?? 'built')
  const isPlanningArchiveStation = computed(() => {
    return store.session.workbenchMode === 'station'
      && store.session.visualMode === 'planning'
      && store.stationState?.entityType === 'station'
      && store.archiveStation != null
  })

  const builtScopeModules = computed(() => {
    if (isPlanningArchiveStation.value) return store.stationState?.archiveBuiltModules || []
    return store.stationState?.modules || []
  })

  const buildingScopeModules = computed(() => {
    if (isPlanningArchiveStation.value) {
      return subtractInProgressModule(
        subtractSavedModules(
          store.stationState?.effectiveTargetModules || [],
          store.stationState?.archiveBuiltModules || []
        ),
        store.stationState?.buildingInProgress
      )
    }

    return subtractInProgressModule(
      store.stationState?.buildingModules || [],
      store.stationState?.buildingInProgress
    )
  })

  const allScopeModules = computed(() => {
    if (isPlanningArchiveStation.value) return store.stationState?.effectiveTargetModules || []
    return [...(store.stationState?.modules || []), ...(store.stationState?.buildingModules || [])]
  })

  const props: DashboardPresenterProps = {
    workbenchMode: computed(() => store.session.workbenchMode),
    visualMode: computed(() => store.session.visualMode),
    displayModules: computed(() => {
      if (scope.value === 'building') return buildingScopeModules.value
      if (scope.value === 'all') return allScopeModules.value
      return builtScopeModules.value
    }),
    workerModules: computed(() => {
      if (isPlanningArchiveStation.value) return allScopeModules.value
      return store.stationState?.modules || []
    }),
    activeModules: computed(() => store.stationState?.modules || []),
    activeBuildingModules: computed(() => store.stationState?.buildingModules || []),
    builtScopeModules,
    buildingScopeModules,
    allScopeModules,
    buildingCargo: computed(() => store.stationState?.buildingCargo || []),
    buildingReservation: computed(() => store.stationState?.buildingReservation || []),
    isBuildingScope: computed(() => scope.value === 'building'),
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

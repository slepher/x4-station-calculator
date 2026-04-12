import { computed, type Ref, type ComputedRef } from 'vue'
import type { SavedModule } from '@/types/x4'
import type { StationDashboardProps, StationDashboardEmits } from '@/types/production-ui'

export interface StationAnalysis {
  totalCost: number
  totalVolume: number
  totalNeeded: number
  totalCapacity: number
  totalTime: number
  playerHQNeeded: number
  totalWorkerDiff: number
  moduleGroups: any[]
  summaryItems: any[]
}

export interface UseStationDashboardModelDeps {
  plannedModules: ComputedRef<SavedModule[]>
  stationAnalysis: ComputedRef<StationAnalysis>
  settings: ComputedRef<{
    transportShipCapacity: number
    workforceAuto: boolean
    manualWorkforce: number
    useHQ: boolean
  }>
  currentEfficiency: ComputedRef<number>
  actualWorkforce: ComputedRef<number>
  buildPriceMultiplier: Ref<number>
  plannedModulesOverride?: ComputedRef<SavedModule[] | null>
  hideWorkersView?: boolean
}

export interface UseStationDashboardModelReturn {
  props: ComputedRef<StationDashboardProps>
  emits: StationDashboardEmits
}

export function useStationDashboardModel(deps: UseStationDashboardModelDeps): UseStationDashboardModelReturn {
  const {
    plannedModules,
    stationAnalysis,
    settings,
    currentEfficiency,
    actualWorkforce,
    buildPriceMultiplier,
    plannedModulesOverride,
    hideWorkersView = false
  } = deps

  const props = computed<StationDashboardProps>(() => ({
    plannedModules: plannedModules.value,
    stationAnalysis: {
      totalCost: stationAnalysis.value.totalCost,
      totalVolume: stationAnalysis.value.totalVolume,
      totalNeeded: stationAnalysis.value.totalNeeded,
      totalCapacity: stationAnalysis.value.totalCapacity,
      totalTime: stationAnalysis.value.totalTime,
      playerHQNeeded: stationAnalysis.value.playerHQNeeded,
      totalWorkerDiff: stationAnalysis.value.totalWorkerDiff,
      moduleGroups: stationAnalysis.value.moduleGroups,
      summaryItems: stationAnalysis.value.summaryItems
    },
    settings: {
      transportShipCapacity: settings.value.transportShipCapacity,
      workforceAuto: settings.value.workforceAuto,
      manualWorkforce: settings.value.manualWorkforce,
      useHQ: settings.value.useHQ
    },
    currentEfficiency: currentEfficiency.value,
    actualWorkforce: actualWorkforce.value,
    plannedModulesOverride: plannedModulesOverride?.value ?? null,
    hideWorkersView,
    buildPriceMultiplier: buildPriceMultiplier.value
  }))

  const emits: StationDashboardEmits = {
    updateTransportShipCapacity: (_value: number) => {
      // Handled by parent via settings update
    },
    updateBuildPriceMultiplier: (value: number) => {
      buildPriceMultiplier.value = value
    },
    updateManualWorkforce: (_value: number) => {
      // Handled by parent via settings update
    },
    updateWorkforceAuto: (_value: boolean) => {
      // Handled by parent via settings update
    },
    updateUseHQ: (_value: boolean) => {
      // Handled by parent via settings update
    }
  }

  return {
    props,
    emits
  }
}
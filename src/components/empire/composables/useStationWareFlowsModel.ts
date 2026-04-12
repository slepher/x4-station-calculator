import { computed, type Ref, type ComputedRef } from 'vue'
import type { GroupedFlows, SavedModule } from '@/types/x4'
import type { StationWareFlowsDashboardProps, StationWareFlowsDashboardEmits, WareFlowViewMode } from '@/types/production-ui'

export interface EmpireGapFlows {
  operations: any[]
  supply: any[]
}

export interface UseStationWareFlowsModelDeps {
  viewMode: Ref<WareFlowViewMode>
  groupedFlows: ComputedRef<GroupedFlows>
  settings: ComputedRef<{
    resourceBufferHours: number
    primaryProductBufferHours: number
    secondaryProductBufferHours: number
    buyMultiplier: number
    sellMultiplier: number
    racePreference: string
    showEmpireGaps: boolean
  }>
  empireGaps: ComputedRef<EmpireGapFlows>
  plannedModules: ComputedRef<SavedModule[]>
  wares: ComputedRef<Record<string, any>>
}

export interface UseStationWareFlowsModelReturn {
  props: ComputedRef<StationWareFlowsDashboardProps>
  emits: StationWareFlowsDashboardEmits
}

export function useStationWareFlowsModel(deps: UseStationWareFlowsModelDeps): UseStationWareFlowsModelReturn {
  const {
    viewMode,
    groupedFlows,
    settings,
    empireGaps,
    plannedModules,
    wares
  } = deps

  const props = computed<StationWareFlowsDashboardProps>(() => ({
    viewMode: viewMode.value,
    groupedFlows: groupedFlows.value,
    settings: {
      resourceBufferHours: settings.value.resourceBufferHours,
      primaryProductBufferHours: settings.value.primaryProductBufferHours,
      secondaryProductBufferHours: settings.value.secondaryProductBufferHours,
      buyMultiplier: settings.value.buyMultiplier,
      sellMultiplier: settings.value.sellMultiplier,
      racePreference: settings.value.racePreference,
      showEmpireGaps: settings.value.showEmpireGaps
    },
    empireGaps: {
      operations: empireGaps.value.operations.map((flow: any) => ({
        id: flow.wareId,
        name: flow.name || flow.wareId,
        wareId: flow.wareId,
        netRate: flow.netRate,
        netValue: flow.netValue || 0,
        tier: flow.tier ?? 0,
        contributions: flow.contributions,
        disableAdd: flow.disableAdd ?? false,
        disableRemove: flow.disableRemove ?? false
      })),
      supply: empireGaps.value.supply.map((flow: any) => ({
        id: flow.wareId,
        name: flow.name || flow.wareId,
        wareId: flow.wareId,
        netRate: flow.netRate,
        netValue: flow.netValue || 0,
        tier: flow.tier ?? 0,
        contributions: flow.contributions,
        disableAdd: flow.disableAdd ?? false,
        disableRemove: flow.disableRemove ?? false
      }))
    },
    plannedModules: plannedModules.value,
    wares: wares.value
  }))

  const emits: StationWareFlowsDashboardEmits = {
    updateViewMode: (value: WareFlowViewMode) => {
      viewMode.value = value
    },
    updateResourceBufferHours: (_value: number) => {
      // Handled by parent via settings update
    },
    updatePrimaryProductBufferHours: (_value: number) => {
      // Handled by parent via settings update
    },
    updateSecondaryProductBufferHours: (_value: number) => {
      // Handled by parent via settings update
    },
    updateBuyMultiplier: (_value: number) => {
      // Handled by parent via settings update
    },
    updateSellMultiplier: (_value: number) => {
      // Handled by parent via settings update
    },
    addGapModule: (_wareId: string) => {
      // Handled by parent
    },
    removeGapModule: (_wareId: string) => {
      // Handled by parent
    }
  }

  return {
    props,
    emits
  }
}
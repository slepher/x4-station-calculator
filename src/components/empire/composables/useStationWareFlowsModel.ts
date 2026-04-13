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
  autoModules: ComputedRef<SavedModule[]>
  settings: ComputedRef<{
    resourceBufferHours: number
    primaryProductBufferHours: number
    secondaryProductBufferHours: number
    buyMultiplier: number
    sellMultiplier: number
    racePreference: string
    showEmpireGaps: boolean
    transportMinutes?: number
  }>
  empireGaps: ComputedRef<EmpireGapFlows>
  plannedModules: ComputedRef<SavedModule[]>
  wares: ComputedRef<Record<string, any>>
  modulesMap?: ComputedRef<Record<string, any>>
  isWareLocked?: (wareId: string) => boolean
  getResolvedLevel?: (wareId: string) => number
  isWareOperable?: (wareId: string) => boolean
  isPlannedWare?: (wareId: string) => boolean
  onToggleWareLock?: (wareId: string) => void
  onToggleWarePriority?: (wareId: string) => void
}

export interface UseStationWareFlowsModelReturn {
  props: ComputedRef<StationWareFlowsDashboardProps>
  emits: StationWareFlowsDashboardEmits
}

export function useStationWareFlowsModel(deps: UseStationWareFlowsModelDeps): UseStationWareFlowsModelReturn {
  const {
    viewMode,
    groupedFlows,
    autoModules,
    settings,
    empireGaps,
    plannedModules,
    wares,
    modulesMap,
    isWareLocked,
    getResolvedLevel,
    isWareOperable,
    isPlannedWare,
    onToggleWareLock,
    onToggleWarePriority
  } = deps

  console.log('[useStationWareFlowsModel] deps received', {
    hasIsWareLocked: !!isWareLocked,
    hasGetResolvedLevel: !!getResolvedLevel,
    hasIsWareOperable: !!isWareOperable,
    hasIsPlannedWare: !!isPlannedWare,
    hasOnToggleWareLock: !!onToggleWareLock,
    hasOnToggleWarePriority: !!onToggleWarePriority
  })

  const props = computed<StationWareFlowsDashboardProps>(() => ({
    viewMode: viewMode.value,
    groupedFlows: groupedFlows.value,
    autoModules: autoModules.value,
    settings: {
      resourceBufferHours: settings.value.resourceBufferHours,
      primaryProductBufferHours: settings.value.primaryProductBufferHours,
      secondaryProductBufferHours: settings.value.secondaryProductBufferHours,
      buyMultiplier: settings.value.buyMultiplier,
      sellMultiplier: settings.value.sellMultiplier,
      racePreference: settings.value.racePreference,
      showEmpireGaps: settings.value.showEmpireGaps,
      transportMinutes: settings.value.transportMinutes
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
    wares: wares.value,
    modulesMap: modulesMap?.value,
    isWareLocked,
    getResolvedLevel,
    isWareOperable,
    isPlannedWare,
    onToggleWareLock,
    onToggleWarePriority
  }))

  const emits: StationWareFlowsDashboardEmits = {
    updateViewMode: (value: WareFlowViewMode) => {
      viewMode.value = value
    },
    updateResourceBufferHours: (_value: number) => {
    },
    updatePrimaryProductBufferHours: (_value: number) => {
    },
    updateSecondaryProductBufferHours: (_value: number) => {
    },
    updateBuyMultiplier: (_value: number) => {
    },
    updateSellMultiplier: (_value: number) => {
    },
    addGapModule: (_wareId: string) => {
    },
    removeGapModule: (_wareId: string) => {
    }
  }

  return {
    props,
    emits
  }
}

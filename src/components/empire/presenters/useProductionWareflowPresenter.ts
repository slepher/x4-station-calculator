import { computed, type ComputedRef } from 'vue'
import type { ProductionSessionState, ProductionStationState } from '@/types/production-workbench-contract'
import type { WareFlowViewMode, EmpireGapItem } from '@/types/production-ui'
import type { WareProductionFlow } from '@/types/production-flow'

const DEFAULT_WAREFLOW_SETTINGS = {
  resourceBufferHours: 1.0,
  primaryProductBufferHours: 12.0,
  secondaryProductBufferHours: 2.0,
  buyMultiplier: 0.5,
  sellMultiplier: 0.5,
  racePreference: 'argon',
  showEmpireGaps: false,
  transportMinutes: 30
}

export interface WareflowPresenterProps {
  workbenchMode: ComputedRef<'overview' | 'station' | 'transit'>
  visualMode: ComputedRef<'planning' | 'live'>
  viewMode: ComputedRef<WareFlowViewMode>
  productionFlows: ComputedRef<WareProductionFlow[]>
  warePriorityLevels: ComputedRef<Record<string, number>>
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
  empireGaps: ComputedRef<{ operations: EmpireGapItem[]; supply: EmpireGapItem[] }>
  isWareLocked: (wareId: string) => boolean
  getResolvedLevel: (wareId: string) => number
  isWareOperable: (wareId: string) => boolean
  isPlannedWare: (wareId: string) => boolean
  onToggleWareLock: (wareId: string) => void
  onToggleWarePriority: (wareId: string) => void
}

export interface WareflowPresenterEmits {
  updateViewMode: (value: WareFlowViewMode) => void
  updateResourceBufferHours: (value: number) => void
  updatePrimaryProductBufferHours: (value: number) => void
  updateSecondaryProductBufferHours: (value: number) => void
  updateBuyMultiplier: (value: number) => void
  updateSellMultiplier: (value: number) => void
  addGapModule: (wareId: string) => void
  removeGapModule: (wareId: string) => void
}

export interface UseProductionWareflowPresenterReturn {
  props: WareflowPresenterProps
  emits: WareflowPresenterEmits
}

export interface WareflowPresenterStore {
  session: ProductionSessionState
  stationState: ProductionStationState | null
  settingActions: {
    updateResourceBufferHours(value: number): void
    updatePrimaryProductBufferHours(value: number): void
    updateSecondaryProductBufferHours(value: number): void
    updateBuyMultiplier(value: number): void
    updateSellMultiplier(value: number): void
  }
  wareRuleActions: {
    isWareLocked(wareId: string): boolean
    getResolvedLevel(wareId: string): number
    isWareOperable(wareId: string): boolean
    isPlannedWare(wareId: string): boolean
    toggleWareLock(wareId: string): void
    toggleWarePriority(wareId: string): void
  }
  moduleActions: {
    addModuleByWare(wareId: string): void
    removeModuleByWare(wareId: string): void
  }
  updateWareflowViewMode(value: WareFlowViewMode): void
}

export function useProductionWareflowPresenter(store: WareflowPresenterStore): UseProductionWareflowPresenterReturn {
  const props: WareflowPresenterProps = {
    workbenchMode: computed(() => store.session.workbenchMode),
    visualMode: computed(() => store.session.visualMode),
    viewMode: computed(() => store.session.wareflowViewMode),
    productionFlows: computed(() => store.stationState?.productionFlows || []),
    warePriorityLevels: computed(() => store.stationState?.warePriorityLevels || {}),
    settings: computed(() => {
      const s = store.stationState?.settings
      if (!s) return DEFAULT_WAREFLOW_SETTINGS
      return {
        resourceBufferHours: s.resourceBufferHours,
        primaryProductBufferHours: s.primaryProductBufferHours,
        secondaryProductBufferHours: s.secondaryProductBufferHours,
        buyMultiplier: s.buyMultiplier,
        sellMultiplier: s.sellMultiplier,
        racePreference: s.racePreference,
        showEmpireGaps: store.session.visualMode === 'live' ? false : s.showEmpireGaps ?? false,
        transportMinutes: s.transportMinutes
      }
    }),
    empireGaps: computed(() => store.stationState?.empireGaps || { operations: [], supply: [] }),
    isWareLocked: (wareId: string) => store.wareRuleActions.isWareLocked(wareId),
    getResolvedLevel: (wareId: string) => store.wareRuleActions.getResolvedLevel(wareId),
    isWareOperable: (wareId: string) => store.wareRuleActions.isWareOperable(wareId),
    isPlannedWare: (wareId: string) => store.wareRuleActions.isPlannedWare(wareId),
    onToggleWareLock: (wareId: string) => store.wareRuleActions.toggleWareLock(wareId),
    onToggleWarePriority: (wareId: string) => store.wareRuleActions.toggleWarePriority(wareId)
  }

  const emits: WareflowPresenterEmits = {
    updateViewMode: (value: WareFlowViewMode) => store.updateWareflowViewMode(value),
    updateResourceBufferHours: (value: number) => store.settingActions.updateResourceBufferHours(value),
    updatePrimaryProductBufferHours: (value: number) => store.settingActions.updatePrimaryProductBufferHours(value),
    updateSecondaryProductBufferHours: (value: number) => store.settingActions.updateSecondaryProductBufferHours(value),
    updateBuyMultiplier: (value: number) => store.settingActions.updateBuyMultiplier(value),
    updateSellMultiplier: (value: number) => store.settingActions.updateSellMultiplier(value),
    addGapModule: (wareId: string) => store.moduleActions.addModuleByWare(wareId),
    removeGapModule: (wareId: string) => store.moduleActions.removeModuleByWare(wareId)
  }

  return { props, emits }
}

import { computed, type ComputedRef } from 'vue'
import type { ProductionSessionState, ProductionStationState } from '@/types/production-workbench-contract'
import type { WareFlowViewMode, EmpireGapItem } from '@/types/production-ui'
import type { WareProductionFlow } from '@/types/production-flow'

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
  getWareflowViewMode(): WareFlowViewMode
  getWareflowSettings(): {
    resourceBufferHours: number
    primaryProductBufferHours: number
    secondaryProductBufferHours: number
    buyMultiplier: number
    sellMultiplier: number
    racePreference: string
    showEmpireGaps: boolean
    transportMinutes?: number
  }
  getEmpireGaps(): { operations: EmpireGapItem[]; supply: EmpireGapItem[] }
  isWareLocked(wareId: string): boolean
  getResolvedLevel(wareId: string): number
  isWareOperable(wareId: string): boolean
  isPlannedWare(wareId: string): boolean
  toggleWareLock(wareId: string): void
  toggleWarePriority(wareId: string): void
  updateWareflowViewMode(value: WareFlowViewMode): void
  updateTransitHubSettings(patch: any): void
  updateResourceBufferHours(value: number): void
  updatePrimaryProductBufferHours(value: number): void
  updateSecondaryProductBufferHours(value: number): void
  updateBuyMultiplier(value: number): void
  updateSellMultiplier(value: number): void
  addWareModule(wareId: string): void
  removeWareModule(wareId: string): void
}

export function useProductionWareflowPresenter(store: WareflowPresenterStore): UseProductionWareflowPresenterReturn {
  const props: WareflowPresenterProps = {
    workbenchMode: computed(() => store.session.workbenchMode),
    visualMode: computed(() => store.session.visualMode),
    viewMode: computed(() => store.getWareflowViewMode()),
    productionFlows: computed(() => store.stationState?.productionFlows || []),
    warePriorityLevels: computed(() => store.stationState?.warePriorityLevels || {}),
    settings: computed(() => store.getWareflowSettings()),
    empireGaps: computed(() => store.getEmpireGaps()),
    isWareLocked: (wareId: string) => store.isWareLocked(wareId),
    getResolvedLevel: (wareId: string) => store.getResolvedLevel(wareId),
    isWareOperable: (wareId: string) => store.isWareOperable(wareId),
    isPlannedWare: (wareId: string) => store.isPlannedWare(wareId),
    onToggleWareLock: (wareId: string) => store.toggleWareLock(wareId),
    onToggleWarePriority: (wareId: string) => store.toggleWarePriority(wareId)
  }

  const emits: WareflowPresenterEmits = {
    updateViewMode: (value: WareFlowViewMode) => store.updateWareflowViewMode(value),
    updateResourceBufferHours: (value: number) => {
      if (store.session.workbenchMode === 'transit') store.updateTransitHubSettings({ resourceBufferHours: value })
      else store.updateResourceBufferHours(value)
    },
    updatePrimaryProductBufferHours: (value: number) => {
      if (store.session.workbenchMode === 'transit') store.updateTransitHubSettings({ primaryProductBufferHours: value })
      else store.updatePrimaryProductBufferHours(value)
    },
    updateSecondaryProductBufferHours: (value: number) => {
      if (store.session.workbenchMode === 'transit') store.updateTransitHubSettings({ secondaryProductBufferHours: value })
      else store.updateSecondaryProductBufferHours(value)
    },
    updateBuyMultiplier: (value: number) => {
      if (store.session.workbenchMode === 'transit') store.updateTransitHubSettings({ buyMultiplier: value })
      else store.updateBuyMultiplier(value)
    },
    updateSellMultiplier: (value: number) => {
      if (store.session.workbenchMode === 'transit') store.updateTransitHubSettings({ sellMultiplier: value })
      else store.updateSellMultiplier(value)
    },
    addGapModule: (wareId: string) => store.addWareModule(wareId),
    removeGapModule: (wareId: string) => store.removeWareModule(wareId)
  }

  return { props, emits }
}

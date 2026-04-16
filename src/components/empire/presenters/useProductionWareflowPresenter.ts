import { computed, type ComputedRef } from 'vue'
import type { ProductionWorkbenchStoreContract } from '@/types/production-workbench-contract'
import type { StationWareFlowsDashboardEmits, WareFlowViewMode, EmpireGapItem } from '@/types/production-ui'
import type { WareProductionFlow } from '@/types/production-flow'
import type { SupplyStorageFlow, TransitHubGroupedFlows } from '@/types/x4'

export interface WareflowPresenterProps {
  workbenchMode: ComputedRef<'overview' | 'station' | 'transit'>
  visualMode: ComputedRef<'planning' | 'live'>
  viewMode: ComputedRef<WareFlowViewMode>
  productionFlows: ComputedRef<WareProductionFlow[]>
  groupedFlows: ComputedRef<TransitHubGroupedFlows>
  storageFlows: ComputedRef<SupplyStorageFlow[]>
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

export interface UseProductionWareflowPresenterReturn {
  props: WareflowPresenterProps
  emits: StationWareFlowsDashboardEmits
}

export function useProductionWareflowPresenter(store: ProductionWorkbenchStoreContract): UseProductionWareflowPresenterReturn {
  const session = computed(() => store.getSessionState())
  const transitState = computed(() => store.getTransitState())
  const props: WareflowPresenterProps = {
    workbenchMode: computed(() => session.value.workbenchMode),
    visualMode: computed(() => session.value.visualMode),
    viewMode: computed(() => store.getWareflowViewMode()),
    productionFlows: computed(() => store.getProductionFlows()),
    groupedFlows: computed(() => transitState.value.groupedFlows),
    storageFlows: computed(() => transitState.value.storageFlows),
    warePriorityLevels: computed(() => store.getWarePriorityLevels()),
    settings: computed(() => store.getWareflowSettings()),
    empireGaps: computed(() => store.getEmpireGaps()),
    isWareLocked: (wareId: string) => store.isWareLocked(wareId),
    getResolvedLevel: (wareId: string) => store.getResolvedLevel(wareId),
    isWareOperable: (wareId: string) => store.isWareOperable(wareId),
    isPlannedWare: (wareId: string) => store.isPlannedWare(wareId),
    onToggleWareLock: (wareId: string) => store.toggleWareLock(wareId),
    onToggleWarePriority: (wareId: string) => store.toggleWarePriority(wareId)
  }

  const emits: StationWareFlowsDashboardEmits = {
    updateViewMode: (value: WareFlowViewMode) => store.updateWareflowViewMode(value),
    updateResourceBufferHours: (value: number) => {
      if (session.value.workbenchMode === 'transit') store.updateTransitHubSettings({ resourceBufferHours: value })
      else store.updateResourceBufferHours(value)
    },
    updatePrimaryProductBufferHours: (value: number) => {
      if (session.value.workbenchMode === 'transit') store.updateTransitHubSettings({ primaryProductBufferHours: value })
      else store.updatePrimaryProductBufferHours(value)
    },
    updateSecondaryProductBufferHours: (value: number) => {
      if (session.value.workbenchMode === 'transit') store.updateTransitHubSettings({ secondaryProductBufferHours: value })
      else store.updateSecondaryProductBufferHours(value)
    },
    updateBuyMultiplier: (value: number) => {
      if (session.value.workbenchMode === 'transit') store.updateTransitHubSettings({ buyMultiplier: value })
      else store.updateBuyMultiplier(value)
    },
    updateSellMultiplier: (value: number) => {
      if (session.value.workbenchMode === 'transit') store.updateTransitHubSettings({ sellMultiplier: value })
      else store.updateSellMultiplier(value)
    },
    addGapModule: (wareId: string) => store.addModule('', { source: 'gap', wareId }),
    removeGapModule: (wareId: string) => store.removeModule({ moduleId: '', source: 'gap', wareId })
  }

  return { props, emits }
}

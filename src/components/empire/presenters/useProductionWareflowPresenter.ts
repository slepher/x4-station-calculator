import { computed, type ComputedRef } from 'vue'
import type { ProductionWorkbenchStoreContract } from '@/types/production-workbench-contract'
import type { StationWareFlowsDashboardEmits, WareFlowViewMode, EmpireGapItem } from '@/types/production-ui'
import type { SavedModule, GroupedFlows } from '@/types/x4'

export interface WareflowPresenterProps {
  viewMode: ComputedRef<WareFlowViewMode>
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
  empireGaps: ComputedRef<{ operations: EmpireGapItem[]; supply: EmpireGapItem[] }>
  plannedModules: ComputedRef<SavedModule[]>
  wares: ComputedRef<Record<string, any>>
  modulesMap: ComputedRef<Record<string, any> | undefined>
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
  const props: WareflowPresenterProps = {
    viewMode: computed(() => store.getWareflowViewMode()),
    groupedFlows: computed(() => store.getGroupedFlows()),
    autoModules: computed(() => store.getAutoModules()),
    settings: computed(() => store.getWareflowSettings()),
    empireGaps: computed(() => store.getEmpireGaps()),
    plannedModules: computed(() => store.getPlannedModules()),
    wares: computed(() => store.getWares()),
    modulesMap: computed(() => store.getModulesMap()),
    isWareLocked: (wareId: string) => store.isWareLocked(wareId),
    getResolvedLevel: (wareId: string) => store.getResolvedLevel(wareId),
    isWareOperable: (wareId: string) => store.isWareOperable(wareId),
    isPlannedWare: (wareId: string) => store.isPlannedWare(wareId),
    onToggleWareLock: (wareId: string) => store.toggleWareLock(wareId),
    onToggleWarePriority: (wareId: string) => store.toggleWarePriority(wareId)
  }

  const emits: StationWareFlowsDashboardEmits = {
    updateViewMode: (value: WareFlowViewMode) => store.updateWareflowViewMode(value),
    updateResourceBufferHours: (value: number) => store.updateResourceBufferHours(value),
    updatePrimaryProductBufferHours: (value: number) => store.updatePrimaryProductBufferHours(value),
    updateSecondaryProductBufferHours: (value: number) => store.updateSecondaryProductBufferHours(value),
    updateBuyMultiplier: (value: number) => store.updateBuyMultiplier(value),
    updateSellMultiplier: (value: number) => store.updateSellMultiplier(value),
    addGapModule: (wareId: string) => store.addModule('', { source: 'gap', wareId }),
    removeGapModule: (wareId: string) => store.removeModule({ moduleId: '', source: 'gap', wareId })
  }

  return { props, emits }
}
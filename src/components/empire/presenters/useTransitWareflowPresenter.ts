import { computed, type ComputedRef } from 'vue'
import type { TransitPresenterContract } from '@/types/transit-presenter-contract'
import type { EmpireGroupedFlows } from '@/types/x4'
import type { SolveMultiWareByLinkOutput } from '@/store/logic/sectorLinkFlow'
import type { WareFlowViewMode } from '@/types/production-ui'

export interface TransitWareflowPresenterProps {
  sectorId: ComputedRef<string | null>
  localGroupedFlows: ComputedRef<EmpireGroupedFlows | null>
  solverOutput: ComputedRef<SolveMultiWareByLinkOutput | null>
  mode: ComputedRef<'planning' | 'live'>
  visualMode: ComputedRef<'planning' | 'live'>
  viewMode: ComputedRef<WareFlowViewMode>
  buyMultiplier: ComputedRef<number>
  sellMultiplier: ComputedRef<number>
  productBufferHours: ComputedRef<number>
}

export interface TransitWareflowPresenterEmits {
  updateViewMode: (value: WareFlowViewMode) => void
  updateBuyMultiplier: (value: number) => void
  updateSellMultiplier: (value: number) => void
  updateProductBufferHours: (value: number) => void
}

export interface UseTransitWareflowPresenterReturn {
  props: TransitWareflowPresenterProps
  emits: TransitWareflowPresenterEmits
}

export function useTransitWareflowPresenter(store: TransitPresenterContract): UseTransitWareflowPresenterReturn {
  const sectorId = computed(() => store.getActiveTransitSectorId())
  const mode = computed(() => store.getTransitMode())
  const hasArchiveTradeStation = computed(() => store.getTransitHasArchiveTradeStation())

  const activeSource = computed(() => store.getActiveTransitPanelSource(sectorId.value))

  const visualMode = computed<'planning' | 'live'>(() => activeSource.value.liveVisualState)

  const localGroupedFlows = computed(() => {
    if (mode.value === 'live' && hasArchiveTradeStation.value) {
      return activeSource.value.live.localGroupedFlows
    }
    return activeSource.value.planning.localGroupedFlows
  })

  const solverOutput = computed(() => {
    if (mode.value === 'live' && hasArchiveTradeStation.value) {
      return activeSource.value.live.solverOutput
    }
    return activeSource.value.planning.solverOutput
  })

  const transitSettings = computed(() => store.getTransitSettings())
  const globalSettings = computed(() => store.getGlobalSettings())

  const viewMode = computed<WareFlowViewMode>(() => 'quantity')
  const buyMultiplier = computed(() => transitSettings.value.buyMultiplier ?? globalSettings.value.buyMultiplier ?? 0.5)
  const sellMultiplier = computed(() => transitSettings.value.sellMultiplier ?? globalSettings.value.sellMultiplier ?? 0.5)
  const productBufferHours = computed(() => transitSettings.value.primaryProductBufferHours ?? globalSettings.value.primaryProductBufferHours ?? 12)

  const props: TransitWareflowPresenterProps = {
    sectorId,
    localGroupedFlows,
    solverOutput,
    mode,
    visualMode,
    viewMode,
    buyMultiplier,
    sellMultiplier,
    productBufferHours
  }

  const emits: TransitWareflowPresenterEmits = {
    updateViewMode: (_value: WareFlowViewMode) => {},
    updateBuyMultiplier: (value: number) => store.updateTransitHubSettings({ buyMultiplier: value }),
    updateSellMultiplier: (value: number) => store.updateTransitHubSettings({ sellMultiplier: value }),
    updateProductBufferHours: (value: number) => store.updateTransitHubSettings({ primaryProductBufferHours: value })
  }

  return { props, emits }
}
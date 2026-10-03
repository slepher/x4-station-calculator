import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { useActiveViewStore } from './useActiveViewStore'
import type { TradeReady, TradeUnavailable } from './logic/tradeAutoFill'

interface TradeFillRequest {
  id: number
  contextKey: string
  revision: number
  bindingGameGuid: string | null
  source: 'button' | 'automatic'
}
interface TradeFillOwnership {
  contextKey: string
  result: TradeReady
  adjusted: boolean
}
import type {
  NpcTradeRankMode,
  NpcTradeSortMetric,
  PlayerTradeDirection,
  WareTarget
} from './logic/npcTradeOffers'

export const useNpcTradeStore = defineStore('npcTrade', () => {
  const direction = ref<PlayerTradeDirection>('sell')
  const bindingGameGuid = ref<string | null>(null)
  const selectedPlayerStationGroupId = ref<string | null>(null)
  const selectedPlayerStationId = ref<string | null>(null)
  const jumpLimit = ref(5)
  const targets = ref<WareTarget[]>([])
  const primaryWareId = ref<string | null>(null)
  const rankMode = ref<NpcTradeRankMode>('primary')
  const sortMetric = ref<NpcTradeSortMetric>('quantity')

  const autoFillEnabled = ref(false)
  const targetRevision = ref(0)
  const observedContextKey = ref<string | null>(null)
  const pendingFill = ref<TradeFillRequest | null>(null)
  const lastFill = ref<TradeFillOwnership | null>(null)
  const fillFailure = ref<{ contextKey: string; result: TradeUnavailable } | null>(null)
  const fillUndo = ref<{
    contextKey: string
    targets: WareTarget[]
    primaryWareId: string | null
    ownership: TradeFillOwnership | null
  } | null>(null)
  let fillRequestId = 0

  function requestFill(contextKey: string, source: 'button' | 'automatic'): void {
    pendingFill.value = { id: ++fillRequestId, contextKey, revision: targetRevision.value, bindingGameGuid: bindingGameGuid.value, source }
    fillFailure.value = null
  }

  function observeContext(contextKey: string): void {
    if (observedContextKey.value === contextKey) return
    observedContextKey.value = contextKey
    pendingFill.value = null
    fillUndo.value = null
    fillFailure.value = null
    if (autoFillEnabled.value) requestFill(contextKey, 'automatic')
  }

  function setAutoFillEnabled(enabled: boolean): void {
    if (autoFillEnabled.value === enabled) return
    autoFillEnabled.value = enabled
    if (enabled && observedContextKey.value !== null) requestFill(observedContextKey.value, 'automatic')
    if (!enabled && pendingFill.value?.source === 'automatic') pendingFill.value = null
  }

  function applyFill(requestId: number, contextKey: string, result: TradeReady): boolean {
    const request = pendingFill.value
    if (request === null || request.id !== requestId || request.contextKey !== contextKey
      || observedContextKey.value !== contextKey || request.revision !== targetRevision.value
      || request.bindingGameGuid !== bindingGameGuid.value) return false
    fillUndo.value = {
      contextKey, targets: targets.value.map(t => ({ ...t })), primaryWareId: primaryWareId.value,
      ownership: lastFill.value === null ? null : { ...lastFill.value }
    }
    targets.value = result.targets.map(t => ({ ...t }))
    if (!targets.value.some(t => t.wareId === primaryWareId.value)) {
      primaryWareId.value = targets.value.length === 0 ? null : targets.value[0]!.wareId
    }
    targetRevision.value++
    lastFill.value = { contextKey, result, adjusted: false }
    pendingFill.value = null
    fillFailure.value = null
    return true
  }

  function rejectFill(requestId: number, contextKey: string, result: TradeUnavailable): void {
    const request = pendingFill.value
    if (request !== null && request.id === requestId && request.contextKey === contextKey
      && observedContextKey.value === contextKey && request.revision === targetRevision.value) {
      fillFailure.value = { contextKey, result }
    }
  }

  function undoFill(contextKey: string): void {
    const undo = fillUndo.value
    if (undo === null || undo.contextKey !== contextKey || observedContextKey.value !== contextKey) return
    targets.value = undo.targets.map(t => ({ ...t }))
    primaryWareId.value = undo.primaryWareId
    lastFill.value = undo.ownership
    fillUndo.value = null
    pendingFill.value = null
    fillFailure.value = null
    targetRevision.value++
  }

  function markTargetsEdited(): void {
    targetRevision.value++
    pendingFill.value = null
    fillUndo.value = null
    fillFailure.value = null
    if (lastFill.value !== null) lastFill.value.adjusted = true
  }

  function addWare(wareId: string): void {
    if (targets.value.some(t => t.wareId === wareId)) return
    targets.value.push({ wareId, targetQty: null })
    if (primaryWareId.value === null) primaryWareId.value = wareId
    markTargetsEdited()
  }

  function updateTargetQty(wareId: string, value: number | null): void {
    const target = targets.value.find(t => t.wareId === wareId)
    const qty = value === null || value <= 0 ? null : value
    if (target === undefined || target.targetQty === qty) return
    target.targetQty = qty
    markTargetsEdited()
  }

  function removeWare(wareId: string): void {
    if (!targets.value.some(t => t.wareId === wareId)) return
    targets.value = targets.value.filter(t => t.wareId !== wareId)
    if (primaryWareId.value === wareId) primaryWareId.value = targets.value.length === 0 ? null : targets.value[0]!.wareId
    markTargetsEdited()
  }

  function setBindingGameGuid(gameGuid: string | null): void {
    if (bindingGameGuid.value === gameGuid) return
    bindingGameGuid.value = gameGuid
    selectedPlayerStationGroupId.value = null
    selectedPlayerStationId.value = null
    autoFillEnabled.value = false
    observedContextKey.value = null
    pendingFill.value = null
    lastFill.value = null
    fillFailure.value = null
    fillUndo.value = null
  }

  const activeViewStore = useActiveViewStore()
  watch(() => activeViewStore.activeBinding, gameGuid => { setBindingGameGuid(gameGuid) }, { immediate: true, flush: 'sync' })

  return {
    direction,
    bindingGameGuid,
    selectedPlayerStationGroupId,
    selectedPlayerStationId,
    jumpLimit,
    targets,
    primaryWareId,
    rankMode,
    sortMetric,
    setBindingGameGuid,
    autoFillEnabled,
    targetRevision,
    observedContextKey,
    pendingFill,
    lastFill,
    fillFailure,
    fillUndo,
    requestFill,
    observeContext,
    setAutoFillEnabled,
    applyFill,
    rejectFill,
    undoFill,
    addWare,
    updateTargetQty,
    removeWare
  }
})

import { defineStore } from 'pinia'
import { ref } from 'vue'
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

  function setBindingGameGuid(gameGuid: string | null): void {
    if (bindingGameGuid.value === gameGuid) return
    bindingGameGuid.value = gameGuid
    selectedPlayerStationGroupId.value = null
    selectedPlayerStationId.value = null
  }

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
    setBindingGameGuid
  }
})

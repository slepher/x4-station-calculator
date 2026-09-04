import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useNpcTradeStore } from '@/store/useNpcTradeStore'

describe('NPC trade page state', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('keeps selections while the application session is alive', () => {
    const store = useNpcTradeStore()
    store.direction = 'buy'
    store.selectedPlayerStationGroupId = 'sector-a'
    store.selectedPlayerStationId = 'station-a'
    store.jumpLimit = 7
    store.targets = [{ wareId: 'claytronics', targetQty: 7336 }]
    store.primaryWareId = 'claytronics'
    store.rankMode = 'composite'
    store.sortMetric = 'targetTotal'
    store.groupBySector = true

    expect(useNpcTradeStore().$state).toEqual(store.$state)
  })
})

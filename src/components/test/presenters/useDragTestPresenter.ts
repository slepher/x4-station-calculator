import { computed } from 'vue'
import { useDragTestStore } from '@/store/useDragTestStore'

export function useDragTestPresenter() {
  const store = useDragTestStore()
  return {
    debugStore: store,
    items: computed(() => store.items),
    zoneAItems: computed(() => store.zoneAItems),
    zoneBItems: computed(() => store.zoneBItems),
    events: computed(() => store.events),
    isDragging: computed(() => store.isDragging),
    draggingItemId: computed(() => store.draggingItemId),
    hoveredZoneId: computed(() => store.hoveredZoneId),
    isZoneBLocked: computed(() => store.isZoneBLocked),
    zoneBLineage: computed(() => store.zoneBLineage),
    getDropStatus: store.getDropStatus,
    startDragging: store.startDragging,
    stopDragging: store.stopDragging,
    enterZone: store.enterZone,
    overZone: store.overZone,
    leaveZone: store.leaveZone,
    clearHover: store.clearHover,
    moveItem: store.moveItem,
    addAutoItem: store.addAutoItem,
    addIsolatedItem: store.addIsolatedItem,
    setZoneBLocked: store.setZoneBLocked,
    resetState: store.resetState,
    getEventHistory: store.getEventHistory,
  }
}

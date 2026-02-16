import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface DragTestItem {
  id: string
  name: string
  zone: 'A' | 'B'
  lineage?: string
  isAuto?: boolean
  isIsolated?: boolean
}

export interface DragEvent {
  type: 'dragstart' | 'dragenter' | 'dragleave' | 'dragover' | 'drop' | 'dragend'
  itemId?: string
  zoneId?: string
  timestamp: number
}

export type DropStatus = 'normal' | 'duplicated' | 'auto' | 'isolate' | 'locked' | 'rejected'

export const useDragTestStore = defineStore('dragTest', () => {
  const items = ref<DragTestItem[]>([
    { id: 'item-1', name: 'Item 1', zone: 'A' },
    { id: 'item-2', name: 'Item 2', zone: 'A' },
    { id: 'item-3', name: 'Item 3', zone: 'A' },
    { id: 'item-4', name: 'Item 4', zone: 'A', lineage: 'terran' },
    { id: 'item-5', name: 'Item 5', zone: 'A', lineage: 'argon' },
  ])

  const events = ref<DragEvent[]>([])
  const isDragging = ref(false)
  const draggingItemId = ref<string | null>(null)
  const hoveredZoneId = ref<string | null>(null)
  const isZoneBLocked = ref(false)
  const zoneBLineage = ref<string>('terran')

  const zoneAItems = computed(() => items.value.filter(item => item.zone === 'A'))
  const zoneBItems = computed(() => items.value.filter(item => item.zone === 'B'))

  const zoneAItemIds = computed(() => new Set(zoneAItems.value.map(item => item.id)))
  const zoneBItemIds = computed(() => new Set(zoneBItems.value.map(item => item.id)))

  function getDropStatus(itemId: string, targetZone: 'A' | 'B'): DropStatus {
    const item = items.value.find(i => i.id === itemId)
    if (!item) return 'normal'

    if (targetZone === 'A') return 'normal'

    const targetItems = zoneBItems.value
    const existingItem = targetItems.find(i => i.id === itemId)

    if (existingItem) {
      if (existingItem.isIsolated) return 'isolate'
      if (existingItem.isAuto) return 'auto'
      return 'duplicated'
    }

    if (isZoneBLocked.value && item.lineage) {
      if (item.lineage !== zoneBLineage.value) return 'rejected'
      return 'locked'
    }

    return 'normal'
  }

  function recordEvent(type: DragEvent['type'], itemId?: string, zoneId?: string) {
    events.value.push({
      type,
      itemId,
      zoneId,
      timestamp: Date.now()
    })
  }

  function startDragging(itemId: string) {
    isDragging.value = true
    draggingItemId.value = itemId
    recordEvent('dragstart', itemId)
  }

  function stopDragging() {
    if (draggingItemId.value) {
      recordEvent('dragend', draggingItemId.value)
    }
    isDragging.value = false
    draggingItemId.value = null
    hoveredZoneId.value = null
  }

  function enterZone(zoneId: string) {
    hoveredZoneId.value = zoneId
    recordEvent('dragenter', draggingItemId.value ?? undefined, zoneId)
  }

  function leaveZone(zoneId: string) {
    if (hoveredZoneId.value === zoneId) {
      hoveredZoneId.value = null
    }
    recordEvent('dragleave', draggingItemId.value ?? undefined, zoneId)
  }

  function moveItem(itemId: string, targetZone: 'A' | 'B'): boolean {
    const status = getDropStatus(itemId, targetZone)
    
    if (status === 'duplicated' || status === 'rejected') {
      return false
    }

    const item = items.value.find(i => i.id === itemId)
    if (!item) return false

    if (status === 'auto') {
      const existingItem = items.value.find(i => i.id === itemId && i.zone === targetZone)
      if (existingItem) {
        existingItem.isAuto = false
      }
    } else if (status === 'isolate') {
      const existingItem = items.value.find(i => i.id === itemId && i.zone === targetZone)
      if (existingItem) {
        existingItem.isIsolated = false
      }
    } else {
      item.zone = targetZone
    }

    recordEvent('drop', itemId, targetZone)
    return true
  }

  function addAutoItem(itemId: string, name: string, zone: 'A' | 'B') {
    const existing = items.value.find(i => i.id === itemId && i.zone === zone)
    if (!existing) {
      items.value.push({
        id: itemId,
        name,
        zone,
        isAuto: true
      })
    }
  }

  function addIsolatedItem(itemId: string, name: string, zone: 'A' | 'B') {
    const existing = items.value.find(i => i.id === itemId && i.zone === zone)
    if (!existing) {
      items.value.push({
        id: itemId,
        name,
        zone,
        isIsolated: true
      })
    }
  }

  function setZoneBLocked(locked: boolean, lineage: string = 'terran') {
    isZoneBLocked.value = locked
    zoneBLineage.value = lineage
  }

  function getEventHistory(): DragEvent[] {
    return [...events.value]
  }

  function clearEventHistory() {
    events.value = []
  }

  function resetState() {
    items.value = [
      { id: 'item-1', name: 'Item 1', zone: 'A' },
      { id: 'item-2', name: 'Item 2', zone: 'A' },
      { id: 'item-3', name: 'Item 3', zone: 'A' },
      { id: 'item-4', name: 'Item 4', zone: 'A', lineage: 'terran' },
      { id: 'item-5', name: 'Item 5', zone: 'A', lineage: 'argon' },
    ]
    events.value = []
    isDragging.value = false
    draggingItemId.value = null
    hoveredZoneId.value = null
    isZoneBLocked.value = false
    zoneBLineage.value = 'terran'
  }

  return {
    items,
    events,
    isDragging,
    draggingItemId,
    hoveredZoneId,
    isZoneBLocked,
    zoneBLineage,
    zoneAItems,
    zoneBItems,
    zoneAItemIds,
    zoneBItemIds,
    getDropStatus,
    recordEvent,
    startDragging,
    stopDragging,
    enterZone,
    leaveZone,
    moveItem,
    addAutoItem,
    addIsolatedItem,
    setZoneBLocked,
    getEventHistory,
    clearEventHistory,
    resetState
  }
})

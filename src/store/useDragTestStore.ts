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
  const initialItems: DragTestItem[] = [
    { id: 'item-1', name: 'Item 1', zone: 'A' },
    { id: 'item-2', name: 'Item 2', zone: 'A' },
    { id: 'item-3', name: 'Item 3', zone: 'A' },
    { id: 'item-4', name: 'Item 4', zone: 'A', lineage: 'terran' },
    { id: 'item-5', name: 'Item 5', zone: 'A', lineage: 'argon' },
  ]
  const items = ref<DragTestItem[]>(initialItems.map(item => ({ ...item })))

  const events = ref<DragEvent[]>([])
  const isDragging = ref(false)
  const draggingItemId = ref<string | null>(null)
  const hoveredZoneId = ref<string | null>(null)
  const draggingSnapshot = ref<DragTestItem | null>(null)
  const itemsSnapshot = ref<DragTestItem[]>([])
  const dropCommitted = ref(false)
  const isZoneBLocked = ref(false)
  const zoneBLineage = ref<string>('terran')

  const zoneAItems = computed(() => items.value.filter(item => item.zone === 'A'))
  const zoneBItems = computed(() => items.value.filter(item => item.zone === 'B'))

  const zoneAItemIds = computed(() => new Set(zoneAItems.value.map(item => item.id)))
  const zoneBItemIds = computed(() => new Set(zoneBItems.value.map(item => item.id)))

  function getDropStatus(itemId: string, targetZone: 'A' | 'B'): DropStatus {
    const sourceItems = isDragging.value && itemsSnapshot.value.length > 0 ? itemsSnapshot.value : items.value
    const item = sourceItems.find(i => i.id === itemId)
    if (!item) return 'normal'

    if (targetZone === 'A') return 'normal'

    const targetItems = sourceItems.filter(i => i.zone === 'B')
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
    itemsSnapshot.value = items.value.map(item => ({ ...item }))
    const source = items.value.find(item => item.id === itemId) ?? initialItems.find(item => item.id === itemId)
    draggingSnapshot.value = source ? { ...source } : null
    dropCommitted.value = false
    recordEvent('dragstart', itemId)
  }

  function stopDragging() {
    const itemId = draggingItemId.value ?? draggingSnapshot.value?.id
    const sourceStillPresent = draggingSnapshot.value
      ? items.value.some(item => item.id === draggingSnapshot.value?.id)
      : true
    if (!dropCommitted.value || !sourceStillPresent) items.value = itemsSnapshot.value.map(item => ({ ...item }))
    if (itemId) recordEvent('dragend', itemId)
    isDragging.value = false
    draggingItemId.value = null
    hoveredZoneId.value = null
    draggingSnapshot.value = null
    dropCommitted.value = false
  }

  function enterZone(zoneId: string) {
    hoveredZoneId.value = zoneId
    recordEvent('dragenter', draggingItemId.value ?? undefined, zoneId)
  }

  function overZone(zoneId: string) {
    recordEvent('dragover', draggingItemId.value ?? undefined, zoneId)
  }

  function leaveZone(zoneId: string) {
    if (hoveredZoneId.value === zoneId) {
      hoveredZoneId.value = null
    }
    recordEvent('dragleave', draggingItemId.value ?? undefined, zoneId)
  }

  function clearHover() {
    hoveredZoneId.value = null
  }

  function moveItem(itemId: string, targetZone: 'A' | 'B'): boolean {
    if (!hoveredZoneId.value || hoveredZoneId.value !== targetZone || !draggingSnapshot.value) return false
    const status = getDropStatus(itemId, targetZone)
    
    if (status === 'duplicated' || status === 'rejected') {
      return false
    }

    const nextItems = itemsSnapshot.value.map(item => ({ ...item }))
    const sourceIndex = nextItems.findIndex(i => i.id === itemId && i.zone !== targetZone)
    const item = sourceIndex >= 0 ? nextItems[sourceIndex] : undefined
    if (!item) return false

    if (status === 'auto') {
      const existingItem = nextItems.find(i => i.id === itemId && i.zone === targetZone)
      if (!existingItem) return false
      existingItem.isAuto = false
      nextItems.splice(sourceIndex, 1)
    } else if (status === 'isolate') {
      const existingItem = nextItems.find(i => i.id === itemId && i.zone === targetZone)
      if (!existingItem) return false
      existingItem.isIsolated = false
      nextItems.splice(sourceIndex, 1)
    } else {
      item.zone = targetZone
    }

    items.value = nextItems
    recordEvent('drop', itemId, targetZone)
    dropCommitted.value = true
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
    draggingSnapshot.value = null
    itemsSnapshot.value = []
    dropCommitted.value = false
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
    overZone,
    leaveZone,
    clearHover,
    moveItem,
    addAutoItem,
    addIsolatedItem,
    setZoneBLocked,
    getEventHistory,
    clearEventHistory,
    resetState
  }
})

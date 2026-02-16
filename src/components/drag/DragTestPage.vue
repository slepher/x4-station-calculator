<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import draggable from 'vuedraggable'
import { useDragTestStore } from '@/store/useDragTestStore'

const store = useDragTestStore()

const isTestEnv = ref(false)

const dragEnterCounter = ref<{ A: number; B: number }>({ A: 0, B: 0 })

onMounted(() => {
  isTestEnv.value = localStorage.getItem('isTestEnv') === 'true' || (window as any).isTestEnv
  if (isTestEnv.value) {
    (window as any).dragTestStore = store
  }
})

onUnmounted(() => {
  if ((window as any).dragTestStore) {
    delete (window as any).dragTestStore
  }
})

const zoneAList = computed({
  get: () => store.zoneAItems,
  set: () => {}
})

const zoneBList = computed({
  get: () => store.zoneBItems,
  set: () => {}
})

const getZoneStatusClass = (zoneId: 'A' | 'B'): string => {
  if (!store.isDragging || !store.draggingItemId) return ''
  
  const status = store.getDropStatus(store.draggingItemId, zoneId)
  const isHovered = store.hoveredZoneId === zoneId
  
  const classes: string[] = []
  
  switch (status) {
    case 'normal':
      classes.push(isHovered ? 'border-blue-500 bg-blue-500/10' : 'border-blue-500/50 bg-blue-500/5')
      break
    case 'duplicated':
      classes.push('border-red-500 bg-red-500/10')
      break
    case 'auto':
      classes.push(isHovered ? 'border-blue-500 bg-blue-500/10' : 'border-emerald-500/50 bg-emerald-500/5')
      break
    case 'isolate':
      classes.push(isHovered ? 'border-blue-500 bg-blue-500/10' : 'border-amber-500/50 bg-amber-500/5')
      break
    case 'locked':
      classes.push('border-amber-500 bg-amber-500/10')
      break
    case 'rejected':
      classes.push('border-red-600 bg-red-900/10')
      break
  }
  
  return classes.join(' ')
}

const getStatusLabel = (zoneId: 'A' | 'B'): string => {
  if (!store.isDragging || !store.draggingItemId) return ''
  
  const status = store.getDropStatus(store.draggingItemId, zoneId)
  const isHovered = store.hoveredZoneId === zoneId
  
  switch (status) {
    case 'duplicated':
      return 'Duplicated'
    case 'auto':
      return isHovered ? 'Manual' : 'Auto'
    case 'isolate':
      return isHovered ? 'Connect' : 'Isolate'
    case 'locked':
      return 'Locked'
    case 'rejected':
      return '🚫 Rejected'
    default:
      return ''
  }
}

const handleDragStart = (evt: any) => {
  const itemId = evt.item.getAttribute('data-item-id')
  if (itemId) {
    store.startDragging(itemId)
  }
}

const handleDragEnd = () => {
  dragEnterCounter.value = { A: 0, B: 0 }
  store.stopDragging()
}

const handleDragEnter = (zoneId: 'A' | 'B') => {
  if (store.isDragging) {
    dragEnterCounter.value[zoneId]++
    if (dragEnterCounter.value[zoneId] === 1) {
      store.enterZone(zoneId)
    }
  }
}

const handleDragLeave = (zoneId: 'A' | 'B') => {
  if (store.isDragging) {
    dragEnterCounter.value[zoneId]--
    if (dragEnterCounter.value[zoneId] === 0) {
      store.leaveZone(zoneId)
    }
  }
}

const handleAddToZoneB = (evt: any) => {
  const item = evt.item?._underlying_vm_
  const itemId = item?.id || evt.item.getAttribute('data-item-id')
  
  if (itemId) {
    const success = store.moveItem(itemId, 'B')
    if (!success) {
      if (evt.item && evt.item.parentNode) {
        evt.item.parentNode.removeChild(evt.item)
      }
    }
  }
  
  store.hoveredZoneId = null
}

const handleAddToZoneA = (evt: any) => {
  const item = evt.item?._underlying_vm_
  const itemId = item?.id || evt.item.getAttribute('data-item-id')
  
  if (itemId) {
    store.moveItem(itemId, 'A')
  }
  
  store.hoveredZoneId = null
}

const toggleZoneBLock = () => {
  store.setZoneBLocked(!store.isZoneBLocked, 'terran')
}

const addAutoItemToZoneB = () => {
  store.addAutoItem('item-1', 'Item 1 (Auto)', 'B')
}

const addIsolatedItemToZoneB = () => {
  store.addIsolatedItem('item-2', 'Item 2 (Isolated)', 'B')
}

const resetTest = () => {
  store.resetState()
}
</script>

<template>
  <div class="drag-test-page p-8 min-h-screen bg-slate-900">
    <div class="max-w-4xl mx-auto">
      <h1 class="text-2xl font-bold text-white mb-2">Vue Drag Test Page</h1>
      <p class="text-white/60 text-sm mb-6">
        This page is for testing vuedraggable behavior with Playwright.
      </p>

      <div class="flex gap-4 mb-6">
        <button 
          @click="toggleZoneBLock"
          class="px-4 py-2 rounded-lg text-sm font-medium transition-all"
          :class="store.isZoneBLocked 
            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50' 
            : 'bg-white/5 text-white/60 border border-white/10'"
        >
          Zone B: {{ store.isZoneBLocked ? `Locked (${store.zoneBLineage})` : 'Unlocked' }}
        </button>
        <button 
          @click="addAutoItemToZoneB"
          class="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/50"
        >
          Add Auto Item to Zone B
        </button>
        <button 
          @click="addIsolatedItemToZoneB"
          class="px-4 py-2 rounded-lg text-sm font-medium bg-amber-500/20 text-amber-400 border border-amber-500/50"
        >
          Add Isolated Item to Zone B
        </button>
        <button 
          @click="resetTest"
          class="px-4 py-2 rounded-lg text-sm font-medium bg-white/5 text-white/60 border border-white/10"
        >
          Reset
        </button>
      </div>

      <div class="grid grid-cols-2 gap-8">
        <div 
          class="zone-container rounded-2xl p-6 border-2 transition-all duration-200"
          :class="getZoneStatusClass('A')"
          data-zone-id="A"
          @dragenter="handleDragEnter('A')"
          @dragleave="handleDragLeave('A')"
        >
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-bold text-white">Zone A</h2>
            <span class="text-xs text-white/40">{{ store.zoneAItems.length }} items</span>
          </div>
          
          <div v-if="store.isDragging && store.draggingItemId && getStatusLabel('A')" 
               class="status-label mb-2 text-xs font-bold uppercase tracking-widest"
               :class="store.getDropStatus(store.draggingItemId, 'A') === 'duplicated' ? 'text-red-400' : 'text-blue-400'">
            {{ getStatusLabel('A') }}
          </div>

          <draggable
            class="draggable-area min-h-[200px] flex flex-col gap-2"
            :list="zoneAList"
            :group="{ name: 'test-items', pull: true, put: true }"
            item-key="id"
            @start="handleDragStart"
            @end="handleDragEnd"
            @add="handleAddToZoneA"
            data-testid="zone-a"
          >
            <template #item="{ element }">
              <div 
                :data-item-id="element.id"
                class="drag-item px-4 py-3 rounded-lg bg-white/5 border border-white/10 cursor-grab hover:bg-white/10 transition-all"
                :class="{ 
                  'border-dashed border-emerald-500/50': element.isAuto,
                  'border-amber-500/50': element.isIsolated
                }"
              >
                <div class="flex items-center justify-between">
                  <span class="text-white font-medium">{{ element.name }}</span>
                  <div class="flex items-center gap-2">
                    <span v-if="element.lineage" class="text-xs text-white/40">{{ element.lineage }}</span>
                    <span v-if="element.isAuto" class="text-xs text-emerald-400">Auto</span>
                    <span v-if="element.isIsolated" class="text-xs text-amber-400">Isolated</span>
                  </div>
                </div>
              </div>
            </template>
          </draggable>
        </div>

        <div 
          class="zone-container rounded-2xl p-6 border-2 transition-all duration-200"
          :class="getZoneStatusClass('B')"
          data-zone-id="B"
          @dragenter="handleDragEnter('B')"
          @dragleave="handleDragLeave('B')"
        >
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-bold text-white">Zone B</h2>
            <span class="text-xs text-white/40">{{ store.zoneBItems.length }} items</span>
          </div>
          
          <div v-if="store.isDragging && store.draggingItemId && getStatusLabel('B')" 
               class="status-label mb-2 text-xs font-bold uppercase tracking-widest"
               :class="{
                 'text-red-400': ['duplicated', 'rejected'].includes(store.getDropStatus(store.draggingItemId, 'B')),
                 'text-blue-400': ['auto', 'isolate', 'normal'].includes(store.getDropStatus(store.draggingItemId, 'B')) && store.hoveredZoneId === 'B',
                 'text-emerald-400': store.getDropStatus(store.draggingItemId, 'B') === 'auto' && store.hoveredZoneId !== 'B',
                 'text-amber-400': ['isolate', 'locked'].includes(store.getDropStatus(store.draggingItemId, 'B')) && store.hoveredZoneId !== 'B'
               }">
            {{ getStatusLabel('B') }}
          </div>

          <draggable
            class="draggable-area min-h-[200px] flex flex-col gap-2"
            :list="zoneBList"
            :group="{ name: 'test-items', pull: true, put: true }"
            item-key="id"
            @start="handleDragStart"
            @end="handleDragEnd"
            @add="handleAddToZoneB"
            data-testid="zone-b"
          >
            <template #item="{ element }">
              <div 
                :data-item-id="element.id"
                class="drag-item px-4 py-3 rounded-lg bg-white/5 border border-white/10 cursor-grab hover:bg-white/10 transition-all"
                :class="{ 
                  'border-dashed border-emerald-500/50': element.isAuto,
                  'border-amber-500/50': element.isIsolated
                }"
              >
                <div class="flex items-center justify-between">
                  <span class="text-white font-medium">{{ element.name }}</span>
                  <div class="flex items-center gap-2">
                    <span v-if="element.lineage" class="text-xs text-white/40">{{ element.lineage }}</span>
                    <span v-if="element.isAuto" class="text-xs text-emerald-400">Auto</span>
                    <span v-if="element.isIsolated" class="text-xs text-amber-400">Isolated</span>
                  </div>
                </div>
              </div>
            </template>
          </draggable>

          <div v-if="store.zoneBItems.length === 0" class="empty-state text-center py-8 text-white/30">
            Drop items here
          </div>
        </div>
      </div>

      <div class="mt-8 p-4 rounded-xl bg-white/5 border border-white/10">
        <h3 class="text-sm font-bold text-white/60 mb-2">Event History (Last 10)</h3>
        <div class="text-xs font-mono text-white/40 space-y-1">
          <div v-for="(event, index) in store.getEventHistory().slice(-10)" :key="index">
            {{ event.type }}: itemId={{ event.itemId }}, zoneId={{ event.zoneId }}
          </div>
          <div v-if="store.events.length === 0" class="text-white/20">
            No events recorded
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.draggable-area:empty {
  min-height: 200px;
}

.drag-item {
  user-select: none;
}

.sortable-ghost {
  opacity: 0.5;
  background: rgba(59, 130, 246, 0.2);
}

.sortable-chosen {
  border-color: rgba(59, 130, 246, 0.5);
}
</style>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import draggable from 'vuedraggable'
import { useDragTestPresenter } from './presenters/useDragTestPresenter'

const presenter = useDragTestPresenter()

const isTestEnv = ref(false)

const dragEnterCounter = ref<{ A: number; B: number }>({ A: 0, B: 0 })

onMounted(() => {
  isTestEnv.value = localStorage.getItem('isTestEnv') === 'true' || (window as any).isTestEnv
  if (isTestEnv.value) {
    (window as any).dragTestStore = presenter.debugStore
  }
})

onUnmounted(() => {
  if ((window as any).dragTestStore) {
    delete (window as any).dragTestStore
  }
})

const zoneAList = computed({
  get: () => presenter.zoneAItems.value,
  set: () => {}
})

const zoneBList = computed({
  get: () => presenter.zoneBItems.value,
  set: () => {}
})

const getZoneStatusClass = (zoneId: 'A' | 'B'): string => {
  if (!presenter.isDragging.value || !presenter.draggingItemId.value) return ''
  
  const status = presenter.getDropStatus(presenter.draggingItemId.value, zoneId)
  const isHovered = presenter.hoveredZoneId.value === zoneId
  
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
  if (!presenter.isDragging.value || !presenter.draggingItemId.value) return ''
  
  const status = presenter.getDropStatus(presenter.draggingItemId.value, zoneId)
  const isHovered = presenter.hoveredZoneId.value === zoneId
  
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
    presenter.startDragging(itemId)
  }
}

const handleDragEnd = () => {
  dragEnterCounter.value = { A: 0, B: 0 }
  presenter.stopDragging()
}

const handleDragEnter = (zoneId: 'A' | 'B') => {
  if (presenter.isDragging.value) {
    dragEnterCounter.value[zoneId]++
    if (dragEnterCounter.value[zoneId] === 1) {
      presenter.enterZone(zoneId)
    }
  }
}

const handleDragOver = (zoneId: 'A' | 'B') => {
  if (presenter.isDragging.value) presenter.overZone(zoneId)
}

const handleDragLeave = (zoneId: 'A' | 'B') => {
  if (presenter.isDragging.value) {
    dragEnterCounter.value[zoneId]--
    if (dragEnterCounter.value[zoneId] === 0) {
      presenter.leaveZone(zoneId)
    }
  }
}

const handleAddToZoneB = (evt: any) => {
  const item = evt.item?._underlying_vm_
  const itemId = item?.id || evt.item.getAttribute('data-item-id')
  
  if (itemId) {
    const success = presenter.moveItem(itemId, 'B')
    if (!success) {
      if (evt.item && evt.item.parentNode) {
        evt.item.parentNode.removeChild(evt.item)
      }
    }
  }
  
  presenter.clearHover()
}

const handleAddToZoneA = (evt: any) => {
  const item = evt.item?._underlying_vm_
  const itemId = item?.id || evt.item.getAttribute('data-item-id')
  
  if (itemId) {
    presenter.moveItem(itemId, 'A')
  }
  
  presenter.clearHover()
}

const toggleZoneBLock = () => {
  presenter.setZoneBLocked(!presenter.isZoneBLocked.value, 'terran')
}

const addAutoItemToZoneB = () => {
  presenter.addAutoItem('item-1', 'Item 1 (Auto)', 'B')
}

const addIsolatedItemToZoneB = () => {
  presenter.addIsolatedItem('item-2', 'Item 2 (Isolated)', 'B')
}

const resetTest = () => {
  presenter.resetState()
}

const dragKey = (item: { zone: string; id: string }) => `${item.zone}:${item.id}`
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
          :class="presenter.isZoneBLocked
            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50' 
            : 'bg-white/5 text-white/60 border border-white/10'"
        >
          Zone B: {{ presenter.isZoneBLocked ? `Locked (${presenter.zoneBLineage})` : 'Unlocked' }}
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
          @dragover="handleDragOver('A')"
          @dragleave="handleDragLeave('A')"
        >
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-bold text-white">Zone A</h2>
            <span class="text-xs text-white/40">{{ presenter.zoneAItems.value.length }} items</span>
          </div>
          
          <div v-if="presenter.isDragging && presenter.draggingItemId && getStatusLabel('A')"
               class="status-label mb-2 text-xs font-bold uppercase tracking-widest"
               :class="presenter.getDropStatus(presenter.draggingItemId.value!, 'A') === 'duplicated' ? 'text-red-400' : 'text-blue-400'">
            {{ getStatusLabel('A') }}
          </div>

          <draggable
            class="draggable-area min-h-[200px] flex flex-col gap-2"
            :model-value="zoneAList"
            :group="{ name: 'test-items', pull: true, put: true }"
            :item-key="dragKey"
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
          @dragover="handleDragOver('B')"
          @dragleave="handleDragLeave('B')"
        >
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-bold text-white">Zone B</h2>
            <span class="text-xs text-white/40">{{ presenter.zoneBItems.value.length }} items</span>
          </div>
          
          <div v-if="presenter.isDragging && presenter.draggingItemId && getStatusLabel('B')"
               class="status-label mb-2 text-xs font-bold uppercase tracking-widest"
               :class="{
                 'text-red-400': ['duplicated', 'rejected'].includes(presenter.getDropStatus(presenter.draggingItemId.value!, 'B')),
                 'text-blue-400': ['auto', 'isolate', 'normal'].includes(presenter.getDropStatus(presenter.draggingItemId.value!, 'B')) && presenter.hoveredZoneId.value === 'B',
                 'text-emerald-400': presenter.getDropStatus(presenter.draggingItemId.value!, 'B') === 'auto' && presenter.hoveredZoneId.value !== 'B',
                 'text-amber-400': ['isolate', 'locked'].includes(presenter.getDropStatus(presenter.draggingItemId.value!, 'B')) && presenter.hoveredZoneId.value !== 'B'
               }">
            {{ getStatusLabel('B') }}
          </div>

          <draggable
            class="draggable-area min-h-[200px] flex flex-col gap-2"
            :model-value="zoneBList"
            :group="{ name: 'test-items', pull: true, put: true }"
            :item-key="dragKey"
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

          <div v-if="presenter.zoneBItems.value.length === 0" class="empty-state text-center py-8 text-white/30">
            Drop items here
          </div>
        </div>
      </div>

      <div class="mt-8 p-4 rounded-xl bg-white/5 border border-white/10">
        <h3 class="text-sm font-bold text-white/60 mb-2">Event History (Last 10)</h3>
        <div class="text-xs font-mono text-white/40 space-y-1">
          <div v-for="(event, index) in presenter.getEventHistory().slice(-10)" :key="index">
            {{ event.type }}: itemId={{ event.itemId }}, zoneId={{ event.zoneId }}
          </div>
          <div v-if="presenter.events.value.length === 0" class="text-white/20">
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

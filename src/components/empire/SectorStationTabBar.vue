<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ProductionTabItem } from '@/types/production-ui'
import { SAVE_POI_ICON_MAP } from '@/components/map/utils/style'
import { getPoiIconTag } from '@/store/logic/stationPoiSemantics'
import playerhqIconUrl from '@/components/icons/playerhq.svg'
import tradestationIconUrl from '@/components/icons/tradestation.svg'
import factoryIconUrl from '@/components/icons/factory.svg'

const props = defineProps<{
  tabs: ProductionTabItem[]
  activeTabId: string | null
  expandedSectorId: string | null
  canCreateStation: boolean
  canOpenContextMenu: boolean
  contextMenuMode?: 'full' | 'delete-only'
  canDeleteStation?: (stationId: string) => boolean
}>()

const emit = defineEmits<{
  selectOverview: []
  selectTransit: [sectorId: string]
  selectStation: [stationId: string]
  createStation: []
  renameStation: [stationId: string]
  duplicateStation: [stationId: string]
  deleteStation: [stationId: string]
  expandSector: [sectorId: string | null]
  jumpToBinding: [tabId: string, tabType: 'station' | 'transit']
}>()

const { t } = useI18n()

const showMenu = ref(false)
const menuPosition = ref({ x: 0, y: 0 })
const menuTabId = ref<string | null>(null)
const menuTabType = ref<'station' | 'transit'>('station')
const showDeleteConfirm = ref(false)
const stationToDelete = ref<string | null>(null)
const tabsScrollAreaRef = ref<HTMLElement | null>(null)
const canScrollLeft = ref(false)
const canScrollRight = ref(false)

const getTabIcon = (tab: ProductionTabItem): string => {
  if (tab.type === 'overview') return playerhqIconUrl
  if (tab.type === 'transit') return tradestationIconUrl
  const iconTag = getPoiIconTag(tab)
  if (iconTag) return SAVE_POI_ICON_MAP[iconTag] || factoryIconUrl
  return factoryIconUrl
}

const getTabIconClass = (tab: ProductionTabItem): string => {
  if (tab.type === 'overview') return 'icon-green'
  if (tab.type === 'transit') return 'icon-orange'
  if (tab.type === 'station') return 'icon-green'
  return ''
}

const addNewStation = () => {
  emit('createStation')
  setTimeout(() => {
    const scrollContainer = tabsScrollAreaRef.value
    if (scrollContainer) {
      scrollContainer.scrollLeft = scrollContainer.scrollWidth
      updateTabsScrollState()
    }
  }, 100)
}

const openSupply = (sectorId: string) => {
  emit('expandSector', sectorId)
  emit('selectTransit', sectorId)
}

const openOverview = () => {
  emit('expandSector', null)
  emit('selectOverview')
}

const selectStationWithExpand = (stationId: string) => {
  const station = props.tabs.find(tab => tab.id === stationId)
  if (station?.sectorId) {
    emit('expandSector', station.sectorId)
  }
  emit('selectStation', stationId)
}

const openMenu = (tabId: string, tabType: 'station' | 'transit', event: MouseEvent) => {
  event.preventDefault()
  menuTabId.value = tabId
  menuTabType.value = tabType
  
  const x = Math.min(event.clientX, window.innerWidth - 180)
  const y = Math.min(event.clientY, window.innerHeight - 200)
  
  menuPosition.value = { x, y }
  showMenu.value = true
}

const closeMenu = () => {
  showMenu.value = false
  menuTabId.value = null
}

const handleClickOutside = () => {
  if (showMenu.value) closeMenu()
}

const updateTabsScrollState = () => {
  const el = tabsScrollAreaRef.value
  if (!el) {
    canScrollLeft.value = false
    canScrollRight.value = false
    return
  }
  const maxScrollLeft = Math.max(0, el.scrollWidth - el.clientWidth)
  canScrollLeft.value = el.scrollLeft > 1
  canScrollRight.value = el.scrollLeft < maxScrollLeft - 1
}

const scrollTabs = (direction: 'left' | 'right') => {
  const el = tabsScrollAreaRef.value
  if (!el) return
  const offset = direction === 'left' ? -320 : 320
  el.scrollBy({ left: offset, behavior: 'smooth' })
}

const handleTabsScroll = () => {
  updateTabsScrollState()
}

const handleWindowResize = () => {
  updateTabsScrollState()
}

watch(
  [() => props.tabs, () => props.activeTabId],
  async () => {
    await nextTick()
    updateTabsScrollState()
  },
  { deep: true }
)

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside)
  window.addEventListener('resize', handleWindowResize)
  nextTick(() => updateTabsScrollState())
})
onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside)
  window.removeEventListener('resize', handleWindowResize)
})

const renameStation = () => {
  if (menuTabId.value) emit('renameStation', menuTabId.value)
  closeMenu()
}

const duplicateStation = () => {
  if (menuTabId.value) emit('duplicateStation', menuTabId.value)
  closeMenu()
}

const confirmDelete = () => {
  stationToDelete.value = menuTabId.value
  showDeleteConfirm.value = true
  closeMenu()
}

const deleteStation = () => {
  if (stationToDelete.value) emit('deleteStation', stationToDelete.value)
  showDeleteConfirm.value = false
  stationToDelete.value = null
}

const cancelDelete = () => {
  showDeleteConfirm.value = false
  stationToDelete.value = null
}

const jumpToBinding = () => {
  if (menuTabId.value) emit('jumpToBinding', menuTabId.value, menuTabType.value)
  closeMenu()
}

const tabsToShow = computed(() => {
  const result: ProductionTabItem[] = []
  
  props.tabs.forEach(tab => {
    if (tab.type === 'overview') {
      result.push(tab)
    } else if (tab.type === 'station' && !tab.sectorId) {
      result.push(tab)
    }
  })
  
  const sectorGroups = new Map<string, ProductionTabItem[]>()
  props.tabs.forEach(tab => {
    if (tab.sectorId && tab.type !== 'overview') {
      if (!sectorGroups.has(tab.sectorId)) {
        sectorGroups.set(tab.sectorId, [])
      }
      sectorGroups.get(tab.sectorId)!.push(tab)
    }
  })
  
  sectorGroups.forEach((items, sectorId) => {
    const transitTab = items.find(i => i.type === 'transit')
    if (transitTab) result.push(transitTab)
    
    if (props.expandedSectorId === sectorId) {
      items.filter(i => i.type === 'station').forEach(stationTab => {
        result.push(stationTab)
      })
    }
  })
  
  return result
})
</script>

<template>
  <div class="station-tab-bar-container">
    <button
      v-if="canScrollLeft"
      class="tabs-nav-btn left"
      type="button"
      @click="scrollTabs('left')"
      aria-label="Scroll tabs left"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="m15 18-6-6 6-6"></path>
      </svg>
    </button>
    <div ref="tabsScrollAreaRef" class="tabs-scroll-area custom-scrollbar" @scroll="handleTabsScroll">
      
      <div 
        v-for="tab in tabsToShow"
        :key="tab.id"
        class="tab-item"
        :class="[
          tab.type === 'overview' ? 'overview-tab' : tab.type === 'transit' ? 'supply-tab' : 'station-tab',
          { 'active': activeTabId === tab.id }
        ]"
        :data-testid="tab.type === 'overview' ? 'overview-tab' : tab.type === 'transit' ? 'supply-tab' : 'station-tab'"
        :data-tag="tab.tag"
        :data-factory-group="tab.factoryGroup"
        @click="tab.type === 'overview' ? openOverview() : tab.type === 'transit' ? openSupply(tab.sectorId!) : selectStationWithExpand(tab.id)"
        @contextmenu.stop="tab.type === 'station' ? openMenu(tab.id, 'station', $event) : tab.type === 'transit' ? openMenu(tab.id, 'transit', $event) : undefined"
      >
        <div class="tab-highlight"></div>
        <div class="tab-content">
          <img class="tab-icon w-6 h-6" :class="getTabIconClass(tab)" :src="getTabIcon(tab)" alt="" />
          <span class="tab-label max-w-[120px] truncate">{{ tab.type === 'overview' ? t('sector.overview') : tab.name }}</span>
        </div>
      </div>

      <button v-if="canCreateStation" class="add-btn" data-testid="add-station-btn" @click="addNewStation" :title="t('sector.add_station')">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>
    </div>
    <button
      v-if="canScrollRight"
      class="tabs-nav-btn right"
      type="button"
      @click="scrollTabs('right')"
      aria-label="Scroll tabs right"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="m9 18 6-6-6-6"></path>
      </svg>
    </button>

    <Teleport to="body">
      <div 
        v-if="showMenu" 
        class="context-menu"
        :style="{ top: `${menuPosition.y}px`, left: `${menuPosition.x}px` }"
        @mousedown.stop
        @click.stop
      >
        <div class="menu-header">{{ t('sector.menu_operations') }}</div>
        
        <div class="menu-item" @click="jumpToBinding">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.5 13.5L13.5 10.5" />
            <path d="M8.25 15.75a3.182 3.182 0 0 1-4.5 0 3.182 3.182 0 0 1 0-4.5l3-3a3.182 3.182 0 0 1 4.5 0" />
            <path d="M15.75 8.25a3.182 3.182 0 0 1 4.5 0 3.182 3.182 0 0 1 0 4.5l-3 3a3.182 3.182 0 0 1-4.5 0" />
          </svg>
          <span>{{ t('sector.jump_to_binding') }}</span>
        </div>

        <template v-if="menuTabType === 'station'">
          <template v-if="props.contextMenuMode !== 'delete-only' && props.canOpenContextMenu">
            <div class="menu-divider"></div>
            <div class="menu-item" @click="renameStation">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              <span>{{ t('sector.rename_station') }}</span>
            </div>
            
            <div class="menu-item" @click="duplicateStation">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              <span>{{ t('sector.duplicate_station') }}</span>
            </div>

            <div class="menu-divider"></div>
          </template>
          
          <div v-if="!props.canDeleteStation || props.canDeleteStation(menuTabId!)" class="menu-item danger" @click="confirmDelete">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            <span>{{ t('sector.delete_station') }}</span>
          </div>
        </template>
      </div>
    </Teleport>

    <Transition name="fade">
      <div v-if="showDeleteConfirm" class="modal-backdrop" @click="cancelDelete">
        <div class="modal-card" @click.stop>
          <div class="modal-header">
            <span class="text-amber-400 text-lg">⚠️</span>
            <h3>{{ t('sector.confirm_delete') }}</h3>
          </div>
          <p class="text-slate-400 text-sm mb-6 ml-1">{{ t('sector.delete_warning') }}</p>
          <div class="flex justify-end gap-3">
            <button class="btn-cancel" @click="cancelDelete">{{ t('ui.cancel') }}</button>
            <button class="btn-danger" @click="deleteStation">{{ t('ui.delete') }}</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.station-tab-bar-container {
  @apply w-full h-12 bg-slate-900 border-b border-slate-700 select-none relative;
}

.tabs-scroll-area {
  @apply flex items-end h-full px-10 gap-1 overflow-x-auto;
  scrollbar-width: none;
}

.tabs-nav-btn {
  @apply absolute top-1/2 -translate-y-1/2 z-20 h-7 w-7 rounded-md flex items-center justify-center;
  @apply bg-slate-900/90 border border-slate-700 text-slate-400;
  @apply hover:text-sky-300 hover:border-slate-500 transition-colors;
}

.tabs-nav-btn.left {
  @apply left-2;
}

.tabs-nav-btn.right {
  @apply right-2;
}

.tabs-scroll-area::-webkit-scrollbar {
  display: none;
}

.tab-item {
  @apply relative h-9 px-4 rounded-t-lg cursor-pointer transition-all duration-200 border-t border-x border-transparent mt-2;
  @apply bg-slate-800/30 text-slate-400;
  @apply hover:bg-slate-800/60 hover:text-slate-200;
  min-width: 100px;
}

.station-tab {
  @apply cursor-pointer;
}
.supply-tab {
  @apply cursor-pointer;
}

.tab-item.active {
  @apply bg-slate-800 text-sky-400 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)];
  @apply border-slate-700 border-b-slate-800;
  @apply h-10 translate-y-[1px] z-10;
}

.tab-highlight {
  @apply absolute top-0 left-0 w-full h-[2px] bg-transparent transition-colors rounded-t-lg;
}
.tab-item.active .tab-highlight {
  @apply bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.6)];
}

.tab-content {
  @apply flex items-center justify-center gap-2 h-full w-full pb-1;
}

.tab-label {
  @apply text-xs font-bold tracking-wide;
}

.overview-tab {
  @apply min-w-[fit-content] px-3;
}

.add-btn {
  @apply h-8 w-8 flex items-center justify-center rounded-lg ml-2 mb-1;
  @apply text-slate-500 hover:text-sky-400 hover:bg-slate-800 border border-transparent hover:border-slate-700 transition-all;
}

.context-menu {
  @apply fixed z-50 bg-slate-800/95 backdrop-blur-md border border-slate-600 rounded-lg shadow-2xl py-1 min-w-[160px];
  animation: menu-slide-in 0.1s ease-out;
}
@keyframes menu-slide-in {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

.menu-header {
  @apply px-3 py-1.5 text-[10px] text-slate-500 font-bold uppercase tracking-wider border-b border-slate-700/50 mb-1;
}

.menu-item {
  @apply flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-300 cursor-pointer transition-colors;
  @apply hover:bg-sky-500/10 hover:text-sky-400 border-l-2 border-transparent hover:border-sky-500;
}

.menu-item.danger {
  @apply text-slate-300 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500;
}

.icon {
  @apply w-3.5 h-3.5 opacity-70;
}

.menu-divider {
  @apply h-px bg-slate-700 my-1 mx-2;
}

.modal-backdrop {
  @apply fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm;
}
.modal-card {
  @apply bg-slate-800 border border-slate-600 rounded-xl p-5 shadow-2xl max-w-sm w-full transform transition-all scale-100;
}
.modal-header {
  @apply flex items-center gap-2 mb-2 font-bold text-slate-200;
}

.btn-cancel {
  @apply px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors;
}
.btn-danger {
  @apply px-4 py-1.5 text-xs font-bold bg-red-600 text-white rounded hover:bg-red-500 shadow-lg shadow-red-900/20 transition-all;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

.icon-green {
  filter: brightness(0) saturate(100%) invert(64%) sepia(60%) saturate(450%) hue-rotate(84deg) brightness(92%) contrast(91%);
}

.icon-orange {
  filter: brightness(0) saturate(100%) invert(76%) sepia(45%) saturate(650%) hue-rotate(7deg) brightness(99%) contrast(91%);
}
</style>
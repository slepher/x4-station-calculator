<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useEmpireStore } from '@/store/useEmpireStore'
import { useI18n } from 'vue-i18n'
import type { StationType } from '@/types/x4'

const empireStore = useEmpireStore()
const { t } = useI18n()

const isBindingMode = computed(() => empireStore.productionSource === 'save-binding')

const showMenu = ref(false)
const menuPosition = ref({ x: 0, y: 0 })
const menuStationId = ref<string | null>(null)
const showDeleteConfirm = ref(false)
const stationToDelete = ref<string | null>(null)
const tabsScrollAreaRef = ref<HTMLElement | null>(null)
const canScrollLeft = ref(false)
const canScrollRight = ref(false)
const expandedSectorId = ref<string | null>(null)

// 数据获取
const stations = computed(() => {
  return empireStore.orderedStationsBySector
})
const sectors = computed(() => empireStore.sectors)

const activeStationId = computed(() => empireStore.activeStationId)
const activeTransitSectorId = computed(() => empireStore.activeTransitSectorId)

const computeDefaultExpandedSectorId = (): string | null => {
  if (activeTransitSectorId.value) return activeTransitSectorId.value
  if (activeStationId.value) {
    const activeStation = stations.value.find(s => s.id === activeStationId.value)
    return activeStation?.sectorId || null
  }
  return null
}

const tabGroups = computed(() => {
  const unassigned = stations.value.filter((station) => !station.sectorId)
  const sectorGroups = sectors.value.map((sector) => ({
    id: sector.id,
    name: sector.name,
    stations: stations.value.filter((station) => station.sectorId === sector.id)
  }))
  return {
    unassigned,
    sectorGroups
  }
})

const visibleSectorGroups = computed(() => {
  const stationCountBySector = new Map<string, number>()
  tabGroups.value.sectorGroups.forEach((group) => {
    stationCountBySector.set(group.id, group.stations.length)
  })

  return tabGroups.value.sectorGroups
    .map((group) => {
      const hasOwnStations = group.stations.length > 0
      const hasLinkedStations = empireStore
        .getLinkedSectors(group.id)
        .some((linkedSectorId) => (stationCountBySector.get(linkedSectorId) ?? 0) > 0)
      return {
        ...group,
        showTransitTab: hasOwnStations || hasLinkedStations
      }
    })
    .filter((group) => group.showTransitTab || group.stations.length > 0)
})

// 图标映射
const getStationIcon = (type?: StationType): string => {
  switch (type) {
    case 'industrial': return '🏭'
    case 'supply': return '📦'
    case 'transit': return '🚚'
    case 'shipyard': return '⚓'
    default: return '🏭'
  }
}

// 核心操作
const selectStation = (stationId: string | null) => {
  empireStore.selectStation(stationId)
}

const addNewStation = () => {
  const name = t('sector.new_station_name')
  empireStore.createStation(name, 'industrial')
  // 自动滚动到最右侧
  setTimeout(() => {
    const scrollContainer = tabsScrollAreaRef.value
    if (scrollContainer) {
      scrollContainer.scrollLeft = scrollContainer.scrollWidth
      updateTabsScrollState()
    }
  }, 100)
}

const openSupply = (sectorId: string) => {
  expandedSectorId.value = sectorId
  empireStore.selectTransitSector(sectorId)
}

const openOverview = () => {
  expandedSectorId.value = null
  empireStore.selectStation(null)
}

const selectStationWithExpand = (stationId: string) => {
  const station = stations.value.find(s => s.id === stationId)
  if (station?.sectorId) {
    expandedSectorId.value = station.sectorId
  }
  empireStore.selectStation(stationId)
}

// 右键菜单逻辑
const openMenu = (stationId: string, event: MouseEvent) => {
  if (isBindingMode.value) return
  event.preventDefault()
  menuStationId.value = stationId
  
  // 计算菜单位置，防止溢出屏幕
  const x = Math.min(event.clientX, window.innerWidth - 180)
  const y = Math.min(event.clientY, window.innerHeight - 200)
  
  menuPosition.value = { x, y }
  showMenu.value = true
}

const closeMenu = () => {
  showMenu.value = false
  menuStationId.value = null
}

// 点击外部关闭菜单
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
  [stations, sectors, activeStationId, activeTransitSectorId],
  async () => {
    await nextTick()
    updateTabsScrollState()
  },
  { deep: true }
)

watch(
  [activeStationId, activeTransitSectorId, visibleSectorGroups],
  () => {
    const defaultSector = computeDefaultExpandedSectorId()
    if (defaultSector && visibleSectorGroups.value.some(g => g.id === defaultSector)) {
      expandedSectorId.value = defaultSector
    }
  },
  { immediate: true }
)

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  window.addEventListener('resize', handleWindowResize)
  nextTick(() => updateTabsScrollState())
})
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('resize', handleWindowResize)
})

// 菜单操作
const renameStation = () => {
  // 这里可以触发重命名逻辑，或者让Tab变为可编辑状态
  // 目前保持原逻辑，选中该站点
  if (menuStationId.value) selectStation(menuStationId.value)
  closeMenu()
}

const duplicateStation = () => {
  if (menuStationId.value) {
    empireStore.duplicateStation(menuStationId.value)
  }
  closeMenu()
}

const confirmDelete = () => {
  stationToDelete.value = menuStationId.value
  showDeleteConfirm.value = true
  closeMenu()
}

const deleteStation = () => {
  if (stationToDelete.value) {
    empireStore.deleteStation(stationToDelete.value)
  }
  showDeleteConfirm.value = false
  stationToDelete.value = null
}

const cancelDelete = () => {
  showDeleteConfirm.value = false
  stationToDelete.value = null
}

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
        class="tab-item overview-tab"
        :class="{ 'active': activeStationId === null && !activeTransitSectorId }"
        @click="openOverview"
      >
        <div class="tab-highlight"></div>
        <div class="tab-content">
          <span class="tab-icon text-base">📊</span>
          <span class="tab-label">{{ t('sector.overview') }}</span>
        </div>
      </div>

      <div
        v-if="tabGroups.unassigned.length > 0"
        class="tab-separator tab-separator-unassigned h-6 w-px bg-slate-700/50 mx-1 self-center"
      ></div>

      <div class="tabs-draggable-list">
        <div
          v-if="tabGroups.unassigned.length > 0"
          class="tab-drop-group"
        >
        <div
          v-for="station in tabGroups.unassigned"
          :key="station.id"
          class="tab-item station-tab"
          :data-station-id="station.id"
          :class="{ 'active': activeStationId === station.id }"
          @click="selectStation(station.id)"
          @contextmenu.stop="openMenu(station.id, $event)"
        >
          <div class="tab-highlight"></div>
          <div class="tab-content">
            <span class="tab-icon">{{ getStationIcon(station.type) }}</span>
            <span class="tab-label max-w-[120px] truncate">{{ station.name }}</span>
          </div>
        </div>
        </div>

        <div
          v-for="group in visibleSectorGroups"
          :key="`group-${group.id}`"
          class="sector-tab-group"
        >
          <div class="tab-separator tab-separator-sector h-6 w-px bg-slate-700/50 mx-1 self-center"></div>

          <div
            v-if="group.showTransitTab"
            class="tab-item supply-tab"
            :class="{ 'active': activeTransitSectorId === group.id }"
            @click="openSupply(group.id)"
          >
            <div class="tab-highlight"></div>
            <div class="tab-content">
              <span class="tab-icon">🚚</span>
              <span class="tab-label max-w-[120px] truncate">{{ group.name }}</span>
            </div>
          </div>

          <template v-if="expandedSectorId === group.id">
            <div
              v-for="station in group.stations"
              :key="station.id"
              class="tab-item station-tab"
              :data-station-id="station.id"
              :class="{ 'active': activeStationId === station.id }"
              @click="selectStationWithExpand(station.id)"
              @contextmenu.stop="openMenu(station.id, $event)"
            >
              <div class="tab-highlight"></div>
              <div class="tab-content">
                <span class="tab-icon">{{ getStationIcon(station.type) }}</span>
                <span class="tab-label max-w-[120px] truncate">{{ station.name }}</span>
              </div>
            </div>
          </template>
        </div>
      </div>

      <button v-if="!isBindingMode" class="add-btn" @click="addNewStation" :title="t('sector.add_station')">
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
        @click.stop
      >
        <div class="menu-header">{{ t('sector.menu_operations') }}</div>
        
        <div class="menu-item" @click="renameStation">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          <span>{{ t('sector.rename_station') }}</span>
        </div>
        
        <div class="menu-item" @click="duplicateStation">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          <span>{{ t('sector.duplicate_station') }}</span>
        </div>

        <div class="menu-divider"></div>
        
        <div class="menu-item danger" @click="confirmDelete">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          <span>{{ t('sector.delete_station') }}</span>
        </div>
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
/* 主容器：与 Toolbar 保持一致的深色背景，但在下方留出一条边框线作为 Tab 的底座 */
.station-tab-bar-container {
  @apply w-full h-12 bg-slate-900 border-b border-slate-700 select-none relative;
}

.tabs-scroll-area {
  @apply flex items-end h-full px-10 gap-1 overflow-x-auto;
  scrollbar-width: none; /* Firefox */
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

.tabs-draggable-list {
  @apply flex items-end gap-1;
}
.tab-drop-group {
  @apply flex items-end gap-1 rounded-md transition-colors;
}
.sector-tab-group {
  @apply flex items-end gap-1 rounded-md transition-colors;
}
.tabs-scroll-area::-webkit-scrollbar {
  display: none; /* Chrome/Safari */
}

/* Tab 基础样式 */
.tab-item {
  @apply relative h-9 px-4 rounded-t-lg cursor-pointer transition-all duration-200 border-t border-x border-transparent mt-2;
  @apply bg-slate-800/30 text-slate-400;
  @apply hover:bg-slate-800/60 hover:text-slate-200;
  /* 关键：让 Tab 看起来像是插在底座上的卡片 */
  min-width: 100px;
}

.station-tab {
  @apply cursor-pointer;
}
.supply-tab {
  @apply cursor-pointer;
}

/* 选中状态 */
.tab-item.active {
  @apply bg-slate-800 text-sky-400 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)];
  /* 底部边框透明，让颜色流向内容区，看起来连通 */
  @apply border-slate-700 border-b-slate-800;
  /* 稍微抬高一点 */
  @apply h-10 translate-y-[1px] z-10;
}

/* 顶部高亮条 (类似浏览器 Tab) */
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

/* 总览 Tab 特殊样式 */
.overview-tab {
  @apply min-w-[fit-content] px-3;
}

/* 新建按钮 */
.add-btn {
  @apply h-8 w-8 flex items-center justify-center rounded-lg ml-2 mb-1;
  @apply text-slate-500 hover:text-sky-400 hover:bg-slate-800 border border-transparent hover:border-slate-700 transition-all;
}

/* 右键菜单 */
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

/* 模态框样式 */
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

/* 动画 */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>

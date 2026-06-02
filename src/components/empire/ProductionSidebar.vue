<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ProductionTabItem } from '@/types/production-ui'
import { SAVE_POI_ICON_MAP } from '@/components/map/utils/style'
import { getPoiIconTag } from '@/store/logic/stationPoiSemantics'
import playerhqIconUrl from '@/components/icons/playerhq.svg'
import tradestationIconUrl from '@/components/icons/tradestation.svg'
import factoryIconUrl from '@/components/icons/factory.svg'
import researchIconUrl from '@/components/icons/tlt_research.svg'
import terraformingIconUrl from '@/components/icons/tlt_terraforming.svg'

const props = defineProps<{
  tabs: ProductionTabItem[]
  activeTabId: string | null
  expandedSectorId: string | null
  hasSectors: boolean
  showTerraforming: boolean
  showResearch: boolean
  showTechTree: boolean
  terraformingClusters: { id: string; name: string; nameId: string; temperatureState: number }[]
  activeTerraformingClusterId: string | null
  canCreateStation: boolean
  canOpenContextMenu: boolean
  contextMenuMode: 'full' | 'delete-only'
  canDeleteStation: (stationId: string) => boolean
}>()

const emit = defineEmits<{
  selectOverview: []
  selectTerraforming: []
  selectTechTree: []
  selectResearch: []
  selectTerraformingCluster: [clusterId: string]
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

const collapsed = ref(false)
const showMenu = ref(false)
const menuPosition = ref({ x: 0, y: 0 })
const menuTabId = ref<string | null>(null)
const menuTabType = ref<'station' | 'transit'>('station')
const showDeleteConfirm = ref(false)
const stationToDelete = ref<string | null>(null)

const getSectorName = (sectorId: string): string => {
  const transitTab = props.tabs.find(t => t.type === 'transit' && t.sectorId === sectorId)
  return transitTab?.name || sectorId
}

const hasSectorChildren = (sectorId: string): boolean => {
  return props.tabs.some(t => t.type === 'station' && t.sectorId === sectorId)
}

const expandedTerraforming = ref(false)

watch(() => props.activeTerraformingClusterId, (clusterId) => {
  if (clusterId) expandedTerraforming.value = true
}, { immediate: true })

const terraformClusterItems = computed<ProductionTabItem[]>(() => {
  return props.terraformingClusters.map(c => ({
    id: `terraforming:${c.id}`,
    type: 'terraforming' as const,
    name: c.name,
    temperatureState: c.temperatureState,
  }))
})

const getTerraformClusterIconClass = (item: { temperatureState?: number }): string => {
  if (item.temperatureState == null) return ''
  switch (item.temperatureState) {
    case 0: return ''
    case 1: return 'icon-temp-state-1'
    case 2: return 'icon-temp-state-2'
    case 3: return 'icon-temp-state-3'
    case 4: return 'icon-temp-state-4'
    default: return ''
  }
}

const groupSectors = computed<Array<{ id: string; name: string; hasChildren: boolean }>>(() => {
  if (!props.hasSectors) return []
  const seen = new Set<string>()
  const result: Array<{ id: string; name: string; hasChildren: boolean }> = []
  props.tabs.forEach(tab => {
    if (tab.sectorId && !seen.has(tab.sectorId)) {
      seen.add(tab.sectorId)
      result.push({
        id: tab.sectorId,
        name: getSectorName(tab.sectorId),
        hasChildren: hasSectorChildren(tab.sectorId)
      })
    }
  })
  return result
})

const findTabById = (id: string): ProductionTabItem | undefined => {
  const tab = props.tabs.find(t => t.id === id || t.name === id)
  if (tab) return tab
  return undefined
}

const findSectorForTabId = (tabId: string | null): string | undefined => {
  if (!tabId || !props.hasSectors) return undefined
  const tab = findTabById(tabId)
  if (tab?.sectorId) return tab.sectorId
  return undefined
}

const collapsedSectors = ref(new Set(
  (() => {
    if (!props.hasSectors) return [] as string[]
    const allIds = groupSectors.value.map(s => s.id)
    const activeSectorId = findSectorForTabId(props.activeTabId)
    if (activeSectorId) {
      return allIds.filter(id => id !== activeSectorId)
    }
    return allIds
  })()
))

watch([() => props.activeTabId, () => props.tabs.length], ([tabId]) => {
  if (!tabId || !props.hasSectors) return
  const activeSectorId = findSectorForTabId(tabId)
  if (activeSectorId) {
    const next = new Set(collapsedSectors.value)
    next.delete(activeSectorId)
    collapsedSectors.value = next
  }
})

const fixedItems = computed<ProductionTabItem[]>(() => {
  const result = props.tabs.filter(t => t.type === 'overview')
  if (props.showResearch) {
    result.push({ id: 'research', type: 'research' as const, name: '研究' })
  }
  if (props.showTerraforming) {
    result.push({ id: 'terraforming', type: 'terraforming' as const, name: '地球化' })
  }
  if (props.showTechTree) {
    result.push({ id: 'tech-tree', type: 'terraforming' as const, name: '科技树' })
  }
  return result
})

const dynamicItems = computed<ProductionTabItem[]>(() => {
  const result: ProductionTabItem[] = []

  if (!props.hasSectors) {
    props.tabs.forEach(tab => {
      if (tab.type === 'station') {
        result.push(tab)
      }
    })
    return result
  }

  const sectorGroups = new Map<string, ProductionTabItem[]>()
  props.tabs.forEach(tab => {
    if (tab.type !== 'overview' && tab.type !== 'terraforming') {
      if (tab.sectorId) {
        if (!sectorGroups.has(tab.sectorId)) {
          sectorGroups.set(tab.sectorId, [])
        }
        sectorGroups.get(tab.sectorId)!.push(tab)
      } else if (tab.type === 'station') {
        result.push(tab)
      }
    }
  })

  sectorGroups.forEach((items) => {
    const transitTab = items.find(i => i.type === 'transit')
    if (transitTab) result.push(transitTab)
    items.filter(i => i.type === 'station').forEach(stationTab => {
      result.push(stationTab)
    })
  })

  return result
})

const getTabIconClass = (tab: ProductionTabItem): string => {
  if (tab.type === 'overview' || tab.type === 'terraforming' || (tab.id && (tab.id === 'overview' || tab.id === 'terraforming' || tab.id === 'tech-tree'))) {
    return 'icon-green'
  }
  if (tab.type === 'transit') return 'icon-orange'
  return 'icon-green'
}

const getTabIcon = (tab: ProductionTabItem): string => {
  if (tab.id === 'overview') return playerhqIconUrl
  if (tab.type === 'terraforming') return terraformingIconUrl
  if (tab.id === 'tech-tree') return terraformingIconUrl
  if (tab.id === 'research') return researchIconUrl
  if (tab.type === 'transit') return tradestationIconUrl
  const iconTag = getPoiIconTag(tab)
  if (iconTag) return SAVE_POI_ICON_MAP[iconTag] || factoryIconUrl
  return factoryIconUrl
}

const handleTabClick = (tab: ProductionTabItem) => {
  if (tab.id === 'overview') {
    emit('selectOverview')
  } else if (tab.id === 'terraforming') {
    expandedTerraforming.value = !expandedTerraforming.value
  } else if (tab.id.startsWith('terraforming:')) {
    emit('selectTerraformingCluster', tab.id.replace('terraforming:', ''))
  } else if (tab.id === 'tech-tree') {
    emit('selectTechTree')
  } else if (tab.id === 'research') {
    emit('selectResearch')
  } else if (tab.type === 'transit') {
    emit('selectTransit', tab.sectorId!)
  } else {
    emit('selectStation', tab.id)
  }
}

const isSectorActive = (sectorId: string): boolean => {
  if (isTabActive('transit:' + sectorId)) return true
  return dynamicItems.value.some(d => d.sectorId === sectorId && d.type === 'station' && isTabActive(d.id))
}

const isSectorExpanded = (sectorId: string): boolean => {
  return !collapsedSectors.value.has(sectorId)
}

const handleSectorClick = (sectorId: string) => {
  emit('selectTransit', sectorId)
}

const toggleSectorCollapse = (sectorId: string) => {
  const next = new Set(collapsedSectors.value)
  if (next.has(sectorId)) {
    next.delete(sectorId)
  } else {
    next.add(sectorId)
  }
  collapsedSectors.value = next
}

const handleFixedClick = (tab: ProductionTabItem) => {
  handleTabClick(tab)
}

const isTabActive = (tabId: string): boolean => {
  return props.activeTabId === tabId
}

const openMenu = (tabId: string, tabType: string, event: MouseEvent) => {
  if (!props.canOpenContextMenu) return
  if (tabType === 'station' && props.contextMenuMode === 'delete-only' && !props.canOpenContextMenu) return
  event.preventDefault()
  menuTabId.value = tabId
  menuTabType.value = tabType as 'station' | 'transit'

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

const doRename = () => {
  if (menuTabId.value) emit('renameStation', menuTabId.value)
  closeMenu()
}

const jumpToBinding = () => {
  if (menuTabId.value) emit('jumpToBinding', menuTabId.value, menuTabType.value)
  closeMenu()
}

const addNewStation = () => {
  emit('createStation')
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div class="production-sidebar" :class="{ collapsed }">
    <button
      class="sidebar-toggle"
      :title="collapsed ? '展开侧栏' : '收起侧栏'"
      @click="collapsed = !collapsed"
    >
      <svg v-if="!collapsed" xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="3" y1="12" x2="21" y2="12"></line>
        <line x1="3" y1="6" x2="21" y2="6"></line>
        <line x1="3" y1="18" x2="21" y2="18"></line>
      </svg>
      <div v-else class="flex items-center justify-center w-full h-full">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m13 18 6-6-6-6"></path>
          <path d="m13 6-6 6 6 6" opacity="0.4"></path>
        </svg>
      </div>
    </button>
    <div class="sidebar-inner">
      <div class="sidebar-scroll custom-scrollbar">
        <div class="sidebar-section sidebar-fixed">
          <div
            v-for="item in fixedItems"
            :key="item.id"
            class="sidebar-item"
            :class="{ active: isTabActive(item.id) }"
            :data-testid="item.id === 'overview' ? 'sidebar-overview' : item.id === 'terraforming' ? 'sidebar-terraforming' : 'sidebar-tech-tree'"
          >
            <div class="sidebar-item-active-bar"></div>
            <button
              v-if="item.id === 'terraforming'"
              class="sector-chevron-btn"
              @click.stop="expandedTerraforming = !expandedTerraforming"
            >
              <svg
                class="sector-chevron w-3 h-3"
                :class="{ rotated: expandedTerraforming }"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="m9 18 6-6-6-6"></path>
              </svg>
            </button>
            <span
              class="sector-click-area flex items-center gap-2 flex-1 min-w-0"
              @click="handleFixedClick(item)"
            >
              <img v-if="item.id !== 'terraforming'" class="sidebar-item-icon" :class="getTabIconClass(item)" :src="getTabIcon(item)" alt="" />
              <span class="sidebar-item-label">{{ item.id === 'overview' ? t('sector.overview') : item.name }}</span>
            </span>
          </div>
        </div>

        <div
          v-if="props.showTerraforming && expandedTerraforming"
          class="sidebar-terraform-clusters"
        >
            <div
              v-for="item in terraformClusterItems"
              :key="item.id"
              class="sidebar-item terraform-cluster-item"
              :class="{ active: props.activeTerraformingClusterId && item.id === `terraforming:${props.activeTerraformingClusterId}` }"
              @click="handleTabClick(item)"
            >
              <div class="sidebar-item-active-bar"></div>
              <img class="sidebar-item-icon sidebar-icon-indented" :class="getTerraformClusterIconClass(item)" :src="getTabIcon(item)" alt="" />
              <span class="sidebar-item-label">{{ item.name }}</span>
            </div>
          </div>

        <div class="sidebar-divider"></div>

        <div v-if="!hasSectors" class="sidebar-section sidebar-dynamic">
          <div
            v-for="item in dynamicItems"
            :key="item.id"
            class="sidebar-item station-item"
            :class="{ active: isTabActive(item.id) }"
            :data-testid="'sidebar-station'"
            :data-station-id="item.id"
            @click="handleTabClick(item)"
            @contextmenu.stop="openMenu(item.id, 'station', $event)"
          >
            <div class="sidebar-item-active-bar"></div>
            <img class="sidebar-item-icon" :class="getTabIconClass(item)" :src="getTabIcon(item)" alt="" />
            <span class="sidebar-item-label">{{ item.name }}</span>
          </div>

          <button v-if="canCreateStation" class="sidebar-add-btn" data-testid="sidebar-add-station" :title="t('sector.add_station')" @click="addNewStation">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span class="ml-1.5 text-xs">{{ t('sector.add_station') }}</span>
          </button>
        </div>

        <div v-else class="sidebar-section sidebar-dynamic">
          <template v-for="sector in groupSectors" :key="sector.id">
            <div
              class="sidebar-item sector-header"
              :class="{ expanded: isSectorExpanded(sector.id), active: isSectorActive(sector.id) }"
            >
              <div class="sidebar-item-active-bar"></div>
              <button
                class="sector-chevron-btn"
                @click="toggleSectorCollapse(sector.id)"
              >
                <svg
                  class="sector-chevron w-3 h-3"
                  :class="{ rotated: isSectorExpanded(sector.id) }"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="m9 18 6-6-6-6"></path>
                </svg>
              </button>
              <span class="sector-click-area flex items-center gap-2 flex-1 min-w-0" @click="handleSectorClick(sector.id)">
                <img class="sidebar-item-icon icon-orange w-5 h-5 flex-shrink-0" :src="tradestationIconUrl" alt="" />
                <span class="sidebar-item-label">{{ sector.name }}</span>
              </span>
            </div>

            <template v-if="isSectorExpanded(sector.id)">
              <div
                v-for="item in dynamicItems.filter(d => d.sectorId === sector.id && d.type === 'station')"
                :key="item.id"
                class="sidebar-item station-item pl-8"
                :class="{ active: isTabActive(item.id) }"
                data-testid="sidebar-station"
                :data-station-id="item.id"
                @contextmenu.stop="openMenu(item.id, item.type, $event)"
              >
                <div class="sidebar-item-active-bar"></div>
                <span class="flex items-center gap-2 flex-1 min-w-0" @click="handleFixedClick(item)">
              <img v-if="item.id !== 'terraforming'" class="sidebar-item-icon" :class="getTabIconClass(item)" :src="getTabIcon(item)" alt="" />
                  <span class="sidebar-item-label">{{ item.name }}</span>
                </span>
              </div>
            </template>
          </template>

          <button v-if="canCreateStation" class="sidebar-add-btn" data-testid="sidebar-add-station" :title="t('sector.add_station')" @click="addNewStation">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span class="ml-1.5 text-xs">{{ t('sector.add_station') }}</span>
          </button>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="showMenu"
        class="sidebar-context-menu"
        :style="{ top: `${menuPosition.y}px`, left: `${menuPosition.x}px` }"
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
          <template v-if="contextMenuMode === 'full'">
            <div class="menu-divider"></div>
            <div class="menu-item" @click="doRename">
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
            <span class="text-amber-400 text-lg">⚠</span>
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
.production-sidebar {
  @apply flex-shrink-0 bg-slate-900 border-r border-slate-700 select-none relative flex flex-col;
  width: 200px;
  transition: width 0.2s ease;
  overflow: hidden;
}

.production-sidebar.collapsed {
  width: 24px;
  @apply bg-slate-950 border-slate-800 cursor-pointer;
}

.sidebar-toggle {
  @apply h-8 w-8 flex items-center justify-center mx-2 my-1.5 rounded-md flex-shrink-0;
  @apply text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors;
}

.production-sidebar.collapsed .sidebar-toggle {
  @apply absolute inset-0 w-full h-full mx-0 my-0 flex-shrink p-0;
  @apply rounded-none text-sky-400 hover:bg-slate-800;
}

.sidebar-inner {
  @apply flex flex-col flex-1 min-h-0 overflow-hidden;
}

.production-sidebar.collapsed .sidebar-inner {
  @apply hidden;
}

.sidebar-scroll {
  @apply flex-1 overflow-y-auto overflow-x-hidden;
}

.sidebar-section {
  @apply py-1;
}

.sidebar-divider {
  @apply mx-3 h-px bg-slate-700/50;
}

.sidebar-item {
  @apply relative flex items-center gap-2 px-3 py-1.5 mx-1 rounded-md cursor-pointer;
  @apply text-slate-400 hover:text-slate-200 hover:bg-slate-800/60;
  transition: all 0.15s ease;
}

.sidebar-item.pl-8 {
  padding-left: 1.75rem;
}

.sidebar-item.active {
  @apply text-sky-400 bg-slate-800;
}

.sidebar-item-active-bar {
  @apply absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full bg-transparent transition-colors;
}

.sidebar-item.active .sidebar-item-active-bar {
  @apply bg-sky-500;
}

.sidebar-item-icon {
  @apply w-5 h-5 flex-shrink-0;
}

.icon-green {
  filter: brightness(0) saturate(100%) invert(64%) sepia(60%) saturate(450%) hue-rotate(84deg) brightness(92%) contrast(91%);
}

.icon-orange {
  filter: brightness(0) saturate(100%) invert(76%) sepia(45%) saturate(650%) hue-rotate(7deg) brightness(99%) contrast(91%);
}

.icon-cyan {
  filter: brightness(0) saturate(100%) invert(71%) sepia(38%) saturate(722%) hue-rotate(155deg) brightness(97%) contrast(93%);
}

.icon-temp-state-2 {
  filter: brightness(0) saturate(100%) invert(48%) sepia(79%) saturate(2476%) hue-rotate(86deg) brightness(118%) contrast(119%);
}

.icon-temp-state-1 {
  filter: brightness(0) saturate(100%) invert(79%) sepia(20%) saturate(1111%) hue-rotate(141deg) brightness(87%) contrast(86%);
}

.icon-temp-state-3 {
  filter: brightness(0) saturate(100%) invert(59%) sepia(60%) saturate(5033%) hue-rotate(1deg) brightness(102%) contrast(105%);
}

.icon-temp-state-4 {
  filter: brightness(0) saturate(100%) invert(16%) sepia(100%) saturate(7419%) hue-rotate(4deg) brightness(89%) contrast(117%);
}

.sidebar-item-label {
  @apply text-xs font-medium truncate;
}

.sector-chevron-btn {
  @apply flex items-center justify-center w-6 h-6 rounded flex-shrink-0;
  @apply text-slate-500 hover:text-slate-300 transition-colors;
}

.sector-click-area {
  @apply cursor-pointer;
}

.sector-chevron.rotated {
  @apply rotate-90;
}

.sector-chevron {
  @apply transition-transform duration-150;
  flex-shrink: 0;
}

.sidebar-add-btn {
  @apply w-full flex items-center gap-1.5 px-3 py-1.5 mx-1 rounded-md;
  @apply text-slate-500 hover:text-sky-400 hover:bg-slate-800/60 transition-all;
}

.sidebar-context-menu {
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

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.sidebar-terraform-clusters {
  padding-left: 20px;
}

.terraform-cluster-item {
  padding-left: 12px;
}

.sidebar-icon-indented {
  opacity: 0.6;
  width: 16px;
  height: 16px;
}
</style>

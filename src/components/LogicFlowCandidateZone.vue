<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import draggable from 'vuedraggable'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useLogicFlowStore } from '@/store/useLogicFlowStore'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const gameData = useGameDataStore()
const logicFlow = useLogicFlowStore()

// --- 一级分类 ---
const activeCategory = ref<'industrial' | 'agricultural'>('industrial')

// --- 二级分类药丸标签 ---
const activeSubCategory = ref('default') // 工业和农业均基于 race

const industrialRaces = ['default', 'terran', 'teladi']
const agriculturalRaces = ['argon', 'boron', 'paranid', 'split', 'teladi', 'terran']

// --- 计算过滤后的商品 ---
const filteredWares = computed(() => {
  // 从 Store 中获取预计算好的回溯集
  const currentWareSet = activeCategory.value === 'industrial'
    ? gameData.wareSetsByIndustrialRace[activeSubCategory.value]
    : gameData.wareSetsByRace[activeSubCategory.value]

  const res = Object.values(gameData.waresMap)
    .filter(w => {
      // 职责转移：UI 不再进行 group 过滤，完全信任 Store 的回溯结果
      return currentWareSet?.has(w.id)
    })
    .sort((a, b) => {
      // 1. 按 Tier 升序 (0, 1, 2, 3)
      if (a.tier !== b.tier) return a.tier - b.tier
      
      // 2. 特殊逻辑：如果是 Tier 0，能量电池始终排在最下面
      if (a.tier === 0) {
        if (a.id === 'energycells' && b.id !== 'energycells') return 1
        if (a.id !== 'energycells' && b.id === 'energycells') return -1
      }

      // 3. 同 Tier 内，已规划的排在上面
      const aPlanned = isWarePlanned(a.id)
      const bPlanned = isWarePlanned(b.id)
      if (aPlanned !== bPlanned) return aPlanned ? -1 : 1
      
      // 4. 字母顺序
      return a.id.localeCompare(b.id)
    })

  if (res.length === 0) {
    console.log('[CandidateZone] No wares found for:', activeCategory.value, activeSubCategory.value, 'WareSet size:', currentWareSet?.size || 0)
  } else {
    console.log('[CandidateZone] Found wares:', res.length, 'Example:', res[0]?.id)
  }
  return res
})

// --- 检查状态 ---
const isWarePlanned = (wareId: string) => {
  return logicFlow.isWareInAnyGroup(wareId)
}

/**
 * 将产物按 Tier 分组
 */
const waresByTier = computed(() => {
  const groups: Record<number, any[]> = { 0: [], 1: [], 2: [], 3: [] }
  filteredWares.value.forEach(w => {
    const list = groups[w.tier]
    if (list) {
      list.push(w)
    }
  })
  return groups
})

// --- 交互处理 ---
const handleSwitchCategory = (cat: 'industrial' | 'agricultural') => {
  activeCategory.value = cat
  activeSubCategory.value = cat === 'industrial' ? 'default' : 'argon'
}

// 是否默认锁定
const isDefaultLocked = ref(false)

const handleDragStart = (evt: any) => {
  const wareId = evt.item.getAttribute('data-ware-id')
  if (wareId) {
    logicFlow.startDragging(wareId)
  }
}

const handleDragEnd = () => {
  logicFlow.stopDragging()
}

// Quick Add / Manual Add
const handleQuickAdd = (wareId: string) => {
  const ware = gameData.waresMap[wareId]
  if (!ware) return

  // 使用当前选中的一二级分类作为上下文
  const category = activeCategory.value
  const subCategory = activeSubCategory.value
  const group = logicFlow.addGroup(category, subCategory, undefined, isDefaultLocked.value)
  
  logicFlow.expandUpstream(group.id, wareId, 'manual', subCategory)
  activeMenuWareId.value = null
}

// --- Menu State ---
const activeMenuWareId = ref<string | null>(null)
const menuPosition = ref({ x: 0, y: 0 })

const toggleMenu = (event: MouseEvent, wareId: string) => {
  if (activeMenuWareId.value === wareId) {
    activeMenuWareId.value = null
  } else {
    // 获取按钮位置
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const menuWidth = 192 // 菜单最小宽度
    const windowWidth = window.innerWidth
    
    // 碰撞检测：如果右侧空间不足，则向左弹出
    let x = rect.right + 8
    if (x + menuWidth > windowWidth) {
      x = rect.left - menuWidth - 8
    }

    menuPosition.value = {
      x: x,
      y: rect.top
    }
    activeMenuWareId.value = wareId
  }
}

const addToGroup = (groupId: string, wareId: string) => {
  const race = activeSubCategory.value
  logicFlow.expandUpstream(groupId, wareId, 'manual', race)
  activeMenuWareId.value = null
}

const handleClearAll = () => {
  if (confirm('确定要清空所有产线组吗？此操作不可撤销。')) {
    logicFlow.clearAllGroups()
  }
}

const handleAddWare = (ware: any) => {
  const isAgricultural = ['agricultural', 'food', 'pharmaceutical', 'water', 'ice'].includes(ware.group)
  const category = isAgricultural ? 'agricultural' : 'industrial'
  
  const subCategory = activeSubCategory.value
  const group = logicFlow.addGroup(category, subCategory, undefined, isDefaultLocked.value)
  
  logicFlow.expandUpstream(group.id, ware.id, 'manual', subCategory)
}

const handleGlobalClick = () => {
  activeMenuWareId.value = null
}

onMounted(() => {
  window.addEventListener('click', handleGlobalClick)
})

onUnmounted(() => {
  window.removeEventListener('click', handleGlobalClick)
})

// 暴露给外部 (测试环境)
defineExpose({
  handleAddWare,
  activeCategory,
  activeSubCategory
})
</script>

<template>
  <div class="candidate-zone">
    <!-- Top Header: Primary Tabs & Race Selection & Search -->
    <div class="header-area">
      <div class="header-left">
        <!-- Primary Tabs -->
        <div class="tab-group">
          <button 
            @click="handleSwitchCategory('industrial')"
            class="tab-btn"
            :class="activeCategory === 'industrial' ? 'tab-btn-industrial-active' : 'tab-btn-inactive'"
          >
            <span class="tab-dot" :class="activeCategory === 'industrial' ? 'tab-dot-active' : 'tab-dot-inactive'"></span>
            {{ t('ui.industrial') }}
          </button>
          <button 
            @click="handleSwitchCategory('agricultural')"
            class="tab-btn"
            :class="activeCategory === 'agricultural' ? 'tab-btn-agricultural-active' : 'tab-btn-inactive'"
          >
            <span class="tab-dot" :class="activeCategory === 'agricultural' ? 'tab-dot-active' : 'tab-dot-inactive'"></span>
            {{ t('ui.agricultural') }}
          </button>
        </div>

        <!-- Lock Control (iOS Style) -->
        <div class="lock-control flex items-center gap-2 ml-4">
          <label class="relative inline-flex items-center cursor-pointer group">
            <input 
              type="checkbox" 
              v-model="isDefaultLocked" 
              class="sr-only peer"
            >
            <div class="w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600 transition-colors"></div>
            <span class="ml-2 text-[10px] font-bold uppercase tracking-widest text-white/40 group-hover:text-white/70 transition-colors">
              {{ isDefaultLocked ? t('race.' + activeSubCategory) : t('logicFlow.unlock') }}
            </span>
          </label>
        </div>

        <!-- Race Selection (Secondary Nav moved to Header) -->
        <div class="race-filter">
          <div class="race-separator"></div>
          <button 
            v-for="sub in (activeCategory === 'industrial' ? industrialRaces : agriculturalRaces)"
            :key="sub"
            @click="activeSubCategory = sub"
            class="race-btn"
            :class="activeSubCategory === sub ? 'race-btn-active' : 'race-btn-inactive'"
          >
            {{ t(`race.${sub}`) }}
          </button>
        </div>
      </div>

      <!-- Global Search Integration -->
      <div class="global-search">
        <div class="search-wrapper group">
          <input 
            v-model="gameData.searchQuery"
            type="text" 
            :placeholder="t('planning.search_placeholder')"
            class="search-input"
          />
          <div class="search-actions">
            <button 
              v-if="gameData.searchQuery"
              @click="gameData.searchQuery = ''"
              class="search-clear-btn"
            >
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
            <div class="search-icon">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            </div>
          </div>
        </div>

        <button 
          @click="handleClearAll"
          class="clear-all-btn"
          v-if="logicFlow.groups.length > 0"
        >
          <span>🗑️</span>
          <span>{{ t('logicFlow.clearAll') }}</span>
        </button>
      </div>
    </div>

    <!-- Ware Grid: 4-Column Layout -->
    <div class="ware-grid">
      <div v-for="tier in [0, 1, 2, 3]" :key="tier" class="tier-column">
        <!-- Tier Header -->
        <div class="tier-header">
          <span class="tier-title">Tier {{ tier }}</span>
          <span class="tier-count">{{ waresByTier[tier]?.length || 0 }}</span>
        </div>

        <!-- Tier List -->
        <div class="tier-list custom-scrollbar">
          <draggable 
            class="draggable-area"
            :model-value="waresByTier[tier] || []"
            :group="{ name: 'wares', pull: 'clone', put: false }"
            :clone="(original: any) => ({ ...original })"
            :sort="false"
            item-key="id"
            :data-subcategory="activeSubCategory"
            @start="handleDragStart"
            @end="handleDragEnd"
          >
            <template #item="{ element: ware }">
              <div 
                :data-ware-id="ware.id"
                class="ware-card group"
                :class="[
                  isWarePlanned(ware.id) ? 'ware-card-planned' : 'ware-card-default',
                  gameData.searchQuery && (
                    ware.id.toLowerCase().includes(gameData.searchQuery.toLowerCase()) || 
                    ware.name.toLowerCase().includes(gameData.searchQuery.toLowerCase()) ||
                    (gameData.localizedWaresMap[ware.id]?.localeName.toLowerCase().includes(gameData.searchQuery.toLowerCase()))
                  ) ? 'ware-card-match' : ''
                ]"
              >
                <!-- Status Indicator -->
                <div 
                  class="ware-status-dot"
                  :class="isWarePlanned(ware.id) ? 'ware-status-dot-planned' : 'ware-status-dot-default'"
                ></div>

                <!-- Ware Icon Small -->
                <div class="ware-icon">
                  <span class="ware-icon-text">📦</span>
                </div>

                <!-- Ware Name -->
                <div class="ware-name">
                  {{ gameData.localizedWaresMap[ware.id]?.localeName || ware.name }}
                </div>

                <!-- T0 Resources Preview -->
                <div class="resource-preview-container" v-if="ware.tier > 0">
                  <div 
                    v-for="resId in Object.keys(logicFlow.calculateRequiredT0Wares(ware.id, activeSubCategory) || {}).sort()" 
                    :key="resId"
                    class="resource-tag"
                  >
                    <span class="resource-text">{{ t('res.' + resId) }}</span>
                  </div>
                </div>

                <!-- Quick Action Button -->
                <div class="quick-add-container" v-if="ware.tier > 0 && ware.id !== 'energycells'">
                  <button 
                    class="quick-add-btn"
                    @click.stop="toggleMenu($event, ware.id)"
                  >
                    ＋
                  </button>
                </div>

                <!-- Teleported Quick Menu (Moved outside scroll container) -->
                <Teleport to="body">
                  <div 
                    v-if="activeMenuWareId === ware.id"
                    class="context-menu"
                    :style="{
                      top: `${menuPosition.y}px`,
                      left: `${menuPosition.x}px`,
                    }"
                  >
                    <div class="context-menu-header">
                      Add to...
                    </div>
                    <div class="context-menu-list custom-scrollbar">
                      <button 
                        v-for="group in logicFlow.groups"
                        :key="group.id"
                        @click.stop="addToGroup(group.id, ware.id)"
                        class="context-menu-item"
                        :class="{ 
                          'opacity-40 cursor-not-allowed pointer-events-none': logicFlow.getWareGroupStatus(group.id, ware.id, activeSubCategory) === 'rejected',
                          'opacity-60': logicFlow.getWareGroupStatus(group.id, ware.id, activeSubCategory) === 'duplicated'
                        }"
                      >
                        <span class="flex-1 truncate">{{ group.name }}</span>
                        <span v-if="logicFlow.getWareGroupStatus(group.id, ware.id, activeSubCategory) === 'rejected'" class="text-[10px] ml-2">🚫</span>
                        <span v-else-if="logicFlow.getWareGroupStatus(group.id, ware.id, activeSubCategory) === 'duplicated'" class="text-[10px] ml-2 opacity-50">{{ t('logicFlow.duplicate') }}</span>
                        <span v-else-if="group.isLocked" class="text-[10px] ml-2 opacity-50">{{ t('race.' + group.lockedLineage) }}</span>
                      </button>
                    </div>
                    <button 
                      @click.stop="handleQuickAdd(ware.id)"
                      class="context-menu-new-line"
                    >
                      <span>✨</span>
                      <span>New Production Line</span>
                    </button>
                  </div>
                </Teleport>
              </div>
            </template>
          </draggable>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  @apply bg-transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  @apply bg-white/5 rounded-full hover:bg-white/10;
}

/* --- Main Layout --- */
.candidate-zone {
  @apply flex flex-col h-full bg-[#0f172a] border-b border-white/10 shadow-2xl relative z-10;
}

.header-area {
  @apply flex items-center justify-between px-6 py-4 border-b border-white/10;
}

.header-left {
  @apply flex items-center gap-6;
}

/* --- Tabs --- */
.tab-group {
  @apply flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10;
}

.tab-btn {
  @apply flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm transition-all duration-300;
}

.tab-btn-industrial-active {
  @apply bg-blue-600 text-white shadow-lg shadow-blue-900/40;
}

.tab-btn-agricultural-active {
  @apply bg-emerald-600 text-white shadow-lg shadow-emerald-900/40;
}

.tab-btn-inactive {
  @apply text-white/40 hover:text-white/60;
}

.tab-dot {
  @apply w-1.5 h-1.5 rounded-full;
}

.tab-dot-active {
  @apply bg-white;
}

.tab-dot-inactive {
  @apply bg-white/20;
}

/* --- Race Filter --- */
.race-filter {
  @apply flex items-center gap-2 h-8;
}

.race-separator {
  @apply h-4 w-[1px] bg-white/10 mr-2;
}

.race-btn {
  @apply px-3 py-1 rounded-lg text-[10px] font-bold transition-all border whitespace-nowrap uppercase tracking-wider;
}

.race-btn-active {
  @apply bg-white/15 border-white/20 text-white shadow-sm shadow-black/20;
}

.race-btn-inactive {
  @apply border-transparent text-white/30 hover:text-white/50 hover:bg-white/5;
}

/* --- Global Search --- */
.global-search {
  @apply flex items-center gap-4;
}

.search-wrapper {
  @apply relative w-72;
}

.search-input {
  @apply w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/50 focus:bg-white/10 focus:ring-2 focus:ring-blue-500/10 transition-all placeholder:text-white/20;
}

.search-actions {
  @apply absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2;
}

.search-clear-btn {
  @apply text-white/20 hover:text-white/60 transition-colors;
}

.search-icon {
  @apply text-white/20 group-hover:text-white/40 pointer-events-none border-l border-white/10 pl-2 ml-1;
}

.clear-all-btn {
  @apply flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white hover:shadow-lg hover:shadow-red-900/20;
}

/* --- Ware Grid --- */
.ware-grid {
  @apply flex-1 overflow-hidden p-6 grid grid-cols-4 gap-6 bg-transparent;
}

.tier-column {
  @apply flex flex-col h-full min-w-0;
}

.tier-header {
  @apply flex items-center justify-between px-2 py-1 mb-2 border-b border-white/10;
}

.tier-title {
  @apply text-[10px] font-black text-white/60 uppercase tracking-widest;
}

.tier-count {
  @apply text-[9px] text-white/40;
}

.tier-list {
  @apply flex-1 overflow-y-auto pr-1;
}

.draggable-area {
  @apply flex flex-col gap-1.5 min-h-[50px];
}

/* --- Ware Card --- */
.ware-card {
  @apply relative flex items-center h-8 px-2 rounded-lg border transition-all duration-300 cursor-grab hover:bg-white/10;
}

.ware-card-planned {
  @apply bg-emerald-500/20 border-emerald-500/50 shadow-[inset_0_0_10px_rgba(16,185,129,0.1)];
}

.ware-card-default {
  @apply bg-white/5 border-white/10 hover:border-white/30;
}

.ware-card-match {
  @apply ring-1 ring-blue-500/50 border-blue-500/50 bg-blue-500/5;
}

.ware-status-dot {
  @apply w-1.5 h-1.5 rounded-full mr-2 shrink-0;
}

.ware-status-dot-planned {
  @apply bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)];
}

.ware-status-dot-default {
  @apply bg-white/20;
}

.ware-icon {
  @apply w-5 h-5 rounded bg-white/10 flex items-center justify-center mr-2 shrink-0 border border-white/10 group-hover:border-white/30 transition-colors shadow-sm shadow-black/40;
}

.ware-icon-text {
  @apply text-[10px] opacity-80 group-hover:opacity-100 transition-opacity;
}

.ware-name {
  @apply text-[11px] font-bold truncate text-white max-w-[120px];
}

/* --- Resource Preview --- */
.resource-preview-container {
  @apply flex items-center gap-1 ml-2 overflow-hidden flex-1;
}

.resource-tag {
  @apply flex items-center gap-0.5 px-1 rounded bg-white/5 border border-white/10 shrink-0;
}

.resource-text {
  @apply text-[9px] font-medium text-blue-200;
}

/* --- Quick Add Button --- */
.quick-add-container {
  @apply flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-auto shrink-0;
}

.quick-add-btn {
  @apply w-5 h-5 rounded-md bg-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white transition-all flex items-center justify-center text-[10px] relative z-20;
}

/* --- Context Menu --- */
.context-menu {
  @apply fixed bg-slate-900 border border-white/10 rounded-xl shadow-2xl z-[9999] overflow-hidden min-w-[192px];
}

.context-menu-header {
  @apply p-2 border-b border-white/5 bg-black/40 text-[9px] font-bold text-white/20 uppercase tracking-widest;
}

.context-menu-list {
  @apply max-h-48 overflow-y-auto;
}

.context-menu-item {
  @apply w-full px-4 py-2 text-left text-[11px] text-white/60 hover:text-white hover:bg-blue-500/20 transition-all flex items-center gap-2;
}

.context-menu-dot {
  @apply w-1.5 h-1.5 rounded-full;
}

.context-menu-dot-industrial {
  @apply bg-blue-500;
}

.context-menu-dot-agricultural {
  @apply bg-emerald-500;
}

.context-menu-new-line {
  @apply w-full px-4 py-2 text-left text-[11px] text-blue-400 hover:text-white hover:bg-blue-500 transition-all border-t border-white/5 flex items-center gap-2;
}
</style>

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

// --- 逻辑组定义 (基于 design.md) ---
const INDUSTRIAL_GROUPS = ['minerals', 'gases', 'refined', 'hightech', 'shiptech', 'energy']
const AGRICULTURAL_GROUPS = ['agricultural', 'food', 'pharmaceutical', 'water', 'ice', 'energy']

// --- 计算过滤后的商品 ---
const filteredWares = computed(() => {
  const allowedGroups = activeCategory.value === 'industrial' ? INDUSTRIAL_GROUPS : AGRICULTURAL_GROUPS
  
  // 从 Store 中获取预计算好的回溯集
  const currentWareSet = activeCategory.value === 'industrial'
    ? gameData.wareSetsByIndustrialRace[activeSubCategory.value]
    : gameData.wareSetsByRace[activeSubCategory.value]

  const res = Object.values(gameData.waresMap)
    .filter(w => {
      // 1. 基础组过滤
      if (!allowedGroups.includes(w.group)) return false
      
      // 2. 特殊逻辑：冰 (Ice) 仅出现在农业分类下
      if (w.id === 'ice' && activeCategory.value === 'industrial') return false
      
      // 3. 基于回溯和直接生产的综合过滤
      // Tier 0 产物 (资源/电池) 只要在组内就显示，其他的需要满足回溯关系
      let matchesBacktrace = false
      if (w.tier === 0 || w.id === 'energycells') {
        matchesBacktrace = true
      } else {
        matchesBacktrace = currentWareSet?.has(w.id) || false
      }

      if (!matchesBacktrace) return false

      return true
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

const handleWareClick = (wareId: string) => {
  // If no group exists, create one
  if (logicFlow.groups.length === 0) {
    handleQuickAdd(wareId)
  } else if (logicFlow.activeGroupId) {
    // Add to active group
    const race = activeSubCategory.value
    logicFlow.expandUpstream(logicFlow.activeGroupId, wareId, 'manual', race)
  }
}

const handleDragStart = (evt: any) => {
  console.log('[CandidateZone] Drag start triggered')
  logicFlow.isDragging = true
  const wareId = evt.item.getAttribute('data-ware-id')
  if (wareId) {
    logicFlow.draggingWareId = wareId
  }
}

const handleDragEnd = () => {
  console.log('[CandidateZone] Drag end triggered')
  logicFlow.isDragging = false
  logicFlow.draggingWareId = null
  logicFlow.hoveredGroupId = null // 确保清理悬停状态
}

// Quick Add / Manual Add
const handleQuickAdd = (wareId: string) => {
  const ware = gameData.waresMap[wareId]
  if (!ware) return

  // 使用当前选中的一二级分类作为上下文
  const category = activeCategory.value
  const subCategory = activeSubCategory.value

  const group = logicFlow.addGroup(category, subCategory)
  
  logicFlow.expandUpstream(group.id, wareId, 'manual', subCategory)
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
  const group = logicFlow.addGroup(category, subCategory)
  
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
  <div class="candidate-zone flex flex-col h-full bg-[#0f172a] border-b border-white/10 shadow-2xl relative z-10">
    <!-- Top Header: Primary Tabs & Race Selection & Search -->
    <div class="flex items-center justify-between px-6 py-4 border-b border-white/10">
      <div class="flex items-center gap-6">
        <!-- Primary Tabs -->
        <div class="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
          <button 
            @click="handleSwitchCategory('industrial')"
            class="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm transition-all duration-300"
            :class="activeCategory === 'industrial' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'text-white/40 hover:text-white/60'"
          >
            <span class="w-1.5 h-1.5 rounded-full" :class="activeCategory === 'industrial' ? 'bg-white' : 'bg-white/20'"></span>
            {{ t('ui.industrial') }}
          </button>
          <button 
            @click="handleSwitchCategory('agricultural')"
            class="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm transition-all duration-300"
            :class="activeCategory === 'agricultural' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40' : 'text-white/40 hover:text-white/60'"
          >
            <span class="w-1.5 h-1.5 rounded-full" :class="activeCategory === 'agricultural' ? 'bg-white' : 'bg-white/20'"></span>
            {{ t('ui.agricultural') }}
          </button>
        </div>

        <!-- Race Selection (Secondary Nav moved to Header) -->
        <div class="flex items-center gap-2 h-8">
          <div class="h-4 w-[1px] bg-white/10 mr-2"></div>
          <button 
            v-for="sub in (activeCategory === 'industrial' ? industrialRaces : agriculturalRaces)"
            :key="sub"
            @click="activeSubCategory = sub"
            class="px-3 py-1 rounded-lg text-[10px] font-bold transition-all border whitespace-nowrap uppercase tracking-wider"
            :class="activeSubCategory === sub 
              ? 'bg-white/15 border-white/20 text-white shadow-sm shadow-black/20' 
              : 'border-transparent text-white/30 hover:text-white/50 hover:bg-white/5'"
          >
            {{ activeCategory === 'industrial' ? sub : t(`race.${sub}`) }}
          </button>
        </div>
      </div>

      <!-- Global Search Integration -->
      <div class="flex items-center gap-4">
        <div class="relative w-72 group">
          <input 
            v-model="gameData.searchQuery"
            type="text" 
            :placeholder="t('planning.search_placeholder')"
            class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/50 focus:bg-white/10 focus:ring-2 focus:ring-blue-500/10 transition-all placeholder:text-white/20"
          />
          <div class="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <button 
              v-if="gameData.searchQuery"
              @click="gameData.searchQuery = ''"
              class="text-white/20 hover:text-white/60 transition-colors"
            >
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
            <div class="text-white/20 group-hover:text-white/40 pointer-events-none border-l border-white/10 pl-2 ml-1">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            </div>
          </div>
        </div>

        <button 
          @click="handleClearAll"
          class="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white hover:shadow-lg hover:shadow-red-900/20"
          v-if="logicFlow.groups.length > 0"
        >
          <span>🗑️</span>
          <span>Clear All</span>
        </button>
      </div>
    </div>

    <!-- Ware Grid: 4-Column Layout -->
    <div class="flex-1 overflow-hidden p-6 grid grid-cols-4 gap-6 bg-transparent">
      <div v-for="tier in [0, 1, 2, 3]" :key="tier" class="flex flex-col h-full min-w-0">
        <!-- Tier Header -->
        <div class="flex items-center justify-between px-2 py-1 mb-2 border-b border-white/10">
          <span class="text-[10px] font-black text-white/60 uppercase tracking-widest">Tier {{ tier }}</span>
          <span class="text-[9px] text-white/40">{{ waresByTier[tier]?.length || 0 }}</span>
        </div>

        <!-- Tier List -->
        <div class="flex-1 overflow-y-auto custom-scrollbar pr-1">
          <draggable 
            class="flex flex-col gap-1.5 min-h-[50px]"
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
                @click="handleWareClick(ware.id)"
                :data-ware-id="ware.id"
                class="ware-card group relative flex items-center h-8 px-2 rounded-lg border transition-all duration-300 cursor-pointer hover:bg-white/10"
                :class="[
                  isWarePlanned(ware.id) 
                    ? 'bg-emerald-500/20 border-emerald-500/50 shadow-[inset_0_0_10px_rgba(16,185,129,0.1)]' 
                    : 'bg-white/5 border-white/10 hover:border-white/30',
                  gameData.searchQuery && (
                    ware.id.toLowerCase().includes(gameData.searchQuery.toLowerCase()) || 
                    ware.name.toLowerCase().includes(gameData.searchQuery.toLowerCase()) ||
                    (gameData.localizedWaresMap[ware.id]?.localeName.toLowerCase().includes(gameData.searchQuery.toLowerCase()))
                  )
                    ? 'ring-1 ring-blue-500/50 border-blue-500/50 bg-blue-500/5'
                    : ''
                ]"
              >
                <!-- Status Indicator -->
                <div 
                  class="w-1.5 h-1.5 rounded-full mr-2 shrink-0"
                  :class="isWarePlanned(ware.id) ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-white/20'"
                ></div>

                <!-- Ware Icon Small -->
                <div class="w-5 h-5 rounded bg-white/10 flex items-center justify-center mr-2 shrink-0 border border-white/10 group-hover:border-white/30 transition-colors shadow-sm shadow-black/40">
                  <span class="text-[10px] opacity-80 group-hover:opacity-100 transition-opacity">📦</span>
                </div>

                <!-- Ware Name -->
                <div class="flex-1 text-[11px] font-bold truncate text-white">
                  {{ gameData.localizedWaresMap[ware.id]?.localeName || ware.name }}
                </div>

                <!-- Quick Action Button -->
                <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0">
                  <button 
                    class="w-5 h-5 rounded-md bg-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white transition-all flex items-center justify-center text-[10px] relative z-20"
                    @click.stop="toggleMenu($event, ware.id)"
                  >
                    ＋
                  </button>
                </div>

                <!-- Teleported Quick Menu (Moved outside scroll container) -->
                <Teleport to="body">
                  <div 
                    v-if="activeMenuWareId === ware.id"
                    class="fixed bg-slate-900 border border-white/10 rounded-xl shadow-2xl z-[9999] overflow-hidden min-w-[192px]"
                    :style="{
                      top: `${menuPosition.y}px`,
                      left: `${menuPosition.x}px`,
                    }"
                  >
                    <div class="p-2 border-b border-white/5 bg-black/40 text-[9px] font-bold text-white/20 uppercase tracking-widest">
                      Add to...
                    </div>
                    <div class="max-h-48 overflow-y-auto custom-scrollbar">
                      <button 
                        v-for="group in logicFlow.groups"
                        :key="group.id"
                        @click.stop="addToGroup(group.id, ware.id)"
                        class="w-full px-4 py-2 text-left text-[11px] text-white/60 hover:text-white hover:bg-blue-500/20 transition-all flex items-center gap-2"
                      >
                        <span class="w-1.5 h-1.5 rounded-full" :class="group.category === 'industrial' ? 'bg-blue-500' : 'bg-emerald-500'"></span>
                        <span class="truncate">{{ group.name }}</span>
                      </button>
                    </div>
                    <button 
                      @click.stop="handleQuickAdd(ware.id)"
                      class="w-full px-4 py-2 text-left text-[11px] text-blue-400 hover:text-white hover:bg-blue-500 transition-all border-t border-white/5 flex items-center gap-2"
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
</style>

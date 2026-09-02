<script setup lang="ts">
import draggable from 'vuedraggable'
import { useLogicFlowCandidatePresenter } from './presenters/useLogicFlowCandidatePresenter'

const presenter = useLogicFlowCandidatePresenter()
const {
  t,
  activeCategory,
  activeSubCategory,
  activeMenuWareId,
  menuPosition,
  searchQuery,
  isDefaultLocked,
  categoryOptions,
  subCategoryOptions,
  canDefaultLock,
  defaultLockLabel,
  groupCount,
  isEditingTitle,
  tierColumns,
  displayTitle,
  editingValue,
  startEditingTitle,
  finishEditingTitle,
  confirmEditingTitle,
  switchCategory: handleSwitchCategory,
  setSubCategory,
  startDrag: handleDragStart,
  stopDrag: handleDragEnd,
  quickAdd: handleQuickAdd,
  groupOptions,
  addToGroup,
  toggleMenu,
  clearAll: handleClearAll,
  addWare: handleAddWare,
} = presenter
// @ts-ignore - used in template via ref="titleInputRef"
const titleInputRef = presenter.titleInputRef

defineExpose({ handleAddWare, activeCategory, activeSubCategory })
</script>

<template>
  <div class="candidate-zone">
    <!-- Plan Title Row -->
    <div class="plan-title-row">
      <div class="plan-title-left">
        <div class="plan-title-indicator"></div>

        <!-- 编辑模式 -->
        <div v-if="isEditingTitle" class="plan-title-edit-group">
          <input
            ref="titleInputRef"
            v-model="editingValue"
            class="plan-title-input"
            @blur="finishEditingTitle"
            @keydown.enter="confirmEditingTitle"
          />
          <button
            @mousedown.prevent="confirmEditingTitle"
            class="plan-title-confirm-btn"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </button>
        </div>

        <!-- 显示模式 -->
        <div
          v-else
          class="plan-title-display-group group/title"
          @click="startEditingTitle"
        >
          <h3 class="plan-title-text">{{ displayTitle }}</h3>
          <svg class="plan-title-edit-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </div>
      </div>

      <!-- Clear All Button -->
      <button
        @click="handleClearAll"
        class="clear-all-btn"
        v-if="groupCount > 0"
      >
        <span>🗑️</span>
        <span>{{ t('logicFlow.clearAll') }}</span>
      </button>
    </div>

    <!-- Top Header: Primary Tabs & Race Selection & Search -->
    <div class="header-area">
      <div class="header-left">
        <!-- Primary Tabs -->
        <div class="tab-group">
          <button
            v-for="category in categoryOptions"
            :key="category.id"
            @click="handleSwitchCategory(category.id)"
            class="tab-btn"
            :class="activeCategory === category.id
              ? (category.id === 'industrial' ? 'tab-btn-industrial-active' : 'tab-btn-agricultural-active')
              : 'tab-btn-inactive'"
          >
            <span class="tab-dot" :class="activeCategory === category.id ? 'tab-dot-active' : 'tab-dot-inactive'"></span>
            {{ category.label }}
          </button>
        </div>

        <!-- Lock Control (iOS Style) -->
        <div class="lock-control">
          <label class="lock-label group">
            <input
              type="checkbox"
              v-model="isDefaultLocked"
              :disabled="!canDefaultLock"
              class="sr-only peer"
            >
            <div class="lock-toggle"></div>
            <span class="lock-label-text">
              {{ defaultLockLabel }}
            </span>
          </label>
        </div>

        <!-- Race Selection (Secondary Nav moved to Header) -->
        <div class="race-filter">
          <div class="race-separator"></div>
          <button
            v-for="sub in subCategoryOptions"
            :key="sub.id"
            @click="setSubCategory(sub.id)"
            class="race-btn"
            :class="activeSubCategory === sub.id ? 'race-btn-active' : 'race-btn-inactive'"
          >
            {{ sub.label }}
          </button>
        </div>
      </div>

      <!-- Global Search Integration -->
      <div class="global-search">
        <div class="search-wrapper group">
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="t('planning.search_placeholder')"
            class="search-input"
          />
          <div class="search-actions">
            <button
              v-if="searchQuery"
              @click="searchQuery = ''"
              class="search-clear-btn"
            >
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
            <div class="search-icon">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Ware Grid: 4-Column Layout -->
    <div class="ware-grid">
      <div v-for="column in tierColumns" :key="column.tier" class="tier-column">
        <!-- Tier Header -->
        <div class="tier-header">
          <span class="tier-title">Tier {{ column.tier }}</span>
          <span class="tier-count">{{ column.wares.length }}</span>
        </div>

        <!-- Tier List -->
        <div class="tier-list custom-scrollbar">
          <draggable 
            class="draggable-area"
            :model-value="column.wares"
            :group="{ name: 'wares', pull: 'clone', put: false }"
            :clone="(original: any) => ({ ...original, instanceId: Date.now() + Math.random() })"
            :sort="false"
            :disabled="column.wares.length > 0 && column.wares.every(ware => !ware.isSelectable)"
            item-key="id"
            :data-subcategory="activeSubCategory"
            @start="handleDragStart"
            @end="handleDragEnd"
          >
            <template #item="{ element: ware }">
              <div 
                :data-ware-id="ware.id"
                :data-tier="ware.tier"
                :draggable="ware.isSelectable"
                class="ware-card-wrapper group"
                :class="[
                  !ware.isSelectable ? 'is-locked-tier cursor-not-allowed opacity-70' : 'is-draggable-tier cursor-grab',
                  ware.isPlanned ? 'ware-card-planned' : 'ware-card-default',
                  ware.isSearchMatch ? 'ware-card-match' : ''
                ]"
              >
                <div class="ware-card-bg" v-if="ware.isSelectable">
                  <button 
                    class="ware-card-add-btn"
                    @click.stop="toggleMenu($event, ware.id)"
                  >
                    ＋
                  </button>
                </div>

                <div class="ware-card-bg" v-else></div>

                <!-- Content Layer -->
                <div class="ware-card-content">
                  <!-- Status Indicator -->
                  <div 
                    class="ware-status-dot"
                    :class="ware.isPlanned ? 'ware-status-dot-planned' : 'ware-status-dot-default'"
                  ></div>

                  <!-- Ware Icon Small -->
                  <div class="ware-icon">
                    <span class="ware-icon-text">📦</span>
                  </div>

                  <!-- Grid for Overlapping -->
                  <div class="ware-content-grid">
                    <!-- Ware Name (Layer 1) -->
                    <div class="ware-name">
                      {{ ware.label }}
                    </div>

                    <!-- T0 Resources + Compression Rate (Layer 2) -->
                    <div class="ware-info-overlay" v-if="!ware.isRawMaterial">
                      <!-- T0 Resources with Gradient Mask -->
                      <div class="resource-preview-container">
                        <div 
                          v-for="resId in ware.resourceIds"
                          :key="resId"
                          class="resource-tag"
                        >
                          <span class="resource-text">{{ t('res.' + resId) }}</span>
                        </div>
                      </div>

                      <!-- Volume Compression Rate -->
                      <div 
                        v-if="ware.compressionRate !== undefined"
                        class="compression-rate-container"
                      >
                        <span 
                          class="compression-rate-text"
                          :class="ware.compressionRate <= 1 ? 'text-emerald-400' : 'text-red-400'"
                        >
                          {{ Math.round(ware.compressionRate * 100) }}%
                        </span>
                        <svg 
                          class="w-3 h-3 shrink-0"
                          :class="ware.compressionRate <= 1 ? 'text-emerald-400/60' : 'text-red-400/60'"
                          viewBox="0 0 24 24" 
                          fill="none" 
                          stroke="currentColor" 
                          stroke-width="2" 
                          stroke-linecap="round" 
                          stroke-linejoin="round"
                        >
                          <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
                          <path d="m3.3 7 8.7 5 8.7-5"/>
                          <path d="M12 22V12"/>
                        </svg>
                      </div>
                    </div>
                  </div>
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
                      {{ t('logicFlow.addTo') }}
                    </div>
                    <div class="context-menu-list custom-scrollbar">
                      <button 
                        v-for="group in groupOptions(ware.id)"
                        :key="group.id"
                        @click.stop="addToGroup(group.id, ware.id)"
                        class="context-menu-item"
                        :class="{ 
                          'opacity-40 cursor-not-allowed pointer-events-none': group.status === 'rejected',
                          'opacity-60': group.status === 'duplicated'
                        }"
                      >
                        <span class="flex-1 truncate">{{ group.label }}</span>
                        <span v-if="group.status === 'rejected'" class="text-[10px] ml-2">🚫</span>
                        <span v-else-if="group.status === 'duplicated'" class="text-[10px] ml-2 opacity-50">{{ t('logicFlow.duplicate') }}</span>
                        <span v-else-if="group.status === 'isolated'" class="text-[10px] ml-2 opacity-70">{{ t('logicFlow.isolate') }}</span>
                        <span v-else-if="group.status === 'auto'" class="text-[10px] ml-2 opacity-70">{{ t('logicFlow.auto') }}</span>
                        <span v-else-if="group.lockedLabel" class="text-[10px] ml-2 opacity-50">{{ group.lockedLabel }}</span>
                      </button>
                    </div>
                    <button 
                      @click.stop="handleQuickAdd(ware.id)"
                      class="context-menu-new-line"
                    >
                      <span>✨</span>
                      <span>{{ t('logicFlow.newProductionLine') }}</span>
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
  @apply flex flex-col bg-[#0f172a] border-b border-white/10 shadow-2xl relative z-10;
}

/* --- Plan Title Row --- */
.plan-title-row {
  @apply flex items-center justify-between px-6 py-3 border-b border-white/10;
}

.plan-title-left {
  @apply flex items-center gap-2 min-w-0;
}

.plan-title-indicator {
  @apply w-1.5 h-4 rounded-full bg-fuchsia-500 flex-shrink-0;
  box-shadow: 0 0 8px rgba(167, 139, 250, 0.5);
}

.plan-title-edit-group {
  @apply flex items-center gap-2 flex-1 min-w-0;
}

.plan-title-input {
  @apply bg-slate-700 text-white font-black text-xl px-2 py-0.5 rounded border border-fuchsia-500/50 outline-none flex-1 min-w-0 text-left transition-all;
  height: 32px;
}

.plan-title-confirm-btn {
  @apply text-green-400 hover:text-green-300 transition-colors p-1 rounded hover:bg-slate-700 flex items-center justify-center flex-shrink-0;
  width: 32px;
  height: 32px;
}

.plan-title-display-group {
  @apply flex items-center gap-2 cursor-pointer hover:bg-slate-700/50 px-2 py-0.5 rounded transition-colors min-w-0;
}

.plan-title-text {
  @apply text-xl font-black text-white tracking-tight truncate;
}

.plan-title-edit-icon {
  @apply w-4 h-4 text-slate-500 opacity-0 group-hover/title:opacity-100 transition-opacity flex-shrink-0;
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

/* --- Lock Control --- */
.lock-control {
  @apply flex items-center gap-2 ml-4;
}

.lock-label {
  @apply relative inline-flex items-center cursor-pointer;
}

.lock-toggle {
  @apply w-9 h-5 bg-white/10 rounded-full transition-colors;
  position: relative;
}

.lock-toggle::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  background: white;
  border: 1px solid rgb(209 213 219);
  border-radius: 9999px;
  transition: transform 0.2s;
}

.peer:checked ~ .lock-toggle {
  background: rgb(37 99 235);
}

.peer:checked ~ .lock-toggle::after {
  transform: translateX(16px);
}

.lock-label-text {
  @apply ml-2 text-[10px] font-bold uppercase tracking-widest text-white/40 group-hover:text-white/70 transition-colors;
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
  @apply overflow-hidden pl-4 pr-8 grid grid-cols-[2fr_3fr_3fr_4fr] gap-12 bg-transparent;
}

.tier-column {
  @apply flex flex-col min-w-0;
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
  @apply flex-1 overflow-y-auto overflow-x-hidden mr-[-36px] pr-[36px];
}
.draggable-area {
  @apply flex flex-col gap-1.5 min-h-[50px] mb-1.5;
}

/* --- Ware Card --- */
.ware-card-wrapper {
  @apply relative h-8 z-10 hover:z-20;
}

.ware-card-bg {
  @apply absolute inset-y-0 left-0 w-full rounded-lg border transition-all duration-300 ease-in-out overflow-hidden z-10;
  @apply bg-white/5 border-white/10;
}

.group:hover .ware-card-bg {
  width: calc(100% + 28px);
}

.ware-card-add-btn {
  @apply absolute right-0 top-0 bottom-0 w-7 flex items-center justify-center;
  @apply bg-blue-600 hover:bg-blue-500 text-white cursor-pointer;
  @apply translate-x-full group-hover:translate-x-0 transition-transform duration-300;
}

.ware-card-content {
  @apply absolute inset-0 w-full h-full px-2 z-20 pointer-events-none flex items-center;
}

.ware-card-content > * {
  @apply pointer-events-auto;
}

.ware-card-planned .ware-card-bg {
  @apply bg-emerald-500/20 border-emerald-500/50 shadow-[inset_0_0_10px_rgba(16,185,129,0.1)];
}

.ware-card-default .ware-card-bg {
  @apply bg-white/5 border-white/10;
}

.group:hover .ware-card-default .ware-card-bg {
  @apply border-white/30;
}

.ware-card-match .ware-card-bg {
  @apply ring-1 ring-blue-500/50 border-blue-500/50 bg-blue-500/5;
}

.is-locked-tier .ware-card-bg {
  @apply opacity-70;
}

.is-locked-tier:hover .ware-card-bg {
  @apply bg-transparent border-white/10;
  width: 100%;
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

/* --- Ware Content Grid (Overlapping Layers) --- */
.ware-content-grid {
  @apply grid grid-cols-[1fr_auto] items-center w-full relative;
}

/* --- Ware Name (Layer 1) --- */
.ware-content-grid > .ware-name {
  @apply col-start-1 col-end-3 row-start-1 text-[11px] font-bold text-white whitespace-nowrap z-0 pr-2 group-hover:text-white transition-colors;
}

/* --- Ware Info Overlay (Layer 2) --- */
.ware-info-overlay {
  @apply col-start-2 row-start-1 z-10 flex items-center h-full ml-auto;
}

/* --- Resource Preview with Gradient Mask --- */
.resource-preview-container {
  @apply flex items-center gap-1 h-full pl-2 pr-0;
  @apply transition-opacity duration-300 hover:opacity-0;
}

.resource-tag {
  @apply flex items-center gap-0.5 px-1 rounded bg-white/5 border border-white/10 shrink-0 bg-slate-900/70;
}

.resource-text {
  @apply text-[9px] font-medium text-blue-200;
}

/* --- Compression Rate --- */
.compression-rate-container {
  @apply flex items-center gap-0.5 shrink-0 h-full px-1;
  @apply transition-opacity duration-300;
}

.compression-rate-text {
  @apply text-[9px] font-bold font-mono min-w-[22px] text-right;
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

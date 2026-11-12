<script setup lang="ts">
import X4DualPhaseRangeSlider from '@/components/common/X4DualPhaseRangeSlider.vue'
import ShipStoragePanel from './ShipStoragePanel.vue'
import { useShipBuildFitPanelPresenter, type ShipFitProps, type ShipFitEvents } from './presenters/useShipBuildFitPanelPresenter'
const props = defineProps<ShipFitProps>()
const emit = defineEmits<ShipFitEvents>()
const { isDlcActive, getDlcDisplayName, side, blueprint, selectedShip, mirrored, compare, locked, activate, expandComparison, enterShipSelector, fitMode, activeSlotType, activeTabKey, expandedSlotKey, blueprintMenuOpen, blueprintMenuRef, fitPanelRef, blueprintTriggerRef, blueprintMenuStyle, currentBlueprintLabel, saveCurrentBlueprint, shouldShowBlueprintDirtyDot, currentBlueprintFavorited, toggleFavoriteCurrent, toggleFavoriteItem, groupedLoadableBlueprintItems, toggleBlueprintMenu, handleBlueprintSelect, handleBlueprintDelete, setMode, availableSlotTypes, renderGroupTabRows, slotTargets, visibleCompatibilityTags, visibleCompatibilityTagLabels, compatibilitySlotLines, selectedNameForTarget, selectedEquipmentForTarget, shouldShowSelectedDlcTag, isMixedSelectionInGroup, handleSlotTypeClick, jumpToTab, t, translateShip, handleSlotClick, sliderStepForTarget, isCountSliderDisabled, getDisplayedCount, handleCountSliderRealtime, handleCountSliderCommit } = useShipBuildFitPanelPresenter(props, emit)
defineExpose({ isDlcActive, getDlcDisplayName, side, blueprint, selectedShip, mirrored, compare, locked, activate, expandComparison, enterShipSelector, fitMode, activeSlotType, activeTabKey, expandedSlotKey, blueprintMenuOpen, blueprintMenuRef, fitPanelRef, blueprintTriggerRef, blueprintMenuStyle, currentBlueprintLabel, saveCurrentBlueprint, shouldShowBlueprintDirtyDot, currentBlueprintFavorited, toggleFavoriteCurrent, toggleFavoriteItem, groupedLoadableBlueprintItems, toggleBlueprintMenu, handleBlueprintSelect, handleBlueprintDelete, setMode, availableSlotTypes, renderGroupTabRows, slotTargets, visibleCompatibilityTags, visibleCompatibilityTagLabels, compatibilitySlotLines, selectedNameForTarget, selectedEquipmentForTarget, shouldShowSelectedDlcTag, isMixedSelectionInGroup, handleSlotTypeClick, jumpToTab, t, translateShip, handleSlotClick, sliderStepForTarget, isCountSliderDisabled, getDisplayedCount, handleCountSliderRealtime, handleCountSliderCommit })
</script>

<template>
  <div
    class="col-span-12 panel-card"
    :class="[wide ? 'lg:col-span-8' : 'lg:col-span-4', { mirrored }]"
    :data-side="side"
    @pointerdown="activate"
    @focusin="activate"
    @click="activate"
    data-testid="ship-build-panel-fit"
    ref="fitPanelRef"
  >
    <div class="panel-header">
      <template v-if="selectedShip">
        <button
          class="ship-switcher ship-switcher-action"
          data-testid="ship-build-change-ship-fit-header"
          :title="t('ship_build.change_ship')"
          :aria-label="t('ship_build.change_ship')"
          @click="enterShipSelector"
        >
          <div class="ship-switcher-main">
            <span class="ship-switcher-name">{{ translateShip(selectedShip) }}</span>
          </div>
          <span class="ship-switcher-divider" />
          <svg class="h-3.5 w-3.5 shrink-0 ml-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 3h6v6" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M10 14L21 3" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          </svg>
        </button>
        <div class="ship-blueprint-picker" ref="blueprintMenuRef">
          <button
            class="ship-blueprint-fav-btn"
            :class="{ 'is-favorited': currentBlueprintFavorited }"
            :title="currentBlueprintFavorited ? t('shipBuild.fav_remove') : t('shipBuild.fav_add')"
            data-testid="ship-build-blueprint-fav-btn"
            @click="toggleFavoriteCurrent"
          >
            <svg v-if="currentBlueprintFavorited" class="h-4 w-4 text-yellow-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            <svg v-else class="h-4 w-4 text-slate-400 hover:text-yellow-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </button>
          <div class="ship-blueprint-actions">
            <button class="ship-blueprint-save" :disabled="locked" :title="t('menu.save')" :aria-label="t('menu.save')"
              data-testid="ship-build-blueprint-save" @click.stop="saveCurrentBlueprint()">
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12l4 4v12a2 2 0 0 1-2 2Z M17 21v-8H7v8 M7 3v5h8V3" />
              </svg>
            </button>
          <button
            class="ship-blueprint-trigger"
            :disabled="locked"
            data-testid="ship-build-blueprint-menu-trigger"
            :title="t('shipBuild.load_blueprint')"
            @click="toggleBlueprintMenu"
            ref="blueprintTriggerRef"
          >
            <span class="ship-blueprint-status">
              {{ currentBlueprintLabel }}
              <span v-if="shouldShowBlueprintDirtyDot" class="ship-blueprint-dirty-dot" />
            </span>
            <span class="ship-blueprint-divider" />
            <svg class="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 6l6 6-6 6" />
            </svg>
          </button>
          </div>
          <div
            v-if="blueprintMenuOpen"
            class="ship-blueprint-menu ship-blueprint-menu-floating"
            :style="blueprintMenuStyle"
            data-testid="ship-build-blueprint-menu"
          >
            <div class="ship-blueprint-menu-group">
              <button class="ship-blueprint-save-as" :disabled="locked" data-testid="ship-build-blueprint-save-as"
                @click="saveCurrentBlueprint(true)">{{ t('menu.save_as') }}</button>
            </div>
            <div
              v-for="group in groupedLoadableBlueprintItems"
              :key="group.key"
              class="ship-blueprint-menu-group"
            >
              <div class="ship-blueprint-menu-group-title">{{ group.title }}</div>
              <div class="ship-blueprint-menu-row"
                v-for="item in group.items"
                :key="item.id"
                :class="[
                  item.isCurrentSaved ? 'ship-blueprint-menu-row-current' : '',
                  item.disabled ? 'ship-blueprint-menu-row-other' : ''
                ]">
                <button class="ship-blueprint-menu-item-text"
                  :disabled="item.disabled"
                  :title="item.disabled ? t('shipCompare.same_id') : undefined"
                  :data-testid="`ship-blueprint-choice-${item.id}`"
                  :class="[
                    item.isBuiltIn ? 'ship-blueprint-menu-item-built-in' : ''
                  ]"
                  @click="handleBlueprintSelect(item.id)">
                  <span>{{ item.label }}</span>
                </button>
                <button
                  v-if="!item.isBuiltIn"
                  class="ship-blueprint-menu-fav-star"
                  :title="item.favorite ? t('shipBuild.fav_remove') : t('shipBuild.fav_add')"
                  @click.stop="toggleFavoriteItem(item.id)"
                >
                  <svg v-if="item.favorite" class="h-3.5 w-3.5 text-yellow-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                  <svg v-else class="h-3.5 w-3.5 text-slate-500 hover:text-yellow-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </button>
                <button
                  v-if="!item.isBuiltIn"
                  class="ship-blueprint-delete-btn"
                  :disabled="item.disabled"
                  :data-testid="`ship-blueprint-delete-${item.id}`"
                  :title="item.disabled ? t('shipCompare.same_id') : t('shipBuild.action_delete')"
                  @click.stop="handleBlueprintDelete(item.id)"
                >
                  <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </template>
      <span v-else>{{ $t('ship_build.panel_fit') }}</span>
    </div>
    <div class="arsenal-shell" data-testid="ship-build-fit-panel">
        <aside class="left-rail">
          <tippy
            v-for="slotType in availableSlotTypes"
            :key="slotType.id"
            theme="x4"
            :content="t(slotType.tooltip)"
            placement="right"
            :delay="[200, 0]"
          >
            <button
              class="slot-type-btn"
              :class="activeSlotType === slotType.id ? 'slot-type-btn-active' : ''"
              :data-testid="`slot-type-${slotType.id}`"
              @click="handleSlotTypeClick(slotType.id)"
            >
              {{ slotType.label }}
            </button>
          </tippy>
        </aside>

        <div class="arsenal-content">
          <main class="arsenal-main">
            <!-- C 槽 and U 槽: Storage Panel -->
            <ShipStoragePanel :side="side"
              v-if="activeSlotType === 'consumables' || activeSlotType === 'units'"
              :selected-ship="selectedShip"
              :slot-type="activeSlotType as 'consumables' | 'units'"
            />

            <div v-else class="toolbar-row">
              <div class="mode-tabs">
                <button class="mode-tab" :class="fitMode === 'connection' ? 'active' : ''" @click="setMode('connection')">{{ t('ship_build.fit_mode_connection') }}</button>
                <button class="mode-tab" :class="fitMode === 'group' ? 'active' : ''" @click="setMode('group')">{{ t('ship_build.fit_mode_group') }}</button>
              </div>
            </div>

            <div class="group-tabs" v-if="activeSlotType !== 'consumables' && activeSlotType !== 'units'">
              <div
                v-for="row in renderGroupTabRows"
                :key="row.key"
                class="group-tab-row"
                :data-testid="row.testId"
              >
                <button
                  v-for="tab in row.tabs"
                  :key="tab.key"
                  class="group-tab"
                  :class="activeTabKey === tab.key ? 'group-tab-active' : ''"
                  @click="jumpToTab(tab.key)"
                >
                  {{ tab.label }}
                </button>
              </div>
            </div>

            <section v-if="activeSlotType !== 'consumables' && activeSlotType !== 'units' && visibleCompatibilityTags.length > 0" class="compatibility-box">
              <div class="compatibility-title">{{ t('ship_build.fit_compatibility') }}:</div>
              <div class="compatibility-line tags">{{ visibleCompatibilityTagLabels.join(' / ') }}</div>
              <div v-for="line in compatibilitySlotLines" :key="line" class="compatibility-line">{{ line }}</div>
            </section>

            <section v-if="activeSlotType !== 'consumables' && activeSlotType !== 'units'" class="slot-wall">
              <div v-for="target in slotTargets" :key="target.key" class="slot-stack">
                <X4DualPhaseRangeSlider
                :direction="mirrored ? 'rtl' : 'ltr'"
                  class="slot-count-slider"
                  :model-value="getDisplayedCount(target)"
                  :min="0"
                  :max="target.totalCount"
                  :step="sliderStepForTarget(target)"
                  track-bg-color="rgb(30 41 59 / 1)"
                  track-border-color="rgb(51 65 85 / 0.7)"
                  fill-color="rgb(16 185 129 / 0.8)"
                  :disabled="isCountSliderDisabled(target)"
                  @update:model-value="handleCountSliderRealtime(target, $event)"
                  @commit="handleCountSliderCommit(target, $event)"
                />
                <button
                  class="slot-row"
                  :class="[
                    expandedSlotKey === target.key ? 'slot-row-expanded' : ''
                  ]"
                  :data-testid="`slot-${target.key}`"
                  @click="handleSlotClick(target)"
                >
                  <div class="slot-row-main">
                    <div class="slot-row-title">{{ target.label }}</div>
                    <div class="slot-row-value" :class="isMixedSelectionInGroup(target) ? 'slot-row-value-mixed' : ''">
                      <span class="slot-row-value-text">{{ selectedNameForTarget(target) }}</span>
                      <span
                        v-if="shouldShowSelectedDlcTag(target)"
                        class="dlc-tag"
                        :class="isDlcActive(selectedEquipmentForTarget(target)?.dlc_tag) ? 'dlc-tag--active' : 'dlc-tag--inactive'"
                      >
                        {{ getDlcDisplayName(selectedEquipmentForTarget(target)?.dlc_tag) }}
                      </span>
                    </div>
                  </div>
                  <div class="slot-row-side">
                    <span class="slot-row-count">{{ getDisplayedCount(target) }}/{{ target.totalCount }}</span>
                  </div>
                </button>
              </div>

              <div v-if="slotTargets.length === 0" class="empty-card">{{ t('ship_build.fit_no_equipment') }}</div>
            </section>
          </main>
        </div>
    </div>
  </div>
</template>

<style scoped>
.panel-card {
  @apply rounded-lg border border-slate-800 shadow-xl overflow-hidden;
}

.panel-header {
  @apply h-12 flex items-center justify-between px-4 py-0 text-slate-200 text-sm font-semibold border-b border-slate-800/70;
}

.ship-switcher {
  @apply inline-flex items-center rounded-md border border-emerald-400/50 overflow-hidden transition-colors;
}

.ship-switcher:hover,
.ship-switcher:focus-within {
  @apply border-emerald-300 bg-emerald-500/10;
}

.ship-switcher-main {
  @apply px-3 py-1.5 text-left text-slate-100;
}

.ship-switcher-name {
  @apply block whitespace-nowrap text-sm font-semibold;
}

.ship-switcher-action {
  @apply relative inline-flex items-center gap-0 pr-2.5 text-emerald-200 bg-transparent appearance-none leading-none;
}

.ship-switcher-divider {
  @apply inline-block h-3 w-px bg-emerald-400/40;
}

.dlc-tag {
  @apply inline-flex max-w-[110px] flex-shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide;
}

.dlc-tag--active {
  @apply border-emerald-500/70 text-emerald-300;
}

.dlc-tag--inactive {
  @apply border-rose-500/70 text-rose-300;
}

.ship-blueprint-picker {
  @apply relative inline-flex items-center gap-1.5;
}

.ship-blueprint-fav-btn {
  @apply inline-flex items-center justify-center h-9 w-9 rounded-md text-slate-400 hover:text-yellow-400 transition-colors;
}

.ship-blueprint-fav-btn.is-favorited {
  @apply text-yellow-400;
}

.ship-blueprint-actions {
  @apply inline-flex items-stretch rounded-md border border-emerald-400/50 text-emerald-200 overflow-hidden;
}

.ship-blueprint-save {
  @apply inline-flex items-center justify-center px-2 hover:bg-emerald-500/15 disabled:opacity-40 disabled:cursor-not-allowed;
}

.ship-blueprint-trigger {
  @apply inline-flex items-center gap-2 px-3 py-1.5 hover:bg-emerald-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed;
}

.ship-blueprint-save-as {
  @apply w-full rounded px-3 py-2 text-left text-xs text-emerald-200 hover:bg-emerald-500/15 disabled:opacity-40 disabled:cursor-not-allowed;
}

.ship-blueprint-status {
  @apply inline-flex items-center gap-1 text-sm font-semibold text-slate-100 whitespace-nowrap;
}

.ship-blueprint-dirty-dot {
  @apply inline-block h-1.5 w-1.5 rounded-full bg-red-500;
}

.ship-blueprint-divider {
  @apply inline-block h-3 w-px bg-emerald-400/40;
}

.ship-blueprint-menu {
  @apply absolute top-0 left-full ml-2 z-40 w-max min-w-44 max-h-64 overflow-y-auto rounded-md border border-emerald-400/40 bg-slate-900/95 p-1 shadow-2xl;
  scrollbar-width: thin;
  scrollbar-color: rgba(52, 211, 153, 0.65) rgba(15, 23, 42, 0.85);
}

.ship-blueprint-menu-floating {
  @apply fixed top-0 left-0 ml-0 z-[120];
}

.ship-blueprint-menu-row {
  @apply flex w-full box-border items-center gap-1 rounded px-1 hover:bg-emerald-500/15 transition-colors;
}

.ship-blueprint-menu-group {
  @apply w-full;
}

.ship-blueprint-menu-group + .ship-blueprint-menu-group {
  @apply mt-2 pt-1 border-t border-emerald-400/20;
}

.ship-blueprint-menu-group-title {
  @apply px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-300/80;
}

.ship-blueprint-menu-item-text {
  text-align: left;
  @apply flex-1 min-w-0 h-8 px-2.5 py-1.5 rounded text-xs text-slate-200 cursor-pointer truncate;
}

.ship-blueprint-menu-item-built-in {
  @apply text-emerald-200;
}

.ship-blueprint-menu-row-current {
  @apply bg-emerald-500/30 hover:bg-emerald-500/30 border border-emerald-400/70;
}

.ship-blueprint-menu-row-other {
  @apply bg-emerald-500/10 hover:bg-emerald-500/10 border border-emerald-400/25;
}

.ship-blueprint-delete-btn:disabled {
  @apply opacity-40 cursor-not-allowed;
}

.ship-blueprint-menu-fav-star {
  @apply shrink-0 h-8 w-7 flex items-center justify-center rounded text-slate-400 hover:text-yellow-400 hover:bg-yellow-500/10 transition-colors;
}

.ship-blueprint-delete-btn {
  @apply shrink-0 h-8 w-7 flex items-center justify-center rounded text-red-300 hover:text-red-200 hover:bg-red-500/20 transition-colors;
}

.ship-blueprint-menu::-webkit-scrollbar {
  width: 8px;
}

.ship-blueprint-menu::-webkit-scrollbar-track {
  background: rgba(15, 23, 42, 0.85);
  border-radius: 9999px;
}

.ship-blueprint-menu::-webkit-scrollbar-thumb {
  background: rgba(52, 211, 153, 0.65);
  border-radius: 9999px;
  border: 1px solid rgba(16, 185, 129, 0.35);
}

.ship-blueprint-menu::-webkit-scrollbar-thumb:hover {
  background: rgba(52, 211, 153, 0.9);
}

.arsenal-shell { @apply p-2 flex gap-2; }
.left-rail { @apply w-9 rounded border border-slate-700/70 flex flex-col items-center gap-2 py-2; }
.left-rail.locked { @apply opacity-60; }
.slot-type-btn { @apply w-6 h-6 rounded-full border border-slate-500/70 text-[10px] font-bold text-slate-200; }
.slot-type-btn-active { @apply border-emerald-300 text-emerald-100; }
.arsenal-content { @apply flex-1 min-w-0; }
.arsenal-main { @apply min-w-0; }
.toolbar-row { @apply flex items-center justify-between gap-2; }
.mode-tabs { @apply inline-flex items-center gap-1; }
.mode-tab { @apply px-2.5 py-1 text-xs font-semibold text-slate-200 border border-slate-700/60 rounded; }
.mode-tab.active { @apply border-emerald-300 text-emerald-100; }
.mode-tab:disabled { @apply opacity-40 cursor-not-allowed; }
.mode-tab-tall { @apply h-[25.6px] px-2 flex items-center; }
.group-tabs { @apply flex flex-col gap-1 mt-2; }
.group-tab-row { @apply flex flex-wrap items-center gap-1; }
.group-tab { @apply px-2.5 py-0.5 text-[11px] border border-slate-700/60 rounded text-slate-200; }
.group-tab-active { @apply border-emerald-300 text-emerald-100; }
.compatibility-box { @apply mt-2 rounded border border-slate-700/60 px-2 py-1.5; }
.compatibility-title { @apply text-xs text-slate-100 font-semibold mb-0.5; }
.compatibility-line { @apply text-[11px] text-slate-200; }
.compatibility-line.tags { @apply text-sky-200; }
.slot-wall { @apply min-w-0 mt-2 grid gap-2; }
.slot-stack { @apply grid gap-1; }
.slot-count-slider { @apply w-full; }
.slot-row { @apply rounded border border-slate-700 px-2 py-2 flex items-center justify-between text-left; }
.slot-row-expanded { @apply border-emerald-200 ring-1 ring-emerald-300; }
.slot-row-main { @apply min-w-0; }
.slot-row-title { @apply text-xs text-slate-100 font-semibold; }
.slot-row-value { @apply mt-0.5 flex items-center gap-2 min-w-0 text-[11px] text-slate-300; }
.slot-row-value-text { @apply truncate; }
.slot-row-value-mixed { @apply text-amber-300 font-semibold; }
.slot-row-side { @apply flex items-center gap-2 ml-2; }
.slot-row-count { @apply text-[10px] text-emerald-300; }
.empty-card { @apply rounded border border-dashed border-slate-700 p-3 text-xs text-slate-300 text-center; }

.pager { @apply inline-flex items-center gap-1; }
.pager-btn { @apply h-[25.6px] rounded border border-slate-600 px-1.5 py-0 text-[10px] text-slate-200 inline-flex items-center; }
.pager-btn-active { @apply border-emerald-300 text-emerald-100; }
.pager-btn:disabled { @apply opacity-40 cursor-not-allowed; }
.filter-block { @apply mt-2 flex flex-col gap-2; }
.filter-line { @apply flex flex-wrap items-center gap-1.5; }
.filter-group { @apply text-[10px] uppercase text-slate-300 font-semibold min-w-8; }
.filter-items-race { @apply flex flex-wrap items-center gap-1.5; }
.filter-items-race-two-rows { display: grid; grid-template-rows: repeat(2, minmax(0, auto)); grid-auto-flow: column; align-items: center; gap: 0.375rem; }
.filter-chip { @apply rounded border border-slate-600 px-2 py-1 text-[10px] text-slate-200; }
.filter-chip-active { @apply border-emerald-300 text-emerald-100; }
.chip-count { @apply text-[10px] text-slate-300 ml-1; }
.picker-candidate-list { @apply mt-0 w-full; }
.candidate-list { @apply grid grid-cols-1 gap-1.5; }
.candidate-item { @apply rounded border border-slate-700 px-2 py-1.5 text-left; }
.candidate-item-active { @apply border-emerald-200 ring-1 ring-emerald-300; }
.candidate-item:focus-visible { @apply outline-none border-emerald-200 ring-1 ring-emerald-300; }
.candidate-name { @apply text-xs text-slate-100; }
.candidate-meta { @apply text-[10px] text-slate-300 mt-0.5; }
.candidate-item { display: flex; justify-content: space-between; align-items: flex-start; }
.candidate-left { flex: 1; min-width: 0; }
.candidate-right { text-align: right; flex-shrink: 0; margin-left: 0.5rem; display: flex; flex-direction: column; justify-content: center; }
.candidate-summary-1 { @apply flex gap-1 justify-end items-center; }
.candidate-summary-2 { @apply flex gap-1 justify-end items-center; }
.summary-label { @apply text-xs text-slate-300; }
.summary-value { @apply text-xs text-emerald-300 tabular-nums; }
.summary-unit { @apply text-[10px] text-slate-400; }

.mirrored .panel-header,
.mirrored .ship-switcher,
.mirrored .ship-blueprint-picker,
.mirrored .ship-blueprint-actions,
.mirrored .ship-blueprint-trigger,
.mirrored .ship-blueprint-status,
.mirrored .arsenal-shell,
.mirrored .mode-tabs,
.mirrored .group-tab-row,
.mirrored .slot-row { flex-direction: row-reverse; }
.mirrored .ship-blueprint-trigger > svg { transform: rotate(180deg); }
.mirrored .compatibility-box,
.mirrored .slot-row { text-align: right; }
.mirrored .mode-tabs,
.mirrored .group-tab-row { justify-content: flex-start; }
.mirrored .toolbar-row { justify-content: flex-end; }
.mirrored .slot-row-value { flex-direction: row-reverse; }
.mirrored .slot-row-side { margin-left: 0; margin-right: 0.5rem; }
.mirrored .ship-switcher-action { padding-right: 0; padding-left: 0.625rem; }
.mirrored .ship-switcher-action > svg { margin-left: 0; margin-right: 0.5rem; }
.mirrored .ship-switcher-main { text-align: right; }
</style>

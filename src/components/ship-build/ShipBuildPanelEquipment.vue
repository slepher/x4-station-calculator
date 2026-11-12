<script setup lang="ts">
import MetricsPanel from '@/components/common/MetricsPanel.vue'
import { useShipBuildEquipmentPanelPresenter, type ShipEquipmentPanelProps, type ShipEquipmentPanelEvents } from './presenters/useShipBuildEquipmentPanelPresenter'
const props = withDefaults(defineProps<ShipEquipmentPanelProps>(), { panelMode: 'picker' })
const emit = defineEmits<ShipEquipmentPanelEvents>()
const { isDlcActive, getDlcDisplayName, shouldHide, selectedRaceIds, selectedMkIds, selectedTagIds, raceTags, mkTags, featureTags, showRaceFilter, showMkFilter, showTagFilter, showFilterBlock, currentPage, totalPages, pagedCandidateItems, toggleRace, toggleMk, toggleFeatureTag, t, translateEquipment, displayEquipment, panelSchema, panelCurrentValues, panelTargetValues, roundedKeys, getEquipmentSummary1, getEquipmentSummary2 } = useShipBuildEquipmentPanelPresenter(props)
</script>

<template>
  <div
    v-if="!shouldHide && props.panelMode === 'picker'"
    class="panel-card equipment-picker-panel"
    data-testid="ship-build-panel-equipment"
  >
    <div class="panel-header">
      <span class="panel-title">{{ t('ship_build.fit_picker_title') }}</span>
      <div class="picker-actions-inline">
        <button class="mode-tab mode-tab-tall picker-action-btn mr-1" data-testid="picker-cancel" @click="emit('cancel')">{{ t('ui.cancel') }}</button>
        <button class="mode-tab mode-tab-tall picker-action-btn" data-testid="picker-confirm" @click="emit('confirm')">{{ t('ship_build.fit_picker_confirm') }}</button>
      </div>
    </div>
    <div class="panel-content">
      <section v-if="showFilterBlock" class="picker-filter-block">
        <div v-if="showRaceFilter" class="filter-line">
          <span class="filter-group">RACE</span>
          <div class="filter-items-race" :class="raceTags.length > 5 ? 'filter-items-race-two-rows' : ''">
            <button
              v-for="tag in raceTags"
              :key="`race-${tag.id}`"
              class="filter-chip"
              :class="selectedRaceIds.includes(tag.id) ? 'filter-chip-active' : ''"
              :data-testid="`picker-race-${tag.id}`"
              @click="toggleRace(tag.id)"
            >
              {{ tag.label }} <span class="chip-count">{{ tag.count }}</span>
            </button>
          </div>
        </div>
        <div v-if="showMkFilter" class="filter-line">
          <span class="filter-group">MK</span>
          <button
            v-for="tag in mkTags"
            :key="`mk-${tag.id}`"
            class="filter-chip"
            :class="selectedMkIds.includes(tag.id) ? 'filter-chip-active' : ''"
            :data-testid="`picker-mk-${tag.id}`"
            @click="toggleMk(tag.id)"
          >
            {{ tag.label }} <span class="chip-count">{{ tag.count }}</span>
          </button>
        </div>
        <div v-if="showTagFilter" class="filter-line">
          <span class="filter-group">TAG</span>
          <button
            v-for="tag in featureTags"
            :key="`tag-${tag.id}`"
            class="filter-chip"
            :class="selectedTagIds.includes(tag.id) ? 'filter-chip-active' : ''"
            :data-testid="`picker-tag-${tag.id}`"
            @click="toggleFeatureTag(tag.id)"
          >
            {{ tag.label }} <span class="chip-count">{{ tag.count }}</span>
          </button>
        </div>
      </section>
      <div v-if="totalPages > 1" class="pager">
        <button class="pager-btn" :disabled="currentPage === 1" @click="currentPage = currentPage - 1">&lt;</button>
        <button
          v-for="page in totalPages"
          :key="page"
          class="pager-btn"
          :class="currentPage === page ? 'pager-btn-active' : ''"
          :data-testid="`picker-page-${page}`"
          @click="currentPage = page"
        >
          {{ page }}
        </button>
        <button class="pager-btn" :disabled="currentPage === totalPages" @click="currentPage = currentPage + 1">&gt;</button>
      </div>
      <div class="candidate-list picker-candidate-list" data-testid="equipment-picker">
      <button
        v-for="item in pagedCandidateItems"
        :key="item?.id || '__empty__'"
        class="candidate-item"
        :class="highlightedEquipmentId === (item?.id || null) ? 'candidate-item-active' : ''"
        :data-testid="`candidate-${item?.id || 'empty'}`"
        @click="emit('update:highlightedEquipmentId', item?.id || null)"
      >
        <div class="candidate-left">
          <div class="candidate-name-row">
            <div class="candidate-name">{{ item ? translateEquipment(item) : t('ship_build.fit_empty_slot') }}</div>
            <span
              v-if="item && item.dlc_tag !== 'base'"
              class="dlc-tag"
              :class="isDlcActive(item.dlc_tag) ? 'dlc-tag--active' : 'dlc-tag--inactive'"
            >
              {{ getDlcDisplayName(item.dlc_tag) }}
            </span>
          </div>
          <div class="candidate-meta">{{ item ? `${item.race || 'GEN'} · ${item.mk ? `MK${item.mk}` : '-'}` : '-' }}</div>
        </div>
        <div v-if="item" class="candidate-right">
          <div class="candidate-summary-1">
            <span class="summary-label">{{ t(getEquipmentSummary1(item).labelKey) }}</span>
            <span class="summary-value">{{ getEquipmentSummary1(item).value }}</span>
            <span class="summary-unit">{{ getEquipmentSummary1(item).unit }}</span>
          </div>
          <div class="candidate-summary-2">
            <span class="summary-label">{{ t(getEquipmentSummary2(item).labelKey) }}</span>
            <span class="summary-value">{{ getEquipmentSummary2(item).value }}</span>
            <span class="summary-unit">{{ getEquipmentSummary2(item).unit }}</span>
          </div>
        </div>
      </button>
      </div>
    </div>
  </div>
  <MetricsPanel
    v-else-if="!shouldHide && props.panelMode === 'equipment'"
    panel-id="ship-build-equipment"
    :title="displayEquipment ? translateEquipment(displayEquipment) : ''"
    header-height="48px"
    :obj-current="panelCurrentValues"
    :obj-target="panelTargetValues"
    :schema="panelSchema"
    order="row"
    :view-tab="null"
    :rounded-keys="roundedKeys"
  />
</template>

<style scoped>
.panel-card {
  @apply bg-slate-900/40 rounded-lg border border-slate-800 shadow-xl overflow-hidden;
}

.panel-header {
  @apply h-12 flex items-center justify-between px-4 py-0 text-slate-200 text-sm font-semibold border-b border-slate-800/70 bg-slate-900/50;
}

.panel-title {
  @apply truncate;
}

.panel-content {
  @apply p-2 flex flex-col gap-3;
}

.equipment-picker-panel {
  @apply flex flex-col;
}

.picker-filter-block {
  @apply rounded border border-slate-700/60 bg-slate-900/40 p-2 space-y-2;
}

.filter-line {
  @apply flex items-center gap-1.5 flex-wrap;
}

.filter-group {
  @apply text-[11px] text-slate-300 font-semibold min-w-9;
}

.filter-chip {
  @apply rounded border border-slate-600 px-2 py-0.5 text-[10px] text-slate-200 hover:border-emerald-300 hover:text-emerald-100 transition-colors;
}

.filter-chip-active {
  @apply border-emerald-400 text-emerald-100 bg-emerald-500/15;
}

.chip-count {
  @apply ml-0.5 text-slate-400;
}

.filter-items-race {
  @apply flex flex-wrap gap-1.5;
}

.filter-items-race-two-rows {
  display: grid;
  grid-template-rows: repeat(2, minmax(0, auto));
  grid-auto-flow: column;
  align-items: center;
  gap: 0.375rem;
}

.picker-actions-inline {
  @apply flex items-center;
}

.mode-tab {
  @apply rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:border-emerald-300 hover:text-emerald-100 transition-colors;
}

.mode-tab-tall {
  @apply h-[25.6px] px-2 flex items-center;
}

.picker-action-btn {
  @apply border-emerald-500/50 text-emerald-200;
}

.picker-candidate-list {
  @apply grid grid-cols-1 gap-1.5;
}

.pager {
  @apply flex justify-end gap-1;
}

.pager-btn {
  @apply h-[25.6px] rounded border border-slate-600 px-1.5 py-0 text-[10px] text-slate-200 inline-flex items-center;
}

.pager-btn-active {
  @apply border-emerald-400 text-emerald-200 bg-emerald-500/10;
}

.candidate-item {
  @apply flex items-start justify-between rounded border border-slate-700/70 bg-slate-900/40 px-2.5 py-2 text-left hover:border-emerald-400/50 hover:bg-emerald-500/10 transition-colors;
}

.candidate-item-active {
  @apply border-emerald-400/70 bg-emerald-500/10;
}

.candidate-left {
  @apply min-w-0;
}

.candidate-name-row {
  @apply flex items-center gap-2 min-w-0;
}

.candidate-name {
  @apply text-xs text-slate-100 truncate;
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

.candidate-meta {
  @apply text-[10px] text-slate-400 uppercase;
}

.candidate-right {
  @apply flex flex-col items-end gap-0.5 pl-2;
}

.candidate-summary-1,
.candidate-summary-2 {
  @apply flex gap-1 items-center;
}

.summary-label { @apply text-[10px] text-slate-300; }
.summary-value { @apply text-[10px] text-emerald-300 tabular-nums; }
.summary-unit { @apply text-[10px] text-slate-400; }
</style>

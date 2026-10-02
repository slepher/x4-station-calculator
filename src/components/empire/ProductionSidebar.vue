<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import draggable from 'vuedraggable'
import { ChevronDoubleLeftIcon, ChevronDoubleRightIcon, ChevronDownIcon, ChevronUpIcon, PlusIcon } from '@heroicons/vue/24/outline'
import ProductionSidebarRow from './ProductionSidebarRow.vue'
import type { ProductionSidebarPresenter, SidebarGroup, SidebarRow } from './presenters/useProductionSidebarPresenter'

const props = defineProps<{ presenter: ProductionSidebarPresenter }>()
const { t } = useI18n()
const scroll = ref<HTMLElement | null>(null)
const overlay = ref<HTMLElement | null>(null)
const overlayPosition = ref({ x: 0, y: 0 })
const sortEpoch = ref(0)
let overlayAnchor = { x: 0, y: 0 }
let resizeTarget: HTMLElement | null = null
let resizePointer: number | null = null
let sortElement: HTMLElement | null = null
let sortKind: 'groups' | 'stations' = 'stations'
let releasePoint: { x: number; y: number } | null = null
let sortCancelled = false

async function positionOverlay(event?: MouseEvent) {
  if (event !== undefined) overlayAnchor = { x: event.clientX, y: event.clientY }
  await nextTick()
  if (overlay.value === null) return
  const rect = overlay.value.getBoundingClientRect()
  overlayPosition.value = { x: Math.max(8, Math.min(overlayAnchor.x, window.innerWidth - rect.width - 8)), y: Math.max(8, Math.min(overlayAnchor.y, window.innerHeight - rect.height - 8)) }
}
function openMenu(id: string, event: MouseEvent) {
  if (props.presenter.openMenu(id)) void positionOverlay(event)
}
function openEditor(id: string, event: MouseEvent) {
  if (props.presenter.openGroupEditor(id)) void positionOverlay(event)
}
function startResize(event: PointerEvent) {
  if (!props.presenter.startResize(event.pointerId, event.clientX)) return
  resizeTarget = event.currentTarget as HTMLElement
  resizePointer = event.pointerId
  resizeTarget.setPointerCapture(event.pointerId)
}
function releaseResize() {
  const target = resizeTarget
  const pointer = resizePointer
  resizeTarget = null
  resizePointer = null
  if (target !== null && pointer !== null && target.hasPointerCapture(pointer)) target.releasePointerCapture(pointer)
}
function endResize(event: PointerEvent, commit: boolean) {
  if (resizePointer !== event.pointerId) return
  props.presenter.endResize(event.pointerId, commit)
  releaseResize()
}
function startSort(event: { from: HTMLElement }, kind: 'groups' | 'stations', groupId: string | null) {
  sortElement = event.from
  sortKind = kind
  releasePoint = null
  sortCancelled = !props.presenter.startSort(kind, groupId)
}
function proposeSort(items: (SidebarRow | SidebarGroup)[]) { props.presenter.proposeSort(items.map(item => item.id)) }
function trackRelease(event: MouseEvent | TouchEvent) {
  if (sortElement === null) return
  if ('changedTouches' in event) {
    const touch = event.changedTouches[0]
    if (touch !== undefined) releasePoint = { x: touch.clientX, y: touch.clientY }
  } else releasePoint = { x: event.clientX, y: event.clientY }
}
function endSort() {
  let legal = false
  if (!sortCancelled && sortElement !== null && releasePoint !== null) {
    const hit = document.elementFromPoint(releasePoint.x, releasePoint.y)
    if (hit !== null) legal = sortElement.contains(hit) && (sortKind === 'groups' || hit.closest('[data-sort-scope]') === sortElement)
  }
  props.presenter.endSort(legal)
  sortElement = null
  releasePoint = null
}
function cancelInput() {
  if (sortElement !== null) {
    sortEpoch.value += 1
    sortElement = null
    releasePoint = null
  }
  sortCancelled = true
  props.presenter.cancelInteraction()
  releaseResize()
}
function outsideClick(event: PointerEvent) {
  if (overlay.value !== null && !overlay.value.contains(event.target as Node)) props.presenter.closeOverlays()
}
function onViewport() { props.presenter.setViewport(window.innerWidth); cancelInput(); void positionOverlay() }
watch(() => props.presenter.resizingPointerId, id => { if (id === null) releaseResize() })
watch(() => props.presenter.contextKey, cancelInput)
watch(() => props.presenter.canSort, enabled => { if (!enabled && sortElement !== null) cancelInput() })
watch(() => props.presenter.location, async location => {
  if (location === null) return
  await nextTick()
  if (scroll.value === null) return
  if (location.stationId === null) scroll.value.scrollTop = location.scrollTop
  else {
    const element = Array.from(scroll.value.querySelectorAll<HTMLElement>('[data-entry-id]')).find(element => element.dataset.entryId === location.stationId)
    if (element !== undefined) element.scrollIntoView({ block: 'nearest' })
  }
}, { immediate: true, flush: 'post' })
watch(() => props.presenter.query, async () => { await nextTick(); if (props.presenter.searching && scroll.value !== null) scroll.value.scrollTop = 0 })
watch(() => props.presenter.editor?.error, () => { void positionOverlay() })
onMounted(() => {
  props.presenter.setViewport(window.innerWidth)
  window.addEventListener('resize', onViewport)
  window.addEventListener('blur', cancelInput)
  document.addEventListener('mouseup', trackRelease, true)
  document.addEventListener('touchend', trackRelease, true)
  document.addEventListener('pointercancel', cancelInput)
  document.addEventListener('touchcancel', cancelInput)
  document.addEventListener('pointerdown', outsideClick)
})
onUnmounted(() => {
  cancelInput()
  window.removeEventListener('resize', onViewport)
  window.removeEventListener('blur', cancelInput)
  document.removeEventListener('mouseup', trackRelease, true)
  document.removeEventListener('touchend', trackRelease, true)
  document.removeEventListener('pointercancel', cancelInput)
  document.removeEventListener('touchcancel', cancelInput)
  document.removeEventListener('pointerdown', outsideClick)
})
</script>

<template>
  <button v-if="presenter.narrowScreen" class="sidebar-drawer-trigger" data-testid="sidebar-drawer-toggle" :aria-label="t('sidebar.open')" @click="presenter.toggleCollapsed()">☰</button>
  <Teleport to="body">
    <button v-if="presenter.narrowScreen && presenter.drawerOpen" class="sidebar-drawer-backdrop" data-testid="sidebar-drawer-backdrop" :aria-label="t('sidebar.close')" @click="presenter.drawerOpen = false" />
  </Teleport>
  <aside class="production-sidebar" :class="{ compact: presenter.compact, drawer: presenter.narrowScreen, 'drawer-open': presenter.drawerOpen }" :style="{ width: `${presenter.width}px` }" data-testid="production-sidebar" :data-drawer="presenter.narrowScreen" :aria-label="t('sidebar.navigation')">
    <div class="sidebar-body" :data-testid="presenter.narrowScreen ? 'sidebar-drawer' : undefined">
      <button class="sidebar-toggle" data-testid="sidebar-toggle" :aria-label="t(presenter.compact ? 'sidebar.expand' : 'sidebar.collapse')" :title="t(presenter.compact ? 'sidebar.expand' : 'sidebar.collapse')" :aria-expanded="!presenter.compact" @click="presenter.toggleCollapsed()">
        <ChevronDoubleRightIcon v-if="presenter.compact" class="sidebar-toggle-icon" aria-hidden="true" />
        <ChevronDoubleLeftIcon v-else class="sidebar-toggle-icon" aria-hidden="true" />
      </button>
    <div ref="scroll" class="sidebar-scroll custom-scrollbar" @scroll="presenter.setScrollTop(($event.target as HTMLElement).scrollTop)">
      <div v-for="item in presenter.fixedItems" :key="item.id" :class="item.id === 'terraforming' ? ['sidebar-group', { expanded: presenter.expandedTerraforming }] : undefined" :style="item.id === 'terraforming' ? { '--sidebar-group-color': presenter.terraformGroupColor } : undefined">
        <ProductionSidebarRow :row="item" :compact="presenter.compact" :expanded="item.id === 'terraforming' ? presenter.expandedTerraforming : null" :fold-color="presenter.terraformGroupColor" @select="presenter.select" @toggle="presenter.toggleTerraforming" />
        <div v-if="item.id === 'terraforming' && presenter.expandedTerraforming" class="sidebar-terraform-clusters">
          <ProductionSidebarRow v-for="cluster in presenter.terraformItems" :key="cluster.id" :row="cluster" :compact="presenter.compact" indented @select="presenter.select" />
        </div>
      </div>
      <div v-if="presenter.pinnedItems.length" class="sidebar-pinned" data-testid="sidebar-pinned">
        <ProductionSidebarRow v-for="item in presenter.pinnedItems" :key="`pinned:${item.id}`" :row="item" :compact="presenter.compact" menu @select="presenter.select" @menu="openMenu" />
      </div>
      <input v-if="!presenter.compact" :value="presenter.query" type="search" class="sidebar-search" data-testid="sidebar-search" :placeholder="t('sidebar.search')" :aria-label="t('sidebar.search')" @input="presenter.setQuery(($event.target as HTMLInputElement).value)">
      <draggable :key="presenter.contextKey + ':flat:' + sortEpoch" :model-value="presenter.flatItems" item-key="id" tag="div" class="sidebar-station-list" data-testid="sidebar-station-list" data-sort-scope="flat" handle=".station-drag-handle" :disabled="!presenter.canSort || presenter.mode !== 'blueprint'" :force-fallback="true" :fallback-on-body="true" :fallback-tolerance="4" ghost-class="sidebar-drag-placeholder" fallback-class="sidebar-drag-shadow" @start="startSort($event, 'stations', null)" @update:model-value="proposeSort" @end="endSort">
        <template #item="{ element }">
          <ProductionSidebarRow :row="element" :compact="presenter.compact" :sortable="presenter.canSort && presenter.mode === 'blueprint'" menu @select="presenter.select" @menu="openMenu" />
        </template>
      </draggable>
      <draggable :key="presenter.contextKey + ':groups:' + sortEpoch" :model-value="presenter.groups" item-key="id" tag="div" class="sidebar-groups" data-sort-scope="groups" handle=".group-drag-handle" :disabled="!presenter.canSort" :force-fallback="true" :fallback-on-body="true" :fallback-tolerance="4" ghost-class="sidebar-drag-placeholder" fallback-class="sidebar-drag-shadow" @start="startSort($event, 'groups', null)" @update:model-value="proposeSort" @end="endSort">
        <template #item="{ element: group }">
          <section class="sidebar-group" :class="{ expanded: group.expanded }" :style="{ '--sidebar-group-color': group.color }">
            <div class="sidebar-row sector-header" :class="{ 'contains-active': group.active, active: group.row.active }" data-testid="sidebar-sector" :data-sector-id="group.id" :data-entry-id="group.row.id" :title="group.name" @contextmenu.prevent.stop="group.editable && openEditor(group.id, $event)">
              <span v-if="presenter.canSort" class="group-drag-handle" aria-hidden="true">⠿</span>
              <button class="sector-chevron-btn" :style="{ backgroundColor: group.color }" data-testid="sidebar-sector-toggle" :data-sector-id="group.id" :aria-expanded="group.expanded" :aria-label="t(group.expanded ? 'sidebar.collapse_group' : 'sidebar.expand_group', { name: group.name })" @click.stop="presenter.toggleGroup(group.id)">
                <ChevronUpIcon v-if="group.expanded" class="sidebar-chevron-icon" aria-hidden="true" />
                <ChevronDownIcon v-else class="sidebar-chevron-icon" aria-hidden="true" />
              </button>
              <button class="sidebar-nav" :aria-label="group.name" :title="group.name" :aria-current="group.row.active ? 'page' : undefined" @click.stop="presenter.select(group.row.id)">
                <img v-if="presenter.compact" class="sidebar-item-icon" :class="group.row.iconClass" :src="group.row.icon" alt="">
                <span v-else class="sidebar-item-label" :style="{ color: group.color }">{{ group.name }}</span>
              </button>
              <button v-if="group.editable && !presenter.compact" class="sidebar-more" data-testid="sidebar-group-menu" :data-sector-id="group.id" :aria-label="t('sidebar.edit_group', { name: group.name })" @click.stop="openEditor(group.id, $event)">⋮</button>
            </div>
            <draggable v-if="group.expanded" :model-value="group.stations" item-key="id" tag="div" class="sidebar-station-list" data-testid="sidebar-station-list" :data-sort-scope="group.id" handle=".station-drag-handle" :disabled="!presenter.canSort" :force-fallback="true" :fallback-on-body="true" :fallback-tolerance="4" ghost-class="sidebar-drag-placeholder" fallback-class="sidebar-drag-shadow" @start="startSort($event, 'stations', group.id)" @update:model-value="proposeSort" @end="endSort">
              <template #item="{ element }"><ProductionSidebarRow :row="element" :compact="presenter.compact" :sortable="presenter.canSort" menu indented @select="presenter.select" @menu="openMenu" /></template>
            </draggable>
          </section>
        </template>
      </draggable>
      <p v-if="presenter.noResults" class="sidebar-message" data-testid="sidebar-no-results">{{ t('sidebar.no_results') }}</p>
      <p v-if="presenter.feedback" class="sidebar-message" role="status">{{ presenter.feedback }}</p>
    </div>
    <div v-if="presenter.primaryAction !== null" class="sidebar-footer">
      <button class="sidebar-add-btn" :data-testid="presenter.primaryAction.testId" :aria-label="presenter.primaryAction.label" :title="presenter.primaryAction.label" @click="presenter.runPrimaryAction()"><PlusIcon class="sidebar-item-icon" aria-hidden="true" /><span v-if="!presenter.compact">{{ presenter.primaryAction.label }}</span></button>
    </div>
    <div v-if="!presenter.compact && !presenter.narrowScreen" class="sidebar-resize-handle" data-testid="sidebar-resize-handle" :title="t('sidebar.resize')" @pointerdown.prevent="startResize" @pointermove="presenter.moveResize($event.pointerId, $event.clientX)" @pointerup="endResize($event, true)" @pointercancel="endResize($event, false)" @lostpointercapture="endResize($event, false)" />
    </div>
  </aside>
  <Teleport to="body">
    <div v-if="presenter.menu || presenter.editor" ref="overlay" class="sidebar-overlay" :style="{ left: `${overlayPosition.x}px`, top: `${overlayPosition.y}px` }" @click.stop @contextmenu.prevent>
      <div v-if="presenter.menu" class="sidebar-context-menu" data-testid="sidebar-context-menu">
        <div class="menu-header">{{ t('sector.menu_operations') }}</div>
        <button v-for="action in presenter.menuActions" :key="action.id" class="menu-item" :class="{ danger: action.id === 'delete' }" :data-testid="action.testId" @click="presenter.runMenuAction(action.id)">{{ action.label }}</button>
      </div>
      <form v-else-if="presenter.editor" class="sidebar-group-editor" data-testid="sidebar-group-editor" @submit.prevent="presenter.applyGroupEditor()">
        <label for="sidebar-group-name">{{ t('sidebar.group_name') }}</label>
        <input id="sidebar-group-name" v-model="presenter.editor.name" data-testid="sidebar-group-name" class="group-name-input" :aria-invalid="presenter.editor.error !== null">
        <div class="sidebar-color-palette" :aria-label="t('sidebar.group_color')">
          <button v-for="color in presenter.colorOptions" :key="color.color" type="button" class="sidebar-color" :class="{ selected: color.selected }" :style="{ backgroundColor: color.color }" :data-color="color.color" data-testid="sidebar-group-color" :title="color.label" :aria-label="color.label" :aria-pressed="color.selected" @click="presenter.editor.color = color.color" />
        </div>
        <p v-if="presenter.editor.error" role="alert">{{ presenter.editor.error }}</p>
        <div class="sidebar-editor-actions"><button type="button" data-testid="sidebar-group-cancel" @click="presenter.closeOverlays()">{{ t('ui.cancel') }}</button><button type="submit" data-testid="sidebar-group-apply">{{ t('sidebar.apply') }}</button></div>
      </form>
    </div>
    <div v-if="presenter.pendingDelete" class="sidebar-delete-backdrop" data-testid="sidebar-delete-dialog" @click="presenter.cancelDelete()">
      <div class="sidebar-delete-card" role="dialog" aria-modal="true" :aria-label="t('sector.confirm_delete')" @click.stop><h3>{{ t('sector.confirm_delete') }}</h3><p>{{ t('sector.delete_warning') }}</p><div class="sidebar-editor-actions"><button data-testid="sidebar-delete-cancel" @click="presenter.cancelDelete()">{{ t('ui.cancel') }}</button><button class="danger" data-testid="sidebar-delete-confirm" @click="presenter.confirmDelete()">{{ t('ui.delete') }}</button></div></div>
    </div>
  </Teleport>
</template>

<style>
.production-sidebar { @apply flex-shrink-0 bg-slate-900 border-r border-slate-700 relative flex flex-col text-slate-300; min-height: 0; --sidebar-icon-center: 32px; --sidebar-row-gutter: 4px; }
.sidebar-body { display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden; }
.sidebar-scroll { flex: 1 1 auto; min-height: 0; overflow-y: auto; overflow-x: hidden; }
.sidebar-footer { flex: 0 0 auto; }
.sidebar-toggle { @apply h-8 w-8 rounded hover:bg-slate-800 text-slate-400; margin: 8px calc(var(--sidebar-icon-center) - 16px); display: flex; flex-shrink: 0; align-items: center; justify-content: center; }
.sidebar-toggle-icon { width: 20px; height: 20px; }
.sidebar-row { @apply relative flex items-center rounded-md text-slate-400 hover:bg-slate-800; margin: 0 var(--sidebar-row-gutter); height: 36px; }
.sidebar-row.active { @apply bg-slate-800 text-sky-400; }
.sidebar-row.contains-active:not(.active) { @apply bg-slate-800/50; }
.sidebar-nav { @apply flex items-center gap-2 flex-1 min-w-0 text-left rounded-md; padding: 8px 8px 8px calc(var(--sidebar-icon-center) - var(--sidebar-row-gutter) - 10px); }
.sidebar-nav.disabled { opacity: .45; cursor: not-allowed; }
.sidebar-nav:focus-visible, .sidebar-more:focus-visible, .sector-chevron-btn:focus-visible, .sidebar-toggle:focus-visible { outline: 2px solid #38bdf8; outline-offset: -2px; }
.sidebar-item-label { @apply text-xs font-medium truncate; }
.sidebar-icon-wrap { position: relative; display: inline-flex; flex-shrink: 0; }
.sidebar-item-icon { width: 20px; height: 20px; flex-shrink: 0; }
.sidebar-status-dot { position: absolute; top: -2px; right: -2px; width: 6px; height: 6px; border-radius: 50%; background: #fb923c; }
.sidebar-more { @apply rounded hover:bg-slate-700; padding: 4px 8px; opacity: 0; }
.sidebar-row:hover .sidebar-more, .sidebar-more:focus-visible { opacity: 1; }
.production-sidebar.compact .sidebar-scroll { scrollbar-width: none; }
.production-sidebar.compact .sidebar-scroll::-webkit-scrollbar { display: none; }
.sidebar-tree-header .sidebar-nav { padding-left: 2px; }
.sector-header .sidebar-nav { padding-left: 5px; }
.production-sidebar.compact .sector-header .sidebar-nav { position: absolute; right: 0; top: 4px; width: 12px; height: 28px; padding: 0; }
.production-sidebar.compact .sector-header .sidebar-item-icon { width: 12px; height: 12px; }
.sidebar-group { margin: 4px 0; position: relative; }
.sidebar-group.expanded::before { content: ''; position: absolute; left: 0; top: 4px; bottom: 4px; width: 2px; border-radius: 2px; background: var(--sidebar-group-color); }
.sector-chevron-btn { display: flex; flex-shrink: 0; align-items: center; justify-content: center; width: 32px; height: 26px; margin-left: calc(var(--sidebar-icon-center) - var(--sidebar-row-gutter) - 16px); border-radius: 8px; color: white; }
.sector-header .sector-chevron-btn { width: 26px; margin-left: calc(var(--sidebar-icon-center) - var(--sidebar-row-gutter) - 13px); }
.sidebar-chevron-icon { width: 14px; height: 14px; }
.station-drag-handle, .group-drag-handle { position: absolute; left: 0; top: 50%; transform: translateY(-50%); padding: 2px; cursor: grab; color: #64748b; touch-action: none; user-select: none; }
.sidebar-search { @apply bg-slate-800 border border-slate-700 rounded text-xs p-2; width: calc(100% - 16px); margin: 8px; }
.sidebar-add-btn { @apply flex items-center gap-2 text-xs hover:text-sky-400; padding: 12px 8px 12px calc(var(--sidebar-icon-center) - 10px); width: 100%; }
.sidebar-message { @apply p-3 text-xs text-slate-400; }
.sidebar-resize-handle { position: absolute; right: -3px; width: 6px; top: 0; bottom: 0; cursor: ew-resize; touch-action: none; z-index: 2; }
.sidebar-resize-handle:hover { background: #38bdf866; }
.production-sidebar.drawer { position: fixed; left: 0; top: 0; bottom: 0; z-index: 51; display: none; }
.production-sidebar.drawer.drawer-open { display: flex; }
.sidebar-drawer-trigger { @apply bg-slate-900 text-sky-400 p-2; align-self: flex-start; }
.sidebar-drawer-backdrop { position: fixed; inset: 0; z-index: 50; background: #0009; }
.sidebar-overlay { @apply bg-slate-800 border border-slate-600 rounded-lg shadow-2xl text-slate-200; position: fixed; z-index: 70; max-width: calc(100vw - 16px); max-height: calc(100vh - 16px); overflow: auto; }
.sidebar-context-menu { min-width: 180px; padding: 4px; }
.menu-header { @apply text-xs text-slate-400 p-2; }
.menu-item { @apply block w-full text-left px-3 py-2 text-xs rounded hover:bg-slate-700; }
.sidebar-overlay .danger, .sidebar-delete-card .danger { color: #f87171; }
.sidebar-group-editor { width: 270px; padding: 16px; font-size: 12px; }
.group-name-input { @apply bg-slate-900 border border-slate-600 rounded p-2 my-2 w-full; }
.sidebar-color-palette { display: flex; flex-wrap: wrap; gap: 12px; padding: 10px 2px; }
.sidebar-color { width: 20px; height: 20px; border-radius: 50%; border: 2px solid transparent; }
.sidebar-color.selected { outline: 2px solid #e2e8f0; outline-offset: 3px; }
.sidebar-editor-actions { @apply flex justify-end gap-3 mt-4; }
.sidebar-editor-actions button { @apply rounded bg-slate-700 px-3 py-2 hover:bg-slate-600; }
.sidebar-delete-backdrop { @apply fixed inset-0 flex items-center justify-center bg-black/60; z-index: 80; }
.sidebar-delete-card { @apply bg-slate-800 border border-slate-600 rounded-xl p-5 shadow-2xl text-slate-200; max-width: 360px; }
.sidebar-drag-placeholder { opacity: .25; }
.sidebar-drag-shadow { opacity: .7; pointer-events: none !important; }
.sidebar-row .icon-green { filter: brightness(0) saturate(100%) invert(64%) sepia(60%) saturate(450%) hue-rotate(84deg) brightness(92%) contrast(91%); }
.sidebar-row .icon-orange { filter: brightness(0) saturate(100%) invert(76%) sepia(45%) saturate(650%) hue-rotate(7deg) brightness(99%) contrast(91%); }
.sidebar-row .icon-temp-state-1 { filter: brightness(0) saturate(100%) invert(79%) sepia(20%) saturate(1111%) hue-rotate(141deg) brightness(87%) contrast(86%); }
.sidebar-row .icon-temp-state-2 { filter: brightness(0) saturate(100%) invert(48%) sepia(79%) saturate(2476%) hue-rotate(86deg) brightness(118%) contrast(119%); }
.sidebar-row .icon-temp-state-3 { filter: brightness(0) saturate(100%) invert(59%) sepia(60%) saturate(5033%) hue-rotate(1deg) brightness(102%) contrast(105%); }
.sidebar-row .icon-temp-state-4 { filter: brightness(0) saturate(100%) invert(16%) sepia(100%) saturate(7419%) hue-rotate(4deg) brightness(89%) contrast(117%); }
</style>

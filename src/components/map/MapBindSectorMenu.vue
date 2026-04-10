<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

interface SaveSectorCandidate {
  sectorMacro: string
  sectorName: string
}

interface VisibleSectorCandidate {
  macro: string
  displayName: string
}

const props = defineProps<{
  open: boolean
  targetSectorId: string | null
  triggerEl: HTMLElement | null
  filteredSaveSectors: SaveSectorCandidate[]
  visibleMapSectors: VisibleSectorCandidate[]
  draftAnchorSectorMacro: string | null
  currentBoundSectorMacro: string | null
  occupiedSectorMacros: Set<string>
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'select-sector', sectorMacro: string): void
}>()

const { t } = useI18n()

const bindMenuRef = ref<HTMLElement | null>(null)
const bindMenuStyle = ref<Record<string, string>>({})

function isSectorOccupied(sectorMacro: string): boolean {
  return props.occupiedSectorMacros.has(sectorMacro)
}

function isCurrentBoundSector(sectorMacro: string): boolean {
  return props.currentBoundSectorMacro === sectorMacro
}

function isDraftBoundSector(sectorMacro: string): boolean {
  return props.draftAnchorSectorMacro === sectorMacro
}

function updateBindMenuPosition() {
  const panel = document.querySelector('.map-save-panel, .map-binding-panel')
  const trigger = props.triggerEl
  const anchor = (trigger?.closest('.empire-sector-item') as HTMLElement | null) || trigger
  if (!panel || !trigger || !anchor) {
    bindMenuStyle.value = {
      position: 'fixed',
      top: '100px',
      left: '400px',
      maxHeight: '300px'
    }
    return
  }

  const panelRect = panel.getBoundingClientRect()
  const anchorRect = anchor.getBoundingClientRect()
  const menuHeight = bindMenuRef.value?.offsetHeight || 300
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0
  const spaceBelow = viewportHeight - anchorRect.bottom
  const spaceAbove = anchorRect.top
  const preferUpward = spaceBelow < menuHeight && spaceAbove > spaceBelow
  const rawTop = preferUpward
    ? anchorRect.bottom - menuHeight
    : anchorRect.top
  const top = Math.max(8, Math.min(rawTop, Math.max(8, viewportHeight - menuHeight - 8)))

  bindMenuStyle.value = {
    position: 'fixed',
    top: `${top}px`,
    left: `${panelRect.right + 8}px`,
    maxHeight: '300px'
  }
}

function onMenuSectorClick(sectorMacro: string) {
  if (isDraftBoundSector(sectorMacro)) return
  emit('select-sector', sectorMacro)
}

function onVisibleSectorClick(sectorMacro: string) {
  emit('select-sector', sectorMacro)
}

function onGlobalPointerDown(event: MouseEvent) {
  if (!props.open) return
  const menuRoot = bindMenuRef.value
  const trigger = props.triggerEl
  if (!menuRoot) return
  if (!(event.target instanceof Node)) return
  if (menuRoot.contains(event.target)) return
  if (trigger && trigger.contains(event.target)) return
  emit('close')
}

function onViewportChange() {
  if (!props.open) return
  updateBindMenuPosition()
}

watch(() => props.open, (open) => {
  if (open) {
    nextTick(() => updateBindMenuPosition())
  }
})

onMounted(() => {
  document.addEventListener('mousedown', onGlobalPointerDown)
  window.addEventListener('resize', onViewportChange)
  window.addEventListener('scroll', onViewportChange, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onGlobalPointerDown)
  window.removeEventListener('resize', onViewportChange)
  window.removeEventListener('scroll', onViewportChange, true)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="bind-menu"
      ref="bindMenuRef"
      :style="bindMenuStyle"
    >
      <div class="bind-menu-group">
        <div class="bind-menu-group-title">{{ t('map.binding_save_sector_candidates') }}</div>
        <template v-if="filteredSaveSectors.length <= 10">
          <button
            v-for="sector in filteredSaveSectors"
            :key="sector.sectorMacro"
            type="button"
            class="bind-menu-item"
            :class="{ 
              active: isCurrentBoundSector(sector.sectorMacro),
              'draft-active': isDraftBoundSector(sector.sectorMacro),
              orange: isSectorOccupied(sector.sectorMacro)
            }"
            :disabled="isSectorOccupied(sector.sectorMacro)"
            @click="onMenuSectorClick(sector.sectorMacro)"
          >
            <span>{{ sector.sectorName }}</span>
          </button>
        </template>
        <div v-else class="bind-menu-hint">
          {{ t('map.binding_filter_hint_search') }}
        </div>
        <div v-if="filteredSaveSectors.length === 0" class="bind-menu-empty">
          {{ t('map.binding_no_unbound_sectors') }}
        </div>
      </div>

      <div class="bind-menu-group">
        <div class="bind-menu-group-title">{{ t('map.binding_visible_sector_candidates') }}</div>
        <template v-if="visibleMapSectors.length > 0 && visibleMapSectors.length <= 10">
          <button
            v-for="sector in visibleMapSectors"
            :key="sector.macro"
            type="button"
            class="bind-menu-item"
            :class="{ orange: isSectorOccupied(sector.macro) }"
            :disabled="isSectorOccupied(sector.macro)"
            @click="onVisibleSectorClick(sector.macro)"
          >
            {{ sector.displayName }}
          </button>
        </template>
        <div v-else-if="visibleMapSectors.length > 10" class="bind-menu-hint">
          {{ t('map.binding_filter_hint_zoom') }}
        </div>
        <div v-else class="bind-menu-empty">
          {{ t('map.binding_no_visible_sectors') }}
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.bind-menu {
  @apply fixed z-[100] min-w-[40px] w-auto max-h-[300px] overflow-y-auto rounded-lg border-2 border-amber-400 bg-black/95 py-2 shadow-2xl;
  backdrop-filter: blur(12px);
  scrollbar-width: thin;
  scrollbar-color: rgba(251, 191, 36, 0.55) transparent;
}

.bind-menu::-webkit-scrollbar {
  width: 6px;
}

.bind-menu::-webkit-scrollbar-track {
  @apply rounded-full bg-slate-900/35;
}

.bind-menu::-webkit-scrollbar-thumb {
  @apply rounded-full bg-amber-300/45;
}

.bind-menu::-webkit-scrollbar-thumb:hover {
  @apply bg-amber-200/60;
}

.bind-menu-group {
  @apply px-1;
}

.bind-menu-group-title {
  @apply px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-amber-100/60;
}

.bind-menu-item {
  @apply flex items-center justify-between whitespace-nowrap rounded px-3 py-2 text-left text-sm text-amber-100 transition-colors hover:bg-amber-200/10;
}

.bind-menu-item.active {
  @apply bg-amber-200/15 text-amber-50;
}

.bind-menu-item.draft-active {
  @apply border border-amber-200/50 bg-amber-200/10 text-amber-50;
}

.bind-menu-item.orange {
  @apply text-orange-200;
}

.bind-menu-item.orange:hover {
  @apply bg-transparent;
}

.bind-menu-item:disabled {
  @apply cursor-not-allowed opacity-50;
}

.bind-menu-hint {
  @apply px-3 py-2 text-xs text-amber-100/50;
}

.bind-menu-empty {
  @apply px-3 py-2 text-xs text-amber-100/40;
}
</style>
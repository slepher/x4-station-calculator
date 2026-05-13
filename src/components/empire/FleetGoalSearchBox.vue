<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useShipBuildStore } from '@/store/useShipBuildStore'
import { useGameDataStore } from '@/store/useGameDataStore'

const emit = defineEmits<{
  addFleetEntry: [shipId: string, blueprintId: string]
}>()

const shipBuildStore = useShipBuildStore()
const gameData = useGameDataStore()
const { t } = useI18n()

const searchInput = ref<HTMLInputElement | null>(null)
const isFocused = ref(false)
const focusSnapshot = ref('')
const popoverPosition = ref({ top: 0, left: 0 })
const searchQuery = ref('')

interface FleetSearchShip {
  shipId: string
  shipName: string
  displayLabel: string
  localeName: string
  name: string
  className: string
  classOrder: number
  blueprints: Array<{ id: string; name: string }>
}

const CLASS_ORDER: Record<string, number> = {
  ship_s: 0,
  ship_m: 1,
  ship_l: 2,
  ship_xl: 3,
}

const shipItems = computed<FleetSearchShip[]>(() => {
  const result: FleetSearchShip[] = []
  for (const bucket of shipBuildStore.savedBlueprints.ships) {
    const localizedShip = gameData.localizedShipsMap[bucket.shipId]
    if (!localizedShip) continue
    const userBlueprints = bucket.blueprints.filter(
      (bp) => !shipBuildStore.isBuiltInBlueprintId(bp.id)
    )
    if (userBlueprints.length === 0) continue
    const localeName = localizedShip.localeName || ''
    const originalName = localizedShip.name || ''
    result.push({
      shipId: bucket.shipId,
      shipName: localeName || originalName || localizedShip.id,
      displayLabel: localeName || originalName || localizedShip.id,
      localeName,
      name: originalName,
      className: localizedShip.class,
      classOrder: CLASS_ORDER[localizedShip.class] ?? 99,
      blueprints: userBlueprints.map((bp) => ({
        id: bp.id,
        name: bp.name || bp.id,
      })),
    })
  }
  return result
})

const filteredResults = computed<FleetSearchShip[]>(() => {
  const query = searchQuery.value.toLowerCase().trim()
  const isEn = gameData.currentLocale === 'en'
  let items = shipItems.value
  if (query) {
    items = items.filter((item) => {
      const localeName = item.localeName.toLowerCase()
      const originalName = item.name.toLowerCase()
      const id = item.shipId.toLowerCase()
      if (isEn) {
        if (originalName.includes(query) || id.includes(query)) return true
      } else {
        if (localeName.includes(query) || originalName.includes(query) || id.includes(query)) return true
      }
      return item.blueprints.some((bp) => bp.name.toLowerCase().includes(query))
    }).map((item) => {
      const localeName = item.localeName.toLowerCase()
      const originalName = item.name.toLowerCase()
      const id = item.shipId.toLowerCase()
      const localeHit = !isEn && localeName.includes(query)
      const nameHit = originalName.includes(query)
      const idHit = id.includes(query)

      let label = item.localeName || item.name || item.shipId
      if (isEn) {
        if (idHit && !nameHit) label += ` (${item.shipId})`
      } else {
        if (nameHit && !localeHit) label += ` (${item.name})`
        else if (idHit && !localeHit && !nameHit) label += ` (${item.shipId})`
      }

      return { ...item, displayLabel: label }
    })
  } else {
    items = items.map((item) => ({ ...item, displayLabel: item.localeName || item.name || item.shipId }))
  }
  return items.sort((a, b) => {
    if (a.classOrder !== b.classOrder) return a.classOrder - b.classOrder
    return a.shipName.localeCompare(b.shipName)
  })
})

const hasAnySavedBlueprints = computed(() => shipItems.value.length > 0)

const updatePopoverPosition = async () => {
  await nextTick()
  if (!searchInput.value) return
  const searchRect = searchInput.value.getBoundingClientRect()
  const panelCard = searchInput.value.closest('.panel-card')
  let baseLeft = searchRect.right
  if (panelCard) {
    const panelRect = panelCard.getBoundingClientRect()
    baseLeft = panelRect.right + 8
  } else {
    baseLeft = searchRect.right + 8
  }
  popoverPosition.value = {
    top: searchRect.top,
    left: baseLeft,
  }
}

const onFocus = async () => {
  focusSnapshot.value = searchQuery.value || ''
  await updatePopoverPosition()
  isFocused.value = true
}

const onBlur = () => {
  setTimeout(() => {
    if (isFocused.value) {
      const popover = document.querySelector('.fleet-search-popover')
      const isClickInsidePopover = popover && popover.contains(document.activeElement)
      if (!isClickInsidePopover) {
        const hasResults = filteredResults.value.length > 0 || !hasAnySavedBlueprints.value
        if (!hasResults) {
          searchQuery.value = focusSnapshot.value
        }
        isFocused.value = false
      }
    }
  }, 10)
}

const onClearClick = () => {
  searchQuery.value = ''
  focusSnapshot.value = ''
  searchInput.value?.focus()
}

const handleSelectBlueprint = (shipId: string, blueprintId: string) => {
  emit('addFleetEntry', shipId, blueprintId)
  isFocused.value = false
  searchInput.value?.blur()
  searchQuery.value = ''
}

const onEsc = () => {
  searchInput.value?.blur()
  isFocused.value = false
}

const handlePopoverMouseDown = (e: MouseEvent) => {
  e.preventDefault()
}

const CLASS_LABELS: Record<string, string> = {
  ship_s: 'S',
  ship_m: 'M',
  ship_l: 'L',
  ship_xl: 'XL',
}

defineExpose({ searchInput, isFocused, searchQuery, onFocus, onBlur, onEsc, onClearClick })
</script>

<template>
  <input
    ref="searchInput"
    :value="searchQuery"
    class="search-input"
    data-testid="fleet-search-input"
    :placeholder="t('build_plan.fleet_search_placeholder')"
    @input="searchQuery = ($event.target as HTMLInputElement).value"
    @focus="onFocus"
    @blur="onBlur"
    @keydown.esc="onEsc"
  />
  <button
    v-show="searchQuery"
    class="clear-btn opacity-0 group-hover:opacity-100 transition-opacity duration-200"
    @mousedown.prevent="onClearClick"
  >
    ×
  </button>

  <Teleport to="body">
    <Transition name="fade-slide">
      <div
        v-if="isFocused && (filteredResults.length > 0 || !hasAnySavedBlueprints)"
        class="fleet-search-popover scrollbar-thin"
        data-testid="fleet-search-popover"
        :style="{ position: 'fixed', top: popoverPosition.top + 'px', left: popoverPosition.left + 'px' }"
        @mousedown="handlePopoverMouseDown"
      >
        <template v-if="!hasAnySavedBlueprints">
          <div class="empty-state">{{ t('build_plan.fleet_empty') }}</div>
        </template>
        <template v-else>
          <div
            v-for="ship in filteredResults"
            :key="ship.shipId"
            class="type-group"
          >
            <div class="group-header">
              <span class="class-badge">{{ CLASS_LABELS[ship.className] || ship.className }}</span>
              {{ ship.displayLabel }}
            </div>
            <div
              v-for="bp in ship.blueprints"
              :key="bp.id"
              class="result-item"
              :data-testid="`fleet-result-${bp.id}`"
              @click="handleSelectBlueprint(ship.shipId, bp.id)"
            >
              <div class="result-main">
                <span class="label">{{ bp.name }}</span>
              </div>
            </div>
          </div>
        </template>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.search-input {
  @apply flex-1 bg-transparent border-none outline-none text-slate-200 text-sm min-w-0;
}

.clear-btn {
  @apply text-slate-500 hover:text-slate-300 px-1 cursor-pointer ml-1;
}

.class-badge {
  @apply inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold bg-amber-700/40 text-amber-300 mr-2;
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  @apply transition-all duration-75;
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  @apply opacity-0 transform translate-x-2;
}
</style>

<style>
.fleet-search-popover {
  @apply w-72 bg-slate-900 border border-slate-700 rounded shadow-2xl z-[9999] max-h-64 overflow-y-auto;
}

.fleet-search-popover .type-group {
  @apply w-full;
}

.fleet-search-popover .group-header {
  @apply px-3 py-1 bg-slate-800/60 text-[10px] uppercase text-slate-500 font-bold border-y border-slate-800 flex items-center;
}

.fleet-search-popover .result-item {
  @apply flex items-center h-9 px-3 hover:bg-sky-500/10 cursor-pointer border-b border-slate-800/40;
}

.fleet-search-popover .result-main {
  @apply flex min-w-0 flex-1 items-center gap-2;
}

.fleet-search-popover .label {
  @apply text-sm text-slate-300 truncate min-w-0 flex-1;
}

.fleet-search-popover .empty-state {
  @apply px-3 py-4 text-xs text-slate-500 text-center italic;
}

.fleet-search-popover.scrollbar-thin::-webkit-scrollbar {
  @apply w-1;
}

.fleet-search-popover.scrollbar-thin::-webkit-scrollbar-thumb {
  @apply bg-slate-700 rounded-full;
}
</style>

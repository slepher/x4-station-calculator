<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEmpireStore } from '@/store/useEmpireStore'
import { useSaveStore } from '@/store/useSaveStore'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useSectorNameFilter } from '@/composables/useSectorNameFilter'
import { getLocalizedSectorQueryMatch } from './savePoiSearch'
import { getCoverageSectors, buildSectorGraphFromMaps } from '@/store/logic/saveBindingUtils'
import { resolveMapSectorByMacro } from './mapSectorMacro'
import type { SaveBindingPlan, SectorPlan } from '@/types/x4'
import type { PlayerStationEntry, SaveArchive } from '@/types/saveArchive'

const props = defineProps<{
  gameGuid: string
}>()

const emit = defineEmits<{
  (e: 'select-group', sectorGroupId: string): void
  (e: 'focus-sector', sectorId: string): void
  (e: 'fit-sectors', sectorIds: string[]): void
}>()

const { t, te, locale } = useI18n()
const empireStore = useEmpireStore()
const saveStore = useSaveStore()
const gameDataStore = useGameDataStore()

const sectorSearchQuery = ref('')
const { getSectorDisplayName, normalizedQuery } = useSectorNameFilter(sectorSearchQuery)

const expandedSectorId = ref<string | null>(null)
const draftJumpRange = ref(3)
const draftCoverage = ref<string[]>([])
const draftExcluded = ref<string[]>([])

const bindMenuOpen = ref(false)
const bindMenuRef = ref<HTMLElement | null>(null)
const bindMenuStyle = ref<Record<string, string>>({})
const bindMenuTargetSectorId = ref<string | null>(null)
const bindMenuTriggerEl = ref<HTMLElement | null>(null)

const activeEmpire = computed(() => empireStore.activeEmpire)

const activeBindingPlan = computed<SaveBindingPlan | null>(() => {
  return empireStore.activeEmpire?.saveBindings?.find((b) => b.gameGuid === props.gameGuid) || null
})

const activeArchive = computed<SaveArchive | null>(() => {
  const binding = activeBindingPlan.value
  if (!binding) return null

  const guid = binding.gameGuid
  const selected = saveStore.selectedArchive

  if (selected && selected.meta.guid === guid) {
    const time = binding.selectedArchiveTime
    if (time === null || selected.meta.time === time) {
      return selected
    }
  }

  const group = saveStore.archives.get(guid)
  if (!group) return null

  const time = binding.selectedArchiveTime
  if (time === null) {
    return group.saves[0] || null
  }

  const archive = group.saves.find((s) => s.meta.time === time)
  return archive ?? group.saves[0] ?? null
})

interface SectorWithStations {
  sectorMacro: string
  rawSectorName: string
  sectorName: string
  showRawSectorName: boolean
  stations: PlayerStationEntry[]
}

const saveSectors = computed<SectorWithStations[]>(() => {
  if (!activeArchive.value) return []

  const sectorsMap = new Map<string, PlayerStationEntry[]>()

  for (const [sectorMacro, sector] of Object.entries(activeArchive.value.sectors)) {
    const stations = sector.playerStations || []
    if (stations.length > 0) {
      sectorsMap.set(sectorMacro, stations)
    }
  }

  const results: SectorWithStations[] = []

  for (const [sectorMacro, stations] of sectorsMap) {
    const fallbackName = activeArchive.value.sectors[sectorMacro]?.name || sectorMacro
    const names = getSectorDisplayName(sectorMacro, fallbackName)

    results.push({
      ...names,
      stations
    })
  }

  return results.sort((a, b) => a.sectorName.localeCompare(b.sectorName))
})

const filteredSaveSectors = computed<SectorWithStations[]>(() => {
  if (!normalizedQuery.value) {
    return saveSectors.value.map((sector) => ({
      ...sector,
      showRawSectorName: false
    }))
  }

  return saveSectors.value
    .filter((sector) =>
      getLocalizedSectorQueryMatch({
        rawName: sector.rawSectorName,
        displayName: sector.sectorName,
        normalizedQuery: normalizedQuery.value,
        locale: locale.value
      }).matched
    )
    .map((sector) => {
      const match = getLocalizedSectorQueryMatch({
        rawName: sector.rawSectorName,
        displayName: sector.sectorName,
        normalizedQuery: normalizedQuery.value,
        locale: locale.value
      })

      const showRawSectorName =
        locale.value !== 'en' &&
        sector.rawSectorName !== sector.sectorName &&
        match.matchedRawName &&
        !match.matchedDisplayName

      return {
        ...sector,
        showRawSectorName
      }
    })
})

const empireSectors = computed<SectorPlan[]>(() => {
  if (!activeEmpire.value) return []
  return [...(activeEmpire.value.sectors || [])].sort((a, b) => (a.order || 0) - (b.order || 0))
})

const empireSectorItems = computed(() => {
  return empireSectors.value.map(sector => {
    const groupBinding = activeBindingPlan.value?.groupBindings.find(
      (b) => b.sectorGroupId === sector.id
    )
    return {
      id: sector.id,
      name: sector.name,
      isBound: !!groupBinding,
      sectorMacro: groupBinding?.sectorMacro || null,
      coverageMacros: groupBinding?.coverageSectorMacros || [],
      jumpRange: groupBinding?.jumpRange || 3,
      expanded: expandedSectorId.value === sector.id
    }
  })
})

const unboundSaveSectors = computed(() => {
  const boundMacros = new Set<string>()
  if (activeBindingPlan.value) {
    activeBindingPlan.value.groupBindings.forEach(b => {
      b.coverageSectorMacros?.forEach(m => boundMacros.add(m.toLowerCase()))
    })
  }
  return saveSectors.value.filter(s => !boundMacros.has(s.sectorMacro.toLowerCase()))
})

const visibleMapSectors = computed<string[]>(() => {
  // TODO: 实现地图可见面积超过50%的星区计算
  return []
})

// 候选星区：跳数范围内但不在覆盖星区中的地图星区
const candidateSectors = computed(() => {
  const currentBinding = activeBindingPlan.value?.groupBindings.find(
    b => b.sectorGroupId === expandedSectorId.value
  )
  
  // 获取当前 anchor 和跳数
  let anchorMacro: string
  let jumpRange: number
  
  if (expandedSectorId.value === bindMenuTargetSectorId.value && bindMenuTargetSectorId.value) {
    // 刚从菜单点击进入配置，使用 draft 值
    anchorMacro = currentBinding?.sectorMacro || ''
    jumpRange = draftJumpRange.value
  } else if (currentBinding?.sectorMacro) {
    // 已有绑定，使用当前配置
    anchorMacro = currentBinding.sectorMacro
    jumpRange = currentBinding.jumpRange
  } else {
    return []
  }
  
  if (!anchorMacro) return []
  
  // 获取跳数范围内的所有地图星区
  const sectorGraphData = buildSectorGraphFromMaps(gameDataStore.maps?.clusters || {})
  const coverageResult = getCoverageSectors(
    anchorMacro.toLowerCase(), 
    jumpRange, 
    sectorGraphData.sectorGraph, 
    sectorGraphData.sectorClusterMap
  )
  
  // 覆盖星区集合
  const coverageSet = new Set(draftCoverage.value.map(m => m.toLowerCase()))
  
  // 候选星区：跳数范围内 - 覆盖星区（所有地图星区）
  const candidates: string[] = []
  for (const sector of coverageResult) {
    const macroLower = sector.sectorMacro.toLowerCase()
    if (!coverageSet.has(macroLower) && macroLower !== anchorMacro.toLowerCase()) {
      candidates.push(sector.sectorMacro)
    }
  }
  
  return candidates
})

function isSaveSectorBound(sectorMacro: string): boolean {
  if (!activeBindingPlan.value) return false
  const groupBinding = activeBindingPlan.value.groupBindings.find(
    (b) => b.coverageSectorMacros?.some(m => m.toLowerCase() === sectorMacro.toLowerCase())
  )
  return !!groupBinding
}

function getBoundSectorGroupName(sectorMacro: string): string | null {
  if (!activeBindingPlan.value) return null
  const groupBinding = activeBindingPlan.value.groupBindings.find(
    (b) => b.coverageSectorMacros?.some(m => m.toLowerCase() === sectorMacro.toLowerCase())
  )
  if (!groupBinding) return null
  const sector = empireSectors.value.find((s) => s.id === groupBinding.sectorGroupId)
  return sector?.name || null
}

function getStationLabel(station: PlayerStationEntry): string {
  if (station.is_headquarter) {
    return t('map.save_station_headquarter')
  }
  return station.code.split('_').pop() || station.code
}

function getSectorMacroDisplayName(sectorMacro: string): string {
  const resolved = resolveMapSectorByMacro(gameDataStore.maps?.clusters || {}, sectorMacro)
  if (resolved?.sectorId) {
    const cluster = gameDataStore.maps?.clusters?.[resolved.clusterId]
    const sector = cluster?.sectors?.[resolved.sectorId]
    if (sector?.nameId && te(sector.nameId)) {
      return t(sector.nameId)
    }
    return sector?.name || sectorMacro
  }
  return sectorMacro
}

function selectSaveSector(sectorMacro: string) {
  const groupBinding = activeBindingPlan.value?.groupBindings.find(
    (b) => b.coverageSectorMacros?.some(m => m.toLowerCase() === sectorMacro.toLowerCase())
  )
  if (groupBinding) {
    emit('select-group', groupBinding.sectorGroupId)
  }
}

function updateBindMenuPosition() {
  const panel = document.querySelector('.map-binding-panel')
  const trigger = bindMenuTriggerEl.value
  if (!panel || !trigger) {
    bindMenuStyle.value = {
      position: 'fixed',
      top: '100px',
      left: '400px',
      maxHeight: '300px'
    }
    return
  }

  const panelRect = panel.getBoundingClientRect()
  const triggerRect = trigger.getBoundingClientRect()

  bindMenuStyle.value = {
    position: 'fixed',
    top: `${triggerRect.top}px`,
    left: `${panelRect.right + 8}px`,
    maxHeight: '300px'
  }
}

function toggleBindMenu(event: MouseEvent, sectorId: string) {
  if (bindMenuOpen.value && bindMenuTargetSectorId.value === sectorId) {
    closeBindMenu()
  } else {
    bindMenuTargetSectorId.value = sectorId
    bindMenuTriggerEl.value = event.currentTarget as HTMLElement
    bindMenuOpen.value = true
    nextTick(() => updateBindMenuPosition())
  }
}

function closeBindMenu() {
  bindMenuOpen.value = false
  bindMenuTargetSectorId.value = null
}

function onBindMenuGlobalPointerDown(event: MouseEvent) {
  if (!bindMenuOpen.value) return
  const menuRoot = bindMenuRef.value
  const trigger = bindMenuTriggerEl.value
  if (!menuRoot) return
  if (!(event.target instanceof Node)) return
  if (menuRoot.contains(event.target)) return
  if (trigger && trigger.contains(event.target)) return
  closeBindMenu()
}

function onBindMenuViewportChange() {
  if (!bindMenuOpen.value) return
  updateBindMenuPosition()
}

function selectSaveSectorForBinding(sectorMacro: string) {
  if (!bindMenuTargetSectorId.value) return

  const sectorGraphData = buildSectorGraphFromMaps(gameDataStore.maps?.clusters || {})
  const coverage = getCoverageSectors(sectorMacro.toLowerCase(), draftJumpRange.value, sectorGraphData.sectorGraph, sectorGraphData.sectorClusterMap)

  draftCoverage.value = coverage.map(s => s.sectorMacro)
  draftExcluded.value = []
  expandedSectorId.value = bindMenuTargetSectorId.value

  empireStore.bindSectorGroup({
    gameGuid: props.gameGuid,
    sectorGroupId: bindMenuTargetSectorId.value,
    sectorMacro,
    jumpRange: draftJumpRange.value,
    coverageSectorMacros: draftCoverage.value
  })

  closeBindMenu()
}

function selectVisibleSectorForBinding(sectorMacro: string) {
  selectSaveSectorForBinding(sectorMacro)
}

function unbindSector(sectorId: string) {
  empireStore.clearSectorGroupBinding(props.gameGuid, sectorId)
}

function isCurrentBoundSector(sectorMacro: string): boolean {
  if (!bindMenuTargetSectorId.value) return false
  const groupBinding = activeBindingPlan.value?.groupBindings.find(
    b => b.sectorGroupId === bindMenuTargetSectorId.value
  )
  return groupBinding?.sectorMacro?.toLowerCase() === sectorMacro.toLowerCase()
}

function unbindCurrentSector() {
  if (bindMenuTargetSectorId.value) {
    empireStore.clearSectorGroupBinding(props.gameGuid, bindMenuTargetSectorId.value)
    closeBindMenu()
  }
}

function onMenuSectorClick(sectorMacro: string) {
  const currentBinding = activeBindingPlan.value?.groupBindings.find(
    b => b.sectorGroupId === bindMenuTargetSectorId.value
  )
  
  if (currentBinding?.sectorMacro?.toLowerCase() === sectorMacro.toLowerCase()) {
    // 点击已选星区，保持现有配置
    draftJumpRange.value = currentBinding.jumpRange
    draftCoverage.value = [...(currentBinding.coverageSectorMacros || [])]
    draftExcluded.value = []
  } else {
    // 点击新星区，重新计算 coverage（跳数不变）
    // 覆盖星区 = 跳数范围内所有 save sector
    const sectorGraphData = buildSectorGraphFromMaps(gameDataStore.maps?.clusters || {})
    const coverageResult = getCoverageSectors(sectorMacro.toLowerCase(), draftJumpRange.value, sectorGraphData.sectorGraph, sectorGraphData.sectorClusterMap)
    
    // 从跳数范围内的星区中筛选出 save sector
    const saveSectorMacros = new Set(saveSectors.value.map(s => s.sectorMacro.toLowerCase()))
    draftCoverage.value = coverageResult
      .map(s => s.sectorMacro)
      .filter(m => saveSectorMacros.has(m.toLowerCase()))
    draftExcluded.value = []
  }
  
  expandedSectorId.value = bindMenuTargetSectorId.value
  
  empireStore.bindSectorGroup({
    gameGuid: props.gameGuid,
    sectorGroupId: bindMenuTargetSectorId.value!,
    sectorMacro,
    jumpRange: draftJumpRange.value,
    coverageSectorMacros: draftCoverage.value
  })
  
  closeBindMenu()
}

function cancelBinding(sectorId: string) {
  empireStore.clearSectorGroupBinding(props.gameGuid, sectorId)
  expandedSectorId.value = null
}

function confirmBinding(sectorId: string) {
  if (draftExcluded.value.length > 0) {
    const currentBinding = activeBindingPlan.value?.groupBindings.find(b => b.sectorGroupId === sectorId)
    if (currentBinding) {
      const newCoverage = draftCoverage.value.filter(m => !draftExcluded.value.includes(m))
      empireStore.bindSectorGroup({
        gameGuid: props.gameGuid,
        sectorGroupId: sectorId,
        sectorMacro: currentBinding.sectorMacro || '',
        jumpRange: draftJumpRange.value,
        coverageSectorMacros: newCoverage
      })
    }
  }
  expandedSectorId.value = null
}

function updateDraftJumpRange(value: number) {
  draftJumpRange.value = Math.max(0, Math.min(5, value))
  
  const currentBinding = activeBindingPlan.value?.groupBindings.find(b => b.sectorGroupId === expandedSectorId.value)
  if (currentBinding?.sectorMacro) {
    const sectorGraphData = buildSectorGraphFromMaps(gameDataStore.maps?.clusters || {})
    const coverage = getCoverageSectors(currentBinding.sectorMacro.toLowerCase(), draftJumpRange.value, sectorGraphData.sectorGraph, sectorGraphData.sectorClusterMap)
    const excludedSet = new Set(draftExcluded.value)
    draftCoverage.value = coverage.map(s => s.sectorMacro).filter(m => !excludedSet.has(m))
  }
}

function excludeFromCoverage(sectorMacro: string) {
  const index = draftCoverage.value.indexOf(sectorMacro)
  if (index >= 0) {
    draftCoverage.value.splice(index, 1)
  }
}

function addToCoverage(sectorMacro: string) {
  if (!draftCoverage.value.includes(sectorMacro)) {
    draftCoverage.value.push(sectorMacro)
  }
}

// @ts-ignore - Used in template
function includeToCoverage(sectorMacro: string) {
  addToCoverage(sectorMacro)
}

watch(() => props.gameGuid, () => {
  closeBindMenu()
})

onMounted(() => {
  document.addEventListener('mousedown', onBindMenuGlobalPointerDown)
  window.addEventListener('resize', onBindMenuViewportChange)
  window.addEventListener('scroll', onBindMenuViewportChange, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onBindMenuGlobalPointerDown)
  window.removeEventListener('resize', onBindMenuViewportChange)
  window.removeEventListener('scroll', onBindMenuViewportChange, true)
})
</script>

<template>
  <div class="binding-sector-group">
    <!-- Empire Sectors -->
    <div class="section-header">{{ t('map.binding_empire_sectors') }}</div>
    <div v-if="empireSectors.length === 0" class="empty-hint">
      {{ t('map.binding_no_empire_sectors') }}
    </div>
    <div v-else class="empire-sectors">
      <div
        v-for="sector in empireSectorItems"
        :key="sector.id"
        class="empire-sector-item"
        :class="{ expanded: sector.expanded, bound: sector.isBound }"
        @click="sector.isBound && !sector.expanded && emit('select-group', sector.id)"
      >
        <div class="empire-sector-header">
          <span class="empire-sector-name">{{ sector.name }}</span>
          <button
            v-if="!sector.isBound"
            class="bind-btn"
            type="button"
            @click.stop="toggleBindMenu($event, sector.id)"
          >
            {{ t('map.binding_bind') }}
            <svg class="bind-btn-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 6l6 6-6 6" />
            </svg>
          </button>
          <button
            v-else-if="!sector.expanded"
            class="bound-sector-btn"
            type="button"
            @click.stop="toggleBindMenu($event, sector.id)"
          >
            {{ sector.sectorMacro ? getSectorMacroDisplayName(sector.sectorMacro) : t('map.binding_bind') }}
            <svg class="bound-btn-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 6l6 6-6 6" />
            </svg>
          </button>
          <template v-else>
            <button class="cancel-btn" type="button" @click.stop="cancelBinding(sector.id)">{{ t('map.binding_cancel') }}</button>
            <button class="confirm-btn" type="button" @click.stop="confirmBinding(sector.id)">{{ t('map.binding_confirm') }}</button>
          </template>
        </div>

        <!-- Expanded Configuration -->
        <div v-if="sector.expanded" class="empire-sector-config">
          <div class="config-row">
            <label class="config-label">{{ t('map.binding_jump_range') }}</label>
            <input
              class="jump-input"
              type="number"
              min="0"
              max="5"
              :value="draftJumpRange"
              @input="updateDraftJumpRange(Number(($event.target as HTMLInputElement).value) || 0)"
            />
          </div>

          <div class="config-row">
            <label class="config-label">{{ t('map.binding_coverage_sectors') }}</label>
            <div class="pill-list">
              <span
                v-for="macro in draftCoverage"
                :key="macro"
                class="pill pill--coverage"
              >
                {{ getSectorMacroDisplayName(macro) }}
                <button class="pill-x" type="button" @click.stop="excludeFromCoverage(macro)">×</button>
              </span>
            </div>
          </div>

          <div class="config-row">
            <label class="config-label">{{ t('map.binding_candidate_sectors') }}</label>
            <div class="pill-list">
              <span
                v-for="macro in candidateSectors"
                :key="macro"
                class="pill pill--candidate"
              >
                {{ getSectorMacroDisplayName(macro) }}
                <button class="pill-plus" type="button" @click.stop="addToCoverage(macro)">+</button>
              </span>
            </div>
          </div>
        </div>

        <!-- Collapsed Coverage Pills -->
        <div v-else-if="sector.isBound && sector.coverageMacros.length > 0" class="coverage-pills">
          <span
            v-for="macro in sector.coverageMacros.slice(0, 5)"
            :key="macro"
            class="pill pill--small"
          >
            {{ getSectorMacroDisplayName(macro) }}
          </span>
          <span v-if="sector.coverageMacros.length > 5" class="pill pill--small pill--more">
            +{{ sector.coverageMacros.length - 5 }}
          </span>
        </div>
      </div>
    </div>

    <!-- Search Box -->
    <div class="search-wrap">
      <input
        v-model="sectorSearchQuery"
        class="search-input"
        :placeholder="t('map.save_coord_search_placeholder')"
        type="text"
      />
      <button
        v-if="sectorSearchQuery"
        class="search-clear"
        type="button"
        @click="sectorSearchQuery = ''"
      >
        ×
      </button>
    </div>

    <!-- Save Sectors -->
    <div class="section-header">{{ t('map.binding_save_sectors') }}</div>
    <div class="sector-stats">
      {{ filteredSaveSectors.reduce((sum, s) => sum + s.stations.length, 0) }} {{ t('map.save_coord_count') }}
    </div>

    <div v-if="filteredSaveSectors.length === 0" class="empty-hint">
      {{ t('map.binding_no_sectors') }}
    </div>

    <div v-else class="save-sectors">
      <div
        v-for="sector in filteredSaveSectors"
        :key="sector.sectorMacro"
        class="save-sector-item"
        :class="{ bound: isSaveSectorBound(sector.sectorMacro) }"
        @click="selectSaveSector(sector.sectorMacro)"
      >
        <div class="save-sector-header">
          <span class="save-sector-name">
            {{ sector.sectorName }}
            <span v-if="sector.showRawSectorName" class="sector-raw">({{ sector.rawSectorName }})</span>
          </span>
          <span class="save-sector-count">{{ sector.stations.length }}</span>
        </div>
        <div v-if="isSaveSectorBound(sector.sectorMacro)" class="save-sector-tag">
          {{ t('map.binding_belongs_to') }}: {{ getBoundSectorGroupName(sector.sectorMacro) }}
        </div>
        <div class="station-tags">
          <span
            v-for="station in sector.stations"
            :key="station.code"
            class="station-tag"
          >
            {{ getStationLabel(station) }}
          </span>
        </div>
      </div>
    </div>

    <!-- Bind Menu -->
    <Teleport to="body">
      <div
        v-if="bindMenuOpen"
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
              :class="{ active: isCurrentBoundSector(sector.sectorMacro) }"
              @click="onMenuSectorClick(sector.sectorMacro)"
            >
              <span>{{ sector.sectorName }}</span>
              <button
                v-if="isCurrentBoundSector(sector.sectorMacro)"
                class="bind-menu-item-unbind"
                type="button"
                @click.stop="unbindCurrentSector()"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-3 w-3">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
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
              v-for="macro in visibleMapSectors"
              :key="macro"
              type="button"
              class="bind-menu-item"
              @click="selectVisibleSectorForBinding(macro)"
            >
              {{ getSectorMacroDisplayName(macro) }}
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
  </div>
</template>

<style scoped>
.binding-sector-group {
  @apply flex flex-col gap-3;
}

.search-wrap {
  @apply relative;
}

.search-input {
  @apply w-full rounded-lg border border-amber-300/30 bg-black/50 px-3 py-2 text-sm text-amber-50 outline-none placeholder:text-amber-100/40;
}

.search-clear {
  @apply absolute right-2 top-1/2 -translate-y-1/2 text-amber-100/60 hover:text-amber-50;
}

.section-header {
  @apply text-xs font-semibold uppercase tracking-wider text-amber-100/60;
}

.sector-stats {
  @apply text-xs text-amber-100/50;
}

.empty-hint {
  @apply text-center text-sm text-amber-100/40;
}

.empire-sectors {
  @apply flex flex-col gap-2;
}

.empire-sector-item {
  @apply rounded border border-amber-300/20 bg-black/40 p-2 transition-colors cursor-pointer hover:border-amber-200/40;
}

.empire-sector-item.bound {
  @apply cursor-pointer;
}

.empire-sector-item.expanded {
  @apply border-amber-200/50 bg-black/60;
}

.empire-sector-header {
  @apply flex items-center justify-between gap-2;
}

.empire-sector-name {
  @apply text-sm text-amber-100;
}

.bind-btn {
  @apply inline-flex items-center gap-1 whitespace-nowrap rounded border border-amber-300/30 bg-amber-200/10 px-2 py-1 text-xs text-amber-100;
}

.bind-btn-chevron {
  @apply h-3 w-3;
}

.unbind-btn {
  @apply rounded border border-red-300/30 bg-red-200/10 px-2 py-1 text-xs text-red-200;
}

.bound-sector-btn {
  @apply inline-flex items-center gap-1 whitespace-nowrap rounded border border-amber-300/30 bg-amber-200/10 px-2 py-1 text-xs text-amber-100;
}

.bound-btn-chevron {
  @apply h-3 w-3;
}

.cancel-btn {
  @apply rounded border border-amber-300/30 bg-transparent px-2 py-1 text-xs text-amber-100;
}

.confirm-btn {
  @apply rounded bg-amber-200/20 px-2 py-1 text-xs text-amber-50;
}

.empire-sector-config {
  @apply mt-3 flex flex-col gap-3 border-t border-amber-300/15 pt-3;
}

.config-row {
  @apply flex flex-col gap-1;
}

.config-label {
  @apply text-xs text-amber-100/60;
}

.jump-input {
  @apply w-20 rounded border border-amber-300/30 bg-black/50 px-2 py-1 text-sm text-amber-50;
}

.coverage-pills {
  @apply mt-2 flex flex-wrap gap-1;
}

.pill {
  @apply inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs;
}

.pill--coverage {
  @apply border-amber-300/30 bg-amber-200/10 text-amber-100;
}

.pill--excluded {
  @apply border-amber-300/20 bg-transparent text-amber-100/60;
}

.pill--candidate {
  @apply border-amber-300/20 bg-transparent text-amber-100/60;
}

.pill--small {
  @apply border-amber-300/20 bg-amber-200/5 text-amber-100/75;
}

.pill--more {
  @apply bg-transparent text-amber-100/50;
}

.pill-x,
.pill-plus {
  @apply text-amber-100/60 hover:text-amber-50;
}

.save-sectors {
  @apply flex flex-col gap-2;
}

.save-sector-item {
  @apply rounded border border-amber-300/15 bg-black/30 p-2 transition-colors hover:border-amber-200/30;
}

.save-sector-item.bound {
  @apply cursor-pointer hover:bg-amber-200/5;
}

.save-sector-header {
  @apply flex items-center justify-between gap-2;
}

.save-sector-name {
  @apply text-sm text-amber-100;
}

.sector-raw {
  @apply text-xs text-amber-100/50;
}

.save-sector-count {
  @apply text-xs text-amber-100/50;
}

.save-sector-tag {
  @apply mt-1 text-xs text-amber-100/60;
}

.station-tags {
  @apply mt-1 flex flex-wrap gap-1;
}

.station-tag {
  @apply rounded-full bg-amber-200/10 px-2 py-0.5 text-xs text-amber-100/70;
}

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

.bind-menu-item-unbind {
  @apply ml-2 inline-flex h-4 w-4 items-center justify-center rounded text-amber-100/55 hover:text-amber-50;
}

.bind-menu-hint {
  @apply px-3 py-2 text-xs text-amber-100/50;
}

.bind-menu-empty {
  @apply px-3 py-2 text-xs text-amber-100/40;
}
</style>
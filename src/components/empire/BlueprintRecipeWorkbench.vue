<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useBlueprintRecipePresenter } from '@/components/empire/presenters/useBlueprintRecipePresenter'

const gameData = useGameDataStore()
const { blueprintsData, factions } = storeToRefs(gameData)
const p = useBlueprintRecipePresenter({ blueprintsData, factions })
const { t } = useI18n()

const { typesNav, selectedTypeId, selectedClassId, filteredBlueprints, searchQuery, factionFilter, licenceFilter, availableFactions, availableLicences } = p.props
const { selectType, selectClass, updateSearchQuery, toggleFactionFilter, toggleLicenceFilter } = p.emits

const expandedTypes = ref<Set<string>>(new Set(p.props.typesNav.value.map(t => t.id)))

function toggleType(typeId: string) {
  const next = new Set(expandedTypes.value)
  if (next.has(typeId)) {
    next.delete(typeId)
  } else {
    next.add(typeId)
  }
  expandedTypes.value = next
}

function resolveName(bp: { nameId: string; name: string; id: string }): string {
  if (bp.nameId) {
    const resolved = t(bp.nameId)
    if (resolved !== bp.nameId) return resolved
  }
  return bp.name || bp.id
}

function formatPrice(price: number | undefined): string {
  if (price == null) return ''
  if (price >= 1e6) return (price / 1e6).toFixed(1) + ' MCr'
  if (price >= 1e3) return (price / 1e3).toFixed(1) + ' kCr'
  return price.toFixed(0) + ' Cr'
}

function resolveLicenceForFaction(factionId: string, ltype: string | undefined): string {
  if (!ltype) return ''
  const faction = factions.value.find(f => f.id === factionId)
  if (faction && faction.licences) {
    const match = faction.licences.find(l => l.type === ltype)
    if (match && match.nameId) {
      const resolved = t(match.nameId)
      if (resolved !== match.nameId) return resolved
      if (match.name) return match.name
    }
  }
  return ''
}

function toggleAllFactions(items: { id: string }[]) {
  if (factionFilter.value.size === 0) {
    factionFilter.value = new Set(items.map(i => i.id))
  } else {
    factionFilter.value = new Set()
  }
}

function toggleAllLicences(items: { id: string }[]) {
  if (licenceFilter.value.size === 0) {
    licenceFilter.value = new Set(items.map(i => i.id))
  } else {
    licenceFilter.value = new Set()
  }
}
</script>

<template>
  <div class="blueprint-recipe-workbench">
    <div class="bp-nav custom-scrollbar">
      <div
        v-for="typeGroup in typesNav"
        :key="typeGroup.id"
        class="bp-nav-group"
      >
        <button
          class="bp-nav-type"
          :class="{ active: selectedTypeId === typeGroup.id }"
          @click="selectType(typeGroup.id); toggleType(typeGroup.id)"
        >
          <svg
            class="bp-nav-chevron"
            :class="{ rotated: expandedTypes.has(typeGroup.id) }"
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
          <span class="bp-nav-type-name">{{ typeGroup.name }}</span>
        </button>
        <div v-if="expandedTypes.has(typeGroup.id)" class="bp-nav-classes">
          <button
            v-for="cls in typeGroup.classes"
            :key="cls.id"
            class="bp-nav-class"
            :class="{ active: selectedClassId === cls.id }"
            @click="selectClass(cls.id)"
          >
            {{ cls.name }}
          </button>
        </div>
      </div>
    </div>

    <div class="bp-filter-panel custom-scrollbar">
      <div v-if="availableFactions.length > 0" class="bp-filter-section">
        <div class="bp-filter-title">
          <span>Factions</span>
          <button class="bp-filter-toggle" @click="toggleAllFactions(availableFactions)">{{ factionFilter.size === 0 ? '取消' : '全选' }}</button>
        </div>
        <label
          v-for="fac in availableFactions"
          :key="fac.id"
          class="bp-filter-item"
        >
          <input
            type="checkbox"
            :checked="!factionFilter.has(fac.id)"
            @change="toggleFactionFilter(fac.id)"
          />
          <span>{{ fac.name }}</span>
        </label>
      </div>
      <div v-if="availableLicences.length > 0" class="bp-filter-section">
        <div class="bp-filter-title">
          <span>Licences</span>
          <button class="bp-filter-toggle" @click="toggleAllLicences(availableLicences)">{{ licenceFilter.size === 0 ? '取消' : '全选' }}</button>
        </div>
        <label
          v-for="lic in availableLicences"
          :key="lic.id"
          class="bp-filter-item"
        >
          <input
            type="checkbox"
            :checked="!licenceFilter.has(lic.id)"
            @change="toggleLicenceFilter(lic.id)"
          />
          <span>{{ t('licence.' + lic.id) }}</span>
        </label>
      </div>
    </div>

    <div class="bp-content custom-scrollbar">
      <div class="bp-search-bar">
        <input
          :value="searchQuery"
          type="text"
          class="bp-search-input"
          :placeholder="t('blueprint_recipe.search')"
          @input="updateSearchQuery(($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="bp-list">
        <div class="bp-list-header">
          <span class="bp-list-count">
            {{ filteredBlueprints.length }} {{ t('blueprint_recipe.results') }}
          </span>
        </div>

        <div v-if="filteredBlueprints.length === 0" class="bp-empty">
          {{ t('blueprint_recipe.no_results') }}
        </div>

        <div
          v-for="bp in filteredBlueprints"
          :key="bp.id"
          class="bp-item"
        >
          <div class="bp-item-top">
            <div class="bp-item-name">{{ resolveName(bp) }}</div>
            <span v-if="bp.price" class="bp-item-price">{{ formatPrice(bp.price) }}</span>
          </div>
          <div class="bp-item-factions" v-if="(bp.factions || []).length > 0">
            <div
              v-for="faction in bp.factions || []"
              :key="faction"
              class="bp-faction-group"
            >
              <span
                class="bp-tag bp-tag-faction"
                :class="{ 'bp-fr-none': !!resolveLicenceForFaction(faction, bp.licence) }"
              >{{ p.props.factionDisplayNames.value[faction] || faction }}</span>
              <span v-if="resolveLicenceForFaction(faction, bp.licence)" class="bp-tag bp-tag-licence">{{ resolveLicenceForFaction(faction, bp.licence) }}</span>
            </div>
          </div>
          <div class="bp-item-meta" v-if="bp.missiononly || bp.noplayerblueprint">
            <span v-if="bp.missiononly" class="bp-tag bp-tag-warn">{{ t('blueprint_recipe.mission_only') }}</span>
            <span v-if="bp.noplayerblueprint" class="bp-tag bp-tag-warn">{{ t('blueprint_recipe.no_player_blueprint') }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.blueprint-recipe-workbench {
  @apply flex flex-1 min-h-0;
}

.bp-nav {
  @apply w-56 flex-shrink-0 overflow-y-auto border-r border-slate-700 bg-slate-900/50;
}

.bp-nav-group {
  @apply border-b border-slate-800/50;
}

.bp-nav-type {
  @apply w-full flex items-center gap-1.5 px-3 py-2 text-left text-sm font-medium;
  @apply text-slate-300 hover:text-slate-100 hover:bg-slate-800/50 transition-colors;
}

.bp-nav-type.active {
  @apply text-sky-400 bg-slate-800/30;
}

.bp-nav-chevron {
  @apply w-3 h-3 flex-shrink-0 text-slate-500 transition-transform duration-150;
}

.bp-nav-chevron.rotated {
  @apply rotate-90;
}

.bp-nav-type-name {
  @apply flex-1 truncate;
}

.bp-nav-classes {
  @apply pl-6 pb-1;
}

.bp-nav-class {
  @apply w-full text-left px-3 py-1 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/50;
  @apply rounded transition-colors;
}

.bp-nav-class.active {
  @apply text-sky-400 bg-slate-800/30;
}

.bp-filter-panel {
  @apply w-44 flex-shrink-0 overflow-y-auto border-r border-slate-700 bg-slate-900/30 px-2 py-2;
}

.bp-filter-section {
  @apply mb-3;
}

.bp-filter-title {
  @apply flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 px-1;
}

.bp-filter-toggle {
  @apply text-[10px] text-sky-400 hover:text-sky-300 font-normal normal-case tracking-normal;
}

.bp-filter-item {
  @apply flex items-center gap-1.5 px-1 py-0.5 text-xs text-slate-400 hover:text-slate-200 cursor-pointer rounded;
}

.bp-filter-item input {
  @apply w-3 h-3;
}

.bp-content {
  @apply flex-1 flex flex-col min-w-0 overflow-y-auto;
}

.bp-search-bar {
  @apply px-4 pt-4 pb-2;
}

.bp-search-input {
  @apply w-full px-3 py-1.5 text-sm bg-slate-800 border border-slate-600 rounded-md;
  @apply text-slate-200 placeholder-slate-500 outline-none;
  @apply focus:border-sky-500 transition-colors;
}

.bp-list-header {
  @apply px-4 py-2 flex items-center;
}

.bp-list-count {
  @apply text-xs text-slate-500;
}

.bp-empty {
  @apply flex-1 flex items-center justify-center text-sm text-slate-500;
}

.bp-item {
  @apply px-4 py-2.5 border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors;
}

.bp-item-top {
  @apply flex items-center justify-between;
}

.bp-item-name {
  @apply text-sm font-medium text-slate-200;
}

.bp-item-price {
  @apply text-xs text-amber-400 flex-shrink-0;
}

.bp-item-factions {
  @apply flex flex-wrap items-center gap-1.5 mt-1.5;
}

.bp-item-meta {
  @apply flex flex-wrap items-center gap-1.5 mt-1.5;
}

.bp-faction-group {
  @apply inline-flex items-center gap-0;
}

.bp-tag {
  @apply inline-block text-[10px] px-1.5 py-0.5 font-medium;
  border-radius: 4px;
}

.bp-tag-faction {
  @apply bg-slate-700/50 text-slate-400 border border-slate-600/50;
}

.bp-tag-licence {
  @apply bg-blue-900/50 text-blue-300 border border-blue-800/50;
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  border-left: none;
}

.bp-fr-none {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}

.bp-tag-warn {
  @apply bg-amber-900/50 text-amber-400 border border-amber-800/50 rounded;
}
</style>

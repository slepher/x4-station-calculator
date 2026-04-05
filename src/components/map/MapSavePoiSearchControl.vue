<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameDataStore } from '@/store/useGameDataStore'
import type { SearchState, SearchTag } from './savePoiSearchFilter'
import type { LocalizedX4Module, X4MapSector } from '@/types/x4'

const emit = defineEmits<{
  (e: 'search-change', state: SearchState & { sectorJumpLimit?: number }): void
}>()

const { t, te } = useI18n()
const gameData = useGameDataStore()

type SearchCategory = 'product' | 'module' | 'faction' | 'sector'

const selectedCategory = ref<SearchCategory>('product')
const searchInput = ref('')
const suggestions = ref<SearchTag[]>([])
const showSuggestions = ref(false)
const productModuleTags = ref<SearchTag[]>([])
const factionTags = ref<SearchTag[]>([])
const sectorTags = ref<SearchTag[]>([])
const sectorJumpLimit = ref(5)

let debounceTimer: ReturnType<typeof setTimeout> | null = null

const productionModulesList = computed<LocalizedX4Module[]>(() => {
  const modules = Object.values(gameData.localizedModulesMap)
  return modules.filter(
    (m) => m.type === 'production' && Object.keys(m.outputs || {}).length > 0
  )
})

const sectorsList = computed<{ id: string; label: string }[]>(() => {
  const sectors: { id: string; label: string }[] = []
  const maps = gameData.maps
  if (!maps || !maps.clusters) return sectors

  for (const cluster of Object.values(maps.clusters)) {
    for (const sector of Object.values(cluster.sectors || {})) {
      const label = getSectorLabel(sector)
      sectors.push({ id: sector.macro || sector.id, label })
    }
  }
  return sectors.sort((a, b) => a.label.localeCompare(b.label))
})

function getSectorLabel(sector: X4MapSector): string {
  if (sector.nameId && te(sector.nameId)) {
    return t(sector.nameId)
  }
  return sector.name || sector.id
}

const categoryLabels = computed(() => ({
  product: t('map.poi_search_category_product'),
  module: t('map.poi_search_category_module'),
  faction: t('map.poi_search_category_faction'),
  sector: t('map.poi_search_category_sector')
}))

const placeholder = computed(() => {
  const labels = categoryLabels.value
  return t('map.poi_search_placeholder', { category: labels[selectedCategory.value] })
})

function searchProducts(query: string): SearchTag[] {
  const normalized = query.toLowerCase()
  const results: SearchTag[] = []
  const wares = Object.values(gameData.localizedWaresMap)
  for (const ware of wares) {
    const name = ware.localeName?.toLowerCase() || ware.id.toLowerCase()
    if (name.includes(normalized)) {
      results.push({
        category: 'product',
        id: ware.id,
        label: ware.localeName || ware.id
      })
    }
    if (results.length >= 10) break
  }
  return results
}

function searchModules(query: string): SearchTag[] {
  const normalized = query.toLowerCase()
  const results: SearchTag[] = []
  for (const module of productionModulesList.value) {
    const name = module.localeName?.toLowerCase() || module.id.toLowerCase()
    if (name.includes(normalized)) {
      results.push({
        category: 'module',
        id: module.id,
        label: module.localeName || module.id
      })
    }
    if (results.length >= 10) break
  }
  return results
}

function searchFactions(query: string): SearchTag[] {
  const normalized = query.toLowerCase()
  const results: SearchTag[] = []
  for (const faction of gameData.factions) {
    const name = faction.name?.toLowerCase() || faction.id.toLowerCase()
    if (name.includes(normalized)) {
      results.push({
        category: 'faction',
        id: faction.id,
        label: faction.name || faction.id
      })
    }
    if (results.length >= 10) break
  }
  return results
}

function searchSectors(query: string): SearchTag[] {
  const normalized = query.toLowerCase()
  const results: SearchTag[] = []
  for (const sector of sectorsList.value) {
    const name = sector.label.toLowerCase()
    if (name.includes(normalized)) {
      results.push({
        category: 'sector',
        id: sector.id,
        label: sector.label
      })
    }
    if (results.length >= 10) break
  }
  return results
}

function performSearch() {
  const query = searchInput.value.trim()
  if (!query) {
    suggestions.value = []
    showSuggestions.value = false
    return
  }

  switch (selectedCategory.value) {
    case 'product':
      suggestions.value = searchProducts(query)
      break
    case 'module':
      suggestions.value = searchModules(query)
      break
    case 'faction':
      suggestions.value = searchFactions(query)
      break
    case 'sector':
      suggestions.value = searchSectors(query)
      break
  }
  showSuggestions.value = suggestions.value.length > 0
}

watch(searchInput, () => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }
  debounceTimer = setTimeout(performSearch, 300)
})

function onCategoryChange() {
  searchInput.value = ''
  suggestions.value = []
  showSuggestions.value = false
}

function selectSuggestion(tag: SearchTag) {
  if (tag.category === 'faction') {
    if (!factionTags.value.some((t) => t.id === tag.id)) {
      factionTags.value.push(tag)
    }
  } else if (tag.category === 'sector') {
    if (!sectorTags.value.some((t) => t.id === tag.id)) {
      sectorTags.value.push(tag)
    }
  } else {
    if (!productModuleTags.value.some((t) => t.id === tag.id)) {
      productModuleTags.value.push(tag)
    }
  }
  searchInput.value = ''
  suggestions.value = []
  showSuggestions.value = false
  emitSearchChange()
}

function removeTag(tag: SearchTag) {
  if (tag.category === 'faction') {
    factionTags.value = factionTags.value.filter((t) => t.id !== tag.id)
  } else if (tag.category === 'sector') {
    sectorTags.value = sectorTags.value.filter((t) => t.id !== tag.id)
  } else {
    productModuleTags.value = productModuleTags.value.filter((t) => t.id !== tag.id)
  }
  emitSearchChange()
}

function emitSearchChange() {
  emit('search-change', {
    productModuleTags: productModuleTags.value,
    factionTags: factionTags.value,
    sectorTags: sectorTags.value,
    sectorJumpLimit: sectorJumpLimit.value
  })
}

function hideSuggestions() {
  showSuggestions.value = false
}

function getTagDisplay(tag: SearchTag): string {
  const labels = categoryLabels.value
  if (tag.category === 'sector') {
    return `${labels.sector}${sectorJumpLimit.value}${t('map.poi_search_jump_suffix')}:${tag.label}`
  }
  return `${labels[tag.category]}:${tag.label}`
}

watch(sectorJumpLimit, () => {
  if (sectorTags.value.length > 0) {
    emitSearchChange()
  }
})
</script>

<template>
  <div class="poi-search-control">
    <div class="search-row">
      <div class="input-wrapper">
        <input
          v-model="searchInput"
          class="search-input"
          :placeholder="placeholder"
          type="text"
          @blur="hideSuggestions"
          @focus="searchInput.trim() && performSearch()"
        />
        <select
          v-model="selectedCategory"
          class="category-select"
          @change="onCategoryChange"
        >
          <option value="product">{{ categoryLabels.product }}</option>
          <option value="module">{{ categoryLabels.module }}</option>
          <option value="faction">{{ categoryLabels.faction }}</option>
          <option value="sector">{{ categoryLabels.sector }}</option>
        </select>
        <div v-if="showSuggestions" class="suggestions-list">
          <div
            v-for="tag in suggestions"
            :key="`${tag.category}:${tag.id}`"
            class="suggestion-item"
            @mousedown.stop="selectSuggestion(tag)"
          >
            {{ tag.label }}
          </div>
        </div>
      </div>
    </div>

    <div v-if="selectedCategory === 'sector' && sectorTags.length > 0" class="jump-limit-row">
      <label class="jump-limit-label">{{ t('map.poi_search_jump_limit') }}</label>
      <input
        v-model.number="sectorJumpLimit"
        class="jump-limit-input"
        type="number"
        min="0"
        max="8"
      />
    </div>

    <div v-if="productModuleTags.length > 0 || factionTags.length > 0 || sectorTags.length > 0" class="tags-area">
      <div
        v-for="tag in productModuleTags"
        :key="`${tag.category}:${tag.id}`"
        class="search-tag"
      >
        <span class="tag-label">{{ getTagDisplay(tag) }}</span>
        <button class="tag-remove" type="button" @click="removeTag(tag)">×</button>
      </div>
      <div
        v-for="tag in factionTags"
        :key="`${tag.category}:${tag.id}`"
        class="search-tag faction"
      >
        <span class="tag-label">{{ getTagDisplay(tag) }}</span>
        <button class="tag-remove" type="button" @click="removeTag(tag)">×</button>
      </div>
      <div
        v-for="tag in sectorTags"
        :key="`${tag.category}:${tag.id}`"
        class="search-tag sector"
      >
        <span class="tag-label">{{ getTagDisplay(tag) }}</span>
        <button class="tag-remove" type="button" @click="removeTag(tag)">×</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.poi-search-control {
  @apply flex flex-col gap-2 mb-3;
}

.search-row {
  @apply flex gap-2;
}

.input-wrapper {
  @apply relative flex-1 flex items-center;
}

.search-input {
  @apply h-10 w-full rounded border border-amber-300/30 bg-black/60 pl-3 pr-24 text-sm text-amber-50 outline-none;
}

.category-select {
  @apply absolute right-0 h-8 my-1 w-20 rounded border-l border-amber-300/30 bg-transparent pl-2 pr-6 text-xs text-amber-100 outline-none cursor-pointer appearance-none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23fcd34d'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 4px center;
  background-size: 14px;
}

.suggestions-list {
  @apply absolute top-full left-0 right-0 mt-1 rounded border border-amber-300/30 bg-black/85 max-h-60 overflow-y-auto z-10;
  backdrop-filter: blur(8px);
}

.suggestion-item {
  @apply px-3 py-2 text-sm text-amber-50 cursor-pointer hover:bg-amber-200/10 transition-colors;
}

.jump-limit-row {
  @apply flex items-center gap-2;
}

.jump-limit-label {
  @apply text-xs text-amber-200/80;
}

.jump-limit-input {
  @apply w-16 h-8 rounded border border-amber-300/30 bg-black/60 px-2 text-sm text-amber-50 outline-none;
}

.tags-area {
  @apply flex flex-wrap gap-2;
}

.search-tag {
  @apply flex items-center gap-1 px-2 py-1 rounded border border-amber-300/15 bg-black/45 text-sm text-amber-50;
}

.search-tag.faction {
  @apply border-blue-300/15 bg-blue-900/20;
}

.search-tag.sector {
  @apply border-emerald-300/15 bg-emerald-900/20;
}

.tag-label {
  @apply truncate;
}

.tag-remove {
  @apply w-4 h-4 flex items-center justify-center rounded text-amber-100/60 hover:text-amber-50 hover:bg-amber-200/10 transition-colors;
}
</style>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useX4I18n } from '@/utils/UseX4I18n'
import { useLocalizedNameMatch } from '@/composables/useLocalizedNameMatch'
import JumpInput from '@/components/common/JumpInput.vue'
import type { SearchState, SearchTag } from './savePoiSearchFilter'

const emit = defineEmits<{
  (e: 'search-change', state: SearchState & { sectorJumpLimit?: number }): void
}>()

const { t, te } = useI18n()
const gameData = useGameDataStore()
const { translateFaction } = useX4I18n()
const { match, formatLabel } = useLocalizedNameMatch()

type SearchCategory = 'product' | 'module' | 'faction' | 'sector'

const selectedCategory = ref<SearchCategory>('product')
const searchInput = ref('')
const suggestions = ref<SearchTag[]>([])
const showSuggestions = ref(false)
const productModuleTags = ref<SearchTag[]>([])
const factionTags = ref<SearchTag[]>([])
const sectorTags = ref<SearchTag[]>([])
const sectorJumpLimit = ref(5)
const showCategoryDropdown = ref(false)

let debounceTimer: ReturnType<typeof setTimeout> | null = null

const categoryOptions: { value: SearchCategory; label: string }[] = [
  { value: 'product', label: 'map.poi_search_category_product' },
  { value: 'module', label: 'map.poi_search_category_module' },
  { value: 'faction', label: 'map.poi_search_category_faction' },
  { value: 'sector', label: 'map.poi_search_category_sector' }
]

const productionModulesList = computed(() => {
  const modules = Object.values(gameData.modulesMap)
  return modules.filter(
    (m) => m.type === 'production' && Object.keys(m.outputs || {}).length > 0
  )
})

const sectorsList = computed(() => {
  const sectors: { id: string; englishName: string; localizedName: string }[] = []
  const maps = gameData.maps
  if (!maps?.sectors) return sectors

  for (const sector of Object.values(maps.sectors)) {
    const englishName = sector.name || sector.id
    let localizedName = englishName
    if (sector.nameId && te(sector.nameId)) {
      localizedName = t(sector.nameId)
    }
    sectors.push({
      id: sector.macro || sector.id,
      englishName,
      localizedName
    })
  }
  return sectors.sort((a, b) => a.localizedName.localeCompare(b.localizedName))
})

const categoryLabels = computed(() => ({
  product: t('map.poi_search_category_product'),
  module: t('map.poi_search_category_module'),
  faction: t('map.poi_search_category_faction'),
  sector: t('map.poi_search_category_sector')
}))

const currentCategoryLabel = computed(() => categoryLabels.value[selectedCategory.value])

const placeholder = computed(() => {
  const labels = categoryLabels.value
  return t('map.poi_search_placeholder', { category: labels[selectedCategory.value] })
})

function selectCategory(value: SearchCategory) {
  selectedCategory.value = value
  showCategoryDropdown.value = false
  onCategoryChange()
}

function toggleCategoryDropdown() {
  showCategoryDropdown.value = !showCategoryDropdown.value
}

function searchProducts(query: string): SearchTag[] {
  const results: SearchTag[] = []
  
  for (const ware of Object.values(gameData.waresMap)) {
    const englishName = ware.name || ware.id
    const localizedName = gameData.localizedWaresMap[ware.id]?.localeName || englishName
    const result = match({ englishName, localizedName, query })
    
    if (result.matched) {
      results.push({
        category: 'product',
        id: ware.id,
        label: formatLabel(englishName, localizedName, query)
      })
    }
    if (results.length >= 10) break
  }
  return results
}

function searchModules(query: string): SearchTag[] {
  const results: SearchTag[] = []
  
  for (const module of productionModulesList.value) {
    const englishName = module.name || module.id
    const localizedName = gameData.localizedModulesMap[module.id]?.localeName || englishName
    const result = match({ englishName, localizedName, query })
    
    if (result.matched) {
      results.push({
        category: 'module',
        id: module.id,
        label: formatLabel(englishName, localizedName, query)
      })
    }
    if (results.length >= 10) break
  }
  return results
}

function searchFactions(query: string): SearchTag[] {
  const results: SearchTag[] = []
  
  for (const faction of gameData.factions) {
    const englishName = faction.name || faction.id
    const localizedName = translateFaction(faction)
    const result = match({ englishName, localizedName, query })
    
    if (result.matched) {
      results.push({
        category: 'faction',
        id: faction.id,
        label: formatLabel(englishName, localizedName, query)
      })
    }
    if (results.length >= 10) break
  }
  return results
}

function searchSectors(query: string): SearchTag[] {
  const results: SearchTag[] = []
  
  for (const sector of sectorsList.value) {
    const result = match({ 
      englishName: sector.englishName, 
      localizedName: sector.localizedName, 
      query 
    })
    
    if (result.matched) {
      results.push({
        category: 'sector',
        id: sector.id,
        label: formatLabel(sector.englishName, sector.localizedName, query)
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
          :class="{ 'sector-mode': selectedCategory === 'sector' }"
          :placeholder="placeholder"
          type="text"
          @blur="hideSuggestions"
          @focus="searchInput.trim() && performSearch()"
        />
        <div class="right-controls">
          <template v-if="selectedCategory === 'sector'">
            <JumpInput
              v-model="sectorJumpLimit"
              :min="0"
              :max="8"
              suffix="j"
            />
            <div class="divider"></div>
          </template>
          <div class="category-dropdown-wrapper">
            <div
              class="category-select-trigger"
              @click="toggleCategoryDropdown"
            >
              {{ currentCategoryLabel }}
              <svg class="category-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            <div v-if="showCategoryDropdown" class="category-dropdown">
              <div
                v-for="option in categoryOptions"
                :key="option.value"
                class="category-option"
                :class="{ active: selectedCategory === option.value }"
                @click="selectCategory(option.value)"
              >
                <span class="category-check">{{ selectedCategory === option.value ? '✓' : '' }}</span>
                {{ t(option.label) }}
              </div>
            </div>
          </div>
        </div>
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
  @apply flex;
}

.input-wrapper {
  @apply relative flex-1 flex items-center;
}

.search-input {
  @apply h-10 w-full rounded border border-amber-300/30 bg-black/60 pl-3 pr-20 text-sm text-amber-50 outline-none;
}

.search-input.sector-mode {
  padding-right: 10rem;
}

.right-controls {
  @apply absolute right-0 top-0 bottom-0 flex items-center gap-0;
}

.divider {
  @apply w-px h-6 mx-2 bg-amber-300/20;
}

.category-dropdown-wrapper {
  @apply relative;
}

.category-select-trigger {
  @apply h-8 w-16 flex items-center justify-between px-2 text-xs text-amber-100 cursor-pointer;
}

.category-arrow {
  @apply w-3 h-3 text-amber-100/80;
}

.category-dropdown {
  @apply absolute top-full right-0 mt-1 rounded border border-amber-300/30 bg-black/90 overflow-hidden z-20;
  min-width: 80px;
  backdrop-filter: blur(8px);
}

.category-option {
  @apply flex items-center gap-2 px-3 py-2 text-sm text-amber-50 cursor-pointer hover:bg-amber-200/10 transition-colors;
}

.category-option.active {
  @apply bg-amber-200/10;
}

.category-check {
  @apply w-4 text-amber-200;
}

.suggestions-list {
  @apply absolute top-full left-0 right-0 mt-1 rounded border border-amber-300/30 bg-black/85 max-h-60 overflow-y-auto z-10;
  backdrop-filter: blur(8px);
}

.suggestion-item {
  @apply px-3 py-2 text-sm text-amber-50 cursor-pointer hover:bg-amber-200/10 transition-colors;
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

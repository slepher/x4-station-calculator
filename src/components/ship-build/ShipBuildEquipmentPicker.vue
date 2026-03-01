<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FitEquipmentOption, EquipmentPickerProps, FilterTag } from '@/components/ship-build/fitTypes'

const props = defineProps<EquipmentPickerProps>()

const emit = defineEmits<{
  (e: 'confirm', equipmentId: string | null): void
  (e: 'cancel'): void
}>()

const { t } = useI18n()

const selectedRaceIds = ref<string[]>([])
const selectedMkIds = ref<string[]>([])
const selectedTagIds = ref<string[]>([])
const currentPage = ref(1)
const highlightedEquipmentId = ref<string | null>(props.initialEquipmentId)

const raceDefs = [
  { id: 'argon', label: 'ARGON' },
  { id: 'paranid', label: 'PARANID' },
  { id: 'split', label: 'SPLIT' },
  { id: 'teladi', label: 'TELADI' },
  { id: 'xenon', label: 'XENON' },
  { id: 'gen', label: 'GEN' }
]

const mkDefs = [
  { id: '1', label: 'MK1' },
  { id: '2', label: 'MK2' },
  { id: '3', label: 'MK3' },
  { id: '4', label: 'MK4' }
]

const tagDefs = [
  { id: 'standard', label: 'STANDARD' },
  { id: 'advanced', label: 'ADVANCED' },
  { id: 'xenon', label: 'XENON' },
  { id: 'mining', label: 'MINING' },
  { id: 'missile', label: 'MISSILE' },
  { id: 'highpower', label: 'HIGHPOWER' }
]

const normalizeRace = (option: FitEquipmentOption) => option.race || 'gen'
const normalizeMk = (option: FitEquipmentOption) => option.mk || ''
const normalizeTags = (option: FitEquipmentOption) => option.tags || []

const filterByRace = (candidates: FitEquipmentOption[], raceIds: string[]) => {
  if (raceIds.length === 0) return candidates
  return candidates.filter((item) => raceIds.includes(normalizeRace(item)))
}

const filterByMk = (candidates: FitEquipmentOption[], mkIds: string[]) => {
  if (mkIds.length === 0) return candidates
  return candidates.filter((item) => mkIds.includes(normalizeMk(item)))
}

const filterByTags = (candidates: FitEquipmentOption[], tagIds: string[]) => {
  if (tagIds.length === 0) return candidates
  return candidates.filter((item) => tagIds.every((tagId) => normalizeTags(item).includes(tagId)))
}

const availableRaceIds = computed(() => new Set(props.options.map((item) => normalizeRace(item))))
const availableMkIds = computed(() => new Set(props.options.map((item) => normalizeMk(item)).filter(Boolean)))
const availableTagIds = computed(() => new Set(props.options.flatMap((item) => normalizeTags(item))))

const raceCountMap = computed(() => {
  const pool = filterByMk(filterByTags(props.options, selectedTagIds.value), selectedMkIds.value)
  const counts = new Map<string, number>()
  pool.forEach((item) => {
    const raceId = normalizeRace(item)
    counts.set(raceId, (counts.get(raceId) || 0) + 1)
  })
  return counts
})

const mkCountMap = computed(() => {
  const pool = filterByRace(filterByTags(props.options, selectedTagIds.value), selectedRaceIds.value)
  const counts = new Map<string, number>()
  pool.forEach((item) => {
    const mkId = normalizeMk(item)
    if (!mkId) return
    counts.set(mkId, (counts.get(mkId) || 0) + 1)
  })
  return counts
})

const tagCountMap = computed(() => {
  const pool = filterByRace(filterByMk(props.options, selectedMkIds.value), selectedRaceIds.value)
  const counts = new Map<string, number>()
  pool.forEach((item) => {
    normalizeTags(item).forEach((tagId) => counts.set(tagId, (counts.get(tagId) || 0) + 1))
  })
  return counts
})

const raceTags = computed<FilterTag[]>(() => raceDefs
  .filter((item) => availableRaceIds.value.has(item.id))
  .map((item) => ({ id: item.id, label: item.label, count: raceCountMap.value.get(item.id) || 0 })))

const mkTags = computed<FilterTag[]>(() => mkDefs
  .filter((item) => availableMkIds.value.has(item.id))
  .map((item) => ({ id: item.id, label: item.label, count: mkCountMap.value.get(item.id) || 0 })))

const featureTags = computed<FilterTag[]>(() => tagDefs
  .filter((item) => availableTagIds.value.has(item.id))
  .map((item) => ({ id: item.id, label: item.label, count: tagCountMap.value.get(item.id) || 0 })))

const filteredCandidates = computed(() => {
  const byRace = filterByRace(props.options, selectedRaceIds.value)
  const byMk = filterByMk(byRace, selectedMkIds.value)
  return filterByTags(byMk, selectedTagIds.value)
})

const pageSize = 10
const listWithEmptyOption = computed(() => [
  { id: null, name: t('ship_build.fit_empty_slot'), mk: null, race: null, tags: [] },
  ...filteredCandidates.value
])

const totalPages = computed(() => {
  const total = Math.ceil(listWithEmptyOption.value.length / pageSize)
  return total > 0 ? total : 1
})

const pagedCandidates = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return listWithEmptyOption.value.slice(start, start + pageSize)
})

const toggleTag = (items: string[], setItems: (next: string[]) => void, id: string) => {
  if (items.includes(id)) {
    setItems(items.filter((item) => item !== id))
    return
  }
  setItems([...items, id])
}

const toggleRace = (id: string) => {
  toggleTag(selectedRaceIds.value, (next) => { selectedRaceIds.value = next }, id)
  currentPage.value = 1
}

const toggleMk = (id: string) => {
  toggleTag(selectedMkIds.value, (next) => { selectedMkIds.value = next }, id)
  currentPage.value = 1
}

const toggleFeatureTag = (id: string) => {
  toggleTag(selectedTagIds.value, (next) => { selectedTagIds.value = next }, id)
  currentPage.value = 1
}

const onConfirm = () => {
  emit('confirm', highlightedEquipmentId.value)
}

watch(() => props.initialEquipmentId, (next) => {
  highlightedEquipmentId.value = next
})

watch(filteredCandidates, () => {
  if (currentPage.value > totalPages.value) {
    currentPage.value = 1
  }
})

watch(() => props.slotKey, () => {
  selectedRaceIds.value = []
  selectedMkIds.value = []
  selectedTagIds.value = []
  currentPage.value = 1
})
</script>

<template>
  <aside v-if="open" class="picker-panel" data-testid="equipment-picker">
    <div class="picker-header">
      <div class="picker-title">{{ slotLabel }}</div>
      <div class="picker-subtitle">{{ t('ship_build.fit_picker_title') }}</div>
    </div>

    <div class="filter-block">
      <div class="filter-line">
        <span class="filter-group">RACE</span>
        <button
          v-for="tag in raceTags"
          :key="`race-${tag.id}`"
          class="filter-chip"
          :class="selectedRaceIds.includes(tag.id) ? 'filter-chip-active' : ''"
          :data-testid="`race-${tag.id}`"
          @click="toggleRace(tag.id)"
        >
          {{ tag.label }} <span class="chip-count">{{ tag.count }}</span>
        </button>
      </div>

      <div class="filter-line">
        <span class="filter-group">MK</span>
        <button
          v-for="tag in mkTags"
          :key="`mk-${tag.id}`"
          class="filter-chip"
          :class="selectedMkIds.includes(tag.id) ? 'filter-chip-active' : ''"
          :data-testid="`mk-${tag.id}`"
          @click="toggleMk(tag.id)"
        >
          {{ tag.label }} <span class="chip-count">{{ tag.count }}</span>
        </button>
      </div>

      <div class="filter-line">
        <span class="filter-group">TAG</span>
        <button
          v-for="tag in featureTags"
          :key="`tag-${tag.id}`"
          class="filter-chip"
          :class="selectedTagIds.includes(tag.id) ? 'filter-chip-active' : ''"
          :data-testid="`tag-${tag.id}`"
          @click="toggleFeatureTag(tag.id)"
        >
          {{ tag.label }} <span class="chip-count">{{ tag.count }}</span>
        </button>
      </div>
    </div>

    <div class="candidate-head">
      <span>{{ t('ship_build.fit_candidate_list') }}</span>
      <div v-if="totalPages > 1" class="pager">
        <button class="pager-btn" :disabled="currentPage === 1" @click="currentPage = currentPage - 1">&lt;</button>
        <button
          v-for="page in totalPages"
          :key="page"
          class="pager-btn"
          :class="currentPage === page ? 'pager-btn-active' : ''"
          :data-testid="`page-${page}`"
          @click="currentPage = page"
        >
          {{ page }}
        </button>
        <button class="pager-btn" :disabled="currentPage === totalPages" @click="currentPage = currentPage + 1">&gt;</button>
      </div>
    </div>

    <div class="candidate-list">
      <button
        v-for="item in pagedCandidates"
        :key="item.id || '__empty__'"
        class="candidate-item"
        :class="highlightedEquipmentId === item.id ? 'candidate-item-active' : ''"
        :data-testid="`candidate-${item.id || 'empty'}`"
        @click="highlightedEquipmentId = item.id"
      >
        <div class="candidate-name">{{ item.name }}</div>
        <div class="candidate-meta">{{ item.race || 'GEN' }} · {{ item.mk ? `MK${item.mk}` : '-' }}</div>
      </button>
    </div>

    <div class="picker-actions">
      <button class="action-btn action-secondary" data-testid="picker-cancel" @click="emit('cancel')">{{ t('ui.cancel') }}</button>
      <button class="action-btn action-primary" data-testid="picker-confirm" @click="onConfirm">{{ t('ship_build.fit_picker_confirm') }}</button>
    </div>
  </aside>
</template>

<style scoped>
.picker-panel { @apply rounded bg-[#032042] p-3 flex flex-col gap-3; }
.picker-header { @apply flex items-end justify-between gap-3; }
.picker-title { @apply text-sm font-semibold text-emerald-200; }
.picker-subtitle { @apply text-xs text-slate-300; }
.filter-block { @apply flex flex-col gap-2; }
.filter-line { @apply flex flex-wrap items-center gap-1.5; }
.filter-group { @apply text-[10px] uppercase text-slate-300 font-semibold min-w-8; }
.filter-chip { @apply rounded border border-slate-600 px-2 py-1 text-[10px] text-slate-200 bg-slate-900/50; }
.filter-chip-active { @apply border-emerald-300 bg-emerald-500/20 text-emerald-100; }
.chip-count { @apply text-[10px] text-slate-300 ml-1; }
.candidate-head { @apply flex items-center justify-between text-xs text-slate-100; }
.pager { @apply inline-flex items-center gap-1; }
.pager-btn { @apply rounded border border-sky-600 px-1.5 py-0.5 text-[10px] text-slate-200; }
.pager-btn-active { @apply border-emerald-300 text-emerald-100; }
.pager-btn:disabled { @apply opacity-40 cursor-not-allowed; }
.candidate-list { @apply grid grid-cols-1 gap-1.5; }
.candidate-item { @apply rounded border border-sky-700 bg-[#0a3c73] px-2 py-1.5 text-left; }
.candidate-item-active { @apply border-emerald-300 ring-1 ring-emerald-400; }
.candidate-name { @apply text-xs text-slate-100; }
.candidate-meta { @apply text-[10px] text-slate-300 mt-0.5; }
.picker-actions { @apply flex items-center justify-end gap-2 pt-2; }
.action-btn { @apply rounded px-3 py-1.5 text-xs font-semibold border; }
.action-secondary { @apply border-slate-500 text-slate-200; }
.action-primary { @apply border-emerald-300 text-emerald-100 bg-emerald-600/20; }
</style>

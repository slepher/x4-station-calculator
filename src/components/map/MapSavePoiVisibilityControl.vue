<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSaveStore } from '@/store/useSaveStore'
import type { SaveArchive, SavePoiCategory, SavePoiVisibility } from '@/types/saveArchive'

const props = defineProps<{
  visibility: SavePoiVisibility
  archive: SaveArchive | null
}>()

const emit = defineEmits<{
  (e: 'visibility-change', visibility: SavePoiVisibility): void
}>()

const { t } = useI18n()
const saveStore = useSaveStore()

const isExpanded = ref(false)

interface CategoryInfo {
  key: SavePoiCategory
  label: string
  count: number
}

const categories = computed<CategoryInfo[]>(() => {
  const data = saveStore.getArchivePoiCategories(props.archive, {})

  return [
    { key: 'playerStation', label: t('map.save_category_player_station'), count: data.playerStation.count },
    { key: 'npcStation', label: t('map.save_category_npc_station'), count: data.npcStation.count },
    { key: 'xenonStation', label: t('map.save_category_xenon_station'), count: data.xenonStation.count },
    { key: 'khaakStation', label: t('map.save_category_khaak_station'), count: data.khaakStation.count },
    { key: 'abandonedShip', label: t('map.save_category_abandoned_ship'), count: data.abandonedShip.count },
    { key: 'datavault', label: t('map.save_category_datavault'), count: data.datavault.count },
    { key: 'erlkingVault', label: t('map.save_category_erlking_vault'), count: data.erlkingVault.count }
  ]
})

function toggleExpanded() {
  isExpanded.value = !isExpanded.value
}

function onCheckboxChange(category: SavePoiCategory, checked: boolean) {
  const newVisibility = { ...props.visibility, [category]: checked }
  emit('visibility-change', newVisibility)
}
</script>

<template>
  <div v-if="archive" class="poi-visibility-control">
    <button
      type="button"
      class="toggle-btn"
      :class="{ active: isExpanded }"
      @click="toggleExpanded"
    >
      <svg class="toggle-icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="3" fill="currentColor" />
        <circle cx="12" cy="5" r="2" fill="currentColor" opacity="0.6" />
        <circle cx="18" cy="9" r="2" fill="currentColor" opacity="0.6" />
        <circle cx="18" cy="15" r="2" fill="currentColor" opacity="0.6" />
        <circle cx="12" cy="19" r="2" fill="currentColor" opacity="0.6" />
        <circle cx="6" cy="15" r="2" fill="currentColor" opacity="0.6" />
        <circle cx="6" cy="9" r="2" fill="currentColor" opacity="0.6" />
      </svg>
      <span class="toggle-label">{{ t('map.poi_visibility_toggle') }}</span>
    </button>

    <Transition name="slide-down">
      <div v-if="isExpanded" class="checkbox-panel">
        <div
          v-for="cat in categories"
          :key="cat.key"
          class="checkbox-item"
        >
          <label class="checkbox-label">
            <input
              type="checkbox"
              :checked="visibility[cat.key]"
              @change="onCheckboxChange(cat.key, ($event.target as HTMLInputElement).checked)"
            />
            <span class="label-text">{{ cat.label }}</span>
            <span class="label-count">({{ cat.count }})</span>
          </label>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.poi-visibility-control {
  @apply relative shrink-0;
}

.toggle-btn {
  @apply inline-flex items-center gap-2 rounded border border-amber-300/40 bg-black/75 px-4 h-10 text-sm font-semibold text-amber-50 shadow-xl transition-colors duration-150 hover:border-amber-200/70 hover:bg-black/85;
  backdrop-filter: blur(4px);
}

.toggle-btn.active {
  @apply border-amber-200/70 bg-amber-200/15 text-amber-50;
}

.toggle-icon {
  @apply h-[18px] w-[18px] text-amber-200/70;
}

.toggle-label {
  @apply leading-none;
}

.checkbox-panel {
  @apply absolute mt-2 rounded border border-amber-300/40 bg-black/85 shadow-2xl overflow-hidden;
  backdrop-filter: blur(8px);
  min-width: 200px;
  right: 0;
  top: 100%;
}

.checkbox-item {
  @apply px-3 py-2 border-b border-amber-300/10 last:border-b-0;
}

.checkbox-item:hover {
  @apply bg-amber-200/5;
}

.checkbox-label {
  @apply flex items-center gap-2 cursor-pointer;
}

.checkbox-label input[type="checkbox"] {
  @apply w-4 h-4 accent-amber-400 rounded border-amber-300/30;
}

.label-text {
  @apply text-sm text-amber-50;
}

.label-count {
  @apply text-xs text-amber-100/55;
}

.slide-down-enter-active,
.slide-down-leave-active {
  @apply transition-all duration-150;
}

.slide-down-enter-from,
.slide-down-leave-to {
  @apply opacity-0 -translate-y-1;
}
</style>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  visibility: {
    sectorLabels: boolean
    sectorLinks: boolean
    sectorGroupColors: boolean
    sectorRoutes: boolean
    sectorFactionFill: boolean
  }
  expanded: boolean
}>()

const emit = defineEmits<{
  (
    e: 'visibility-change',
    visibility: {
      sectorLabels: boolean
      sectorLinks: boolean
      sectorGroupColors: boolean
      sectorRoutes: boolean
      sectorFactionFill: boolean
    }
  ): void
  (e: 'toggle'): void
}>()

const { t } = useI18n()

function toggleExpanded() {
  emit('toggle')
}

function onToggle<K extends keyof typeof props.visibility>(key: K, checked: boolean) {
  emit('visibility-change', {
    ...props.visibility,
    [key]: checked
  })
}
</script>

<template>
  <div class="map-svg-diagnostic-control">
    <button
      type="button"
      class="toggle-btn"
      :class="{ active: expanded }"
      @click="toggleExpanded"
    >
      <svg class="toggle-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M4 7.5h16M4 12h16M4 16.5h16"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-width="1.8"
        />
        <circle cx="8" cy="7.5" r="2" fill="currentColor" />
        <circle cx="16" cy="12" r="2" fill="currentColor" />
        <circle cx="11" cy="16.5" r="2" fill="currentColor" />
      </svg>
      <span class="toggle-label">{{ t('map.debug_visibility_toggle') }}</span>
    </button>

    <Transition name="slide-down">
      <div v-if="expanded" class="checkbox-panel">
        <div class="checkbox-item">
          <label class="checkbox-label">
            <input
              type="checkbox"
              :checked="visibility.sectorLabels"
              @change="onToggle('sectorLabels', ($event.target as HTMLInputElement).checked)"
            />
            <span class="label-text">{{ t('map.debug_visibility_sector_labels') }}</span>
          </label>
        </div>

        <div class="checkbox-item">
          <label class="checkbox-label">
            <input
              type="checkbox"
              :checked="visibility.sectorLinks"
              @change="onToggle('sectorLinks', ($event.target as HTMLInputElement).checked)"
            />
            <span class="label-text">{{ t('map.debug_visibility_sector_links') }}</span>
          </label>
        </div>

        <div class="checkbox-item">
          <label class="checkbox-label">
            <input
              type="checkbox"
              :checked="visibility.sectorGroupColors"
              @change="onToggle('sectorGroupColors', ($event.target as HTMLInputElement).checked)"
            />
            <span class="label-text">{{ t('map.debug_visibility_sector_group_colors') }}</span>
          </label>
        </div>

        <div class="checkbox-item">
          <label class="checkbox-label">
            <input
              type="checkbox"
              :checked="visibility.sectorRoutes"
              @change="onToggle('sectorRoutes', ($event.target as HTMLInputElement).checked)"
            />
            <span class="label-text">{{ t('map.debug_visibility_sector_routes') }}</span>
          </label>
        </div>

        <div class="checkbox-item">
          <label class="checkbox-label">
            <input
              type="checkbox"
              :checked="visibility.sectorFactionFill"
              @change="onToggle('sectorFactionFill', ($event.target as HTMLInputElement).checked)"
            />
            <span class="label-text">{{ t('map.debug_visibility_sector_faction_fill') }}</span>
          </label>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.map-svg-diagnostic-control {
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
  width: max-content;
  max-width: min(320px, calc(100vw - 3rem));
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
  @apply flex items-center gap-2 cursor-pointer whitespace-nowrap;
}

.checkbox-label input[type="checkbox"] {
  @apply w-4 h-4 accent-amber-400 rounded border-amber-300/30;
}

.label-text {
  @apply text-sm text-amber-50;
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

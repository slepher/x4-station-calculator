<script setup lang="ts">
import type { X4Module, SavedModule } from '@/types/x4'
import { useX4I18n } from '@/utils/UseX4I18n';
import X4NumberInput from '@/components/common/X4NumberInput.vue';
import { useI18n } from 'vue-i18n';
import { computed } from 'vue';
import { useGameDataStore } from '@/store/useGameDataStore';

const { translateModule } = useX4I18n();
const { t } = useI18n();
const gameData = useGameDataStore()

const props = defineProps<{
  item: SavedModule
  info: X4Module
  readonly?: boolean
  noClick?: boolean
  isNumberFlashing?: boolean
  inactiveByDlc?: boolean
  countDisabled?: boolean
  threshold?: number
  diffAnnotation?: string
  colorByDiff?: boolean
  isRecommended?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:count', val: number): void
  (e: 'transfer', item: SavedModule): void
  (e: 'remove'): void
}>()

const isBelowThreshold = computed(() => {
  return props.isRecommended && props.threshold !== undefined && props.item.count < props.threshold
})
const isAboveThreshold = computed(() => {
  return props.colorByDiff && (moduleDiffAnnotation.value?.startsWith('+') ?? false)
})

const colorBarStyle = computed(() => {
  const colorRgb = props.info.color_rgb;
  if (colorRgb) {
    return {
      backgroundColor: colorRgb
    };
  }
  
  const type = props.info.type;
  if (type === 'habitation' || type.includes('habitat')) {
    return {
      backgroundColor: '#f97316'
    };
  } else {
    return {
      backgroundColor: '#0ea5e9'
    };
  }
})

const moduleInfoClass = computed(() => {
  return !props.readonly ? 'module-info--editable ignore-drag' : 'module-info--readonly'
})

const shouldShowDlcTag = computed(() => props.info.dlc_tag !== 'base')
const dlcLabel = computed(() => gameData.getDlcDisplayName(props.info.dlc_tag))
const isDlcActive = computed(() => gameData.isDlcActive(props.info.dlc_tag))
const localizedModuleName = computed(() => translateModule(props.info))
const moduleDiffAnnotation = computed(() => props.diffAnnotation ?? props.item.diffAnnotation)
const moduleDiffClass = computed(() => {
  if (!moduleDiffAnnotation.value) return ''
  return moduleDiffAnnotation.value.startsWith('-') ? 'module-diff-annotation--negative' : 'module-diff-annotation--positive'
})
</script>

<template>
  <div
    class="module-row group/row"
    :class="{
      'module-row--draggable': !readonly,
      'module-row--readonly': readonly,
      'module-row--inactive': inactiveByDlc
    }"
  >
    <div class="color-bar" :style="colorBarStyle">
    </div>

    <div class="module-info" :class="moduleInfoClass">
      <div class="module-title-row">
        <div class="module-name" :title="localizedModuleName">
          <span class="module-name-text">{{ localizedModuleName }}</span>
          <span
            v-if="moduleDiffAnnotation"
            class="module-diff-annotation"
            :class="moduleDiffClass"
          >{{ moduleDiffAnnotation }}</span>
        </div>
        <span v-if="shouldShowDlcTag" class="dlc-tag" :class="isDlcActive ? 'dlc-tag--active' : 'dlc-tag--inactive'"
          :title="dlcLabel">DLC</span>
      </div>
    </div>

    <div class="controls" v-if="!readonly">
      <div class="ignore-drag input-wrapper" :class="{
        'input-wrapper--flashing': isNumberFlashing,
        'input-wrapper--warning': isBelowThreshold,
        'input-wrapper--positive': isAboveThreshold
      }">
        <X4NumberInput :modelValue="item.count" @update:modelValue="emit('update:count', $event)" width-class="w-14"
          :min="props.isRecommended ? (props.threshold ?? 1) : 1" :disabled="countDisabled" />
      </div>
      <button @click="emit('remove')" class="remove-btn ignore-drag" :title="t('planning.remove')">×</button>
    </div>
    <div class="controls" v-else>
      <div v-if="!props.noClick" class="count-display ignore-drag" @click="emit('transfer', item)">
        <span class="count-text count-text--clickable" :class="{
          'count-text--flashing': isNumberFlashing,
          'count-text--warning': isBelowThreshold,
          'count-text--positive': isAboveThreshold
        }"
          :title="t('planning.transfer_to_planning')">{{ item.count }}</span>
      </div>
      <div v-else class="count-display">
        <span class="count-text count-text--static" :class="{
          'count-text--flashing': isNumberFlashing,
          'count-text--warning': isBelowThreshold,
          'count-text--positive': isAboveThreshold
        }">{{ item.count
          }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.module-row {
  @apply flex items-center bg-slate-800/80 border border-slate-700 p-1 rounded hover:border-sky-500/50 transition-all h-9;
}

.module-row--highlight {
  @apply border-sky-500/50;
  animation: highlight-animation 0.3s ease-in-out;
}

@keyframes highlight-animation {
  0% {
    border-color: rgb(14 165 233 / 0.5);
    box-shadow: 0 0 0 0 rgba(14, 165, 233, 0.3);
  }

  50% {
    border-color: rgb(14 165 233 / 0.7);
    box-shadow: 0 0 0 4px rgba(14, 165, 233, 0.2);
  }

  100% {
    border-color: rgb(14 165 233 / 0.5);
    box-shadow: 0 0 0 0 rgba(14, 165, 233, 0);
  }
}

.module-row--draggable {
  @apply cursor-move;
}

.module-row--readonly {
  @apply cursor-default;
}

.module-row--inactive {
  @apply opacity-50;
}

.color-bar {
  @apply w-1.5 h-6 rounded-sm mr-2 flex-shrink-0;
}

.color-bar--habitat {
  @apply bg-orange-500;
}

.color-bar--default {
  @apply bg-sky-500;
}

.module-info {
  @apply flex-1 min-w-0 mr-2;
}

.module-info--editable {
  @apply cursor-text;
}

.module-info--readonly {
  @apply cursor-default;
}

.module-name {
  @apply flex items-center min-w-0 font-medium text-slate-300 group-hover/row:text-white transition-colors text-xs sm:text-sm;
}

.module-name-text {
  @apply truncate min-w-0;
}

.module-diff-annotation {
  @apply ml-1 shrink-0 text-[10px] font-normal;
}

.module-diff-annotation--positive {
  @apply text-emerald-300/75;
}

.module-diff-annotation--negative {
  @apply text-red-300/75;
}

.module-title-row {
  @apply flex items-center gap-2 min-w-0;
}

.dlc-tag {
  @apply inline-flex flex-shrink-0 items-center rounded-md border px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide cursor-default;
}

.dlc-tag--active {
  @apply border-emerald-500/70 text-emerald-300;
}

.dlc-tag--inactive {
  @apply border-rose-500/70 text-rose-300;
}

.controls {
  @apply flex items-center gap-1;
}

.remove-btn {
  @apply text-slate-600 hover:text-red-400 px-1.5 transition-colors text-lg leading-none cursor-pointer;
}

.count-display {
  @apply flex items-center justify-center w-14;
}

.count-text {
  @apply text-sm font-medium;
}

.count-text--clickable {
  @apply cursor-pointer hover:text-sky-300 hover:bg-sky-400/20 transition-all duration-200 text-sky-400 px-2 py-0.5 rounded;
}

.count-text--static {
  @apply text-slate-500;
}

.count-text--warning {
  @apply text-red-400;
}

.count-text--positive {
  @apply text-green-400;
}

.count-text--flashing {
  animation: number-flash 0.3s ease-in-out;
}

.input-wrapper {
  @apply rounded transition-colors;
}

.input-wrapper--flashing {
  animation: number-flash 0.3s ease-in-out;
}

.input-wrapper--warning :deep(.x4-num-input) {
  color: #f87171 !important;

}

.input-wrapper--positive :deep(.x4-num-input) {
  color: #4ade80 !important;

}

@keyframes number-flash {
  0% {
    background-color: rgba(14, 165, 233, 0.1);
    color: rgb(14, 165, 233);
    transform: scale(1);
  }

  50% {
    background-color: rgba(14, 165, 233, 0.3);
    color: rgb(56, 189, 248);
    transform: scale(1.05);
  }

  100% {
    background-color: rgba(14, 165, 233, 0.1);
    color: rgb(14, 165, 233);
    transform: scale(1);
  }
}
</style>

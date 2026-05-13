<script setup lang="ts">
import type { BuildGoal } from '@/types/build-plan'
import type { LocalizedX4Ware, LocalizedX4Module, LocalizedX4ModuleGroup } from '@/types/x4'
import X4NumberInput from '@/components/common/X4NumberInput.vue'
import { useI18n } from 'vue-i18n'
import { computed } from 'vue'
import { useGameDataStore } from '@/store/useGameDataStore'

const { t } = useI18n()
const gameData = useGameDataStore()

const props = defineProps<{
  goal: BuildGoal & { type: 'production-rate' | 'build-module' }
  displayName: string
  wareInfo?: LocalizedX4Ware
  moduleInfo?: LocalizedX4Module
  moduleGroup?: LocalizedX4ModuleGroup
}>()

const emit = defineEmits<{
  (e: 'update:value', val: number): void
  (e: 'remove'): void
}>()

const colorBarStyle = computed(() => {
  const colorRgb = props.moduleGroup?.color_rgb
  if (colorRgb) {
    return { backgroundColor: colorRgb }
  }
  return { backgroundColor: '#0ea5e9' }
})

const shouldShowDlcTag = computed(() => {
  if (props.goal.type === 'production-rate' && props.wareInfo) {
    return props.wareInfo.dlc_tag !== 'base'
  }
  if (props.goal.type === 'build-module' && props.moduleInfo) {
    return props.moduleInfo.dlc_tag !== 'base'
  }
  return false
})

const dlcTag = computed(() => {
  if (props.goal.type === 'production-rate' && props.wareInfo) {
    return props.wareInfo.dlc_tag
  }
  if (props.goal.type === 'build-module' && props.moduleInfo) {
    return props.moduleInfo.dlc_tag
  }
  return 'base'
})

const dlcLabel = computed(() => gameData.getDlcDisplayName(dlcTag.value))
const isDlcActive = computed(() => gameData.isDlcActive(dlcTag.value))
</script>

<template>
  <div class="ware-row group/row" :data-testid="`goal-item-${goal.type === 'production-rate' ? goal.wareId : goal.moduleId}`">
    <div class="color-bar" :style="colorBarStyle"></div>

    <div class="ware-info">
      <div class="ware-title-row">
        <div class="ware-name" :title="displayName">
          {{ displayName }}
        </div>
        <span
          v-if="shouldShowDlcTag"
          class="dlc-tag"
          :class="isDlcActive ? 'dlc-tag--active' : 'dlc-tag--inactive'"
        >
          {{ dlcLabel }}
        </span>
      </div>
    </div>

    <div class="controls">
      <X4NumberInput
        :modelValue="goal.type === 'production-rate' ? goal.ratePerHour : goal.count"
        @update:modelValue="emit('update:value', $event)"
        width-class="w-14"
        :min="1"
        :step="1"
      />
      <button @click="emit('remove')" class="remove-btn" :title="t('planning.remove')">×</button>
    </div>
  </div>
</template>

<style scoped>
.ware-row {
  @apply flex items-center bg-slate-800/80 border border-slate-700 p-1 rounded hover:border-sky-500/50 transition-all h-9;
}

.color-bar {
  @apply w-1.5 h-6 rounded-sm mr-2 flex-shrink-0;
}

.ware-info {
  @apply flex-1 min-w-0 mr-2;
}

.ware-name {
  @apply truncate font-medium text-slate-300 group-hover/row:text-white transition-colors text-xs sm:text-sm;
}

.ware-title-row {
  @apply flex items-center gap-2 min-w-0;
}

.dlc-tag {
  @apply inline-flex max-w-[110px] flex-shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide;
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
</style>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = withDefaults(defineProps<{
  mode: 'result' | 'edit'
  view?: 'live' | 'map'
  prefJumpRange: number
  bridgeSearchJumpRange: number
  prefThreshold: number
  nodeEnabled: boolean
  canDisableNode: boolean
  unresolvedAllocationCount?: number
  unresolvedTradeStationCount?: number
  showConfirm?: boolean
  confirmDisabled?: boolean
}>(), {
  view: 'live',
  unresolvedAllocationCount: 0,
  unresolvedTradeStationCount: 0,
  showConfirm: true,
  confirmDisabled: false,
  needsRecalc: false,
  editDisabled: true
})

const emit = defineEmits<{
  (e: 'update:prefJumpRange', value: number): void
  (e: 'update:bridgeSearchJumpRange', value: number): void
  (e: 'update:prefThreshold', value: number): void
  (e: 'update:nodeEnabled', value: boolean): void
  (e: 'calculate'): void
  (e: 'quick-calculate'): void
  (e: 'reset'): void
  (e: 'confirm'): void
  (e: 'back'): void
  (e: 'map'): void
}>()

const { t } = useI18n()

const jumpOptions = [1, 2, 3, 4, 5]
const bridgeJumpOptions = [2, 3, 4, 5]
const thresholdOptions = [
  { label: '1M', value: 1_000_000 },
  { label: '3M', value: 3_000_000 },
  { label: '5M', value: 5_000_000 },
  { label: '10M', value: 10_000_000 },
  { label: '20M', value: 20_000_000 }
]

const nodeDisabled = computed(() => props.mode === 'edit' && !props.canDisableNode)
const thresholdDisabled = computed(() => !props.nodeEnabled)

const hasUnresolved = computed(() => (props.unresolvedAllocationCount ?? 0) + (props.unresolvedTradeStationCount ?? 0) > 0)
</script>

<template>
  <div class="auto-sector-bar" :class="{ 'auto-sector-bar--map': view === 'map' }">
    <template v-if="view === 'live'">
      <div class="bar-row bar-row--live">
        <div class="bar-left">
          <div class="param-field" :title="t('sector.bridge_search_jump')">
            <span class="bar-label">{{ t('sector.connected') }}</span>
            <select class="bar-select bar-select--narrow" :value="bridgeSearchJumpRange" @change="emit('update:bridgeSearchJumpRange', Number(($event.target as HTMLSelectElement).value))">
              <option v-for="j in bridgeJumpOptions" :key="j" :value="j" :disabled="j < prefJumpRange">{{ j }}{{ t('sector.jump_unit') }}</option>
            </select>
          </div>
          <div class="param-field" :title="t('sector.node_enabled_desc')">
            <label class="bar-label-inline">
              <input type="checkbox" class="bar-checkbox" :checked="nodeEnabled" :disabled="nodeDisabled" @change="emit('update:nodeEnabled', ($event.target as HTMLInputElement).checked)" />
              <span class="bar-label">{{ t('sector.node_enabled') }}</span>
            </label>
          </div>
          <div class="param-field" :title="t('sector.group_coverage_jump')">
            <span class="bar-label">{{ t('sector.group_coverage_jump_short') }}</span>
            <select class="bar-select bar-select--narrow" :value="prefJumpRange" :disabled="thresholdDisabled" @change="emit('update:prefJumpRange', Number(($event.target as HTMLSelectElement).value))">
              <option v-for="j in jumpOptions" :key="j" :value="j">{{ j }}{{ t('sector.jump_unit') }}</option>
            </select>
          </div>
          <div class="param-field" :title="t('sector.default_threshold')">
            <span class="bar-label">{{ t('sector.trade_station_short') }}</span>
            <select class="bar-select" :value="prefThreshold" :disabled="thresholdDisabled" @change="emit('update:prefThreshold', Number(($event.target as HTMLSelectElement).value))">
              <option v-for="opt in thresholdOptions" :key="opt.value" :value="opt.value">{{ opt.label }}{{ t('sector.volume_unit_m3') }}</option>
            </select>
          </div>
        </div>
        <div class="bar-right">
          <button class="bar-btn back-btn" @click="emit('back')">{{ t('sector.back') }}</button>
          <button class="bar-btn map-btn" @click="emit('map')">{{ t('sector.map') }}</button>
          <template v-if="mode === 'edit'">
            <button class="bar-btn reset-btn" @click="emit('reset')">{{ t('sector.reset') }}</button>
            <button v-if="showConfirm" class="bar-btn confirm-btn" :disabled="confirmDisabled" @click="emit('confirm')">{{ t('sector.confirm') }}</button>
            <button class="bar-btn calc-btn" @click="emit('calculate')">{{ t('sector.calculate') }}</button>
          </template>
          <template v-else>
            <span v-if="hasUnresolved" class="bar-unresolved">
              {{ t('sector.unresolved') }}: {{ unresolvedAllocationCount }}{{ unresolvedTradeStationCount ? '+' + unresolvedTradeStationCount : '' }}
            </span>
            <button class="bar-btn reset-btn" @click="emit('reset')">{{ t('sector.reset') }}</button>
            <button v-if="showConfirm" class="bar-btn confirm-btn" :disabled="confirmDisabled" @click="emit('confirm')">{{ t('sector.confirm') }}</button>
            <button class="bar-btn calc-btn" @click="emit('quick-calculate')">
              {{ t('sector.calculate') }}
            </button>
          </template>
        </div>
      </div>
    </template>
    <template v-else>
      <div class="bar-row bar-row--map">
        <div class="bar-left">
          <div class="param-field" :title="t('sector.bridge_search_jump')">
            <span class="bar-label">{{ t('sector.connected') }}</span>
            <select class="bar-select bar-select--narrow" :value="bridgeSearchJumpRange" @change="emit('update:bridgeSearchJumpRange', Number(($event.target as HTMLSelectElement).value))">
              <option v-for="j in bridgeJumpOptions" :key="j" :value="j" :disabled="j < prefJumpRange">{{ j }}</option>
            </select>
          </div>
          <div class="param-field" :title="t('sector.node_enabled_desc')">
            <label class="bar-label-inline">
              <input type="checkbox" class="bar-checkbox" :checked="nodeEnabled" :disabled="nodeDisabled" @change="emit('update:nodeEnabled', ($event.target as HTMLInputElement).checked)" />
              <span class="bar-label">{{ t('sector.node_enabled') }}</span>
            </label>
          </div>
          <div class="param-field" :title="t('sector.group_coverage_jump')">
            <span class="bar-label">{{ t('sector.group_coverage_jump_short') }}</span>
            <select class="bar-select bar-select--narrow" :value="prefJumpRange" :disabled="thresholdDisabled" @change="emit('update:prefJumpRange', Number(($event.target as HTMLSelectElement).value))">
              <option v-for="j in jumpOptions" :key="j" :value="j">{{ j }}</option>
            </select>
          </div>
          <div class="param-field" :title="t('sector.default_threshold')">
            <span class="bar-label">{{ t('sector.trade_station_short') }}</span>
            <select class="bar-select" :value="prefThreshold" :disabled="thresholdDisabled" @change="emit('update:prefThreshold', Number(($event.target as HTMLSelectElement).value))">
              <option v-for="opt in thresholdOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </div>
        </div>
      </div>
      <div class="bar-row bar-row--map !justify-end">
        <div class="bar-right">
          <template v-if="mode === 'edit'">
            <button class="bar-btn reset-btn" @click="emit('reset')">{{ t('sector.reset') }}</button>
            <button v-if="showConfirm" class="bar-btn confirm-btn" :disabled="confirmDisabled" @click="emit('confirm')">{{ t('sector.confirm') }}</button>
            <button class="bar-btn calc-btn" @click="emit('calculate')">{{ t('sector.calculate') }}</button>
          </template>
          <template v-else>
            <span v-if="hasUnresolved" class="bar-unresolved">{{ unresolvedAllocationCount }}{{ unresolvedTradeStationCount ? '+' + unresolvedTradeStationCount : '' }}</span>
            <button class="bar-btn reset-btn" @click="emit('reset')">{{ t('sector.reset') }}</button>
            <button class="bar-btn confirm-btn" :disabled="confirmDisabled" @click="emit('confirm')">{{ t('sector.confirm') }}</button>
            <button class="bar-btn calc-btn" @click="emit('quick-calculate')">
              {{ t('sector.calculate') }}
            </button>
          </template>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.auto-sector-bar {
  @apply flex flex-col gap-2 p-1.5 bg-slate-800/50 rounded border border-slate-700/50;
}

.auto-sector-bar--map {
  @apply gap-1 p-1;
}

.bar-row {
  @apply flex items-center justify-between;
}

.bar-left {
  @apply flex flex-wrap items-center gap-1.5;
}

.param-field {
  @apply inline-flex items-center gap-1 rounded border border-slate-700/60 bg-slate-900/30 px-1.5 py-1;
}

.bar-label {
  @apply text-xs text-slate-400;
}

.bar-label-inline {
  @apply inline-flex items-center gap-0.5 cursor-pointer;
}

.bar-checkbox {
  @apply h-3.5 w-3.5 accent-sky-500;
}

.bar-select {
  @apply h-6 text-xs bg-slate-900 border border-slate-600 rounded px-1.5 text-slate-200 focus:outline-none focus:border-sky-500 disabled:opacity-40 disabled:cursor-not-allowed;
}

.bar-select--narrow {
  @apply w-12;
}

.bar-btn {
  @apply px-2.5 py-1 text-xs font-medium rounded transition-colors;
}

.recalc-btn {
  @apply bg-sky-600/20 text-sky-400 border border-sky-500/30 hover:bg-sky-600/30;
}

.reset-btn {
  @apply bg-slate-600/20 text-slate-300 border border-slate-500/30 hover:bg-slate-600/30;
}

.confirm-btn {
  @apply bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30 disabled:opacity-40 disabled:cursor-not-allowed;
}

.calc-btn {
  @apply bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 relative;
}

.calc-btn--needs-recalc {
  @apply border-red-500/50;
}

.back-btn {
  @apply bg-slate-600/20 text-slate-300 border border-slate-500/30 hover:bg-slate-600/30;
}

.map-btn {
  @apply bg-slate-600/20 text-slate-300 border border-slate-500/30 hover:bg-slate-600/30;
}

.recalc-dot {
  @apply absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full;
}

.bar-unresolved {
  @apply text-xs text-amber-400;
}

.bar-right {
  @apply flex items-center gap-1.5;
}

/* Map compact */
.auto-sector-bar--map .param-field {
  @apply px-1 py-0.5 gap-0.5;
}
.auto-sector-bar--map .bar-label {
  @apply text-[10px];
}
.auto-sector-bar--map .bar-select {
  @apply h-5 text-[11px] px-1;
}
.auto-sector-bar--map .bar-select--narrow {
  @apply w-10;
}
.auto-sector-bar--map .bar-btn {
  @apply px-1.5 py-0.5 text-[11px];
}
</style>

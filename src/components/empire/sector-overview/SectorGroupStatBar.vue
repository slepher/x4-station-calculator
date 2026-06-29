<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const props = withDefaults(defineProps<{
  mode: 'result' | 'edit'
  view?: 'live' | 'map'
  bridgeRetainEnabled: boolean
  coverageRetainEnabled: boolean
  tradeStationRetainEnabled?: boolean
  bridgeRetainIndeterminate: boolean
  coverageRetainIndeterminate: boolean
  tradeStationRetainIndeterminate?: boolean
  showAddHub?: boolean
  editDisabled?: boolean
  addDisabled?: boolean
}>(), {
  view: 'live',
  tradeStationRetainEnabled: false,
  tradeStationRetainIndeterminate: false,
  showAddHub: false,
  editDisabled: true,
  addDisabled: false
})

const emit = defineEmits<{
  (e: 'update:bridgeRetainEnabled', value: boolean): void
  (e: 'update:coverageRetainEnabled', value: boolean): void
  (e: 'update:tradeStationRetainEnabled', value: boolean): void
  (e: 'edit'): void
  (e: 'exit'): void
  (e: 'add-hub'): void
}>()

const { t } = useI18n()

function onBridgeRetainChange(e: Event) {
  emit('update:bridgeRetainEnabled', (e.target as HTMLInputElement).checked)
}
function onCoverageRetainChange(e: Event) {
  emit('update:coverageRetainEnabled', (e.target as HTMLInputElement).checked)
}
function onTradeStationRetainChange(e: Event) {
  emit('update:tradeStationRetainEnabled', (e.target as HTMLInputElement).checked)
}
</script>

<template>
  <div class="stat-bar" :class="{ 'stat-bar--map': view === 'map' }">
    <div class="stat-bar-row">
      <div class="stat-bar-left">
        <div class="param-field" :title="t('sector.bridge_retain')">
          <label class="bar-label-inline">
            <input type="checkbox" class="bar-checkbox" :checked="bridgeRetainEnabled" :indeterminate.prop="bridgeRetainIndeterminate" @change="onBridgeRetainChange" />
            <span class="bar-label">{{ t('sector.connected') }}</span>
          </label>
        </div>
        <div class="param-field" :title="t('sector.coverage_retain')">
          <label class="bar-label-inline">
            <input type="checkbox" class="bar-checkbox" :checked="coverageRetainEnabled" :indeterminate.prop="coverageRetainIndeterminate" @change="onCoverageRetainChange" />
            <span class="bar-label">{{ t('sector.group_coverage_jump_short') }}</span>
          </label>
        </div>
        <div class="param-field" :title="t('sector.trade_station_retain')">
          <label class="bar-label-inline">
            <input type="checkbox" class="bar-checkbox" :checked="tradeStationRetainEnabled" :indeterminate.prop="tradeStationRetainIndeterminate" @change="onTradeStationRetainChange" />
            <span class="bar-label">{{ t('sector.trade_station_short') }}</span>
          </label>
        </div>
      </div>
      <div class="stat-bar-right">
        <template v-if="mode === 'edit'">
          <button class="bar-btn cancel-btn" @click="emit('exit')">{{ t('sector.exit') }}</button>
          <button class="bar-btn add-btn" :disabled="addDisabled" @click="emit('add-hub')">{{ showAddHub ? t('sector.cancel_add_hub') : t('sector.add_hub') }}</button>
        </template>
        <template v-else>
          <button class="bar-btn recalc-btn" :disabled="editDisabled" @click="emit('edit')">{{ t('sector.edit') }}</button>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stat-bar {
  @apply flex flex-col gap-1 p-1.5 bg-slate-800/50 rounded border border-slate-700/50 mb-2;
}

.stat-bar--map {
  @apply gap-0.5 p-1;
}

.stat-bar-row {
  @apply flex items-center justify-between;
}

.stat-bar-left {
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

.bar-btn {
  @apply px-2.5 py-1 text-xs font-medium rounded transition-colors;
}

.cancel-btn {
  @apply bg-slate-700/30 text-slate-300 border border-slate-500/30 hover:bg-slate-700/50;
}

.add-btn {
  @apply bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30;
}

.add-btn:disabled {
  @apply opacity-40 cursor-not-allowed hover:bg-emerald-600/20;
}

.recalc-btn {
  @apply bg-sky-600/20 text-sky-400 border border-sky-500/30 hover:bg-sky-600/30 disabled:opacity-40 disabled:cursor-not-allowed;
}

.stat-bar-right {
  @apply flex items-center gap-1.5;
}

.stat-bar--map .param-field {
  @apply px-1 py-0.5 gap-0.5;
}

.stat-bar--map .bar-label {
  @apply text-[10px];
}

.stat-bar--map .bar-btn {
  @apply px-1.5 py-0.5 text-[11px];
}
</style>

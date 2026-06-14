<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  prefJumpRange: number
  bridgeSearchJumpRange: number
  prefThreshold: number
  mode: 'result' | 'edit'
  nodeEnabled: boolean
  canDisableNode: boolean
  bridgeRetainEnabled: boolean
  coverageRetainEnabled: boolean
  bridgeRetainIndeterminate: boolean
  coverageRetainIndeterminate: boolean
}>()

const emit = defineEmits<{
  (e: 'update:prefJumpRange', value: number): void
  (e: 'update:bridgeSearchJumpRange', value: number): void
  (e: 'update:prefThreshold', value: number): void
  (e: 'update:nodeEnabled', value: boolean): void
  (e: 'update:bridgeRetainEnabled', value: boolean): void
  (e: 'update:coverageRetainEnabled', value: boolean): void
  (e: 'calculate'): void
  (e: 'edit'): void
  (e: 'cancel'): void
  (e: 'add-hub'): void
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

function getThresholdLabel(value: number): string {
  return thresholdOptions.find((opt) => opt.value === value)?.label || String(value)
}

const nodeDisabled = computed(() => props.mode === 'edit' && !props.canDisableNode)
const thresholdDisabled = computed(() => !props.nodeEnabled)

function onBridgeRetainChange(e: Event) {
  emit('update:bridgeRetainEnabled', (e.target as HTMLInputElement).checked)
}
function onCoverageRetainChange(e: Event) {
  emit('update:coverageRetainEnabled', (e.target as HTMLInputElement).checked)
}
</script>

<template>
  <div class="confirm-bar">
    <div class="bar-row">
      <div class="bar-left">
        <!-- 桥接 + 保留 -->
        <div class="param-field" :title="t('sector.bridge_search_jump')">
          <span class="bar-label">{{ t('sector.bridge_search_jump_short') }}</span>
          <span v-if="mode === 'result'" class="bar-value">{{ bridgeSearchJumpRange }}{{ t('sector.jump_unit') }}</span>
          <select
            v-else
            class="bar-select bar-select--narrow"
            :value="bridgeSearchJumpRange"
            @change="emit('update:bridgeSearchJumpRange', Number(($event.target as HTMLSelectElement).value))"
          >
            <option v-for="j in bridgeJumpOptions" :key="j" :value="j" :disabled="j < prefJumpRange">{{ j }}{{ t('sector.jump_unit') }}</option>
          </select>
          <label v-if="mode === 'edit'" class="bar-label-inline" :title="t('sector.bridge_retain')">
            <input
              type="checkbox"
              class="bar-checkbox"
              :checked="bridgeRetainEnabled"
              :indeterminate.prop="bridgeRetainIndeterminate"
              @change="onBridgeRetainChange"
            />
            <span class="bar-label">{{ t('sector.retain') }}</span>
          </label>
        </div>

        <!-- 节点 -->
        <div v-if="mode === 'edit'" class="param-field" :title="t('sector.node_enabled_desc')">
          <label class="bar-label-inline">
            <input
              type="checkbox"
              class="bar-checkbox"
              :checked="nodeEnabled"
              :disabled="nodeDisabled"
              @change="emit('update:nodeEnabled', ($event.target as HTMLInputElement).checked)"
            />
            <span class="bar-label">{{ t('sector.node_enabled') }}</span>
          </label>
        </div>

        <!-- 阈值 -->
        <div class="param-field" :title="t('sector.default_threshold')">
          <span class="bar-label">{{ t('sector.default_threshold_short') }}</span>
          <span v-if="mode === 'result'" class="bar-value">{{ getThresholdLabel(prefThreshold) }}{{ t('sector.volume_unit_m3') }}</span>
          <select
            v-else
            class="bar-select"
            :value="prefThreshold"
            :disabled="thresholdDisabled"
            @change="emit('update:prefThreshold', Number(($event.target as HTMLSelectElement).value))"
          >
            <option v-for="opt in thresholdOptions" :key="opt.value" :value="opt.value">{{ opt.label }}{{ t('sector.volume_unit_m3') }}</option>
          </select>
        </div>

        <!-- 覆盖 + 保留 -->
        <div class="param-field" :title="t('sector.group_coverage_jump')">
          <span class="bar-label">{{ t('sector.group_coverage_jump_short') }}</span>
          <span v-if="mode === 'result'" class="bar-value">{{ prefJumpRange }}{{ t('sector.jump_unit') }}</span>
          <select
            v-else
            class="bar-select bar-select--narrow"
            :value="prefJumpRange"
            :disabled="thresholdDisabled"
            @change="emit('update:prefJumpRange', Number(($event.target as HTMLSelectElement).value))"
          >
            <option v-for="j in jumpOptions" :key="j" :value="j">{{ j }}{{ t('sector.jump_unit') }}</option>
          </select>
          <label v-if="mode === 'edit'" class="bar-label-inline" :title="t('sector.coverage_retain')">
            <input
              type="checkbox"
              class="bar-checkbox"
              :checked="coverageRetainEnabled"
              :indeterminate.prop="coverageRetainIndeterminate"
              @change="onCoverageRetainChange"
            />
            <span class="bar-label">{{ t('sector.retain') }}</span>
          </label>
        </div>
      </div>
      <button v-if="mode !== 'edit'" class="bar-btn recalc-btn" @click="emit('edit')">
        {{ t('sector.edit') }}
      </button>
    </div>
    <div v-if="mode === 'edit'" class="bar-row bar-row--actions">
      <button class="bar-btn add-btn" @click="emit('add-hub')">
        {{ t('sector.add_hub') }}
      </button>
      <div class="bar-actions">
        <button class="bar-btn cancel-btn" @click="emit('cancel')">
          {{ t('sector.cancel') }}
        </button>
        <button class="bar-btn recalc-btn" @click="emit('calculate')">
          {{ t('sector.calculate') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.confirm-bar {
  @apply flex flex-col gap-2 p-1.5 bg-slate-800/50 rounded border border-slate-700/50 mb-3;
}

.bar-row {
  @apply flex items-center justify-between;
}

.bar-row--actions {
  @apply gap-1.5;
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

.bar-value {
  @apply min-w-5 text-center text-xs font-medium text-slate-200;
}

.bar-btn {
  @apply px-2.5 py-1 text-xs font-medium rounded transition-colors;
}

.bar-actions {
  @apply flex items-center gap-1.5 ml-auto;
}

.cancel-btn {
  @apply bg-slate-700/30 text-slate-300 border border-slate-500/30 hover:bg-slate-700/50;
}

.recalc-btn {
  @apply bg-sky-600/20 text-sky-400 border border-sky-500/30 hover:bg-sky-600/30;
}

.add-btn {
  @apply bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30;
}
</style>

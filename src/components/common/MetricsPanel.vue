<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ViewTabUI from '@/components/common/ViewTabUI.vue'
import MetricItem from '@/components/common/MetricItem.vue'
import type {
  MetricSchema,
  MetricSchemaItem,
  MetricsOrder,
  MetricsPanelViewTab,
  MetricValueMap
} from '@/components/common/metricsPanelTypes'

const props = withDefaults(defineProps<{
  title?: string
  panelId?: string
  objCurrent: MetricValueMap | null
  objTarget: MetricValueMap | null
  schema: MetricSchema
  order?: MetricsOrder
  viewTab?: MetricsPanelViewTab | null
  roundedKeys?: string[]
}>(), {
  title: 'Metrics Panel',
  panelId: 'default',
  order: 'row',
  viewTab: null,
  roundedKeys: () => []
})

const currentMode = ref(props.viewTab?.views[0]?.mode || '')

watch(
  () => props.viewTab,
  (next) => {
    currentMode.value = next?.views[0]?.mode || ''
  },
  { deep: true }
)

const visibleKeys = computed<string[] | 'all'>(() => {
  if (!props.viewTab) return 'all'
  const view = props.viewTab.views.find((item) => item.mode === currentMode.value)
  return view?.keys || 'all'
})

const maxColumns = computed(() => {
  if (!props.schema.length) return 1
  return Math.max(1, ...props.schema.map((row) => row.length))
})

const flattened = computed<MetricSchemaItem[]>(() => {
  const rows = props.schema
  if (!rows.length) return []

  const expanded: MetricSchemaItem[] = []
  if (props.order === 'column') {
    const colCount = maxColumns.value
    for (let col = 0; col < colCount; col += 1) {
      for (let row = 0; row < rows.length; row += 1) {
        const item = rows[row]?.[col]
        if (item) expanded.push(item)
      }
    }
  } else {
    for (const row of rows) {
      for (const item of row) expanded.push(item)
    }
  }

  if (visibleKeys.value === 'all') return expanded
  const visible = new Set(visibleKeys.value)
  return expanded.filter((item) => visible.has(item.key))
})

const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${maxColumns.value}, minmax(0, 1fr))`
}))

const labelText = (labelKey: string) => labelKey
</script>

<template>
  <div class="metrics-panel" :data-testid="`metrics-panel-${panelId}`">
    <div class="metrics-panel-header" :data-testid="`metrics-panel-header-${panelId}`">
      <span class="metrics-panel-title">{{ title }}</span>
      <ViewTabUI
        v-if="viewTab && viewTab.views.length > 0"
        v-model="currentMode"
        :views="viewTab.views.map((item) => ({ key: item.mode, label: item.label }))"
        :color-style="viewTab.style || 'emerald'"
        :ui-key="`metrics-panel-${panelId}`"
      />
    </div>

    <div class="metrics-panel-content" :data-testid="`metrics-panel-content-${panelId}`">
      <div class="metrics-grid" :style="gridStyle" :data-testid="`metrics-panel-grid-${panelId}`">
        <MetricItem
          v-for="item in flattened"
          :key="item.key"
          :metric-key="item.key"
          :label="labelText(item.labelKey)"
          :unit="item.unit || ''"
          :current-value="objCurrent?.[item.key]"
          :target-value="objTarget?.[item.key]"
          :max="item.max"
          :rounded-keys="roundedKeys"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.metrics-panel {
  @apply bg-slate-900/40 rounded-lg border border-slate-800 shadow-xl overflow-hidden;
}

.metrics-panel-header {
  @apply flex items-center justify-between gap-3 px-4 py-3 text-slate-200 text-sm font-semibold border-b border-slate-800/70 bg-slate-900/50;
}

.metrics-panel-title {
  @apply truncate;
}

.metrics-panel-content {
  @apply p-2 bg-slate-900/30 rounded-lg m-2;
}

.metrics-grid {
  @apply grid gap-x-4 gap-y-2;
}
</style>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLogicFlowStore } from '@/store/useLogicFlowStore'
import { useBuildFlowGraph, BuildFlowTeleport } from './composables/useBuildFlowGraph'

const { t } = useI18n()
const logicFlow = useLogicFlowStore()

const containerRef = ref<HTMLElement | null>(null)
const graphHandle = ref<ReturnType<typeof useBuildFlowGraph> | null>(null)

const shouldHide = computed(() => {
  return logicFlow.isDragging && !logicFlow.isBuildFlowDragging
})

const hasContent = computed(() => {
  const result = logicFlow.buildFlowLineCards.length > 0
  console.log('[BuildFlowZone] hasContent:', result, 'lineCards:', logicFlow.buildFlowLineCards.length)
  return result
})

function syncGraphData() {
  console.log('[BuildFlowZone] syncGraphData called, graphHandle:', graphHandle.value ? 'present' : 'null')
  if (!graphHandle.value) return
  graphHandle.value.syncGraph(
    logicFlow.buildFlowGroups,
    logicFlow.buildFlowAssignments
  )
}

watch(
  () => [logicFlow.buildFlowGroups, logicFlow.buildFlowAssignments],
  () => {
    console.log('[BuildFlowZone] watch triggered, buildFlowGroups:', logicFlow.buildFlowGroups.length, 'assignments:', logicFlow.buildFlowAssignments.length)
    nextTick(syncGraphData)
  },
  { deep: true }
)

onMounted(() => {
  console.log('[BuildFlowZone] mounted, containerRef:', containerRef.value ? 'present' : 'null', 'hasContent:', hasContent.value)
  if (containerRef.value) {
    graphHandle.value = useBuildFlowGraph(containerRef.value)
    console.log('[BuildFlowZone] graph created')
    nextTick(syncGraphData)
  }
})

onUnmounted(() => {
  graphHandle.value?.dispose()
  graphHandle.value = null
})
</script>

<template>
  <div
    v-show="hasContent && !shouldHide"
    class="build-flow-zone border border-dashed border-gray-600 rounded-lg p-3 space-y-3"
  >
    <div class="text-xs text-gray-400 font-medium uppercase tracking-wide">
      {{ t('buildFlow.build_flow_zone_title') }}
    </div>

    <div ref="containerRef" class="build-flow-graph-container"></div>

    <BuildFlowTeleport />
  </div>
</template>

<style scoped>
.build-flow-graph-container {
  width: 100%;
  min-height: 200px;
  position: relative;
}

.build-flow-graph-container :deep(.x6-graph-svg) {
  background: transparent !important;
}

.build-flow-graph-container :deep(.x6-node) {
  overflow: visible !important;
}
</style>

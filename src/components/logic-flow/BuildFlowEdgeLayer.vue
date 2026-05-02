<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import type { BuildFlowEdge } from '@/components/logic-flow/presenters/useBuildFlowPresenter'

const props = defineProps<{
  edges: BuildFlowEdge[]
}>()

const svgRef = ref<SVGSVGElement | null>(null)

interface RoutedEdge {
  id: string
  d: string
}

const lines = ref<RoutedEdge[]>([])

function recalculate() {
  if (!svgRef.value) return
  const container = svgRef.value.parentElement
  if (!container) return

  const exitOffset = 16
  const approachOffset = 16

  const containerRect = container.getBoundingClientRect()
  if (containerRect.width === 0) {
    scheduleRecalculate()
    return
  }

  const cardEls = container.querySelectorAll('.build-flow-line-card')
  const cardBounds: Array<{ top: number; bottom: number; y: number; height: number }> = []
  cardEls.forEach(el => {
    const r = el.getBoundingClientRect()
    cardBounds.push({ top: r.top - containerRect.top, bottom: r.bottom - containerRect.top, y: r.top - containerRect.top + r.height / 2, height: r.height })
  })
  cardBounds.sort((a, b) => a.top - b.top)

  type Gap = { y: number; idx: number }
  const gaps: Gap[] = []
  gaps.push({ y: 0, idx: -1 })
  for (let i = 0; i < cardBounds.length - 1; i++) {
    const a = cardBounds[i]!, b = cardBounds[i + 1]!
    const gapY = (a.bottom + b.top) / 2
    gaps.push({ y: gapY, idx: i })
  }
  const last = cardBounds[cardBounds.length - 1]
  gaps.push({ y: (last?.bottom ?? 0) + 8, idx: cardBounds.length - 1 })
  console.log('[EdgeLayer] cardBounds:', cardBounds.map(c => ({top: c.top.toFixed(0), bottom: c.bottom.toFixed(0)})))
  console.log('[EdgeLayer] gaps:', gaps.map(g => ({idx: g.idx, y: g.y.toFixed(0)})))

  const positioned: Array<{
    edge: BuildFlowEdge
    x1: number; y1: number
    x2: number; y2: number
  }> = []

  for (const edge of props.edges) {
    const sourceEl = container.querySelector(`[data-tag-id="${edge.sourceTagId}"]`)
    const targetEl = container.querySelector(`[data-tag-id="${edge.targetTagId}"]`)
    if (!sourceEl || !targetEl) continue

    const sourceRect = sourceEl.getBoundingClientRect()
    const targetRect = targetEl.getBoundingClientRect()
    if (sourceRect.width === 0 || targetRect.width === 0) continue

    const isSelf = (edge as any).isSelfConnection
    const x1 = isSelf ? sourceRect.left - containerRect.left : sourceRect.right - containerRect.left
    const y1 = sourceRect.top + sourceRect.height / 2 - containerRect.top
    const x2 = isSelf ? targetRect.right - containerRect.left : targetRect.left - containerRect.left
    const y2 = targetRect.top + targetRect.height / 2 - containerRect.top

    positioned.push({ edge, x1, y1, x2, y2 })
  }

  if (positioned.length === 0) return

  const gapLaneCounts = new Array(gaps.length).fill(0)
  const results: RoutedEdge[] = []

  positioned.forEach((pos) => {
    const { edge, x1, y1, x2, y2 } = pos
    const isSelf = (edge as any).isSelfConnection
    if (isSelf) {
      results.push({ id: edge.id, d: `M ${x1},${y1} L ${x2},${y2}` })
      return
    }

    let bestGap = gaps[0]
    let bestDist = Infinity
    for (const g of gaps) {
      const d = Math.abs(g.y - y1) + Math.abs(g.y - y2)
      if (d < bestDist) { bestDist = d; bestGap = g }
    }

    const lane = gapLaneCounts[bestGap!.idx + 1]++
    const maxLanes = Math.max(...gapLaneCounts, 1)
    const spacing = maxLanes > 3 ? 6 : 10
    const routeY = bestGap!.y + lane * spacing
    const exitX = x1 + exitOffset
    const approachX = x2 - approachOffset
    const d = `M ${x1},${y1} L ${exitX},${y1} L ${exitX},${routeY} L ${approachX},${routeY} L ${approachX},${y2} L ${x2},${y2}`
    results.push({ id: edge.id, d })
    console.log(`[edge] ${edge.id.slice(0,30)} gap=${bestGap!.idx} lane=${lane} routeY=${routeY.toFixed(1)} | ${x1.toFixed(0)},${y1.toFixed(0)} → ${x2.toFixed(0)},${y2.toFixed(0)}`) 
  })

  lines.value = results
}

let resizeObserver: ResizeObserver | null = null
let mutationObserver: MutationObserver | null = null
let pendingRaf = 0
let retryCount = 0
const MAX_RETRIES = 5

function scheduleRecalculate() {
  cancelAnimationFrame(pendingRaf)
  pendingRaf = requestAnimationFrame(() => {
    recalculate()
    if (retryCount < MAX_RETRIES) {
      retryCount++
      pendingRaf = requestAnimationFrame(recalculate)
    }
  })
}

onMounted(async () => {
  const container = svgRef.value?.parentElement
  if (!container) return

  resizeObserver = new ResizeObserver(scheduleRecalculate)
  resizeObserver.observe(container)

  mutationObserver = new MutationObserver(scheduleRecalculate)
  mutationObserver.observe(container, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-tag-id', 'class', 'style']
  })

  retryCount = 0
  await nextTick()
  scheduleRecalculate()
})

onUnmounted(() => {
  cancelAnimationFrame(pendingRaf)
  resizeObserver?.disconnect()
  mutationObserver?.disconnect()
})

watch(() => props.edges, () => {
  retryCount = 0
  nextTick(scheduleRecalculate)
}, { deep: true })
watch(() => props.edges.length, () => {
  retryCount = 0
  nextTick(scheduleRecalculate)
})
</script>

<template>
  <svg
    ref="svgRef"
    class="build-flow-edge-layer pointer-events-none absolute inset-0 w-full h-full overflow-visible"
    style="z-index: 10;"
  >
    <defs>
      <marker
        id="build-flow-arrowhead"
        markerWidth="10"
        markerHeight="8"
        refX="10"
        refY="4"
        orient="auto"
        markerUnits="userSpaceOnUse"
      >
        <polygon points="0 0, 10 4, 0 8" fill="rgba(251, 146, 60, 0.8)" />
      </marker>
    </defs>
    <path
      v-for="line in lines"
      :key="line.id"
      :d="line.d"
      stroke="rgba(251, 146, 60, 0.7)"
      stroke-width="2"
      stroke-linecap="round"
      fill="none"
      marker-end="url(#build-flow-arrowhead)"
    />
  </svg>
</template>

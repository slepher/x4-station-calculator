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
  color?: string
}

const lines = ref<RoutedEdge[]>([])

function recalculate() {
  if (!svgRef.value) return
  const container = svgRef.value.parentElement
  if (!container) return

  const GAP = 12
  const BASE_OFFSET = 24
  const COLORS = ['#f97316','#eab308','#22d3ee','#a78bfa','#fb923c','#facc15','#67e8f9','#c4b5fd']

  const containerRect = container.getBoundingClientRect()
  if (containerRect.width === 0) { scheduleRecalculate(); return }

  const cardEls = container.querySelectorAll('.build-flow-line-card')
  const cardBounds: Array<{ top: number; bottom: number }> = []
  cardEls.forEach(el => { const r = el.getBoundingClientRect(); cardBounds.push({ top: r.top - containerRect.top, bottom: r.bottom - containerRect.top }) })
  cardBounds.sort((a, b) => a.top - b.top)

  const positioned: Array<{
    edge: BuildFlowEdge
    x1: number; y1: number
    x2: number; y2: number
    cardY1: number; cardY2: number
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

    let cardY1 = y1, cardY2 = y2
    for (const cb of cardBounds) {
      if (y1 >= cb.top && y1 <= cb.bottom) cardY1 = cb.bottom
      if (y2 >= cb.top && y2 <= cb.bottom) cardY2 = cb.bottom
    }

    positioned.push({ edge, x1, y1, x2, y2, cardY1, cardY2 })
  }

  if (positioned.length === 0) { lines.value = []; return }

  const results: RoutedEdge[] = []
  let modeAIdx = 0
  positioned.forEach((pos, i) => {
    const { edge, x1, y1, x2, y2, cardY1, cardY2 } = pos
    const isSelf = (edge as any).isSelfConnection
    if (isSelf) {
      results.push({ id: edge.id, d: `M ${x1},${y1} L ${x2},${y2}`, color: COLORS[i % COLORS.length] })
      return
    }

    let d: string

    if (x2 > x1) {
      if (Math.abs(y1 - y2) < 4) {
        d = `M ${x1},${y1} L ${x2},${y2}`
      } else {
        const midX = Math.min(x1 + (modeAIdx + 1) * 4, x2 - 4)
        console.log(`[modeA] i=${modeAIdx} start=(${x1.toFixed(0)},${y1.toFixed(0)}) midX=${midX.toFixed(0)} end=(${x2.toFixed(0)},${y2.toFixed(0)})`)
        d = `M ${x1},${y1} L ${midX},${y1} L ${midX},${y2} L ${x2},${y2}`
      }
      modeAIdx++
    } else {
      const offset = BASE_OFFSET + i * GAP
      const p1X = x1 + offset
      const p2Y = y1 < y2 ? cardY2 + 4 + i * 4 : y1 - cardY1 - 4 - i * 4
      const p3X = x2 - offset
      console.log(`[modeB] i=${i} start=(${x1.toFixed(0)},${y1.toFixed(0)}) p1X=${p1X.toFixed(0)} end=(${x2.toFixed(0)},${y2.toFixed(0)})`)
      d = `M ${x1},${y1} L ${p1X},${y1} L ${p1X},${p2Y} L ${p3X},${p2Y} L ${p3X},${y2} L ${x2},${y2}`
    }

    results.push({ id: edge.id, d, color: COLORS[i % COLORS.length] })
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
      :stroke="line.color || 'rgba(251, 146, 60, 0.7)'"
      stroke-width="3"
      stroke-linecap="round"
      fill="none"
      marker-end="url(#build-flow-arrowhead)"
    />
  </svg>
</template>

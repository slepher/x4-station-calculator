<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import type { BuildFlowEdge } from '@/components/logic-flow/presenters/useBuildFlowPresenter'

const props = defineProps<{
  edges: BuildFlowEdge[]
  wareIds: string[]
}>()

const svgRef = ref<SVGSVGElement | null>(null)

interface RoutedEdge {
  id: string
  d: string
  color?: string
  colorIdx: number
}

const lines = ref<RoutedEdge[]>([])

const DEBUG_LOG = true

const COLORS = ['#f97316','#eab308','#22d3ee','#a78bfa','#fb923c','#facc15','#67e8f9','#c4b5fd']

function getEdgeColor(wareId: string) {
  const i = props.wareIds.indexOf(wareId)
  return { color: COLORS[i >= 0 ? i % COLORS.length : 0], idx: i >= 0 ? i % COLORS.length : 0 }
}

function recalculate() {
  if (!svgRef.value) return
  const container = svgRef.value.parentElement
  if (!container) return

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

  if (positioned.length === 0) { lines.value = []; return }

  const results: RoutedEdge[] = []
  positioned.sort((a, b) => a.y1 - b.y1)

  const lineGaps: Array<{ start: number; end: number }> = []
  for (let i = 0; i < cardBounds.length - 1; i++) {
    const g = { start: cardBounds[i]!.bottom, end: cardBounds[i + 1]!.top }
    if (g.end > g.start) lineGaps.push(g)
  }

  const modeBEdges = positioned.filter(p => !(p.edge as any).isSelfConnection && p.x2 <= p.x1)
  const sourceYRange = new Map<string, { y1: number; yMin: number; yMax: number }>()
  for (const p of modeBEdges) {
    const sk = `${p.edge.sourceGroupId}:${p.edge.wareId}`
    const existing = sourceYRange.get(sk)
    if (existing) {
      existing.yMin = Math.min(existing.yMin, p.y2)
      existing.yMax = Math.max(existing.yMax, p.y2)
    } else {
      sourceYRange.set(sk, { y1: p.y1, yMin: p.y2, yMax: p.y2 })
    }
  }
  for (const [, range] of sourceYRange) {
    if (range.yMin === range.yMax) {
      range.yMin = Math.min(range.y1, range.yMin)
      range.yMax = Math.max(range.y1, range.yMax)
    }
  }

  const sourceGapAssignment = new Map<string, { gapIdx: number; start: number; end: number }>()
  for (const [sk, range] of sourceYRange) {
    const candidates = lineGaps
      .map((g, idx) => ({ idx, start: g.start, end: g.end, center: (g.start + g.end) / 2 }))
      .filter(g => g.start >= range.yMin && g.end <= range.yMax)
    if (candidates.length === 0) continue
    candidates.sort((a, b) => Math.abs(a.center - range.y1) - Math.abs(b.center - range.y1))
    const chosen = candidates[0]!
    sourceGapAssignment.set(sk, { gapIdx: chosen.idx, start: chosen.start, end: chosen.end })
    if (DEBUG_LOG) {
      console.log(`[gapAssign] src=${sk} yRange=[${range.yMin.toFixed(0)},${range.yMax.toFixed(0)}] y1=${range.y1.toFixed(0)} chosenGap=[${chosen.start.toFixed(0)},${chosen.end.toFixed(0)}] idx=${chosen.idx}`)
    }
  }

  const gapSourcesSorted = new Map<number, string[]>()
  for (const [sk, assign] of sourceGapAssignment) {
    if (!gapSourcesSorted.has(assign.gapIdx)) gapSourcesSorted.set(assign.gapIdx, [])
    gapSourcesSorted.get(assign.gapIdx)!.push(sk)
  }
  for (const [, srcs] of gapSourcesSorted) {
    srcs.sort((a, b) => (sourceYRange.get(a)?.y1 ?? 0) - (sourceYRange.get(b)?.y1 ?? 0))
  }
  const gapSlotPosition = new Map<string, { p2Y: number; p3X: number }>()
  for (const [gIdx, srcs] of gapSourcesSorted) {
    const gap = lineGaps[gIdx]
    if (!gap) continue
    const gapSize = gap.end - gap.start
    for (let i = 0; i < srcs.length; i++) {
      const sk = srcs[i]!
      const p2Y = gap.start + ((i + 1) * gapSize) / Math.max(srcs.length + 1, 1)
      const existing = gapSlotPosition.get(sk)
      if (existing) {
        existing.p2Y = p2Y
      } else {
        gapSlotPosition.set(sk, { p2Y, p3X: 0 })
      }
    }
  }

  const allModeBSources = [...sourceYRange.keys()]
  allModeBSources.sort((a, b) => (sourceYRange.get(a)?.y1 ?? 0) - (sourceYRange.get(b)?.y1 ?? 0))
  const lineCardEls = container.querySelectorAll('.build-flow-line-card')
  let buildMatGapEnd = containerRect.width - 16
  lineCardEls.forEach(el => {
    const r = el.getBoundingClientRect()
    const left = r.left - containerRect.left
    if (left < buildMatGapEnd) buildMatGapEnd = left
  })
  for (let i = 0; i < allModeBSources.length; i++) {
    const sk = allModeBSources[i]!
    const p3X = 4 + ((i + 1) * (buildMatGapEnd - 8)) / Math.max(allModeBSources.length + 1, 1)
    const existing = gapSlotPosition.get(sk)
    if (existing) {
      existing.p3X = p3X
    } else {
      gapSlotPosition.set(sk, { p2Y: 0, p3X })
    }
  }

  const srcMidX = new Map<string, number>()
  const allSources = new Map<string, { y1: number; hasModeA: boolean; hasModeB: boolean }>()
  for (const pos of positioned) {
    if ((pos.edge as any).isSelfConnection) continue
    const sk = `${pos.edge.sourceGroupId}:${pos.edge.wareId}`
    const existing = allSources.get(sk)
    const isModeA = pos.x2 > pos.x1
    if (existing) {
      if (isModeA) existing.hasModeA = true
      else existing.hasModeB = true
    } else {
      allSources.set(sk, { y1: pos.y1, hasModeA: isModeA, hasModeB: !isModeA })
    }
  }
  const sortedSources = [...allSources.entries()].sort((a, b) => {
    const categoryA = a[1].hasModeB && !a[1].hasModeA ? 0 : a[1].hasModeA && a[1].hasModeB ? 1 : 2
    const categoryB = b[1].hasModeB && !b[1].hasModeA ? 0 : b[1].hasModeA && b[1].hasModeB ? 1 : 2
    if (categoryA !== categoryB) return categoryA - categoryB
    return a[1].y1 - b[1].y1
  })
  const totalSources = sortedSources.length
  const outTagEl = container.querySelector('[class*="build-flow-output-card"] [data-tag-id]')
  const gapEnd = outTagEl ? outTagEl.getBoundingClientRect().left - containerRect.left : containerRect.width - 16
  for (let i = 0; i < sortedSources.length; i++) {
    const [sk] = sortedSources[i]!
    const firstPos = positioned.find(p => `${p.edge.sourceGroupId}:${p.edge.wareId}` === sk && !(p.edge as any).isSelfConnection)
    if (!firstPos) continue
    const gap = Math.max(gapEnd - firstPos.x1 - 8, 4)
    srcMidX.set(sk, firstPos.x1 + 4 + ((i + 1) * gap) / Math.max(totalSources + 1, 1))
  }

  positioned.forEach((pos) => {
    const { edge, x1, y1, x2, y2 } = pos
    const isSelf = (edge as any).isSelfConnection
    if (isSelf) {
      const ec = getEdgeColor(edge.wareId); results.push({ id: edge.id, d: `M ${x1},${y1} L ${x2},${y2}`, color: ec.color, colorIdx: ec.idx })
      return
    }

    const sk = `${edge.sourceGroupId}:${edge.wareId}`
    const midX = srcMidX.get(sk) ?? x1 + 4
    let d: string

    if (x2 > x1) {
      if (Math.abs(y1 - y2) < 4) {
        d = `M ${x1},${y1} L ${x2},${y2}`
      } else {
        d = `M ${x1},${y1} L ${midX},${y1} L ${midX},${y2} L ${x2},${y2}`
      }
    } else {
      const slot = gapSlotPosition.get(sk)
      if (!slot) return

      const p1X = midX
      const p2Y = slot.p2Y
      const p3X = slot.p3X
      if (DEBUG_LOG) {
        const assign = sourceGapAssignment.get(sk)
        const srcsInGap = gapSourcesSorted.get(assign?.gapIdx ?? -1) ?? []
        const ei = srcsInGap.indexOf(sk)
        console.log(`[modeB] src=${sk} gap=[${assign?.start.toFixed(0)},${assign?.end.toFixed(0)}] ei=${ei}/${srcsInGap.length} y1=${y1.toFixed(0)} p1X=${p1X.toFixed(0)} p2Y=${p2Y.toFixed(0)} p3X=${p3X.toFixed(0)}`)
      }
      d = `M ${x1},${y1} L ${p1X},${y1} L ${p1X},${p2Y} L ${p3X},${p2Y} L ${p3X},${y2} L ${x2},${y2}`
    }

    const ec = getEdgeColor(edge.wareId); results.push({ id: edge.id, d, color: ec.color, colorIdx: ec.idx })
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
      <marker v-for="(c, ci) in COLORS" :key="ci" :id="`arrow-${ci}`" markerWidth="10" markerHeight="8" refX="10" refY="4" orient="auto" markerUnits="userSpaceOnUse">
        <polygon points="0 0, 10 4, 0 8" :fill="c" />
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
      :marker-end="`url(#arrow-${line.colorIdx})`"
    />
  </svg>
</template>

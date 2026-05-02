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
    srcCardBot: number; srcCardTop: number
    tgtCardBot: number; tgtCardTop: number
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

    let srcCardBot = y1, srcCardTop = y1, tgtCardBot = y2, tgtCardTop = y2
    for (const cb of cardBounds) {
      if (y1 >= cb.top && y1 <= cb.bottom) { srcCardBot = cb.bottom; srcCardTop = cb.top }
      if (y2 >= cb.top && y2 <= cb.bottom) { tgtCardBot = cb.bottom; tgtCardTop = cb.top }
    }

    positioned.push({ edge, x1, y1, x2, y2, srcCardBot, srcCardTop, tgtCardBot, tgtCardTop })
  }

  if (positioned.length === 0) { lines.value = []; return }

  const results: RoutedEdge[] = []
  positioned.sort((a, b) => a.y1 - b.y1)

  const gapGroups = new Map<string, typeof positioned>()
  for (const p of positioned) {
    if ((p.edge as any).isSelfConnection) continue
    if (p.x2 > p.x1) continue
    const gs = p.y1 < p.y2 ? p.srcCardBot : p.tgtCardBot
    const ge = p.y1 < p.y2 ? p.tgtCardTop : p.srcCardTop
    const gk = `${gs.toFixed(0)}|${ge.toFixed(0)}`
    if (!gapGroups.has(gk)) gapGroups.set(gk, [])
    gapGroups.get(gk)!.push(p)
  }

  const gapCounters = new Map<string, number>()
  for (const [gk, group] of gapGroups) {
    const parts = gk.split('|').map(Number)
    console.log(`[gap] y:${(parts[0]??0).toFixed(0)}-${(parts[1]??0).toFixed(0)} edges:${group.length}`)
  }

  const srcMidX = new Map<string, number>()
  const totalSources = new Set(positioned.filter(p => !(p.edge as any).isSelfConnection).map(p => `${p.edge.sourceGroupId}:${p.edge.wareId}`)).size
  let srcIdx = 0
  const outTagEl = container.querySelector('[class*="build-flow-output-card"] [data-tag-id]')
  const gapEnd = outTagEl ? outTagEl.getBoundingClientRect().left - containerRect.left : containerRect.width - 16
  for (const pos of positioned) {
    const sk = `${pos.edge.sourceGroupId}:${pos.edge.wareId}`
    if (!srcMidX.has(sk) && !(pos.edge as any).isSelfConnection) {
      const gap = Math.max(gapEnd - pos.x1 - 8, 4)
      srcMidX.set(sk, pos.x1 + 4 + ((srcIdx + 1) * gap) / Math.max(totalSources + 1, 1))
      srcIdx++
    }
  }

  positioned.forEach((pos) => {
    const { edge, x1, y1, x2, y2, srcCardBot, srcCardTop, tgtCardBot, tgtCardTop } = pos
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
      const gs = y1 < y2 ? srcCardBot : tgtCardBot
      const ge = y1 < y2 ? tgtCardTop : srcCardTop
      const gk = `${gs.toFixed(0)}|${ge.toFixed(0)}`
      const ei = gapCounters.get(gk) ?? 0
      gapCounters.set(gk, ei + 1)
      const totalInGap = gapGroups.get(gk)?.length ?? 1

      const p1X = midX
      const gapStart = y1 < y2 ? srcCardBot : tgtCardBot
      const gapEnd2 = y1 < y2 ? tgtCardTop : srcCardTop
      const gapSize = Math.max(gapEnd2 - gapStart, 4)
      const p2Y = gapStart + ((ei + 1) * gapSize) / Math.max(totalInGap + 1, 1)
      const p3X = 4 + ((ei + 1) * (x2 - 8)) / Math.max(totalInGap + 1, 1)
      console.log(`[modeB] gap=${gk.slice(0,20)} ei=${ei}/${totalInGap} p1X=${p1X.toFixed(0)} p3X=${p3X.toFixed(0)}`)
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

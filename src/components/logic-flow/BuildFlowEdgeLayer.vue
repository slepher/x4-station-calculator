<script lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import type { BuildFlowEdge } from '@/components/logic-flow/presenters/useBuildFlowPresenter'

function getArrowPoints(tipX: number, tipY: number, fromX: number, fromY: number): string {
  const dx = tipX - fromX
  const dy = tipY - fromY
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len === 0) return ''

  const ux = dx / len
  const uy = dy / len

  const arrowSize = 8
  const baseX = tipX - ux * arrowSize
  const baseY = tipY - uy * arrowSize

  const perpX = -uy
  const perpY = ux
  const halfWidth = arrowSize * 0.4

  const p1x = tipX
  const p1y = tipY
  const p2x = baseX + perpX * halfWidth
  const p2y = baseY + perpY * halfWidth
  const p3x = baseX - perpX * halfWidth
  const p3y = baseY - perpY * halfWidth

  return `${p1x},${p1y} ${p2x},${p2y} ${p3x},${p3y}`
}

interface EdgeLine {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
  arrow: string
}

export default {
  name: 'BuildFlowEdgeLayer',
  props: {
    edges: {
      type: Array as () => BuildFlowEdge[],
      required: true
    }
  },
  setup(props: { edges: BuildFlowEdge[] }) {
    const svgRef = ref<SVGSVGElement | null>(null)
    const lines = ref<EdgeLine[]>([])

    function recalculate() {
      if (!svgRef.value) return

      const svgEl = svgRef.value
      const container = svgEl.parentElement
      if (!container) return

      const containerRect = container.getBoundingClientRect()
      const newLines: EdgeLine[] = []

      for (const edge of props.edges) {
        const sourceEl = container.querySelector(`[data-tag-id="${edge.sourceTagId}"]`)
        const targetEl = container.querySelector(`[data-tag-id="${edge.targetTagId}"]`)
        if (!sourceEl || !targetEl) continue

        const sourceRect = sourceEl.getBoundingClientRect()
        const targetRect = targetEl.getBoundingClientRect()

        const x1 = sourceRect.left + sourceRect.width / 2 - containerRect.left
        const y1 = sourceRect.top + sourceRect.height / 2 - containerRect.top
        const x2 = targetRect.left + targetRect.width / 2 - containerRect.left
        const y2 = targetRect.top + targetRect.height / 2 - containerRect.top

        const arrow = getArrowPoints(x2, y2, x1, y1)

        newLines.push({ id: edge.id, x1, y1, x2, y2, arrow })
      }

      lines.value = newLines
    }

    let observer: ResizeObserver | null = null

    onMounted(() => {
      recalculate()
      observer = new ResizeObserver(() => recalculate())
      if (svgRef.value?.parentElement) {
        observer.observe(svgRef.value.parentElement)
      }
    })

    onUnmounted(() => {
      observer?.disconnect()
    })

    watch(() => props.edges, () => nextTick(recalculate), { deep: true })
    watch(() => props.edges.length, () => nextTick(recalculate))

    return { svgRef, lines }
  }
}
</script>

<template>
  <svg
    ref="svgRef"
    class="build-flow-edge-layer pointer-events-none absolute inset-0 w-full h-full overflow-visible"
    style="z-index: 10;"
  >
    <line
      v-for="line in lines"
      :key="line.id"
      :x1="line.x1"
      :y1="line.y1"
      :x2="line.x2"
      :y2="line.y2"
      stroke="rgba(251, 146, 60, 0.7)"
      stroke-width="2"
      stroke-linecap="round"
    />
    <polygon
      v-for="line in lines"
      :key="'arrow-' + line.id"
      :points="line.arrow"
      fill="rgba(251, 146, 60, 0.7)"
    />
  </svg>
</template>

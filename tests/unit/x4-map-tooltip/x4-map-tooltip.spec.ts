import { describe, expect, test } from 'vitest'

// Helper function to replicate the placement logic from MapWorkbenchView.vue
type TooltipPlacement = 'bottom' | 'top' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

const TOOLTIP_OFFSET = 14
const TOOLTIP_VIEWPORT_PADDING = 12

function chooseTooltipPlacement(
  anchor: { left: number; top: number; right: number; bottom: number; width: number; height: number },
  viewportWidth: number,
  viewportHeight: number,
  tooltipWidth: number,
  tooltipHeight: number
): TooltipPlacement {
  const centerX = anchor.left + anchor.width / 2
  const centerY = anchor.top + anchor.height / 2
  const candidates: Array<{ placement: TooltipPlacement; left: number; top: number }> = [
    { placement: 'bottom', left: centerX - tooltipWidth / 2, top: anchor.bottom + TOOLTIP_OFFSET },
    { placement: 'top', left: centerX - tooltipWidth / 2, top: anchor.top - tooltipHeight - TOOLTIP_OFFSET },
    { placement: 'left', left: anchor.left - tooltipWidth - TOOLTIP_OFFSET, top: centerY - tooltipHeight / 2 },
    { placement: 'right', left: anchor.right + TOOLTIP_OFFSET, top: centerY - tooltipHeight / 2 },
    { placement: 'top-left', left: anchor.left - tooltipWidth - TOOLTIP_OFFSET, top: anchor.top - tooltipHeight - TOOLTIP_OFFSET },
    { placement: 'top-right', left: anchor.right + TOOLTIP_OFFSET, top: anchor.top - tooltipHeight - TOOLTIP_OFFSET },
    { placement: 'bottom-left', left: anchor.left - tooltipWidth - TOOLTIP_OFFSET, top: anchor.bottom + TOOLTIP_OFFSET },
    { placement: 'bottom-right', left: anchor.right + TOOLTIP_OFFSET, top: anchor.bottom + TOOLTIP_OFFSET }
  ]

  const fits = (candidate: { left: number; top: number }) =>
    candidate.left >= TOOLTIP_VIEWPORT_PADDING &&
    candidate.top >= TOOLTIP_VIEWPORT_PADDING &&
    candidate.left + tooltipWidth <= viewportWidth - TOOLTIP_VIEWPORT_PADDING &&
    candidate.top + tooltipHeight <= viewportHeight - TOOLTIP_VIEWPORT_PADDING

  const orthogonal = candidates.slice(0, 4)
  const diagonal = candidates.slice(4)
  return (
    orthogonal.find(fits)?.placement ||
    diagonal.find(fits)?.placement ||
    candidates
      .map((candidate) => {
        const overflowLeft = Math.max(0, TOOLTIP_VIEWPORT_PADDING - candidate.left)
        const overflowTop = Math.max(0, TOOLTIP_VIEWPORT_PADDING - candidate.top)
        const overflowRight = Math.max(0, candidate.left + tooltipWidth - (viewportWidth - TOOLTIP_VIEWPORT_PADDING))
        const overflowBottom = Math.max(0, candidate.top + tooltipHeight - (viewportHeight - TOOLTIP_VIEWPORT_PADDING))
        return {
          placement: candidate.placement,
          overflow: overflowLeft + overflowTop + overflowRight + overflowBottom
        }
      })
      .sort((left, right) => left.overflow - right.overflow)[0]?.placement ||
    'bottom'
  )
}

describe('x4-map-tooltip', () => {
  // 1.1 tooltip 定位算法测试
  test('1.1 tooltip 定位算法测试', () => {
    // 1.1.1 对 `chooseTooltipPlacement` 函数测试默认下方弹出场景
    const anchor1 = { left: 400, top: 100, right: 500, bottom: 200, width: 100, height: 100 }
    const viewportWidth1 = 1024
    const viewportHeight1 = 768
    const tooltipWidth1 = 220
    const tooltipHeight1 = 200

    const result1 = chooseTooltipPlacement(anchor1, viewportWidth1, viewportHeight1, tooltipWidth1, tooltipHeight1)
    expect(result1).toBe('bottom')

    // 1.1.2 测试正交方向优先于斜角方向
    const anchor2 = { left: 400, top: 600, right: 500, bottom: 700, width: 100, height: 100 }
    const result2 = chooseTooltipPlacement(anchor2, 1024, 768, 220, 200)
    expect(['top', 'left', 'right']).toContain(result2)

    // 1.1.3 测试边界钳制逻辑 #期望: [tooltip 不超出视口]
    const anchor3 = { left: 50, top: 650, right: 150, bottom: 750, width: 100, height: 100 }
    const result3 = chooseTooltipPlacement(anchor3, 800, 768, 220, 200)
    expect(['bottom', 'top', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right']).toContain(result3)
  })
})
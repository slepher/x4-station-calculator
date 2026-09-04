import { describe, expect, it } from 'vitest'
import { simplifyDensePathPoints } from '@/components/map/utils/geometry'

describe('highway path point simplification', () => {
  it('collapses a dense consecutive control-point run to one representative point', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 42, y: 1 },
      { x: 44, y: 2 },
      { x: 46, y: 3 },
      { x: 90, y: 20 },
      { x: 120, y: 25 }
    ]

    expect(simplifyDensePathPoints(points, 4)).toEqual([
      { x: 0, y: 0 },
      { x: 44, y: 2 },
      { x: 90, y: 20 },
      { x: 120, y: 25 }
    ])
  })

  it('always preserves entry and exit points even when they are close to neighbors', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 }
    ]

    const simplified = simplifyDensePathPoints(points, 4)
    expect(simplified).toHaveLength(3)
    expect(simplified[0]).toEqual({ x: 0, y: 0 })
    expect(simplified.at(-1)).toEqual({ x: 3, y: 0 })
  })
})

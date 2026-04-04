import { describe, expect, it } from 'vitest'
import { getSectorScalePerRadius, sectorPointToLocalRatio } from '@/components/map/utils/coordinates'

describe('sector coordinate normalization', () => {
  it('snaps the sector center to the nearest 64000 grid before projecting local ratios', () => {
    const sector = {
      id: 'sector_alpha',
      normalized: {
        scale_per_radius: 1,
        scale_basis: {
          hex_inner_ratio: Math.sqrt(3) / 2,
          extent_ratio: 0.8
        }
      },
      zones: {
        zone_left: {
          id: 'zone_left',
          raw_sector_pos: { x: 70000, y: 0, z: 0 }
        },
        zone_right: {
          id: 'zone_right',
          raw_sector_pos: { x: 90000, y: 0, z: 0 }
        }
      }
    } as any

    expect(getSectorScalePerRadius(sector)).toBeCloseTo(0.6928203230275509 / 26000, 12)
    const ratio = sectorPointToLocalRatio(sector, { x: 90000, z: 0 })
    expect(ratio?.x).toBeCloseTo(0.6928203230275509, 12)
    expect(Object.is(ratio?.y, -0) ? 0 : ratio?.y).toBe(0)
  })

  it('prefers recorded raw_center_pos when present', () => {
    const sector = {
      id: 'sector_alpha',
      raw_center_pos: { x: 64000, y: 0, z: 0 },
      normalized: {
        scale_per_radius: 0.001
      },
      zones: {
        zone_left: {
          id: 'zone_left',
          raw_sector_pos: { x: 70000, y: 0, z: 0 }
        },
        zone_right: {
          id: 'zone_right',
          raw_sector_pos: { x: 90000, y: 0, z: 0 }
        }
      }
    } as any

    const ratio = sectorPointToLocalRatio(sector, { x: 90000, z: 0 })
    expect(ratio?.x).toBeCloseTo(0.6928203230275509, 12)
    expect(Object.is(ratio?.y, -0) ? 0 : ratio?.y).toBe(0)
  })
})

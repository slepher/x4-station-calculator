import { describe, expect, it } from 'vitest'
import { getEffectiveVisibleSavePoiCategories } from '@/components/empire/savePoiVisibility'
import type { SavePoiVisibility } from '@/types/saveArchive'

const baseVisibility: SavePoiVisibility = {
  playerStation: false,
  npcStation: false,
  abandonedShip: false,
  datavault: false,
  erlkingVault: false
}

describe('user-save-map save POI visibility', () => {
  it('includes the active detail category even when its checkbox is off', () => {
    expect(getEffectiveVisibleSavePoiCategories(baseVisibility, 'playerStation')).toEqual(['playerStation'])
  })

  it('merges checked categories with the active detail category without duplicates', () => {
    const visibility: SavePoiVisibility = {
      ...baseVisibility,
      playerStation: true,
      datavault: true
    }

    expect(getEffectiveVisibleSavePoiCategories(visibility, 'playerStation')).toEqual([
      'playerStation',
      'datavault'
    ])

    expect(getEffectiveVisibleSavePoiCategories(visibility, 'npcStation')).toEqual([
      'playerStation',
      'datavault',
      'npcStation'
    ])
  })

  it('returns only checked categories when no detail category is active', () => {
    const visibility: SavePoiVisibility = {
      ...baseVisibility,
      abandonedShip: true
    }

    expect(getEffectiveVisibleSavePoiCategories(visibility, null)).toEqual(['abandonedShip'])
  })
})

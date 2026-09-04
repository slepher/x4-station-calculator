/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest'
import { getSavePoiIconSize, SMALL_ICON_SIZE } from '@/components/map/utils/style'
import { MAP_ICON_SIZES } from '@/components/map/utils/mapIconConfig'

describe('save poi icon size', () => {
  it('uses large icon size for piratebase tags', () => {
    expect(getSavePoiIconSize({
      key: 'npc:pirate',
      code: 'PIR',
      category: 'npcStation',
      sectorMacro: 'sector_alpha_macro',
      sectorName: 'Alpha',
      position: { x: 0, z: 0 },
      tag: 'piratebase'
    })).toBe(MAP_ICON_SIZES.savePoiLarge)
  })

  it('keeps unrelated tags at the small icon size', () => {
    expect(getSavePoiIconSize({
      key: 'npc:factory',
      code: 'FAC',
      category: 'npcStation',
      sectorMacro: 'sector_alpha_macro',
      sectorName: 'Alpha',
      position: { x: 0, z: 0 },
      tag: 'factory'
    })).toBe(SMALL_ICON_SIZE)
  })
})

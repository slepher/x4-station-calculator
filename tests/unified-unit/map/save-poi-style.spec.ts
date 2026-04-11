/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest'
import { getSavePoiIconSize, OVERLAY_ICON_SIZE, SMALL_ICON_SIZE } from '@/components/map/utils/style'

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
    })).toBe(OVERLAY_ICON_SIZE)
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

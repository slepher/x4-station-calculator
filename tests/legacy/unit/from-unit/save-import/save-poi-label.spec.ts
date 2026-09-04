import { describe, expect, it } from 'vitest'
import { getStationPoiLabel } from '../../../src/components/map/savePoiLabel'
import type { SavePoiOverlayItem } from '../../../src/types/saveArchive'

const basePoi: SavePoiOverlayItem = {
  key: 'npcStation:AAA',
  code: 'AAA',
  category: 'npcStation',
  sectorMacro: 'sec',
  sectorName: 'Sector',
  position: { x: 0, y: 0, z: 0 },
  tag: 'factory'
}

const context = {
  t: (key: string) => ({
    'map.save_category_npc_station': 'Faction Stations',
    'map.save_category_player_station': 'Player Stations',
    'map.save_npc_profile_mixed': 'Complex',
    'map.save_npc_tag_shipyard': 'Shipyard',
    'map.save_npc_tag_weaponplatform': 'Weapon Platform',
    'map.save_station_headquarter': 'Headquarters'
  }[key] || key),
  localizedModulesMap: {
    module_gen_prod_energycells_01: {
      id: 'module_gen_prod_energycells_01',
      localeName: 'Energy Cells Production'
    }
  },
  localizedModuleGroupsMap: {
    refined: {
      id: 'refined',
      localeName: 'Refined Goods'
    },
    shiptech: {
      id: 'shiptech',
      localeName: 'Ship Tech'
    },
    hightech: {
      id: 'hightech',
      localeName: 'High Tech'
    },
    pharmaceutical: {
      id: 'pharmaceutical',
      localeName: 'Pharmaceuticals'
    },
    agricultural: {
      id: 'agricultural',
      localeName: 'Agriculture'
    },
    food: {
      id: 'food',
      localeName: 'Food'
    },
    water: {
      id: 'water',
      localeName: 'Water'
    }
  }
} as any

describe('save poi label', () => {
  it('uses localized module name for single-module factory profile', () => {
    expect(getStationPoiLabel({
      ...basePoi,
      productionProfile: 'module_gen_prod_energycells_01'
    }, context)).toBe('Energy Cells Production')
  })

  it('uses localized module group name for single-group factory profile', () => {
    expect(getStationPoiLabel({
      ...basePoi,
      productionProfile: 'refined'
    }, context)).toBe('Refined Goods')
  })

  it('uses localized ordered cluster labels for cluster factory profile', () => {
    expect(getStationPoiLabel({
      ...basePoi,
      productionProfile: 'shiptech'
    }, context)).toBe('Ship Tech')
  })

  it('uses highest-priority life cluster group as label', () => {
    expect(getStationPoiLabel({
      ...basePoi,
      productionProfile: 'pharmaceutical'
    }, context)).toBe('Pharmaceuticals')
  })

  it('uses mixed locale for mixed factory profile', () => {
    expect(getStationPoiLabel({
      ...basePoi,
      productionProfile: 'mixed'
    }, context)).toBe('Complex')
  })

  it('uses tag locale for non-factory npc station', () => {
    expect(getStationPoiLabel({
      ...basePoi,
      tag: 'shipyard'
    }, context)).toBe('Shipyard')
  })

  it('uses headquarters label before any other rule', () => {
    expect(getStationPoiLabel({
      ...basePoi,
      category: 'playerStation',
      is_headquarter: true,
      productionProfile: 'module_gen_prod_energycells_01'
    }, context)).toBe('Headquarters')
  })

  it('does not apply headquarters override to non-player stations', () => {
    expect(getStationPoiLabel({
      ...basePoi,
      category: 'npcStation',
      is_headquarter: true,
      tag: 'shipyard'
    }, context)).toBe('Shipyard')
  })

  it('uses weapon platform label for khaak weapon platforms', () => {
    expect(getStationPoiLabel({
      ...basePoi,
      category: 'khaakStation',
      tag: 'weaponplatform'
    }, context)).toBe('Weapon Platform')
  })
})

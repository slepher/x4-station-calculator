import { describe, expect, it } from 'vitest'
import type { SaveArchive } from '@/types/saveArchive'
import {
  deriveSavePoiCategoryData,
  flattenSavePoiCategoryData
} from '@/store/useSaveStore'

const archive: SaveArchive = {
  meta: {
    guid: 'g-1',
    seed: 1,
    time: 3600,
    playerName: 'Tester',
    version: '8.0',
    filename: 'save.xml',
    parser_version: 'v1',
    source: 'original'
  },
  isCompatible: true,
  sectors: {
    sector_alpha_macro: {
      name: 'Alpha',
      is_known: true,
      stations: [
        { code: 'P-01', macro: 'station_player', owner: 'player', x: 1000, y: 0, z: 2000 },
        { code: 'N-HQ-01', macro: 'station_npc_hq', owner: 'argon', x: 3000, y: 0, z: 4000, is_headquarter: true },
        { code: 'N-01', macro: 'station_npc', owner: 'argon', x: 5000, y: 0, z: 6000 }
      ],
      datavaults: [
        { code: 'DV-01', macro: 'datavault_macro', owner: 'neutral', x: 7000, y: 0, z: 8000, has_blueprints: true }
      ],
      erlkingVaults: [
        { code: 'EK-01', macro: 'erlking_macro', owner: 'neutral', x: 9000, y: 0, z: 10000, has_wares: true }
      ],
      abandonedShips: [
        { code: 'AS-01', macro: 'ship_macro', class: 'fighter', x: 11000, y: 0, z: 12000 }
      ]
    },
    sector_empty_macro: {
      name: 'Empty',
      is_known: true,
      stations: [],
      datavaults: [],
      erlkingVaults: [],
      abandonedShips: []
    }
  }
}

describe('user-save-map save POI derivation', () => {
  it('derives the five shared POI categories from archive data', () => {
    const categories = deriveSavePoiCategoryData(archive)

    expect(categories.playerStation.count).toBe(1)
    expect(categories.playerStation.groups).toHaveLength(1)
    expect(categories.playerStation.groups[0]?.items.map((item) => item.code)).toEqual(['P-01'])

    expect(categories.npcStation.count).toBe(1)
    expect(categories.npcStation.groups).toHaveLength(1)
    expect(categories.npcStation.groups[0]?.items.map((item) => item.code)).toEqual(['N-HQ-01'])

    expect(categories.abandonedShip.count).toBe(1)
    expect(categories.abandonedShip.groups[0]?.items.map((item) => item.code)).toEqual(['AS-01'])

    expect(categories.datavault.count).toBe(1)
    expect(categories.datavault.groups[0]?.items.map((item) => item.code)).toEqual(['DV-01'])

    expect(categories.erlkingVault.count).toBe(1)
    expect(categories.erlkingVault.groups[0]?.items.map((item) => item.code)).toEqual(['EK-01'])
  })

  it('flattens grouped category data into overlay-ready POIs', () => {
    const categories = deriveSavePoiCategoryData(archive)
    const overlays = flattenSavePoiCategoryData(categories)

    expect(overlays.map((item) => `${item.category}:${item.code}`)).toEqual([
      'playerStation:P-01',
      'npcStation:N-HQ-01',
      'abandonedShip:AS-01',
      'datavault:DV-01',
      'erlkingVault:EK-01'
    ])
    expect(overlays.every((item) => item.sectorName === 'Alpha')).toBe(true)
  })
})

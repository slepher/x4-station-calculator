import { describe, expect, it, vi } from 'vitest'

import { buildGameDataLoaderKey, loadGameDataFiles } from '@/store/logic/useGameData'

describe('useGameData bundled loader', () => {
  it('构建稳定的 game data loader key', () => {
    expect(buildGameDataLoaderKey('8.0-Diplomacy', 'wares.json')).toBe(
      '/src/assets/x4_game_data/8.0-Diplomacy/data/wares.json'
    )
  })

  it('从 bundle loader map 加载指定版本的数据文件', async () => {
    const makeLoader = <T>(payload: T) => vi.fn().mockResolvedValue({ default: payload })

    const data = await loadGameDataFiles('8.0-Diplomacy', {
      [buildGameDataLoaderKey('8.0-Diplomacy', 'wares.json')]: makeLoader([{ id: 'energycells' }]),
      [buildGameDataLoaderKey('8.0-Diplomacy', 'modules.json')]: makeLoader([]),
      [buildGameDataLoaderKey('8.0-Diplomacy', 'module_groups.json')]: makeLoader([]),
      [buildGameDataLoaderKey('8.0-Diplomacy', 'consumption.json')]: makeLoader({}),
      [buildGameDataLoaderKey('8.0-Diplomacy', 'ships.json')]: makeLoader([]),
      [buildGameDataLoaderKey('8.0-Diplomacy', 'ship_races.json')]: makeLoader([]),
      [buildGameDataLoaderKey('8.0-Diplomacy', 'ship_types.json')]: makeLoader([]),
      [buildGameDataLoaderKey('8.0-Diplomacy', 'equipments.json')]: makeLoader([]),
      [buildGameDataLoaderKey('8.0-Diplomacy', 'equipment_types.json')]: makeLoader([]),
      [buildGameDataLoaderKey('8.0-Diplomacy', 'slot_tags.json')]: makeLoader([]),
      [buildGameDataLoaderKey('8.0-Diplomacy', 'consumables.json')]: makeLoader([]),
      [buildGameDataLoaderKey('8.0-Diplomacy', 'drones.json')]: makeLoader([]),
      [buildGameDataLoaderKey('8.0-Diplomacy', 'missiles.json')]: makeLoader([]),
      [buildGameDataLoaderKey('8.0-Diplomacy', 'bullets.json')]: makeLoader([]),
      [buildGameDataLoaderKey('8.0-Diplomacy', 'maps.json')]: makeLoader({ clusters: {} }),
      [buildGameDataLoaderKey('8.0-Diplomacy', 'regionyields.json')]: makeLoader([]),
      [buildGameDataLoaderKey('8.0-Diplomacy', 'factions.json')]: makeLoader([]),
      [buildGameDataLoaderKey('8.0-Diplomacy', 'default_maxes.json')]: makeLoader({}),
      [buildGameDataLoaderKey('8.0-Diplomacy', 'ship_slots.json')]: makeLoader({}),
      [buildGameDataLoaderKey('8.0-Diplomacy', 'languages.json')]: makeLoader([])
    })

    expect(data.wares).toEqual([{ id: 'energycells' }])
    expect(data.maps).toEqual({ clusters: {} })
  })

  it('缺失版本文件时抛出可定位错误', async () => {
    await expect(loadGameDataFiles('missing-version', {})).rejects.toThrow(
      "[GameData] Missing bundled data file 'wares.json' for folder 'missing-version'"
    )
  })
})

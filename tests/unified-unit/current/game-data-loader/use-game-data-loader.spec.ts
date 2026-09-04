import { describe, expect, it, vi } from 'vitest'

import { buildGameDataLoaderKey, buildMapHighwayRings, loadGameDataFiles } from '@/store/logic/useGameData'

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
      [buildGameDataLoaderKey('8.0-Diplomacy', 'maps.json')]: makeLoader({ clusters: {}, sectors: {} }),
      [buildGameDataLoaderKey('8.0-Diplomacy', 'map_resources.json')]: makeLoader({ version: '8.0', resource_model: 'regions', sectors: {}, regionyield_definitions: [] }),
      [buildGameDataLoaderKey('8.0-Diplomacy', 'regionyields.json')]: makeLoader([]),
      [buildGameDataLoaderKey('8.0-Diplomacy', 'res.json')]: makeLoader([]),
      [buildGameDataLoaderKey('8.0-Diplomacy', 'factions.json')]: makeLoader([]),
      [buildGameDataLoaderKey('8.0-Diplomacy', 'default_maxes.json')]: makeLoader({}),
      [buildGameDataLoaderKey('8.0-Diplomacy', 'ship_slots.json')]: makeLoader({}),
      [buildGameDataLoaderKey('8.0-Diplomacy', 'languages.json')]: makeLoader([]),
      [buildGameDataLoaderKey('8.0-Diplomacy', 'dlcs.json')]: makeLoader([]),
      [buildGameDataLoaderKey('8.0-Diplomacy', 'terraforming.json')]: makeLoader({ clusters: [] }),
      [buildGameDataLoaderKey('8.0-Diplomacy', 'research.json')]: makeLoader({ research: [] }),
      [buildGameDataLoaderKey('8.0-Diplomacy', 'blueprints.json')]: makeLoader({ groups: [] })
    })

    expect(data.wares).toEqual([{ id: 'energycells' }])
    expect(data.maps).toEqual({ clusters: {}, sectors: {}, highwayRings: [] })
    expect(data.mapResources.resource_model).toBe('regions')
  })

  it('载入 maps.json 后计算高速环路成员', async () => {
    const rings = buildMapHighwayRings({
      clusters: {},
      sectors: {
        sector_a: {
          id: 'sector_a',
          cluster_id: 'cluster_a',
          nameId: 'sector_a',
          name: 'A',
          owner: '',
          owner_color: '',
          cluster_gates: {
            gate_left: {
              id: 'gate_left',
              target_cluster_id: 'cluster_left',
              raw_local_pos: { x: -500, z: 0 }
            },
            gate_right: {
              id: 'gate_right',
              target_cluster_id: 'cluster_right',
              raw_local_pos: { x: 10_500, z: 0 }
            }
          },
          highways: {
            highway_a: {
              entry: { x: 0, z: 0 },
              exit: { x: 10_000, z: 0 },
              spline: [{ x: 0, z: 0 }, { x: 10_000, z: 0 }]
            },
            highway_b: {
              entry: { x: 10_000, z: 0 },
              exit: { x: 0, z: 0 },
              spline: [{ x: 10_000, z: 0 }, { x: 0, z: 0 }]
            }
          }
        }
      }
    })

    expect(rings).toEqual([{
      sectorId: 'sector_a',
      highwayIds: ['highway_a', 'highway_b'],
      lengthKm: 20,
      maxJoinDistanceM: 0,
      gateMatches: [
        {
          gateId: 'gate_left',
          targetClusterId: 'cluster_left',
          highwayId: 'highway_a',
          portKind: 'entry',
          distanceM: 500
        },
        {
          gateId: 'gate_right',
          targetClusterId: 'cluster_right',
          highwayId: 'highway_a',
          portKind: 'exit',
          distanceM: 500
        }
      ]
    }])
  })

  it('缺失版本文件时抛出可定位错误', async () => {
    await expect(loadGameDataFiles('missing-version', {})).rejects.toThrow(
      "[GameData] Missing bundled data file 'wares.json' for folder 'missing-version'"
    )
  })
})

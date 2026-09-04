import { describe, expect, it } from 'vitest'
import { resolveMapSectorByMacro } from '@/components/empire/mapSectorMacro'

describe('user-save-map sector macro resolution', () => {
  it('matches save archive sector macros against map sector ids case-insensitively', () => {
    const clusters = {
      Cluster_100_macro: {
        sectors: {
          Cluster_100_Sector001_macro: {
            id: 'Cluster_100_Sector001_macro',
            name: 'Watchful Gaze'
          }
        }
      }
    }

    const match = resolveMapSectorByMacro(clusters, 'cluster_100_sector001_macro')

    expect(match).toEqual({
      clusterId: 'Cluster_100_macro',
      sectorId: 'Cluster_100_Sector001_macro',
      sector: {
        id: 'Cluster_100_Sector001_macro',
        name: 'Watchful Gaze'
      }
    })
  })
})

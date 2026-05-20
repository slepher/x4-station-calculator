import { describe, expect, it } from 'vitest'
import { deriveBindingStationsFromRecords, toProductionStation } from '@/store/logic/liveStationResolver'

describe('deriveBindingStationsFromRecords', () => {
  it('maps binding groupId to station sectorId when converting binding plans', () => {
    const station = toProductionStation({
      id: 'binding-station-1',
      saveStationCode: 'save-station-1',
      groupId: 'group-alpha',
      name: 'Bound Station',
      type: 'industrial',
      modules: [],
      settings: {
        racePreference: 'argon',
        considerWorkforceForAutoFill: true,
        showEmpireGaps: false,
        resourceBufferHours: 2,
        primaryProductBufferHours: 2,
        secondaryProductBufferHours: 2,
        transportMinutes: 30,
        transportShipCapacity: 40000,
        buyMultiplier: 0.5,
        sellMultiplier: 0.5,
        sunlight: 100
      }
    } as any)

    expect(station.sectorId).toBe('group-alpha')
  })

  it('uses actual sector sunlight for save-derived stations even when a binding plan exists', () => {
    const groups = [
      {
        id: 'group-alpha',
        name: 'Alpha',
        sectorMacro: 'Cluster_01_Sector001_macro',
        coverageSectorMacros: [],
        connectedGroupIds: []
      }
    ] as any

    const stationPlans = [
      {
        id: 'binding-station-1',
        saveStationCode: 'save-station-1',
        name: 'Bound Station',
        type: 'industrial',
        modules: [],
        settings: {
          racePreference: 'argon',
          considerWorkforceForAutoFill: true,
          showEmpireGaps: false,
          resourceBufferHours: 2,
          primaryProductBufferHours: 2,
          secondaryProductBufferHours: 2,
          transportMinutes: 30,
          transportShipCapacity: 40000,
          buyMultiplier: 0.5,
          sellMultiplier: 0.5,
          sunlight: 100
        },
        groupId: 'group-alpha'
      }
    ] as any

    const stationRecords = [
      {
        code: 'save-station-1',
        type: 'station',
        sectorMacro: 'Cluster_01_Sector001_macro',
        data: {
          code: 'save-station-1',
          modules: []
        }
      }
    ] as any

    const sectorsMap = {
      Cluster_01_Sector001_macro: {
        area: {
          sunlight: 1.37
        }
      }
    }

    const result = deriveBindingStationsFromRecords(groups, stationPlans, stationRecords, sectorsMap)

    expect(result).toHaveLength(1)
    expect(result[0]?.station.id).toBe('binding-station-1')
    expect(result[0]?.station.settings.sunlight).toBe(137)
  })
})

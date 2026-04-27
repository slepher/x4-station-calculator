/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest'
import { migrateEmpireStateToCurrent } from '@/store/logic/stateMigrations'
import type { SavedEmpiresState } from '@/types/x4'
import v4Fixture from '../../fixtures/db/db-4.json'

const lookup: any = {
  modulesMap: {},
  modulesByMacroId: {}
}

describe('V4 → V5 empire migration', () => {
  const v4Input = (v4Fixture as any).x4_empire_data as SavedEmpiresState & { activeStationId?: string }
  const result = migrateEmpireStateToCurrent(v4Input, lookup)
  const migrated = result.state

  it('root level only has version, activeId, list', () => {
    const rootKeys = Object.keys(migrated).sort()
    expect(rootKeys).toEqual(['activeId', 'list', 'version'])
    expect(migrated.version).toBe(5)
    expect(migrated.activeId).toBe(v4Input.activeId)
  })

  it('each empire only has id, name, stations', () => {
    for (const empire of migrated.list) {
      const empireKeys = Object.keys(empire).sort()
      expect(empireKeys).toEqual(['id', 'name', 'stations'])
    }
  })

  it('each station only has expected fields', () => {
    const expectedStationKeys = ['count', 'id', 'lastUpdated', 'lockedWares', 'modules', 'name', 'settings', 'type', 'warePriority'].sort()
    for (const empire of migrated.list) {
      for (const station of empire.stations) {
        const stationKeys = Object.keys(station).sort()
        expect(stationKeys).toEqual(expectedStationKeys)
      }
    }
  })

  it('preserves empire count and order', () => {
    expect(migrated.list.length).toBe(v4Input.list.length)
    migrated.list.forEach((empire, i) => {
      expect(empire.name).toBe(v4Input.list[i].name)
    })
  })

  it('preserves station content (modules, settings, lockedWares)', () => {
    migrated.list.forEach((empire, i) => {
      const v4Empire = v4Input.list[i]
      expect(empire.stations.length).toBe(v4Empire.stations.length)
      empire.stations.forEach((station, j) => {
        const v4Station = v4Empire.stations[j]
        expect(station.name).toBe(v4Station.name)
        expect(station.modules).toEqual(v4Station.modules)
        expect(station.lockedWares).toEqual(v4Station.lockedWares || [])
        expect(station.settings).toEqual(v4Station.settings)
      })
    })
  })
})

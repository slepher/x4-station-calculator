import { describe, expect, it, vi } from 'vitest'
import { loadPlayerStationsFlatByArchiveId } from '@/db/saveArchiveDB'

const db = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('dexie', () => ({ default: class {
  player_stations = { get: db.get }
  version() { return { stores: () => { this.player_stations = { get: db.get }; return this } } }
} }))

describe('archive snapshot integrity', () => {
  it('rejects a missing record when complete facts are required', async () => {
    db.get.mockResolvedValue(undefined)
    await expect(loadPlayerStationsFlatByArchiveId({}, 'g_1', { requireRecord: true })).rejects.toThrow('Missing player station snapshot')
  })
  it('accepts a complete empty snapshot and retains legacy optional reads', async () => {
    db.get.mockResolvedValue({ data: { player_stations: {}, player_buildstorages: {} } })
    await expect(loadPlayerStationsFlatByArchiveId({}, 'g_1', { requireRecord: true })).resolves.toEqual([])
    db.get.mockResolvedValue(undefined)
    await expect(loadPlayerStationsFlatByArchiveId({}, 'g_1')).resolves.toEqual([])
  })
})

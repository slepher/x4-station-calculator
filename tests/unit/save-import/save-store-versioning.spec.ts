import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { SaveArchive, SavedSaveArchivesState } from '@/types/saveArchive'

const dbMocks = vi.hoisted(() => ({
  loadArchiveDetailFromDB: vi.fn(),
  saveArchiveToDB: vi.fn(),
  removeArchiveFromDB: vi.fn(),
  clearArchivesFromDB: vi.fn(),
  clearLegacySaveDB: vi.fn()
}))

vi.mock('@/db/saveArchiveDB', () => ({
  createArchiveId: (guid: string, time: number) => `${guid}_${time}`,
  saveArchiveToDB: dbMocks.saveArchiveToDB,
  loadArchiveDetailFromDB: dbMocks.loadArchiveDetailFromDB,
  removeArchiveFromDB: dbMocks.removeArchiveFromDB,
  clearArchivesFromDB: dbMocks.clearArchivesFromDB,
  clearLegacySaveDB: dbMocks.clearLegacySaveDB
}))

const postProcessMocks = vi.hoisted(() => ({
  postProcessRustSaveArchive: vi.fn((archive: SaveArchive) => ({
    ...archive,
    meta: {
      ...archive.meta,
      parser_version: 'v2',
      post_processor_version: 'v2'
    },
    isValid: true
  }))
}))

vi.mock('@/workers/saveParser.post', () => ({
  CURRENT_PARSER_VERSION: 'v2',
  CURRENT_POST_PROCESSOR_VERSION: 'v2',
  postProcessRustSaveArchive: postProcessMocks.postProcessRustSaveArchive
}))

vi.mock('@/store/useGameDataStore', () => ({
  useGameDataStore: () => ({
    currentVersion: '8.0',
    modulesByMacroId: {},
    maps: { clusters: {} },
    versionsConfig: [
      { storage_keys: { save_archives: 'x4_save_archives' } },
      { storage_keys: { save_archives: 'x4_save_archives_v9_beta' } }
    ],
    getStorageKey: (module: string) => module === 'save_archives' ? 'x4_save_archives' : module
  })
}))

import { useSaveStore } from '@/store/useSaveStore'

function setSavedState(state: SavedSaveArchivesState | null) {
  if (state) localStorage.setItem('x4_save_archives', JSON.stringify(state))
  else localStorage.removeItem('x4_save_archives')
}

describe('save store versioning', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    dbMocks.loadArchiveDetailFromDB.mockReset()
    dbMocks.saveArchiveToDB.mockReset()
    dbMocks.removeArchiveFromDB.mockReset()
    dbMocks.clearArchivesFromDB.mockReset()
    dbMocks.clearLegacySaveDB.mockReset()
    postProcessMocks.postProcessRustSaveArchive.mockClear()
  })

  it('marks archives invalid when parser_version mismatches current parser version', async () => {
    setSavedState({
      version: 1,
      activeArchiveId: null,
      list: [
        {
          id: 'g_1',
          guid: 'g',
          time: 1,
          playerName: 'Tester',
          version: '8.0',
          filename: 'save.xml',
          parser_version: 'v1',
          post_processor_version: 'v1',
          source: 'original',
          isCompatible: true,
          isValid: true,
          createdAt: new Date('2026-04-04T00:00:00.000Z'),
          sectorCount: 0
        }
      ],
      settings: {
        visibility: {
          playerStation: false,
          npcStation: false,
          xenonStation: false,
          khaakStation: false,
          abandonedShip: false,
          datavault: false,
          erlkingVault: false
        },
        excludeConditionalSmallStations: true
      }
    })

    const saveStore = useSaveStore()
    await saveStore.initialize()

    expect(postProcessMocks.postProcessRustSaveArchive).not.toHaveBeenCalled()
    expect(saveStore.archiveGroups[0]?.saves[0]?.isValid).toBe(false)
    expect(dbMocks.clearLegacySaveDB).not.toHaveBeenCalled()
  })

  it('re-runs post process when parser_version matches but post_processor_version mismatches', async () => {
    setSavedState({
      version: 1,
      activeArchiveId: 'g_1',
      list: [
        {
          id: 'g_1',
          guid: 'g',
          time: 1,
          playerName: 'Tester',
          version: '8.0',
          filename: 'save.xml',
          parser_version: 'v2',
          post_processor_version: 'v1',
          source: 'original',
          isCompatible: true,
          isValid: true,
          createdAt: new Date('2026-04-04T00:00:00.000Z'),
          sectorCount: 1
        }
      ],
      settings: {
        visibility: {
          playerStation: false,
          npcStation: false,
          xenonStation: false,
          khaakStation: false,
          abandonedShip: false,
          datavault: false,
          erlkingVault: false
        },
        excludeConditionalSmallStations: true
      }
    })
    dbMocks.loadArchiveDetailFromDB.mockResolvedValue({
      meta: {
        guid: 'g',
        seed: 1,
        time: 1,
        playerName: 'Tester',
        version: '8.0',
        filename: 'save.xml',
        parser_version: 'v2',
        post_processor_version: 'v1',
        source: 'original'
      },
      sectors: {
        cluster_01_sector001_macro: {
          name: 'Sector',
          is_known: true
        }
      },
      isCompatible: true,
      isValid: true
    } satisfies SaveArchive)

    const saveStore = useSaveStore()
    await saveStore.initialize()

    expect(dbMocks.loadArchiveDetailFromDB).toHaveBeenCalledWith('x4_save_archives', 'g_1')
    expect(postProcessMocks.postProcessRustSaveArchive).toHaveBeenCalledTimes(1)
    expect(dbMocks.saveArchiveToDB).toHaveBeenCalledTimes(1)
    expect(saveStore.selectedArchive?.meta.post_processor_version).toBe('v2')
    expect(saveStore.savedArchivesState.activeArchiveId).toBe('g_1')
  })

  it('cleans legacy save DB when no scoped save keys exist', async () => {
    const saveStore = useSaveStore()
    await saveStore.initialize()

    expect(dbMocks.clearLegacySaveDB).toHaveBeenCalledTimes(1)
    expect(saveStore.totalArchiveCount).toBe(0)
  })

  it('repairs missing active archive body and clears activeArchiveId', async () => {
    setSavedState({
      version: 1,
      activeArchiveId: 'g_1',
      list: [
        {
          id: 'g_1',
          guid: 'g',
          time: 1,
          playerName: 'Tester',
          version: '8.0',
          filename: 'save.xml',
          parser_version: 'v2',
          post_processor_version: 'v2',
          source: 'original',
          isCompatible: true,
          isValid: true,
          createdAt: new Date('2026-04-04T00:00:00.000Z'),
          sectorCount: 1
        }
      ],
      settings: {
        visibility: {
          playerStation: false,
          npcStation: false,
          xenonStation: false,
          khaakStation: false,
          abandonedShip: false,
          datavault: false,
          erlkingVault: false
        },
        excludeConditionalSmallStations: true
      }
    })
    dbMocks.loadArchiveDetailFromDB.mockResolvedValue(null)

    const saveStore = useSaveStore()
    await saveStore.initialize()

    expect(saveStore.selectedArchive).toBeNull()
    expect(saveStore.savedArchivesState.activeArchiveId).toBeNull()
    const persisted = JSON.parse(localStorage.getItem('x4_save_archives') || '{}') as SavedSaveArchivesState
    expect(persisted.activeArchiveId).toBeNull()
  })

  it('migrates missing settings to defaults and persists updated settings separately from archive selection', async () => {
    localStorage.setItem('x4_save_archives', JSON.stringify({
      version: 1,
      activeArchiveId: null,
      list: []
    }))

    const saveStore = useSaveStore()
    await saveStore.initialize()

    expect(saveStore.savedArchivesState.settings.excludeConditionalSmallStations).toBe(true)
    expect(saveStore.savedArchivesState.settings.visibility.playerStation).toBe(false)

    saveStore.updateSettings({
      excludeConditionalSmallStations: false,
      visibility: {
        ...saveStore.savedArchivesState.settings.visibility,
        playerStation: true,
        datavault: true
      }
    })

    const persisted = JSON.parse(localStorage.getItem('x4_save_archives') || '{}') as SavedSaveArchivesState
    expect(persisted.settings.excludeConditionalSmallStations).toBe(false)
    expect(persisted.settings.visibility.playerStation).toBe(true)
    expect(persisted.settings.visibility.datavault).toBe(true)
    expect(persisted.activeArchiveId).toBeNull()
  })
})

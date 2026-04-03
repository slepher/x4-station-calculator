import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { SaveArchive } from '@/types/saveArchive'

const dbMocks = vi.hoisted(() => ({
  loadArchiveListFromDB: vi.fn(),
  loadArchiveDetailFromDB: vi.fn(),
  saveArchiveToDB: vi.fn()
}))

vi.mock('@/db/saveArchiveDB', () => ({
  saveArchiveToDB: dbMocks.saveArchiveToDB,
  loadArchiveListFromDB: dbMocks.loadArchiveListFromDB,
  loadArchiveDetailFromDB: dbMocks.loadArchiveDetailFromDB,
  removeArchiveFromDB: vi.fn(),
  clearAllArchivesFromDB: vi.fn()
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
    maps: { clusters: {} }
  })
}))

import { useSaveStore } from '@/store/useSaveStore'

describe('save store versioning', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    dbMocks.loadArchiveListFromDB.mockReset()
    dbMocks.loadArchiveDetailFromDB.mockReset()
    dbMocks.saveArchiveToDB.mockReset()
    postProcessMocks.postProcessRustSaveArchive.mockClear()
  })

  it('marks archives invalid when parser_version mismatches current parser version', async () => {
    dbMocks.loadArchiveListFromDB.mockResolvedValue([
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
        createdAt: new Date(),
        sectorCount: 0
      }
    ])

    const saveStore = useSaveStore()
    await saveStore.initialize()

    expect(postProcessMocks.postProcessRustSaveArchive).not.toHaveBeenCalled()
    expect(saveStore.archiveGroups[0]?.saves[0]?.isValid).toBe(false)
  })

  it('re-runs post process when parser_version matches but post_processor_version mismatches', async () => {
    dbMocks.loadArchiveListFromDB.mockResolvedValue([
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
        createdAt: new Date(),
        sectorCount: 1
      }
    ])
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

    expect(dbMocks.loadArchiveDetailFromDB).toHaveBeenCalledWith('g_1')
    expect(postProcessMocks.postProcessRustSaveArchive).toHaveBeenCalledTimes(1)
    expect(dbMocks.saveArchiveToDB).toHaveBeenCalledTimes(1)
    expect(saveStore.archiveGroups[0]?.saves[0]?.meta.post_processor_version).toBe('v2')
    expect(saveStore.archiveGroups[0]?.saves[0]?.isValid).toBe(true)
  })
})

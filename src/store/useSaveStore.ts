import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { SaveArchive, ArchiveGroup, SectorData, SaveParserErrorDetail } from '@/types/saveArchive'
import { useGameDataStore } from './useGameDataStore'

function normalizeVersion(v: string): string {
  const trimmed = v.trim()
  if (/^\d+\.\d+$/.test(trimmed)) {
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed.toFixed(1) : v
  }

  const num = parseInt(trimmed, 10)
  if (isNaN(num)) return v
  return num >= 100 ? (num / 100).toFixed(1) : num.toFixed(1)
}

function generateExportFileName(meta: SaveArchive['meta']): string {
  const safeName = meta.playerName.replace(/[^\w\-]/g, '_')
  const shortGuid = meta.guid.slice(0, 8)
  return `${safeName}_${shortGuid}_${meta.time}.json`
}

function createEmptySectorData(name: string): SectorData {
  return {
    name,
    is_known: false,
    stations: [],
    datavaults: [],
    erlkingVaults: [],
    abandonedShips: []
  }
}

export const useSaveStore = defineStore('save', () => {
  const gameDataStore = useGameDataStore()

  const archives = ref<Map<string, ArchiveGroup>>(new Map())
  const selectedArchive = ref<SaveArchive | null>(null)
  const isParsing = ref(false)
  const parseProgress = ref('')
  const parseError = ref<string | null>(null)

  const archiveGroups = computed<ArchiveGroup[]>(() => {
    return Array.from(archives.value.values())
  })

  const totalArchiveCount = computed<number>(() => {
    return archiveGroups.value.reduce((sum, group) => sum + group.saves.length, 0)
  })

  function checkVersionCompatibility(version: string): boolean {
    const normalizedVersion = normalizeVersion(version)
    const currentVersion = normalizeVersion(gameDataStore.currentVersion)
    console.log('[checkVersionCompatibility] input version:', version, 'normalized:', normalizedVersion)
    console.log('[checkVersionCompatibility] currentVersion:', gameDataStore.currentVersion, 'normalized:', currentVersion)
    console.log('[checkVersionCompatibility] match:', normalizedVersion === currentVersion)
    return normalizedVersion === currentVersion
  }

  function addArchive(archive: SaveArchive): void {
    archive.isCompatible = checkVersionCompatibility(archive.meta.version)

    const guid = archive.meta.guid
    const existingGroup = archives.value.get(guid)

    if (existingGroup) {
      const existingIndex = existingGroup.saves.findIndex(
        s => s.meta.time === archive.meta.time
      )

      if (existingIndex >= 0) {
        existingGroup.saves[existingIndex] = archive
      } else {
        existingGroup.saves.push(archive)
      }

      existingGroup.saves.sort((a, b) => b.meta.time - a.meta.time)

      if (archive.meta.playerName && archive.meta.playerName !== existingGroup.playerName) {
        existingGroup.playerName = archive.meta.playerName
      }
    } else {
      const newGroup: ArchiveGroup = {
        guid,
        playerName: archive.meta.playerName || 'Unknown',
        saves: [archive]
      }
      archives.value.set(guid, newGroup)
    }
  }

  function selectArchive(guid: string, time: number): void {
    const group = archives.value.get(guid)
    if (!group) {
      selectedArchive.value = null
      return
    }

    const archive = group.saves.find(s => s.meta.time === time)
    selectedArchive.value = archive || null
  }

  function clearSelection(): void {
    selectedArchive.value = null
  }

  function removeArchive(guid: string, time: number): void {
    const group = archives.value.get(guid)
    if (!group) return

    const index = group.saves.findIndex(s => s.meta.time === time)
    if (index >= 0) {
      group.saves.splice(index, 1)
    }

    if (group.saves.length === 0) {
      archives.value.delete(guid)
    }

    if (selectedArchive.value?.meta.guid === guid && selectedArchive.value?.meta.time === time) {
      selectedArchive.value = null
    }
  }

  function clearAll(): void {
    archives.value.clear()
    selectedArchive.value = null
    parseError.value = null
    parseProgress.value = ''
    isParsing.value = false
  }

  function exportToJson(guid: string, time: number): void {
    const group = archives.value.get(guid)
    if (!group) return

    const archive = group.saves.find(s => s.meta.time === time)
    if (!archive) return

    const exportData = {
      meta: archive.meta,
      sectors: archive.sectors
    }

    const jsonString = JSON.stringify(exportData, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const fileName = generateExportFileName(archive.meta)

    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    URL.revokeObjectURL(url)
  }

  function importFromJson(jsonData: unknown): { success: boolean; error?: string; errorDetail?: SaveParserErrorDetail } {
    try {
      if (!jsonData || typeof jsonData !== 'object') {
        return { success: false, error: 'Invalid JSON format', errorDetail: { type: 'parse_error', message: 'Invalid JSON format' } }
      }

      const data = jsonData as { meta?: unknown; sectors?: unknown }

      if (!data.meta || typeof data.meta !== 'object') {
        return { success: false, error: 'Missing meta information', errorDetail: { type: 'parse_error', message: 'Missing meta information' } }
      }

      const meta = data.meta as SaveArchive['meta']

      if (!meta.guid || !meta.seed || !meta.time || !meta.version) {
        return { success: false, error: 'Missing required meta fields', errorDetail: { type: 'parse_error', message: 'Missing required meta fields' } }
      }

      const normalizedSaveVersion = normalizeVersion(meta.version)
      const normalizedCurrentVersion = normalizeVersion(gameDataStore.currentVersion)
      
      if (normalizedSaveVersion !== normalizedCurrentVersion) {
        return { 
          success: false, 
          error: `Version mismatch: save version ${meta.version} does not match current game version ${gameDataStore.currentVersion}`,
          errorDetail: {
            type: 'version_mismatch',
            save_version: meta.version,
            save_version_normalized: normalizedSaveVersion,
            expected_version: gameDataStore.currentVersion,
            expected_version_normalized: normalizedCurrentVersion
          }
        }
      }

      if (!data.sectors || typeof data.sectors !== 'object') {
        return { success: false, error: 'Missing sectors data', errorDetail: { type: 'parse_error', message: 'Missing sectors data' } }
      }

      const sectors = data.sectors as Record<string, SectorData>

      for (const [sectorId, sector] of Object.entries(sectors)) {
        if (!sector.name) {
          sectors[sectorId] = createEmptySectorData(sectorId)
        }
      }

      const archive: SaveArchive = {
        meta: {
          ...meta,
          filename: typeof meta.filename === 'string' ? meta.filename : '',
          parser_version: meta.parser_version === 'v1' ? 'v1' : 'v1',
          source: 'imported'
        },
        sectors,
        isCompatible: true
      }

      addArchive(archive)
      return { success: true }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      return { success: false, error: message, errorDetail: { type: 'parse_error', message } }
    }
  }

  function setParsingState(parsing: boolean, progress: string = '', error: string | null = null): void {
    isParsing.value = parsing
    parseProgress.value = progress
    parseError.value = error
  }

  return {
    archives,
    selectedArchive,
    isParsing,
    parseProgress,
    parseError,
    archiveGroups,
    totalArchiveCount,
    checkVersionCompatibility,
    addArchive,
    selectArchive,
    clearSelection,
    removeArchive,
    clearAll,
    exportToJson,
    importFromJson,
    setParsingState
  }
})

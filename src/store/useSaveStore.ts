import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  SaveArchive,
  ArchiveGroup,
  SectorData,
  SaveParserErrorDetail,
  SavePoiCategory,
  SavePoiCategoryData,
  SavePoiCategoryDataMap,
  SavePoiOverlayItem,
  SavePoiSectorGroup,
  StationEntry,
  PlayerStationEntry,
  FactionStationEntry,
  NpcStationEntry,
  DatavaultEntry,
  AbandonedShipEntry
} from '@/types/saveArchive'
import { useGameDataStore } from './useGameDataStore'
import {
  saveArchiveToDB,
  loadArchiveListFromDB,
  loadArchiveDetailFromDB,
  removeArchiveFromDB,
  clearAllArchivesFromDB,
  removeOutdatedArchivesFromDB
} from '@/db/saveArchiveDB'

const CURRENT_PARSER_VERSION = 'v1'
const SAVE_POI_CATEGORIES: SavePoiCategory[] = ['playerStation', 'npcStation', 'xenonStation', 'khaakStation', 'abandonedShip', 'datavault', 'erlkingVault']

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
    owner: undefined,
    playerStations: [],
    xenonStations: [],
    khaakStations: [],
    npcStations: [],
    datavaults: [],
    erlkingVaults: [],
    abandonedShips: []
  }
}

function sortPoiGroups<T>(groups: SavePoiSectorGroup<T>[]): SavePoiSectorGroup<T>[] {
  return groups.sort((a, b) => a.sectorName.localeCompare(b.sectorName))
}

function createPoiCategoryData<T>(
  key: SavePoiCategory,
  groups: SavePoiSectorGroup<T>[]
): SavePoiCategoryData<T> {
  return {
    key,
    count: groups.reduce((sum, group) => sum + group.items.length, 0),
    groups: sortPoiGroups(groups)
  }
}

function buildPoiGroups<T>(
  sectors: Record<string, SectorData>,
  extractor: (sector: SectorData) => T[]
): SavePoiSectorGroup<T>[] {
  return Object.entries(sectors)
    .map(([sectorMacro, sector]) => ({
      sectorMacro,
      sectorName: sector.name,
      items: extractor(sector)
    }))
    .filter((group) => group.items.length > 0)
}

function createOverlayItem(
  category: SavePoiCategory,
  sectorMacro: string,
  sectorName: string,
  item: StationEntry | DatavaultEntry | AbandonedShipEntry
): SavePoiOverlayItem {
  const isStation = 'tag' in item || 'is_headquarter' in item
  const owner = category === 'playerStation' ? 'player' : ('owner' in item ? item.owner : undefined)
  return {
    key: `${category}:${item.code}`,
    code: item.code,
    category,
    owner,
    sectorMacro,
    sectorName,
    pos: { x: item.x, z: item.z },
    tag: isStation && 'tag' in item ? item.tag : undefined,
    is_headquarter: isStation && 'is_headquarter' in item ? item.is_headquarter : undefined
  }
}

export function deriveSavePoiCategoryData(archive: SaveArchive | null | undefined): SavePoiCategoryDataMap {
  const sectors = archive?.sectors || {}

  return {
    playerStation: createPoiCategoryData('playerStation', buildPoiGroups(sectors, (sector) =>
      sector.playerStations || []
    )),
    npcStation: createPoiCategoryData('npcStation', buildPoiGroups(sectors, (sector) =>
      (sector.npcStations || []).filter((station) => station.tag !== 'factory')
    )),
    xenonStation: createPoiCategoryData('xenonStation', buildPoiGroups(sectors, (sector) =>
      sector.xenonStations || []
    )),
    khaakStation: createPoiCategoryData('khaakStation', buildPoiGroups(sectors, (sector) =>
      sector.khaakStations || []
    )),
    abandonedShip: createPoiCategoryData('abandonedShip', buildPoiGroups(sectors, (sector) => sector.abandonedShips || [])),
    datavault: createPoiCategoryData('datavault', buildPoiGroups(sectors, (sector) => sector.datavaults || [])),
    erlkingVault: createPoiCategoryData('erlkingVault', buildPoiGroups(sectors, (sector) => sector.erlkingVaults || []))
  }
}

function classifyLegacyStation(station: StationEntry): keyof Pick<SectorData, 'playerStations' | 'xenonStations' | 'khaakStations' | 'npcStations'> {
  if (station.owner === 'player') return 'playerStations'
  if (station.owner === 'xenon') return 'xenonStations'
  if (station.owner === 'khaak') return 'khaakStations'
  return 'npcStations'
}

function normalizeSectorData(
  sectorId: string,
  sector: SectorData & {
    stations?: StationEntry[]
    player_stations?: PlayerStationEntry[]
    xenon_stations?: FactionStationEntry[]
    khaak_stations?: FactionStationEntry[]
    npc_stations?: NpcStationEntry[]
  }
): SectorData {
  const normalized = createEmptySectorData(sector.name || sectorId)
  normalized.is_known = Boolean(sector.is_known)
  normalized.owner = sector.owner
  normalized.datavaults = Array.isArray(sector.datavaults)
    ? sector.datavaults.map((entry) => ({
      ...entry,
      unlocked: entry.unlocked === true,
      wares: Array.isArray(entry.wares) ? entry.wares : []
    }))
    : []
  normalized.erlkingVaults = Array.isArray(sector.erlkingVaults)
    ? sector.erlkingVaults.map((entry) => ({
      ...entry,
      unlocked: entry.unlocked === true,
      wares: Array.isArray(entry.wares) ? entry.wares : []
    }))
    : []
  normalized.abandonedShips = Array.isArray(sector.abandonedShips) ? sector.abandonedShips : []

  if (Array.isArray(sector.playerStations)) normalized.playerStations = sector.playerStations as PlayerStationEntry[]
  else if (Array.isArray(sector.player_stations)) normalized.playerStations = sector.player_stations as PlayerStationEntry[]
  if (Array.isArray(sector.xenonStations)) normalized.xenonStations = sector.xenonStations as FactionStationEntry[]
  else if (Array.isArray(sector.xenon_stations)) normalized.xenonStations = sector.xenon_stations as FactionStationEntry[]
  if (Array.isArray(sector.khaakStations)) normalized.khaakStations = sector.khaakStations as FactionStationEntry[]
  else if (Array.isArray(sector.khaak_stations)) normalized.khaakStations = sector.khaak_stations as FactionStationEntry[]
  if (Array.isArray(sector.npcStations)) normalized.npcStations = sector.npcStations as NpcStationEntry[]
  else if (Array.isArray(sector.npc_stations)) normalized.npcStations = sector.npc_stations as NpcStationEntry[]

  if (Array.isArray(sector.stations)) {
    for (const station of sector.stations) {
      const key = classifyLegacyStation(station)
      ;(normalized[key] as StationEntry[]).push(station)
    }
  }

  return normalized
}

export function flattenSavePoiCategoryData(
  data: SavePoiCategoryDataMap,
  categories: SavePoiCategory[] = SAVE_POI_CATEGORIES
): SavePoiOverlayItem[] {
  return categories.flatMap((category) =>
    data[category].groups.flatMap((group) =>
      group.items.map((item) => createOverlayItem(category, group.sectorMacro, group.sectorName, item))
    )
  )
}

export const useSaveStore = defineStore('save', () => {
  const gameDataStore = useGameDataStore()

  const archives = ref<Map<string, ArchiveGroup>>(new Map())
  const selectedArchive = ref<SaveArchive | null>(null)
  const isParsing = ref(false)
  const parseProgress = ref('')
  const parseError = ref<string | null>(null)
  const isInitialized = ref(false)

  const archiveGroups = computed<ArchiveGroup[]>(() => {
    return Array.from(archives.value.values())
  })

  const totalArchiveCount = computed<number>(() => {
    return archiveGroups.value.reduce((sum, group) => sum + group.saves.length, 0)
  })

  const selectedArchivePoiCategories = computed<SavePoiCategoryDataMap>(() => {
    return deriveSavePoiCategoryData(selectedArchive.value)
  })

  const selectedArchivePoiOverlays = computed<SavePoiOverlayItem[]>(() => {
    return flattenSavePoiCategoryData(selectedArchivePoiCategories.value)
  })

  async function initialize(): Promise<void> {
    if (isInitialized.value) return
    
    // Set initialized flag early to prevent concurrent calls
    isInitialized.value = true
    
    try {
      const removedCount = await removeOutdatedArchivesFromDB(CURRENT_PARSER_VERSION)
      if (removedCount > 0) {
        console.log(`[saveStore] removed ${removedCount} outdated archives`)
      }
      
      const metaList = await loadArchiveListFromDB()
      
      // Clear existing data before loading to ensure idempotency
      archives.value.clear()
      
      for (const meta of metaList) {
        const guid = meta.guid
        const existingGroup = archives.value.get(guid)
        
        const stubArchive: SaveArchive = {
          meta: {
            guid: meta.guid,
            seed: 0,
            time: meta.time,
            playerName: meta.playerName,
            version: meta.version,
            filename: meta.filename,
            parser_version: meta.parser_version as 'v1' | 'v2',
            source: meta.source
          },
          sectors: {},
          isCompatible: meta.isCompatible
        }
        
        if (existingGroup) {
          // Check if this save already exists (by time)
          const existingIndex = existingGroup.saves.findIndex(s => s.meta.time === meta.time)
          if (existingIndex >= 0) {
            existingGroup.saves[existingIndex] = stubArchive
          } else {
            existingGroup.saves.push(stubArchive)
          }
        } else {
          archives.value.set(guid, {
            guid,
            playerName: meta.playerName,
            saves: [stubArchive]
          })
        }
      }
      
      // Sort saves within each group by time (descending)
      for (const group of archives.value.values()) {
        group.saves.sort((a, b) => b.meta.time - a.meta.time)
      }
      
      console.log(`[saveStore] initialized with ${archives.value.size} groups, ${metaList.length} total saves`)
    } catch (error) {
      console.error('[saveStore] initialization failed:', error)
      // Reset flag on error to allow retry
      isInitialized.value = false
    }
  }

  function checkVersionCompatibility(version: string): boolean {
    const normalizedVersion = normalizeVersion(version)
    const currentVersion = normalizeVersion(gameDataStore.currentVersion)
    console.log('[checkVersionCompatibility] input version:', version, 'normalized:', normalizedVersion)
    console.log('[checkVersionCompatibility] currentVersion:', gameDataStore.currentVersion, 'normalized:', currentVersion)
    console.log('[checkVersionCompatibility] match:', normalizedVersion === currentVersion)
    return normalizedVersion === currentVersion
  }

  function addArchive(archive: SaveArchive): void {
    archive.sectors = Object.fromEntries(
      Object.entries(archive.sectors).map(([sectorId, sector]) => [sectorId, normalizeSectorData(sectorId, sector as SectorData & { stations?: StationEntry[] })])
    )
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
    
    saveArchiveToDB(archive).catch(error => {
      console.error('[saveStore] failed to persist archive:', error)
    })
  }

  async function selectArchive(guid: string, time: number): Promise<void> {
    const group = archives.value.get(guid)
    if (!group) {
      selectedArchive.value = null
      return
    }

    let archive = group.saves.find(s => s.meta.time === time)
    
    if (archive && Object.keys(archive.sectors).length === 0) {
      const id = `${guid}_${time}`
      const fullArchive = await loadArchiveDetailFromDB(id)
      if (fullArchive) {
        fullArchive.sectors = Object.fromEntries(
          Object.entries(fullArchive.sectors).map(([sectorId, sector]) => [sectorId, normalizeSectorData(sectorId, sector as SectorData & { stations?: StationEntry[] })])
        )
        const index = group.saves.findIndex(s => s.meta.time === time)
        if (index >= 0) {
          group.saves[index] = fullArchive
          archive = fullArchive
        }
      }
    }
    
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
    
    removeArchiveFromDB(guid, time).catch(error => {
      console.error('[saveStore] failed to remove archive from DB:', error)
    })
  }

  function clearAll(): void {
    archives.value.clear()
    selectedArchive.value = null
    parseError.value = null
    parseProgress.value = ''
    isParsing.value = false
    
    clearAllArchivesFromDB().catch(error => {
      console.error('[saveStore] failed to clear DB:', error)
    })
  }

  async function exportToJson(guid: string, time: number): Promise<void> {
    const id = `${guid}_${time}`
    let archive = await loadArchiveDetailFromDB(id)
    
    if (!archive) {
      const group = archives.value.get(guid)
      if (!group) return
      archive = group.saves.find(s => s.meta.time === time) || null
    }
    
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

      const sectorsInput = data.sectors as Record<string, SectorData & { stations?: StationEntry[] }>
      const sectors: Record<string, SectorData> = {}

      for (const [sectorId, sector] of Object.entries(sectorsInput)) {
        sectors[sectorId] = normalizeSectorData(sectorId, sector)
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

  function getArchivePoiCategories(archive: SaveArchive | null | undefined): SavePoiCategoryDataMap {
    return deriveSavePoiCategoryData(archive)
  }

  function getArchivePoiOverlays(
    archive: SaveArchive | null | undefined,
    categories: SavePoiCategory[] = SAVE_POI_CATEGORIES
  ): SavePoiOverlayItem[] {
    return flattenSavePoiCategoryData(getArchivePoiCategories(archive), categories)
  }

  return {
    archives,
    selectedArchive,
    isParsing,
    parseProgress,
    parseError,
    archiveGroups,
    totalArchiveCount,
    selectedArchivePoiCategories,
    selectedArchivePoiOverlays,
    isInitialized,
    initialize,
    checkVersionCompatibility,
    addArchive,
    selectArchive,
    clearSelection,
    removeArchive,
    clearAll,
    exportToJson,
    importFromJson,
    setParsingState,
    getArchivePoiCategories,
    getArchivePoiOverlays
  }
})

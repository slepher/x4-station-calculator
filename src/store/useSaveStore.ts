import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  SaveArchive,
  ArchiveGroup,
  ArchiveMeta,
  SavedSaveArchivesState,
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
  clearArchivesFromDB,
  clearLegacySaveDB,
  createArchiveId,
  loadArchiveDetailFromDB,
  removeArchiveFromDB,
  saveArchiveToDB
} from '@/db/saveArchiveDB'
import {
  CURRENT_PARSER_VERSION,
  CURRENT_POST_PROCESSOR_VERSION,
  postProcessRustSaveArchive
} from '@/workers/saveParser.post'

const SAVE_POI_CATEGORIES: SavePoiCategory[] = ['playerStation', 'npcStation', 'xenonStation', 'khaakStation', 'abandonedShip', 'datavault', 'erlkingVault']
const SAVE_ARCHIVES_STATE_VERSION = 1

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

function createEmptySaveArchivesState(): SavedSaveArchivesState {
  return {
    version: SAVE_ARCHIVES_STATE_VERSION,
    activeArchiveId: null,
    list: []
  }
}

function migrateSaveArchivesStateToCurrent(raw: unknown): SavedSaveArchivesState {
  if (!raw || typeof raw !== 'object') {
    return createEmptySaveArchivesState()
  }

  const parsed = raw as Partial<SavedSaveArchivesState>
  const list = Array.isArray(parsed.list)
    ? parsed.list
      .filter((item): item is ArchiveMeta => Boolean(item && typeof item === 'object'))
      .map((item) => ({
        ...item,
        id: typeof item.id === 'string' ? item.id : createArchiveId(item.guid, item.time),
        createdAt: item.createdAt instanceof Date ? item.createdAt : new Date(item.createdAt)
      }))
    : []

  return {
    version: SAVE_ARCHIVES_STATE_VERSION,
    activeArchiveId: typeof parsed.activeArchiveId === 'string' ? parsed.activeArchiveId : null,
    list
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
    pos: { x: item.position.x, z: item.position.z },
    tag: isStation && 'tag' in item ? item.tag : undefined,
    factoryGroup: isStation && 'factoryGroup' in item ? item.factoryGroup : undefined,
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
      sector.npcStations || []
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

function isArchiveParserVersionValid(archive: Pick<SaveArchive, 'meta'>): boolean {
  return archive.meta.parser_version === CURRENT_PARSER_VERSION
}

function createStubArchiveFromMeta(meta: ArchiveMeta): SaveArchive {
  return {
    meta: {
      guid: meta.guid,
      seed: 0,
      time: meta.time,
      playerName: meta.playerName,
      version: meta.version,
      filename: meta.filename,
      parser_version: meta.parser_version === 'v1' ? 'v1' : 'v2',
      post_processor_version: meta.post_processor_version === 'v1' ? 'v1' : meta.post_processor_version === 'v2' ? 'v2' : undefined,
      source: meta.source
    },
    sectors: {},
    isCompatible: meta.isCompatible,
    isValid: meta.parser_version === CURRENT_PARSER_VERSION
  }
}

function upsertArchiveMeta(list: ArchiveMeta[], meta: ArchiveMeta): ArchiveMeta[] {
  const next = [...list]
  const index = next.findIndex((item) => item.id === meta.id)
  if (index >= 0) next[index] = meta
  else next.push(meta)
  next.sort((a, b) => b.time - a.time)
  return next
}

function removeArchiveMeta(list: ArchiveMeta[], archiveId: string): ArchiveMeta[] {
  return list.filter((item) => item.id !== archiveId)
}

function buildArchiveGroups(metaList: ArchiveMeta[]): Map<string, ArchiveGroup> {
  const groups = new Map<string, ArchiveGroup>()

  for (const meta of metaList) {
    const archive = createStubArchiveFromMeta(meta)
    const existing = groups.get(meta.guid)
    if (existing) {
      existing.saves.push(archive)
      existing.saves.sort((a, b) => b.meta.time - a.meta.time)
      if (meta.playerName) existing.playerName = meta.playerName
    } else {
      groups.set(meta.guid, {
        guid: meta.guid,
        playerName: meta.playerName,
        saves: [archive]
      })
    }
  }

  return groups
}

export const useSaveStore = defineStore('save', () => {
  const gameDataStore = useGameDataStore()

  function getStorageKey(): string {
    return gameDataStore.getStorageKey('save_archives')
  }

  function getAllSaveStorageKeys(): string[] {
    const configs = gameDataStore.versionsConfig || []
    const keys = configs
      .map((config) => config.storage_keys.save_archives)
      .filter((key): key is string => typeof key === 'string' && key.length > 0)
    return keys.length > 0 ? keys : ['x4_save_archives']
  }

  function writeSavedState() {
    localStorage.setItem(getStorageKey(), JSON.stringify(savedArchivesState.value))
  }

  function rebuildArchivesFromState() {
    archives.value = buildArchiveGroups(savedArchivesState.value.list)
  }

  function buildArchiveMeta(archive: SaveArchive, existingCreatedAt?: Date): ArchiveMeta {
    return {
      id: createArchiveId(archive.meta.guid, archive.meta.time),
      guid: archive.meta.guid,
      time: archive.meta.time,
      playerName: archive.meta.playerName,
      version: archive.meta.version,
      filename: archive.meta.filename,
      parser_version: archive.meta.parser_version,
      post_processor_version: archive.meta.post_processor_version,
      source: archive.meta.source,
      isCompatible: archive.isCompatible,
      isValid: archive.isValid,
      createdAt: existingCreatedAt || new Date(),
      sectorCount: Object.keys(archive.sectors).length
    }
  }

  async function restoreSelectedArchive(archiveId: string): Promise<void> {
    const fullArchive = await loadArchiveDetailFromDB(getStorageKey(), archiveId)
    if (!fullArchive) {
      selectedArchive.value = null
      savedArchivesState.value.activeArchiveId = null
      writeSavedState()
      return
    }

    fullArchive.isValid = isArchiveParserVersionValid(fullArchive)
    fullArchive.sectors = Object.fromEntries(
      Object.entries(fullArchive.sectors).map(([sectorId, sector]) => [sectorId, normalizeSectorData(sectorId, sector as SectorData & { stations?: StationEntry[] })])
    )

    if (fullArchive.isValid && fullArchive.meta.post_processor_version !== CURRENT_POST_PROCESSOR_VERSION) {
      const reprocessedArchive = postProcessRustSaveArchive(
        fullArchive,
        gameDataStore.modulesByMacroId,
        gameDataStore.maps
      )
      reprocessedArchive.isCompatible = checkVersionCompatibility(reprocessedArchive.meta.version)
      reprocessedArchive.isValid = isArchiveParserVersionValid(reprocessedArchive)
      await saveArchiveToDB(getStorageKey(), reprocessedArchive)
      const existingMeta = savedArchivesState.value.list.find((item) => item.id === archiveId)
      const nextMeta = buildArchiveMeta(reprocessedArchive, existingMeta?.createdAt)
      savedArchivesState.value.list = upsertArchiveMeta(savedArchivesState.value.list, nextMeta)
      writeSavedState()
      rebuildArchivesFromState()
      selectedArchive.value = reprocessedArchive
      return
    }

    selectedArchive.value = fullArchive
  }

  const savedArchivesState = ref<SavedSaveArchivesState>(createEmptySaveArchivesState())
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
    return savedArchivesState.value.list.length
  })

  const selectedArchivePoiCategories = computed<SavePoiCategoryDataMap>(() => {
    return deriveSavePoiCategoryData(selectedArchive.value)
  })

  const selectedArchivePoiOverlays = computed<SavePoiOverlayItem[]>(() => {
    return flattenSavePoiCategoryData(selectedArchivePoiCategories.value)
  })

  async function initialize(): Promise<void> {
    if (isInitialized.value) return
    isInitialized.value = true

    try {
      const allKeysMissing = getAllSaveStorageKeys().every((key) => localStorage.getItem(key) === null)
      if (allKeysMissing) {
        await clearLegacySaveDB()
      }

      const stored = localStorage.getItem(getStorageKey())
      savedArchivesState.value = stored
        ? migrateSaveArchivesStateToCurrent(JSON.parse(stored))
        : createEmptySaveArchivesState()

      rebuildArchivesFromState()
      selectedArchive.value = null

      if (savedArchivesState.value.activeArchiveId) {
        await restoreSelectedArchive(savedArchivesState.value.activeArchiveId)
      }
    } catch (error) {
      console.error('[saveStore] initialization failed:', error)
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
    archive.isValid = isArchiveParserVersionValid(archive)

    const archiveId = createArchiveId(archive.meta.guid, archive.meta.time)
    const existingMeta = savedArchivesState.value.list.find((item) => item.id === archiveId)
    const nextMeta = buildArchiveMeta(archive, existingMeta?.createdAt)
    savedArchivesState.value.list = upsertArchiveMeta(savedArchivesState.value.list, nextMeta)
    savedArchivesState.value.activeArchiveId = archiveId
    writeSavedState()
    rebuildArchivesFromState()
    selectedArchive.value = archive

    saveArchiveToDB(getStorageKey(), archive).catch(error => {
      console.error('[saveStore] failed to persist archive:', error)
    })
  }

  async function selectArchive(guid: string, time: number): Promise<void> {
    const archiveId = createArchiveId(guid, time)
    const exists = savedArchivesState.value.list.some((item) => item.id === archiveId)
    if (!exists) {
      selectedArchive.value = null
      return
    }

    savedArchivesState.value.activeArchiveId = archiveId
    writeSavedState()
    await restoreSelectedArchive(archiveId)
  }

  function clearSelection(): void {
    selectedArchive.value = null
    savedArchivesState.value.activeArchiveId = null
    writeSavedState()
  }

  function removeArchive(guid: string, time: number): void {
    const archiveId = createArchiveId(guid, time)
    const exists = savedArchivesState.value.list.some((item) => item.id === archiveId)
    if (!exists) return

    savedArchivesState.value.list = removeArchiveMeta(savedArchivesState.value.list, archiveId)
    if (savedArchivesState.value.activeArchiveId === archiveId) {
      savedArchivesState.value.activeArchiveId = null
    }
    if (selectedArchive.value?.meta.guid === guid && selectedArchive.value?.meta.time === time) {
      selectedArchive.value = null
    }
    writeSavedState()
    rebuildArchivesFromState()

    removeArchiveFromDB(getStorageKey(), archiveId).catch(error => {
      console.error('[saveStore] failed to remove archive from DB:', error)
    })
  }

  function clearAll(): void {
    savedArchivesState.value = createEmptySaveArchivesState()
    archives.value.clear()
    selectedArchive.value = null
    parseError.value = null
    parseProgress.value = ''
    isParsing.value = false
    writeSavedState()

    clearArchivesFromDB(getStorageKey()).catch(error => {
      console.error('[saveStore] failed to clear DB:', error)
    })
  }

  async function exportToJson(guid: string, time: number): Promise<void> {
    const archiveId = createArchiveId(guid, time)
    let archive = await loadArchiveDetailFromDB(getStorageKey(), archiveId)

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
          parser_version: meta.parser_version === 'v1' ? 'v1' : 'v2',
          post_processor_version: meta.post_processor_version === 'v1'
            ? 'v1'
            : meta.post_processor_version === 'v2'
              ? 'v2'
              : undefined,
          source: 'imported'
        },
        sectors,
        isCompatible: true,
        isValid: meta.parser_version === CURRENT_PARSER_VERSION
      }

      const finalArchive = archive.meta.post_processor_version === CURRENT_POST_PROCESSOR_VERSION
        ? archive
        : postProcessRustSaveArchive(archive, gameDataStore.modulesByMacroId, gameDataStore.maps)

      addArchive(finalArchive)
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
    savedArchivesState,
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

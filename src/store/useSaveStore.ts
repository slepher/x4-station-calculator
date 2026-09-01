import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  SaveArchive,
  SaveMeta,
  ArchiveGroup,
  ArchiveMeta,
  SavedSaveArchivesState,
  SaveArchiveSettings,
  SectorData,
  SaveParserErrorDetail,
  SavePoiCategory,
  SavePoiCategoryData,
  SavePoiCategoryDataMap,
  SavePoiOverlayItem,
  SavePoiSectorGroup,
  StationEntry,
  DatavaultEntry,
  AbandonedShipEntry,
  CodeMap
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
import {
  classifyPlayerShip,
  type PlayerShipAvailabilityState
} from './logic/playerShipAvailability'
const SAVE_POI_CATEGORIES: SavePoiCategory[] = ['playerStation', 'npcStation', 'xenonStation', 'khaakStation', 'abandonedShip', 'datavault', 'erlkingVault']
const SAVE_ARCHIVES_STATE_VERSION = 1

type SavePoiFilterOptions = Record<string, never>

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
    center: undefined,
    scale_per_radius: undefined,
    clusterGates: [],
    superhighwayGates: [],
    highways: [],
    player_stations: {},
    xenon_stations: {},
    khaak_stations: {},
    npc_stations: {},
    player_buildstorages: {},
    datavaults: {},
    erlking_vaults: {},
    abandoned_ships: {},
    player_ships: {}
  }
}

function recordValues<T>(record: CodeMap<T> | undefined): T[] {
  return record ? Object.values(record) : []
}

function createEmptySaveArchivesState(): SavedSaveArchivesState {
  return {
    version: SAVE_ARCHIVES_STATE_VERSION,
    activeArchiveId: null,
    list: [],
    settings: createDefaultSaveArchiveSettings()
  }
}

function createDefaultSavePoiVisibility(): Record<SavePoiCategory, boolean> {
  return {
    playerStation: true,
    npcStation: true,
    xenonStation: true,
    khaakStation: true,
    abandonedShip: true,
    datavault: true,
    erlkingVault: true
  }
}

function createDefaultSaveArchiveSettings(): SaveArchiveSettings {
  return {
    visibility: createDefaultSavePoiVisibility()
  }
}

function getLatestArchiveMetaForGuid(list: ArchiveMeta[], guid: string): ArchiveMeta | null {
  const matches = list.filter((item) => item.guid === guid && isArchiveParserVersionValidByString(item.parser_version))
  if (matches.length === 0) return null
  return [...matches].sort((a, b) => b.time - a.time)[0] || null
}

function migrateSaveArchiveSettingsToCurrent(raw: unknown): SaveArchiveSettings {
  const defaults = createDefaultSaveArchiveSettings()
  if (!raw || typeof raw !== 'object') return defaults

  const parsed = raw as Partial<SaveArchiveSettings>
  const visibility = parsed.visibility && typeof parsed.visibility === 'object'
    ? {
      ...defaults.visibility,
      ...Object.fromEntries(
        SAVE_POI_CATEGORIES.map((category) => [category, parsed.visibility?.[category] === true])
      )
    }
    : defaults.visibility

  return {
    visibility
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
    list,
    settings: migrateSaveArchiveSettingsToCurrent(parsed.settings)
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
  extractor: (sectorMacro: string, sector: SectorData) => T[]
): SavePoiSectorGroup<T>[] {
  return Object.entries(sectors)
    .map(([sectorMacro, sector]) => ({
      sectorMacro,
      sectorName: sector.name,
      items: extractor(sectorMacro, sector)
    }))
    .filter((group) => group.items.length > 0)
}

export function createOverlayItem(
  category: SavePoiCategory,
  sectorMacro: string,
  sectorName: string,
  item: StationEntry | DatavaultEntry | AbandonedShipEntry
): SavePoiOverlayItem {
  const isStation = 'tag' in item || 'is_headquarter' in item
  const owner = category === 'playerStation' ? 'player' : ('owner' in item ? item.owner : undefined)
  const isAbandonedShip = category === 'abandonedShip' && 'class' in item
  const isVault = category === 'datavault' || category === 'erlkingVault'
  return {
    key: `${category}:${item.code}`,
    code: item.code,
    category,
    owner,
    sectorMacro,
    sectorName,
    position: { x: item.position.x, y: item.position.y, z: item.position.z, tx: item.position.tx, ty: item.position.ty },
    tag: isStation && 'tag' in item ? item.tag : undefined,
    factoryGroup: isStation && 'factoryGroup' in item ? item.factoryGroup : undefined,
    productionProfile: isStation && 'productionProfile' in item ? item.productionProfile : undefined,
    profileName: isStation && 'profileName' in item ? item.profileName : undefined,
    is_headquarter: isStation && 'is_headquarter' in item ? item.is_headquarter : undefined,
    class: isAbandonedShip ? item.class : undefined,
    purpose: isAbandonedShip && 'purpose' in item ? item.purpose : undefined,
    shipId: isAbandonedShip && 'shipId' in item ? item.shipId : undefined,
    macro: isAbandonedShip ? item.macro : undefined,
    unlocked: isVault && 'unlocked' in item ? item.unlocked : undefined
  }
}

function shouldIncludePoiItem(
  category: SavePoiCategory,
  sectorMacro: string,
  sectorName: string,
  item: StationEntry | DatavaultEntry | AbandonedShipEntry,
  options?: SavePoiFilterOptions
): boolean {
  void category
  void sectorMacro
  void sectorName
  void item
  void options
  return true
}

export function deriveSavePoiCategoryData(
  archive: SaveArchive | null | undefined,
  options?: SavePoiFilterOptions
): SavePoiCategoryDataMap {
  const sectors = archive?.sectors || {}

  return {
    playerStation: createPoiCategoryData('playerStation', buildPoiGroups(sectors, (sectorMacro, sector) =>
      recordValues(sector.player_stations).filter((item) => shouldIncludePoiItem('playerStation', sectorMacro, sector.name, item, options))
    )),
    npcStation: createPoiCategoryData('npcStation', buildPoiGroups(sectors, (sectorMacro, sector) =>
      recordValues(sector.npc_stations).filter((item) => shouldIncludePoiItem('npcStation', sectorMacro, sector.name, item, options))
    )),
    xenonStation: createPoiCategoryData('xenonStation', buildPoiGroups(sectors, (sectorMacro, sector) =>
      recordValues(sector.xenon_stations).filter((item) => shouldIncludePoiItem('xenonStation', sectorMacro, sector.name, item, options))
    )),
    khaakStation: createPoiCategoryData('khaakStation', buildPoiGroups(sectors, (sectorMacro, sector) =>
      recordValues(sector.khaak_stations).filter((item) => shouldIncludePoiItem('khaakStation', sectorMacro, sector.name, item, options))
    )),
    abandonedShip: createPoiCategoryData('abandonedShip', buildPoiGroups(sectors, (_sectorMacro, sector) => recordValues(sector.abandoned_ships))),
    datavault: createPoiCategoryData('datavault', buildPoiGroups(sectors, (_sectorMacro, sector) => recordValues(sector.datavaults))),
    erlkingVault: createPoiCategoryData('erlkingVault', buildPoiGroups(sectors, (_sectorMacro, sector) => recordValues(sector.erlking_vaults)))
  }
}

function normalizeSectorData(
  sectorId: string,
  sector: SectorData
): SectorData {
  const normalized = createEmptySectorData(sector.name || sectorId)
  normalized.is_known = Boolean(sector.is_known)
  normalized.owner = sector.owner
  normalized.center = sector.center
    && typeof sector.center.x === 'number'
    && typeof sector.center.y === 'number'
    && typeof sector.center.z === 'number'
    ? sector.center
    : undefined
  normalized.scale_per_radius = typeof sector.scale_per_radius === 'number' ? sector.scale_per_radius : undefined
  normalized.clusterGates = Array.isArray(sector.clusterGates) ? sector.clusterGates : []
  normalized.superhighwayGates = Array.isArray(sector.superhighwayGates) ? sector.superhighwayGates : []
  normalized.highways = Array.isArray(sector.highways) ? sector.highways : []
  normalized.datavaults = sector.datavaults || {}
  normalized.erlking_vaults = sector.erlking_vaults || {}
  normalized.abandoned_ships = sector.abandoned_ships || {}
  normalized.player_stations = sector.player_stations || {}
  normalized.xenon_stations = sector.xenon_stations || {}
  normalized.khaak_stations = sector.khaak_stations || {}
  normalized.npc_stations = sector.npc_stations || {}
  normalized.player_buildstorages = sector.player_buildstorages || {}
  normalized.player_ships = sector.player_ships === undefined ? {} : sector.player_ships

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

function isArchiveParserVersionValidByString(parserVersion: string): boolean {
  return parserVersion === CURRENT_PARSER_VERSION
}

function upsertArchiveMeta(list: ArchiveMeta[], meta: ArchiveMeta): ArchiveMeta[] {
  const index = list.findIndex((item) => item.id === meta.id)
  if (index >= 0) {
    const next = [...list]
    next[index] = meta
    return next
  }
  return [...list, meta]
}

function removeArchiveMeta(list: ArchiveMeta[], archiveId: string): ArchiveMeta[] {
  return list.filter((item) => item.id !== archiveId)
}

function createStubArchiveFromMeta(meta: ArchiveMeta, currentVersion?: string): SaveArchive {
  const isValid = isArchiveParserVersionValidByString(meta.parser_version)
  const isCompatible = currentVersion
    ? normalizeVersion(meta.version) === normalizeVersion(currentVersion)
    : true
  return {
    meta: {
      guid: meta.guid,
      seed: 0,
      time: meta.time,
      playerName: meta.playerName,
      version: meta.version,
      filename: meta.filename,
      parser_version: meta.parser_version,
      post_processor_version: meta.post_processor_version as SaveMeta['post_processor_version'],
      source: meta.source
    },
    sectors: {},
    isCompatible,
    isValid
  }
}

function buildArchiveGroups(metaList: ArchiveMeta[], currentVersion?: string): Map<string, ArchiveGroup> {
  const groups = new Map<string, ArchiveGroup>()

  for (const meta of metaList) {
    const archive = createStubArchiveFromMeta(meta, currentVersion)
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
    archives.value = buildArchiveGroups(savedArchivesState.value.list, gameDataStore.currentVersion)
  }

  function loadData(data: SavedSaveArchivesState) {
    savedArchivesState.value = migrateSaveArchivesStateToCurrent(data)
    writeSavedState()
    rebuildArchivesFromState()
    selectedArchive.value = null
  }

  async function loadDataAndRestore(data: SavedSaveArchivesState): Promise<void> {
    savedArchivesState.value = migrateSaveArchivesStateToCurrent(data)
    writeSavedState()
    rebuildArchivesFromState()
    
    if (savedArchivesState.value.activeArchiveId) {
      await restoreSelectedArchive(savedArchivesState.value.activeArchiveId)
    } else {
      selectedArchive.value = null
    }
  }

  function updateSettings(patch: Partial<SaveArchiveSettings>) {
    savedArchivesState.value.settings = {
      ...savedArchivesState.value.settings,
      ...patch
    }
    writeSavedState()
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
      createdAt: existingCreatedAt || new Date(),
      sectorCount: Object.keys(archive.sectors).length
    }
  }

  let archiveRestoreRequestId = 0

  async function restoreSelectedArchive(archiveId: string): Promise<void> {
    const requestId = ++archiveRestoreRequestId
    const resolvedArchiveId = savedArchivesState.value.list.some((item) => item.id === archiveId)
      ? archiveId
      : getLatestArchiveMetaForGuid(savedArchivesState.value.list, archiveId)?.id || null

    if (!resolvedArchiveId) {
      if (requestId !== archiveRestoreRequestId) return
      selectedArchive.value = null
      savedArchivesState.value.activeArchiveId = null
      writeSavedState()
      return
    }

    const fullArchive = await loadArchiveDetailFromDB(gameDataStore, resolvedArchiveId)
    if (requestId !== archiveRestoreRequestId) return
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
        gameDataStore.maps,
        gameDataStore.ships,
        gameDataStore.equipments
      )
      reprocessedArchive.isCompatible = checkVersionCompatibility(reprocessedArchive.meta.version)
      reprocessedArchive.isValid = isArchiveParserVersionValid(reprocessedArchive)
      await saveArchiveToDB(gameDataStore, reprocessedArchive)
      const existingMeta = savedArchivesState.value.list.find((item) => item.id === resolvedArchiveId)
      const nextMeta = buildArchiveMeta(reprocessedArchive, existingMeta?.createdAt)
      savedArchivesState.value.list = upsertArchiveMeta(savedArchivesState.value.list, nextMeta)
      writeSavedState()
      rebuildArchivesFromState()
      if (requestId !== archiveRestoreRequestId) return
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

  const selectedArchivePlayerShips = computed<PlayerShipAvailabilityState[]>(() => {
    const archive = selectedArchive.value
    if (archive === null) return []

    return Object.entries(archive.sectors).flatMap(([sectorMacro, sector]) => {
      if (sector.player_ships === undefined) return []
      return Object.values(sector.player_ships).map((ship) => classifyPlayerShip(ship, sectorMacro))
    })
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
      
      // Check if restored archive is valid
      const restoredArchive = selectedArchive.value
      if (restoredArchive && !isArchiveParserVersionValid(restoredArchive)) {
        selectedArchive.value = null
        savedArchivesState.value.activeArchiveId = null
        writeSavedState()
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

  async function addArchive(archive: SaveArchive): Promise<void> {
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

    try {
      await saveArchiveToDB(gameDataStore, archive)
    } catch (error) {
      console.error('[saveStore] failed to persist archive:', error)
    }

    selectedArchive.value = archive
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

  async function selectArchiveGroup(guid: string): Promise<void> {
    const latestMeta = getLatestArchiveMetaForGuid(savedArchivesState.value.list, guid)
    if (!latestMeta) {
      selectedArchive.value = null
      return
    }

    savedArchivesState.value.activeArchiveId = guid
    writeSavedState()
    await restoreSelectedArchive(guid)
  }

  async function previewArchive(guid: string, time: number): Promise<void> {
    const archiveId = createArchiveId(guid, time)
    const exists = savedArchivesState.value.list.some((item) => item.id === archiveId)
    if (!exists) {
      selectedArchive.value = null
      return
    }

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
    } else if (savedArchivesState.value.activeArchiveId === guid) {
      const remaining = savedArchivesState.value.list.filter((item) => item.id !== archiveId && item.guid === guid)
      savedArchivesState.value.activeArchiveId = remaining.length > 0 ? guid : null
    }
    if (selectedArchive.value?.meta.guid === guid && selectedArchive.value?.meta.time === time) {
      selectedArchive.value = null
    }
    writeSavedState()
    rebuildArchivesFromState()

    removeArchiveFromDB(gameDataStore, archiveId).catch(error => {
      console.error('[saveStore] failed to remove archive from DB:', error)
    })
  }

  function clearAll(): void {
    const settings = savedArchivesState.value.settings
    savedArchivesState.value = createEmptySaveArchivesState()
    savedArchivesState.value.settings = settings
    archives.value.clear()
    selectedArchive.value = null
    parseError.value = null
    parseProgress.value = ''
    isParsing.value = false
    writeSavedState()

    clearArchivesFromDB(gameDataStore).catch(error => {
      console.error('[saveStore] failed to clear DB:', error)
    })
  }

  async function exportToJson(guid: string, time: number): Promise<void> {
    const archiveId = createArchiveId(guid, time)
    let archive = await loadArchiveDetailFromDB(gameDataStore, archiveId)

    if (!archive) {
      const group = archives.value.get(guid)
      if (!group) return
      archive = group.saves.find(s => s.meta.time === time) || null
    }

    if (!archive) return

    const needsReprocess = archive.meta.post_processor_version !== CURRENT_POST_PROCESSOR_VERSION
      || !hasValidPosition(archive)

    if (needsReprocess) {
      archive = postProcessRustSaveArchive(
        archive,
        gameDataStore.modulesByMacroId,
        gameDataStore.maps,
        gameDataStore.ships,
        gameDataStore.equipments
      )
    }

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

  function hasValidPosition(archive: SaveArchive): boolean {
    for (const sector of Object.values(archive.sectors)) {
      for (const station of Object.values(sector.player_stations || {})) {
        if (station.relative_position && !station.position) {
          return false
        }
      }
    }
    return true
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
          parser_version: CURRENT_PARSER_VERSION,
          post_processor_version: meta.post_processor_version === CURRENT_POST_PROCESSOR_VERSION
            ? CURRENT_POST_PROCESSOR_VERSION
            : undefined,
          source: 'imported'
        },
        sectors,
        isCompatible: true,
        isValid: true
      }

      const finalArchive = archive.meta.post_processor_version === CURRENT_POST_PROCESSOR_VERSION
        ? archive
        : postProcessRustSaveArchive(archive, gameDataStore.modulesByMacroId, gameDataStore.maps, gameDataStore.ships, gameDataStore.equipments)

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

  function getArchivePoiCategories(
    archive: SaveArchive | null | undefined,
    options?: SavePoiFilterOptions
  ): SavePoiCategoryDataMap {
    return deriveSavePoiCategoryData(archive, options)
  }

  function getArchivePoiOverlays(
    archive: SaveArchive | null | undefined,
    categories: SavePoiCategory[] = SAVE_POI_CATEGORIES,
    options?: SavePoiFilterOptions
  ): SavePoiOverlayItem[] {
    return flattenSavePoiCategoryData(getArchivePoiCategories(archive, options), categories)
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
    selectedArchivePlayerShips,
    isInitialized,
    initialize,
    checkVersionCompatibility,
    addArchive,
    selectArchive,
    selectArchiveGroup,
    previewArchive,
    clearSelection,
    removeArchive,
    clearAll,
    exportToJson,
    importFromJson,
    setParsingState,
    updateSettings,
    getArchivePoiCategories,
    getArchivePoiOverlays,
    loadData,
    loadDataAndRestore,
    restoreSelectedArchive
  }
})

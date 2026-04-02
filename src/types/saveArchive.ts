export type SaveSource = 'original' | 'imported'

export interface VersionMismatchError {
  type: 'version_mismatch'
  save_version: string
  save_version_normalized: string
  expected_version: string
  expected_version_normalized: string
}

export interface ParseError {
  type: 'parse_error'
  message: string
}

export type SaveParserErrorDetail = VersionMismatchError | ParseError

export interface ProgressInfo {
  phase: 'receiving' | 'parsing' | 'finalizing' | 'done' | 'error'
  inputBytesTotal: number
  parsedBytesTotal: number
  bufferedBytes: number
  expectedTotalBytes: number
  percent: number
  tagCount: number
  sectorCount: number
  done: boolean
  inputComplete: boolean
  error: string | null
  errorDetail?: SaveParserError
  version?: string
  versionMismatch?: boolean
}

export interface SaveMeta {
  guid: string
  seed: number
  time: number
  playerName: string
  version: string
  filename: string
  parser_version: 'v1' | 'v2'
  source: SaveSource
}

export interface StationEquipment {
  type: 'shields' | 'turrets'
  ref: string
  group: string
  exact: number
}

export interface PlayerStationModule {
  index: number
  ref: string
  equipments?: StationEquipment[]
}

export interface AggregatedStationModule {
  ref: string
  amount: number
}

export interface StationBaseEntry {
  code: string
  macro: string
  owner: string
  x: number
  y: number
  z: number
  is_wreck?: boolean
  is_headquarter?: boolean
}

export interface PlayerStationEntry extends StationBaseEntry {
  modules?: PlayerStationModule[]
}

export interface NpcStationEntry extends StationBaseEntry {
  modules?: AggregatedStationModule[]
  isShipyard?: boolean
  isWharf?: boolean
  isEquipmentdock?: boolean
  isTradestation?: boolean
  isNest?: boolean
  isHive?: boolean
}

export interface FactionStationEntry extends StationBaseEntry {
  modules?: AggregatedStationModule[]
  isShipyard?: boolean
  isWharf?: boolean
  isEquipmentdock?: boolean
  isTradestation?: boolean
  isNest?: boolean
  isHive?: boolean
}

export type StationEntry = PlayerStationEntry | NpcStationEntry | FactionStationEntry

export interface DatavaultWareEntry {
  ware: string
  amount: number
}

export interface DatavaultEntry {
  code: string
  macro: string
  owner: string
  x: number
  y: number
  z: number
  unlocked: boolean
  wares?: DatavaultWareEntry[]
  has_blueprints?: boolean
  has_wares?: boolean
  has_signalleak?: boolean
}

export interface AbandonedShipEntry {
  code: string
  macro: string
  class: string
  x: number
  y: number
  z: number
}

export interface SectorData {
  name: string
  is_known: boolean
  owner?: string
  playerStations?: PlayerStationEntry[]
  xenonStations?: FactionStationEntry[]
  khaakStations?: FactionStationEntry[]
  npcStations?: NpcStationEntry[]
  datavaults?: DatavaultEntry[]
  erlkingVaults?: DatavaultEntry[]
  abandonedShips?: AbandonedShipEntry[]
}

export interface SaveArchive {
  meta: SaveMeta
  sectors: Record<string, SectorData>
  isCompatible: boolean
}

export type SavePoiCategory = 'playerStation' | 'npcStation' | 'abandonedShip' | 'datavault' | 'erlkingVault'

export type SavePoiVisibility = Record<SavePoiCategory, boolean>

export interface SavePoiOverlayItem {
  key: string
  code: string
  category: SavePoiCategory
  owner?: string
  sectorMacro: string
  sectorName: string
  pos: { x: number; z: number }
}

export interface SavePoiSectorGroup<T> {
  sectorMacro: string
  sectorName: string
  items: T[]
}

export interface SavePoiCategoryData<T> {
  key: SavePoiCategory
  count: number
  groups: SavePoiSectorGroup<T>[]
}

export interface SavePoiCategoryDataMap {
  playerStation: SavePoiCategoryData<StationEntry>
  npcStation: SavePoiCategoryData<StationEntry>
  abandonedShip: SavePoiCategoryData<AbandonedShipEntry>
  datavault: SavePoiCategoryData<DatavaultEntry>
  erlkingVault: SavePoiCategoryData<DatavaultEntry>
}

export interface ArchiveGroup {
  guid: string
  playerName: string
  saves: SaveArchive[]
}

export type SaveParserProgress = {
  type: 'progress'
  status: string
}

export type SaveParserRustProgress = {
  type: 'progress'
  data: ProgressInfo
}

export type SaveParserComplete = {
  type: 'complete'
  data: SaveArchive
}

export type SaveParserError = {
  type: 'error'
  message: string
  detail?: SaveParserErrorDetail
}

export type SaveParserRustMessage = SaveParserRustProgress | SaveParserComplete | SaveParserError

export type SaveParserMessage = SaveParserProgress | SaveParserRustProgress | SaveParserComplete | SaveParserError

export interface SaveParserConfig {
  sectorNames: Record<string, string>
  shipNames: Record<string, string>
  positions: Record<string, { x: number; y: number; z: number }>
  strings: Record<string, Record<string, string>>
  currentVersion: string
  filename?: string
}

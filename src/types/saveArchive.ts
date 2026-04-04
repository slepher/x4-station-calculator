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
  post_processor_version?: 'v1' | 'v2' | 'v3' | 'v4'
  source: SaveSource
}

export interface SaveSectorStaticPosition {
  x: number
  y: number
  z: number
  tx?: number
  ty?: number
}

export interface SaveSectorClusterGateEntry {
  id: string
  target_cluster_id?: string
  position: SaveSectorStaticPosition
}

export interface SaveSectorSuperhighwayGateEntry {
  id: string
  link_id: string
  zone_id: string
  target_sector_id?: string
  position: SaveSectorStaticPosition
}

export interface SaveSectorHighwayEntry {
  id: string
  entry: SaveSectorStaticPosition
  exit: SaveSectorStaticPosition
  spline?: SaveSectorStaticPosition[]
}

export interface StationEquipment {
  type: 'shields' | 'turrets'
  ref: string
  group: string
  exact: number
}

export interface PlayerStationConstruction {
  index: number
  ref: string
  predecessor?: number
  equipments?: StationEquipment[]
}

export interface AggregatedStationModule {
  ref: string
  amount: number
  module_id?: string
  type?: string
  group?: string
}

export interface AggregatedEquipment {
  type: 'shields' | 'turrets'
  ref: string
  amount: number
}

export interface StationBaseEntry {
  code: string
  macro: string
  owner: string
  relative_position: { x: number; y: number; z: number }
  zone_id?: string
  position: SaveSectorStaticPosition
  is_wreck?: boolean
  is_headquarter?: boolean
  tag?: string
}

export interface PlayerStationEntry extends StationBaseEntry {
  constructions?: PlayerStationConstruction[]
  modules?: AggregatedStationModule[]
  equipments?: AggregatedEquipment[]
  isShipyard?: boolean
  isWharf?: boolean
  isEquipmentdock?: boolean
  isFactory?: boolean
  factoryGroup?: string
  isPiratebase?: boolean
  isDefencemodule?: boolean
}

export interface NpcStationEntry extends StationBaseEntry {
  modules?: AggregatedStationModule[]
  equipments?: AggregatedEquipment[]
  isShipyard?: boolean
  isWharf?: boolean
  isEquipmentdock?: boolean
  isTradestation?: boolean
  isFactory?: boolean
  factoryGroup?: string
  isPiratebase?: boolean
  isDefencemodule?: boolean
  isNest?: boolean
  isHive?: boolean
}

export interface FactionStationEntry extends StationBaseEntry {
  modules?: AggregatedStationModule[]
  equipments?: AggregatedEquipment[]
  isShipyard?: boolean
  isWharf?: boolean
  isEquipmentdock?: boolean
  isTradestation?: boolean
  isFactory?: boolean
  factoryGroup?: string
  isPiratebase?: boolean
  isDefencemodule?: boolean
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
  relative_position: { x: number; y: number; z: number }
  zone_id?: string
  position: SaveSectorStaticPosition
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
  relative_position: { x: number; y: number; z: number }
  zone_id?: string
  position: SaveSectorStaticPosition
}

export interface SectorData {
  name: string
  is_known: boolean
  owner?: string
  scale_per_radius?: number
  clusterGates?: SaveSectorClusterGateEntry[]
  superhighwayGates?: SaveSectorSuperhighwayGateEntry[]
  highways?: SaveSectorHighwayEntry[]
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
  isValid: boolean
}

export interface ArchiveMeta {
  id: string
  guid: string
  time: number
  playerName: string
  version: string
  filename: string
  parser_version: string
  post_processor_version?: string
  source: SaveSource
  isCompatible: boolean
  isValid: boolean
  createdAt: Date
  sectorCount: number
}

export interface SavedSaveArchivesState {
  version: number
  activeArchiveId: string | null
  list: ArchiveMeta[]
}

export type SavePoiCategory = 'playerStation' | 'npcStation' | 'xenonStation' | 'khaakStation' | 'abandonedShip' | 'datavault' | 'erlkingVault'

export type SavePoiVisibility = Record<SavePoiCategory, boolean>

export interface SavePoiOverlayItem {
  key: string
  code: string
  category: SavePoiCategory
  owner?: string
  sectorMacro: string
  sectorName: string
  position: SaveSectorStaticPosition
  tag?: string
  factoryGroup?: string
  is_headquarter?: boolean
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
  xenonStation: SavePoiCategoryData<StationEntry>
  khaakStation: SavePoiCategoryData<StationEntry>
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

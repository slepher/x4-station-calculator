import type { SavedModule } from './x4'

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
  expectedTotalSectors?: number
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
  parser_version: string
  post_processor_version?: string
  source: SaveSource
}

export interface SaveSectorStaticPosition {
  x: number
  y: number
  z: number
  tx?: number
  ty?: number
}

export interface SaveSectorCenter {
  x: number
  y: number
  z: number
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
  equipment_id?: string
}

export interface PlayerStationConstruction {
  id?: string
  index: number
  ref: string
  predecessor?: number
  equipments?: StationEquipment[]
}

export interface WareAmount {
  ware: string
  amount: number
}

export interface StationTradeOverrides {
  max?: WareAmount[]
  buy?: WareAmount[]
  sell?: WareAmount[]
}

export interface WorkforceEntry {
  race: string
  amount: number
}

export interface BuildProgress {
  start?: number
  end?: number
  sequenceindex?: number
}

export interface BuildStorageEntry {
  component_id: string
  code: string
  owner: string
  relative_position: { x: number; y: number; z: number }
  zone_id?: string
  cargo?: WareAmount[]
  reservation?: WareAmount[]
  station_code?: string
  target_station_component_id?: string
  constructions?: PlayerStationConstruction[]
  modules?: AggregatedStationModule[]
  equipments?: AggregatedEquipment[]
  progress?: BuildProgress
}

export interface AggregatedStationModule {
  ref: string
  amount: number
  module_id?: string
  type?: string
  group?: string
}

export type NpcProductionProfile = string

export interface AggregatedEquipment {
  type: 'shields' | 'turrets'
  ref: string
  amount: number
  equipment_id?: string
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
  component_id?: string
  constructions?: PlayerStationConstruction[]
  modules?: AggregatedStationModule[]
  equipments?: AggregatedEquipment[]
  cargo?: WareAmount[]
  reservation?: WareAmount[]
  overrides?: StationTradeOverrides
  buildstorage_code?: string
  workforces?: WorkforceEntry[]
  isShipyard?: boolean
  isWharf?: boolean
  isEquipmentdock?: boolean
  isFactory?: boolean
  factoryGroup?: string
  productionProfile?: NpcProductionProfile
  profileName?: string
  isPiratebase?: boolean
  isDefencemodule?: boolean
}

export interface NpcStationEntry extends StationBaseEntry {
  modules?: AggregatedStationModule[]
  equipments?: AggregatedEquipment[]
  tradeOffers?: NpcTradeOffer[]
  isShipyard?: boolean
  isWharf?: boolean
  isEquipmentdock?: boolean
  isTradestation?: boolean
  isFactory?: boolean
  factoryGroup?: string
  productionProfile?: NpcProductionProfile
  profileName?: string
  isPiratebase?: boolean
  isDefencemodule?: boolean
  isNest?: boolean
  isHive?: boolean
}

export interface NpcTradeOffer {
  ware: string
  side: 'buy' | 'sell'
  price: number
  amount: number
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
  shipId?: string
  purpose?: string
  relative_position: { x: number; y: number; z: number }
  zone_id?: string
  position: SaveSectorStaticPosition
}

export type CodeMap<T> = Record<string, T>

export type PlayerStationType = 'station' | 'buildstorage'

export interface PlayerStationRecord {
  id: string
  archiveId: string
  sectorMacro: string
  code: string
  type: PlayerStationType
  data: PlayerStationEntry | BuildStorageEntry
}

export interface SaveResearchRuntime {
  visibleIds: string[]
  completedIds: string[]
  activeId: string | null
}

export interface SaveTerraformingRebateAmount {
  ware?: string
  wareGroup?: string
  amount: number
}

export interface SaveTerraformingEventProgress {
  eventId: string
  completedCount: number
  startTime?: number
}

export interface SaveTerraformingProjectProgress {
  projectId: string
  aborted?: boolean
  scaledResources: WareAmount[]
  submittedResources: WareAmount[]
  inTransitResources?: WareAmount[]
  inTransitShipBatches?: number
}

export interface SaveTerraformingCompletedProject {
  projectId: string
  completedCount: number
  startTime?: number
}

export interface SaveTerraformingCluster {
  clusterId: string
  part: string
  seed: string
  missionCue?: string
  missionComplete: boolean
  stats: Record<string, number>
  rebates: SaveTerraformingRebateAmount[]
  activeProject?: SaveTerraformingProjectProgress
  completedProjects: SaveTerraformingCompletedProject[]
  retainedProjects: SaveTerraformingProjectProgress[]
  events: SaveTerraformingEventProgress[]
}

export interface PlayerStationsRecord {
  id: string
  archiveId: string
  guid: string
  data: {
    player_stations: Record<string, Record<string, PlayerStationEntry>>
    player_buildstorages: Record<string, Record<string, BuildStorageEntry>>
    research: SaveResearchRuntime
    terraforming_clusters: Record<string, SaveTerraformingCluster>
    player_blueprints: string[]
    player_relations: Record<string, number>
    player_licences: Record<string, string[]>
  }
}

export interface ArchiveDataRecord {
  id: string
  archiveId: string
  guid: string
  data: SaveArchive
}

export interface SectorData {
  name: string
  is_known: boolean
  owner?: string
  center?: SaveSectorCenter
  scale_per_radius?: number
  clusterGates?: SaveSectorClusterGateEntry[]
  superhighwayGates?: SaveSectorSuperhighwayGateEntry[]
  highways?: SaveSectorHighwayEntry[]
  player_stations?: CodeMap<PlayerStationEntry>
  xenon_stations?: CodeMap<FactionStationEntry>
  khaak_stations?: CodeMap<FactionStationEntry>
  npc_stations?: CodeMap<NpcStationEntry>
  player_buildstorages?: CodeMap<BuildStorageEntry>
  datavaults?: CodeMap<DatavaultEntry>
  erlking_vaults?: CodeMap<DatavaultEntry>
  abandoned_ships?: CodeMap<AbandonedShipEntry>
}

export interface SaveArchive {
  meta: SaveMeta
  sectors: Record<string, SectorData>
  isCompatible: boolean
  isValid: boolean
  research?: SaveResearchRuntime
  terraforming_clusters?: Record<string, SaveTerraformingCluster>
  playerBlueprints?: string[]
  playerRelations?: Record<string, number>
  playerLicences?: Record<string, string[]>
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
  createdAt: Date
  sectorCount: number
}

export interface SavedSaveArchivesState {
  version: number
  activeArchiveId: string | null
  list: ArchiveMeta[]
  settings: SaveArchiveSettings
}

export type SavePoiCategory = 'playerStation' | 'npcStation' | 'xenonStation' | 'khaakStation' | 'abandonedShip' | 'datavault' | 'erlkingVault'

export type SavePoiVisibility = Record<SavePoiCategory, boolean>

export interface SaveArchiveSettings {
  visibility: SavePoiVisibility
}

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
  productionProfile?: string
  profileName?: string
  is_headquarter?: boolean
  class?: string
  purpose?: string
  shipId?: string
  macro?: string
  unlocked?: boolean
  largeIconFreezeBelowScale?: number
  largeIconBaseSize?: number
  visualColorOverride?: string
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

export interface ArchiveStationSectorData {
  name: string
  nameId?: string
  resources: string[]
  sunlight: number
}

export interface ArchiveStationBuildingData {
  modules: SavedModule[]
  cargo: WareAmount[]
  reservation: WareAmount[]
  inProgressModule?: SavedModule
}

export interface ArchiveStationPosition {
  x: number
  y: number
  z: number
}

export interface ArchiveStationData {
  code: string
  name?: string
  sectorMacro: string
  sector: ArchiveStationSectorData
  position?: ArchiveStationPosition
  modules: SavedModule[]
  building: ArchiveStationBuildingData
  cargo?: WareAmount[]
  reservation?: WareAmount[]
  overrides?: StationTradeOverrides
  targetCounts?: WareAmount[]
  workforces?: WorkforceEntry[]
  tag?: string
  factoryGroup?: string
  productionProfile?: string
  profileName?: string
}

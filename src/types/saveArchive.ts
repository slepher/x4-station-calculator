export type SaveSource = 'original' | 'imported'

export interface SaveMeta {
  guid: string
  seed: number
  time: number
  playerName: string
  version: string
  filename: string
  parser_version: 'v1'
  source: SaveSource
}

export interface StationEquipment {
  type: 'shields' | 'turrets'
  ref: string
  group: string
  exact: number
}

export interface StationModule {
  index: number
  ref: string
  equipments?: StationEquipment[]
}

export interface StationEntry {
  code: string
  macro: string
  owner: string
  x: number
  y: number
  z: number
  is_wreck?: boolean
  is_headquarter?: boolean
  modules?: StationModule[]
}

export interface DatavaultEntry {
  code: string
  macro: string
  owner: string
  x: number
  y: number
  z: number
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
  stations: StationEntry[]
  datavaults: DatavaultEntry[]
  erlkingVaults: DatavaultEntry[]
  abandonedShips: AbandonedShipEntry[]
}

export interface SaveArchive {
  meta: SaveMeta
  sectors: Record<string, SectorData>
  isCompatible: boolean
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

export type SaveParserComplete = {
  type: 'complete'
  data: SaveArchive
}

export type SaveParserError = {
  type: 'error'
  message: string
}

export type SaveParserMessage = SaveParserProgress | SaveParserComplete | SaveParserError

export interface SaveParserConfig {
  sectorNames: Record<string, string>
  shipNames: Record<string, string>
  positions: Record<string, { x: number; y: number; z: number }>
  strings: Record<string, Record<string, string>>
  currentVersion: string
  filename?: string
}

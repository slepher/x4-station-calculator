import type { SavePoiCategory, SavePoiOverlayItem } from '@/types/saveArchive'

export type Vec2 = { x: number; y: number }
export type Ratio = { x: number; y: number }

export type LayoutConfig = {
  width: number
  height: number
  padX: number
  padY: number
  topPad: number
}

export type FitState = {
  minX: number
  minY: number
  scale: number
  offsetX: number
  offsetY: number
}

export type HighwayPoint = { x?: number; z?: number; sx?: number; sy?: number }
export type Highway = {
  entry?: HighwayPoint
  exit?: HighwayPoint
  spline?: HighwayPoint[]
  entry_pos?: { x?: number; z?: number }
  exit_pos?: { x?: number; z?: number }
}
export type Gate = {
  id?: string
  target_cluster_id?: string
  raw_local_pos?: { x?: number; z?: number; sx?: number; sy?: number }
}
export type Zone = {
  raw_sector_pos?: { x?: number; y?: number; z?: number; sx?: number; sy?: number }
}

export type SectorLink = {
  id: string
  sector_a_id?: string
  sector_b_id?: string
  from_zone_id?: string
  to_zone_id?: string
  render?: { lane_count?: number; lane_index?: number }
}

export type SectorResourceEntry = {
  ware: string
  yield?: string
  level?: number
}

export type Sector = {
  id: string
  macro?: string
  cluster_id?: string
  nameId?: string
  name?: string
  owner?: string
  owner_color?: string
  area?: {
    sunlight?: number
  }
  raw_center_pos?: { x: number; y: number; z: number }
  resources?: SectorResourceEntry[]
  normalized?: {
    center_offset_ratio?: Ratio
    sector_radius_ratio?: number
    scale_per_radius?: number
  }
  zones?: Record<string, Zone>
  highways?: Record<string, Highway>
  cluster_gates?: Record<string, Gate>
  has_khaak_hive?: boolean
  khaak_hive_sources?: string[]
}

export type Cluster = {
  id: string
  nameId?: string
  name?: string
  owner?: string
  owner_color?: string
  dlc_tag?: string
  normalized?: { pixel_basis?: Vec2 }
  sectors?: string[]
  sector_links?: Record<string, SectorLink>
}

export type SearchSectorLayout = {
  sectorId: string
  clusterId: string
  name: string
  displayName: string
  centerX: number
  centerY: number
  radius: number
  verticalExtent: number
}

export type SectorResourceColorSlice = {
  ware: string
  color: string
  share: number
}

export type SectorResourceFill =
  | {
      mode: 'solid'
      ware: string
      color: string
    }
  | {
      mode: 'pie'
      slices: SectorResourceColorSlice[]
    }

export type PlacementLocation = {
  cluster_id: string
  sector_id: string
  pos: {
    x: number
    z: number
  }
}

export type PlacementOverlay = {
  key: string
  id: string
  kind: 'station' | 'sector'
  name: string
  icon: 'factory' | 'shipyard' | 'tradestation'
  location: PlacementLocation
  localRatio?: Ratio
  draggable?: boolean
  savePoiVisual?: SavePoiOverlayItem
}

export type PlacementPreview = {
  kind: 'station' | 'sector'
  name: string
  icon: 'factory' | 'shipyard' | 'tradestation'
  location: PlacementLocation
  localRatio?: Ratio
  savePoiVisual?: SavePoiOverlayItem
}

export type SavePoiColorMap = Record<SavePoiCategory, string>

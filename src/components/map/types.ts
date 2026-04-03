import type { SavePoiCategory } from '@/types/saveArchive'

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

export type HighwayPoint = { sx?: number; sy?: number }
export type Highway = { entry?: HighwayPoint; exit?: HighwayPoint; spline?: HighwayPoint[] }
export type Gate = { id?: string; target_cluster_id?: string; raw_local_pos?: { sx?: number; sy?: number } }
export type Zone = { raw_sector_pos?: { sx?: number; sy?: number } }

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
  nameId?: string
  name?: string
  owner?: string
  owner_color?: string
  area?: {
    sunlight?: number
  }
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
  sectors?: Record<string, Sector>
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
}

export type PlacementPreview = {
  kind: 'station' | 'sector'
  name: string
  icon: 'factory' | 'shipyard' | 'tradestation'
  location: PlacementLocation
}

export type SavePoiColorMap = Record<SavePoiCategory, string>

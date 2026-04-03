import { computed, type ComputedRef, type Ref } from 'vue'
import { getSectorViewportTransform } from '@/components/map/utils/coordinates'
import type { Cluster, SearchSectorLayout, SectorResourceEntry, SectorResourceFill } from '@/components/map/types'
import type { MapSvgLayoutState } from './useMapSvgLayout'

const SQRT3 = Math.sqrt(3)
const HEX_TOP_EDGE_RATIO = SQRT3 / 2
const SECTOR_LABEL_FONT_SIZE = 14
const SINGLE_SECTOR_LABEL_FONT_SIZE = 18
const MIN_SECTOR_LABEL_FONT_SIZE = 8
const MULTI_SECTOR_LABEL_PAD_RATIO = 0.03
const MULTI_SECTOR_LABEL_PAD_MIN_PX = 2

type SectorVisualState = 'default' | 'selected' | 'search' | 'resource'

export type MapSectorBadgeGeometry = {
  key: string
  label: string
  x: number
  y: number
  width: number
  height: number
}

export type MapSectorPieSlice = {
  ware: string
  color: string
  path: string
}

export type MapSectorPolygonCluster = {
  id: string
  cx: number
  cy: number
  color: string
  clusterRadius: number
  isDlcActive?: boolean
  sectors: Array<{
    id: string
    clusterId: string
    name: string
    displayName: string
    owner: string
    sunlight: number
    resources: SectorResourceEntry[]
    sx: number
    sy: number
    radius: number
    color: string
    label: string
    labelY: number
    labelFontSize: number
    hasKhaakHive: boolean
    khaakHiveSources: string[]
  }>
  singleLabel?: string
  singleRadius?: number
  singleLabelY?: number
  singleLabelFontSize?: number
}

const polarToCartesian = (cx: number, cy: number, radius: number, angleDeg: number) => {
  const angleRad = (Math.PI / 180) * angleDeg
  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad)
  }
}

const describePieSlicePath = (cx: number, cy: number, radius: number, startAngle: number, sweepAngle: number) => {
  const start = polarToCartesian(cx, cy, radius, startAngle)
  const end = polarToCartesian(cx, cy, radius, startAngle + sweepAngle)
  const largeArcFlag = sweepAngle > 180 ? 1 : 0
  return [
    `M ${cx.toFixed(1)} ${cy.toFixed(1)}`,
    `L ${start.x.toFixed(1)} ${start.y.toFixed(1)}`,
    `A ${radius.toFixed(1)} ${radius.toFixed(1)} 0 ${largeArcFlag} 1 ${end.x.toFixed(1)} ${end.y.toFixed(1)}`,
    'Z'
  ].join(' ')
}

export function useMapSvgSectors(args: {
  gameData: {
    isDlcActive: (tag?: string) => boolean
  }
  clusters: ComputedRef<Record<string, Cluster>>
  regionIds: ComputedRef<string[]>
  layoutState: ComputedRef<MapSvgLayoutState>
  searchHighlightedSectorIds: Ref<string[]>
  resourceHighlightedSectorIds: Ref<string[]>
  resourceSectorFills: Ref<Record<string, SectorResourceFill>>
  resourceSectorGroupBadges: Ref<Record<string, string[]>>
  resourceFillColorOverride: Ref<string | null | undefined>
  selectedSectorId: Ref<string | null | undefined>
  resolveName: (nameId?: string, fallback?: string) => string
  resolveOwnerColor: (node: { owner_color?: string }, sectorId?: string, clusterId?: string) => string
}) {
  const searchHighlightedSectorIdSet = computed(() => new Set(args.searchHighlightedSectorIds.value || []))
  const resourceHighlightedSectorIdSet = computed(() => new Set(args.resourceHighlightedSectorIds.value || []))
  const isSelectedSector = (sectorId: string) => args.selectedSectorId.value === sectorId
  const isResourceFilterActive = computed(() =>
    Object.keys(args.resourceSectorFills.value || {}).length > 0 ||
    resourceHighlightedSectorIdSet.value.size > 0 ||
    Boolean(args.resourceFillColorOverride.value)
  )

  const getSectorVisualState = (sectorId: string): SectorVisualState => {
    if (isSelectedSector(sectorId)) return 'selected'
    if (searchHighlightedSectorIdSet.value.has(sectorId)) return 'search'
    if (resourceHighlightedSectorIdSet.value.has(sectorId)) return 'resource'
    return 'default'
  }

  const shouldRenderResourceOverlay = (sectorId: string) => {
    const state = getSectorVisualState(sectorId)
    return state === 'resource' || state === 'selected'
  }

  const getResourceFill = (sectorId: string) => args.resourceSectorFills.value?.[sectorId] || null
  const getResourceGroupBadges = (sectorId: string) => args.resourceSectorGroupBadges.value?.[sectorId] || []
  const hasPieFill = (sectorId: string) => getResourceFill(sectorId)?.mode === 'pie'

  const sectorFillOpacity = (sectorId: string) => {
    const state = getSectorVisualState(sectorId)
    if (isResourceFilterActive.value && state === 'default') return 0
    if (hasPieFill(sectorId) && (state === 'resource' || state === 'selected')) return 0
    if (state === 'selected') return 0.28
    if (state === 'search') return 0.18
    if (state === 'resource') return 0.15
    return 0.08
  }

  const sectorStrokeWidth = (sectorId: string, defaultValue: number) => {
    const state = getSectorVisualState(sectorId)
    if (state === 'selected') return defaultValue + 0.9
    if (state === 'search') return defaultValue + 0.45
    if (state === 'resource') return defaultValue + 0.25
    return defaultValue
  }

  const sectorStrokeOpacity = (sectorId: string, defaultValue: number) => {
    const state = getSectorVisualState(sectorId)
    if (state === 'selected') return 1
    if (state === 'search') return Math.min(1, defaultValue + 0.08)
    if (state === 'resource') return Math.min(1, defaultValue + 0.03)
    return defaultValue
  }

  const sectorLabelFill = (sectorId: string) => {
    const state = getSectorVisualState(sectorId)
    if (state === 'selected' || state === 'search') return '#fef3c7'
    if (state === 'resource') return '#fce7f3'
    return '#f8fafc'
  }

  const sectorLabelWeight = (sectorId: string) => getSectorVisualState(sectorId) === 'default' ? 500 : 700

  const sectorFilter = (sectorId: string) => {
    if (isSelectedSector(sectorId)) return 'selected'
    if (searchHighlightedSectorIdSet.value.has(sectorId)) return 'search'
    if (resourceHighlightedSectorIdSet.value.has(sectorId)) return 'resource'
    return undefined
  }

  const sectorFillColor = (sectorId: string, defaultColor: string) => {
    if (!isResourceFilterActive.value) return defaultColor
    const fill = getResourceFill(sectorId)
    if (fill?.mode === 'solid' && resourceHighlightedSectorIdSet.value.has(sectorId)) return fill.color
    if (fill?.mode === 'pie' && resourceHighlightedSectorIdSet.value.has(sectorId)) return 'transparent'
    if (resourceHighlightedSectorIdSet.value.has(sectorId)) return args.resourceFillColorOverride.value || defaultColor
    return 'transparent'
  }

  const sectorStrokeColor = (sectorId: string, defaultColor: string) => {
    if (!isResourceFilterActive.value) return defaultColor
    if (resourceHighlightedSectorIdSet.value.has(sectorId)) return args.resourceFillColorOverride.value || defaultColor
    return defaultColor
  }

  const buildPieSliceGeometries = (sectorId: string, cx: number, cy: number, radius: number): MapSectorPieSlice[] => {
    const fill = getResourceFill(sectorId)
    if (!fill || fill.mode !== 'pie' || !shouldRenderResourceOverlay(sectorId)) return []
    let startAngle = -90
    return fill.slices.map((slice, index) => {
      const sweepAngle = index === fill.slices.length - 1
        ? 360 - (startAngle + 90)
        : Math.max(0, Math.min(360, slice.share * 360))
      const path = describePieSlicePath(cx, cy, radius, startAngle, sweepAngle)
      startAngle += sweepAngle
      return { ware: slice.ware, color: slice.color, path }
    })
  }

  const buildResourceGroupBadgeGeometries = (sectorId: string, cx: number, cy: number, radius: number): MapSectorBadgeGeometry[] => {
    if (!shouldRenderResourceOverlay(sectorId)) return []
    const badges = getResourceGroupBadges(sectorId)
    if (!badges.length) return []
    const badgeWidth = Math.max(12, radius * 0.32)
    const badgeHeight = Math.max(12, radius * 0.24)
    const gap = Math.max(4, radius * 0.1)
    const totalWidth = badges.length * badgeWidth + Math.max(0, badges.length - 1) * gap
    const startX = cx - totalWidth / 2
    const y = cy + radius * 0.52
    return badges.map((label, index) => ({
      key: `${sectorId}-${label}-${index}`,
      label,
      x: startX + index * (badgeWidth + gap),
      y,
      width: badgeWidth,
      height: badgeHeight
    }))
  }

  const clusterPolygons = computed<MapSectorPolygonCluster[]>(() => {
    const rows: MapSectorPolygonCluster[] = []
    const { centers, clusterRadius } = args.layoutState.value

    args.regionIds.value.forEach((clusterId) => {
      const cluster = args.clusters.value[clusterId]
      const center = centers[clusterId]
      if (!cluster || !center) return

      const color = args.resolveOwnerColor(cluster, undefined, clusterId)
      const clusterDlcActive = args.gameData.isDlcActive(cluster.dlc_tag)
      const sectors: MapSectorPolygonCluster['sectors'] = []

      Object.values(cluster.sectors || {}).forEach((sector) => {
        const transform = getSectorViewportTransform(cluster, center, clusterRadius, sector)
        const sectorRadiusRatio = Number(sector.normalized?.sector_radius_ratio || 0)
        const topEdgeY = transform.center.y - transform.sectorRadius * HEX_TOP_EDGE_RATIO
        const pad = Math.max(MULTI_SECTOR_LABEL_PAD_MIN_PX, transform.sectorRadius * MULTI_SECTOR_LABEL_PAD_RATIO)
        const displayName = args.resolveName(sector.nameId, sector.name || sector.id)
        sectors.push({
          id: sector.id,
          clusterId,
          name: sector.name || sector.id,
          displayName,
          owner: sector.owner || cluster.owner || 'ownerless',
          sunlight: Math.round(Number(sector.area?.sunlight || 0) * 100),
          resources: Array.isArray((sector as { resources?: SectorResourceEntry[] }).resources)
            ? (sector as { resources?: SectorResourceEntry[] }).resources || []
            : [],
          sx: transform.center.x,
          sy: transform.center.y,
          radius: transform.sectorRadius,
          color: args.resolveOwnerColor(sector, sector.id, clusterId),
          label: displayName,
          labelY: topEdgeY + pad,
          labelFontSize: Math.max(MIN_SECTOR_LABEL_FONT_SIZE, SECTOR_LABEL_FONT_SIZE * sectorRadiusRatio),
          hasKhaakHive: sector.has_khaak_hive || false,
          khaakHiveSources: sector.khaak_hive_sources || []
        })
      })

      if (sectors.length === 1) {
        const singleRadius = sectors[0]!.radius
        const topEdgeY = center.y - singleRadius * HEX_TOP_EDGE_RATIO
        const pad = Math.max(MULTI_SECTOR_LABEL_PAD_MIN_PX, singleRadius * MULTI_SECTOR_LABEL_PAD_RATIO)
        rows.push({
          id: clusterId,
          cx: center.x,
          cy: center.y,
          color,
          clusterRadius,
          isDlcActive: clusterDlcActive,
          sectors,
          singleLabel: sectors[0]!.label,
          singleRadius,
          singleLabelY: topEdgeY + pad,
          singleLabelFontSize: SINGLE_SECTOR_LABEL_FONT_SIZE
        })
        return
      }

      rows.push({ id: clusterId, cx: center.x, cy: center.y, color, clusterRadius, isDlcActive: clusterDlcActive, sectors })
    })

    return rows
  })

  const sectorLayouts = computed<SearchSectorLayout[]>(() =>
    clusterPolygons.value.flatMap((cluster) =>
      cluster.sectors.map((sector) => ({
        sectorId: sector.id,
        clusterId: sector.clusterId,
        name: sector.name,
        displayName: sector.displayName,
        centerX: sector.sx,
        centerY: sector.sy,
        radius: sector.radius,
        verticalExtent: sector.radius * HEX_TOP_EDGE_RATIO
      }))
    )
  )

  return {
    getSectorVisualState,
    shouldRenderResourceOverlay,
    sectorFillOpacity,
    sectorStrokeWidth,
    sectorStrokeOpacity,
    sectorLabelFill,
    sectorLabelWeight,
    sectorFilter,
    sectorFillColor,
    sectorStrokeColor,
    buildPieSliceGeometries,
    buildResourceGroupBadgeGeometries,
    clusterPolygons,
    sectorLayouts
  }
}

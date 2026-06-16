<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import MapSvgCanvas from '@/components/map/MapSvgCanvas.vue'
import MapSectorTooltip from './MapSectorTooltip.vue'
import MapResourceFilterPanel from './MapResourceFilterPanel.vue'
import MapSavePanel from './MapSavePanel.vue'
import MapSavePoiVisibilityControl from './MapSavePoiVisibilityControl.vue'
import MapSvgDiagnosticVisibilityControl from './MapSvgDiagnosticVisibilityControl.vue'
import { getEffectiveVisibleSavePoiCategories } from './savePoiVisibility'
import MapSavePoiTooltip from './MapSavePoiTooltip.vue'
import { focusOverlayInViewport } from './focusOverlayInViewport'
import { getSectorScalePerRadius, sectorLocalRatioToRawPointWithScale, sectorPointToLocalRatioWithScale } from '@/components/map/utils/coordinates'
import { hexVertices } from '@/components/map/utils/geometry'
import { resolveMapSectorByMacro, resolveSectorMacroById } from '@/components/map/utils/mapSectorMacro'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useMapStore } from '@/store/useMapStore'
import { useBlueprintProductionStore } from '@/store/useBlueprintProductionStore'
import { useSaveBindingStore } from '@/store/useSaveBindingStore'
import type { SectorResourceFill } from '@/store/logic/mapResourceFilter'
import type { EntityLocation } from '@/types/x4'
import { useSaveStore } from '@/store/useSaveStore'
import { useActiveViewStore, type BindingStage } from '@/store/useActiveViewStore'
import type { SaveArchive, SavePoiCategory, SavePoiVisibility, SavePoiOverlayItem, SectorData } from '@/types/saveArchive'
import { buildAggregatedModulesFromStationPlan, classifyPlayerStationPoi } from '@/store/logic/stationPoiSemantics'
import type { StationPlan } from '@/types/x4'
import { DEFAULT_STATION_SETTINGS } from '@/store/state/stationSettings'

type SearchSectorLayout = {
  sectorId: string
  clusterId: string
  name: string
  displayName: string
  centerX: number
  centerY: number
  radius: number
  verticalExtent: number
}
type SearchResultItem = SearchSectorLayout & {
  matchType: 'name' | 'localeName' | 'id'
}
type MapSectorResourceEntry = {
  ware: string
  yield?: string
  level?: number
  respawn?: number
  rating?: number
}
type MapSectorDataset = {
  id: string
  clusterId: string
  name: string
  displayName: string
  sunlight: number
  resources: MapSectorResourceEntry[]
  scalePerRadius: number
}
type SectorHoverPayload = {
  sectorId: string
  clusterId: string
  name: string
  displayName: string
  owner: string
  sunlight: number
  resources: MapSectorResourceEntry[]
  hasKhaakHive: boolean
  khaakHiveSources: string[]
  anchorRect: {
    left: number
    top: number
    right: number
    bottom: number
    width: number
    height: number
  }
}
type TooltipPlacement = 'bottom' | 'top' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
type TooltipViewModel = {
  sectorId: string
  anchorRect: SectorHoverPayload['anchorRect']
}
type PlacementOverlayItem = {
  key: string
  id: string
  kind: 'station' | 'sector'
  name: string
  icon: 'factory' | 'shipyard' | 'tradestation'
  location: EntityLocation
  localRatio?: { x: number; y: number }
  draggable?: boolean
  savePoiVisual?: SavePoiOverlayItem
  binding?: {
    gameGuid: string
    sectorGroupId: string
    coverageSectorMacros: string[]
    isVirtualTradestation?: boolean
  }
}
type PlacementPreview = {
  kind: 'station' | 'sector'
  name: string
  icon: 'factory' | 'shipyard' | 'tradestation'
  location: EntityLocation
  localRatio?: { x: number; y: number }
  savePoiVisual?: SavePoiOverlayItem
}
type DraggingPlacementItem = {
  id: string
  kind: 'station' | 'sector'
  name: string
  icon: 'factory' | 'shipyard' | 'tradestation'
  savePoiVisual?: SavePoiOverlayItem
}

const clusterRefHeightPx = ref(142)
const clusterRadiusFromLayout = ref(0)
const centersFromLayout = ref<Record<string, { x: number; y: number }>>({})
const MAX_SCALE_MULTIPLIER = 4
const TOOLTIP_OFFSET = 14
const TOOLTIP_VIEWPORT_PADDING = 12
const ENABLE_MAP_SECTOR_TOOLTIP_MEASUREMENT = true

const viewportRef = ref<HTMLDivElement | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)
const tooltipRef = ref<InstanceType<typeof MapSectorTooltip> | null>(null)
const viewportResizeObserver = ref<ResizeObserver | null>(null)
const viewportSize = ref({ width: 0, height: 0 })

const imageNaturalWidth = ref(0)
const imageNaturalHeight = ref(0)

const minScale = ref(1)
const maxScale = ref(4)
const scale = ref(0)
const zoomPercent = ref(0)
const clusterVisibilityThresholdPx = ref(0)

const panX = ref(0)
const panY = ref(0)

const isDragging = ref(false)
const isZooming = ref(false)
const dragStartX = ref(0)
const dragStartY = ref(0)
const dragOriginX = ref(0)
const dragOriginY = ref(0)

const searchQuery = ref('')
const isSearchFocused = ref(false)
const selectedSectorId = ref<string | null>(null)
const selectedSectorSource = ref<'search' | 'resource' | null>(null)
const searchSectors = ref<SearchSectorLayout[]>([])
const resourceHighlightedSectorIds = ref<string[]>([])

const { t, te, locale } = useI18n()
const gameDataStore = useGameDataStore()
const mapStore = useMapStore()
const saveStore = useSaveStore()
const blueprintStore = useBlueprintProductionStore()
const saveBindingStore = useSaveBindingStore()
const activeViewStore = useActiveViewStore()

const { isResourcePanelOpen, isSavePanelOpen, isBindingPanelOpen, mapBindingGameGuid: bindingContextGameGuid, mapBindingStage: bindingContextStage, mapDragBindingSectorGroupId: dragEnabledBindingSectorGroupId } = storeToRefs(activeViewStore)
const activeSavePoiCategory = ref<SavePoiCategory | null>(null)
const focusedSavePoiKey = ref<string | null>(null)
const savePoiTooltipItem = ref<SavePoiOverlayItem | null>(null)
const mapDiagnosticVisibility = ref({
  sectorLabels: true,
  sectorLinks: true,
  sectorGroupColors: true
})
const activeControlPanel = ref<'diagnostic' | 'poi' | null>(null)

const sectorGroupColorMap = computed<Record<string, string>>(() => {
  const binding = saveBindingStore.activeBinding
  if (!binding) return {}
  const map: Record<string, string> = {}
  for (const group of binding.groups) {
    if (!group.color) continue
    if (group.sectorMacro && !map[group.sectorMacro]) {
      map[group.sectorMacro] = group.color
    }
    for (const entry of group.coverageSectorMacros) {
      if (!map[entry.ref]) map[entry.ref] = group.color
    }
  }
  return map
})
const settledSavePoiViewportContentBounds = ref<{
  left: number
  top: number
  right: number
  bottom: number
} | null>(null)
const resourcePrimaryColor = ref<string | null>(null)
const resourceSectorFills = ref<Record<string, SectorResourceFill>>({})
const resourceSectorGroupBadges = ref<Record<string, string[]>>({})
const draggingPlacementItem = ref<DraggingPlacementItem | null>(null)
const draggingOverlayKey = ref<string | null>(null)
const draggingBindingKey = ref<string | null>(null)
const draggingSectorGroupId = ref<string | null>(null)
const draggingFreeSector = ref<{ sectorGroupId: string; name: string } | null>(null)
const draggingFreeStation = ref<{ stationId: string; sectorGroupId: string; name: string; icon: 'factory' | 'shipyard'; blueprintStation?: StationPlan } | null>(null)
const draggingVirtualTradestation = ref<{ sectorGroupId: string; name: string } | null>(null)
const draggingCoverageSectorMacros = ref<Set<string>>(new Set())
const focusedPlacementKey = ref<string | null>(null)
const placementPreview = ref<PlacementPreview | null>(null)
const hoveredSectorSource = ref<SectorHoverPayload | null>(null)
const lastHoveredSectorSource = ref<SectorHoverPayload | null>(null)
const hoveredSector = ref<TooltipViewModel | null>(null)
const isTooltipHovered = ref(false)
const tooltipPlacement = ref<TooltipPlacement>('bottom')
const tooltipPosition = ref({ left: 0, top: 0 })
const tooltipMeasuredSize = ref({ width: 0, height: 0 })
const tooltipHideTimer = ref<number | null>(null)
const zoomRestoreTimer = ref<number | null>(null)
const zoomSettleTimer = ref<number | null>(null)
const lastMousePos = ref({ x: 0, y: 0 })

const sectorsById = computed<Record<string, MapSectorDataset>>(() => {
  const out: Record<string, MapSectorDataset> = {}
  const maps = gameDataStore.maps
  const clusters = maps?.clusters || {}
  const sectors = maps?.sectors || {}
  Object.entries(clusters).forEach(([clusterId, cluster]) => {
    // DLC filter: skip clusters from inactive DLC
    if (gameDataStore.enforceDlcActivation && !gameDataStore.isDlcActive(cluster.dlc_tag)) {
      return
    }
    ;(cluster.sectors || []).forEach((sectorId) => {
      const sector = sectors[sectorId] as any
      if (!sector) return
      const displayName = sector.nameId && te(sector.nameId) ? t(sector.nameId) : (sector.name || sector.id)
      out[sector.id] = {
        id: sector.id,
        clusterId,
        name: sector.name || sector.id,
        displayName,
        sunlight: Math.round(Number(sector.area?.sunlight || 0) * 100),
        resources: mapStore.getSectorResources(sector.id),
        scalePerRadius: getSectorScalePerRadius(sector as any)
      }
    })
  })
  return out
})

const displayScaleText = computed(() => `${Math.round(scale.value * 100)}%`)
const normalizedSearchQuery = computed(() => searchQuery.value.trim().toLowerCase())
const isFreeStationDropForbidden = computed(() => {
  if (!draggingFreeStation.value && !draggingVirtualTradestation.value && !draggingFreeSector.value) return false
  if (!placementPreview.value) return false
  if (draggingFreeSector.value) return false
  const location = placementPreview.value.location
  const sectorMacro = resolveSectorMacroById(gameDataStore.maps || { clusters: {}, sectors: {} }, location.cluster_id, location.sector_id)
  return sectorMacro ? !draggingCoverageSectorMacros.value.has(sectorMacro) : true
})
const activeBindingDragPreview = computed<{
  kind: 'station'
  name: string
  icon: 'factory' | 'shipyard' | 'tradestation'
  savePoiVisual?: SavePoiOverlayItem
} | null>(() => {
  if (draggingVirtualTradestation.value) {
    const sectorMacro = Array.from(draggingCoverageSectorMacros.value)[0] || ''
    return {
      kind: 'station',
      name: draggingVirtualTradestation.value.name,
      icon: 'tradestation',
      savePoiVisual: buildBindingSavePoiVisual({
        key: `preview:tradestation:${draggingVirtualTradestation.value.sectorGroupId}`,
        code: `preview:tradestation:${draggingVirtualTradestation.value.sectorGroupId}`,
        sectorMacro,
        position: { x: 0, z: 0 },
        isVirtualTradestation: true,
        sectorGroupId: draggingVirtualTradestation.value.sectorGroupId
      })
    }
  }
  if (draggingFreeStation.value) {
    const station = draggingFreeStation.value.blueprintStation || null
    const sectorMacro = Array.from(draggingCoverageSectorMacros.value)[0] || ''
    return {
      kind: 'station',
      name: draggingFreeStation.value.name,
      icon: draggingFreeStation.value.icon,
      savePoiVisual: buildBindingSavePoiVisual({
        key: `preview:station:${draggingFreeStation.value.stationId}`,
        code: station?.name || draggingFreeStation.value.stationId,
        sectorMacro,
        position: { x: 0, z: 0 },
        station
      })
    }
  }
  return null
})

const resolveBindingArchive = (gameGuid: string | null) => {
  if (!gameGuid) return null
  const binding = saveBindingStore.activeBinding?.gameGuid === gameGuid
    ? saveBindingStore.activeBinding
    : saveBindingStore.getBindingByGameGuid(gameGuid)
  const selected = saveStore.selectedArchive
  if (selected && selected.meta.guid === gameGuid) {
    if (binding?.selectedArchiveTime === null || binding?.selectedArchiveTime === undefined || selected.meta.time === binding?.selectedArchiveTime) {
      return selected
    }
  }
  const group = saveStore.archives.get(gameGuid)
  if (!group) return null
  const selectedTime = binding?.selectedArchiveTime
  if (selectedTime === null || selectedTime === undefined) return group.saves[0] || null
  return group.saves.find((save) => save.meta.time === selectedTime) || group.saves[0] || null
}

const loggedBindingDataErrors = new Set<string>()

const logBindingDataError = (reason: string, detail: Record<string, unknown>) => {
  const key = `${reason}:${detail.gameGuid || 'none'}:${detail.sectorMacro || detail.sectorId || 'none'}`
  if (loggedBindingDataErrors.has(key)) return
  loggedBindingDataErrors.add(key)
  console.error('[MapWorkbench][BindingData]', reason, detail)
}

const resolveBindingScaleContext = (gameGuid: string | null, sectorMacro: string | null, sectorId?: string) => {
  const mapSector = sectorId ? gameDataStore.maps?.sectors?.[sectorId] : null
  const mapScalePerRadius = mapSector ? getSectorScalePerRadius(mapSector as Parameters<typeof getSectorScalePerRadius>[0]) : 0
  if (!gameGuid || !sectorMacro) {
    return {
      scalePerRadius: mapScalePerRadius,
      source: 'map' as const
    }
  }
  const archiveSector = resolveBindingArchive(gameGuid)?.sectors?.[sectorMacro]
  if (!archiveSector) {
    return {
      scalePerRadius: mapScalePerRadius,
      source: 'map-fallback-missing-archive-sector' as const
    }
  }
  if (typeof archiveSector.scale_per_radius === 'number' && Number.isFinite(archiveSector.scale_per_radius) && archiveSector.scale_per_radius > 0) {
    return {
      scalePerRadius: archiveSector.scale_per_radius,
      source: 'archive' as const
    }
  }
  logBindingDataError('archive-sector-missing-scale', {
    gameGuid,
    sectorMacro,
    sectorId,
    hasArchiveSector: true,
    archiveScalePerRadius: archiveSector.scale_per_radius ?? null,
    mapScalePerRadius
  })
  return {
    scalePerRadius: 0,
    source: 'archive-missing-scale' as const
  }
}

const buildSaveSectorLocalRatio = (
  gameGuid: string | null,
  sectorMacro: string | null,
  sectorId: string,
  position: { x: number; z: number }
) => {
  const sector = gameDataStore.maps?.sectors?.[sectorId]
  if (!sector) return undefined
  const scaleContext = resolveBindingScaleContext(gameGuid, sectorMacro, sectorId)
  return sectorPointToLocalRatioWithScale(
    sector as Parameters<typeof sectorPointToLocalRatioWithScale>[0],
    position,
    { scalePerRadius: scaleContext.scalePerRadius }
  ) || undefined
}

const resolveSectorDisplayNameByMacro = (sectorMacro: string) => {
  const resolved = resolveMapSectorByMacro(gameDataStore.maps || { clusters: {}, sectors: {} }, sectorMacro)
  if (!resolved?.sectorId) return sectorMacro
  const sector = gameDataStore.maps?.sectors?.[resolved.sectorId]
  if (sector?.nameId && te(sector.nameId)) return t(sector.nameId)
  return sector?.name || sectorMacro
}

const resolveEmpireSectorGroupName = (sectorGroupId: string) =>
  saveBindingStore.activeBinding?.groups.find((sector) => sector.id === sectorGroupId)?.name || sectorGroupId

const buildBindingSavePoiVisual = (input: {
  key: string
  code: string
  sectorMacro: string
  position: { x: number; y?: number; z: number; tx?: number; ty?: number }
  station?: StationPlan | null
  isVirtualTradestation?: boolean
  sectorGroupId?: string
}): SavePoiOverlayItem => {
  if (input.isVirtualTradestation) {
    return {
      key: input.key,
      code: input.sectorGroupId ? resolveEmpireSectorGroupName(input.sectorGroupId) : input.code,
      category: 'playerStation',
      owner: 'player',
      sectorMacro: input.sectorMacro,
      sectorName: resolveSectorDisplayNameByMacro(input.sectorMacro),
      position: {
        x: input.position.x,
        y: input.position.y || 0,
        z: input.position.z,
        tx: input.position.tx,
        ty: input.position.ty
      },
      tag: 'tradestation'
    }
  }

  const station = input.station
  const aggregatedModules = station ? buildAggregatedModulesFromStationPlan(station, gameDataStore.modulesMap) : {}
  const classification = classifyPlayerStationPoi({
    modules: aggregatedModules,
    modulesMap: gameDataStore.modulesMap
  })

  return {
    key: input.key,
    code: input.code,
    category: 'playerStation',
    owner: 'player',
    sectorMacro: input.sectorMacro,
    sectorName: resolveSectorDisplayNameByMacro(input.sectorMacro),
    position: {
      x: input.position.x,
      y: input.position.y || 0,
      z: input.position.z,
      tx: input.position.tx,
      ty: input.position.ty
    },
    tag: classification.tag,
    factoryGroup: classification.factoryGroup,
    productionProfile: classification.productionProfile,
    profileName: classification.profileName,
    is_headquarter: classification.is_headquarter
  }
}

const buildBindingPreview = (
  _gameGuid: string | null,
  location: EntityLocation,
  localRatio: { x: number; y: number } | undefined,
  input: {
    kind: 'station' | 'sector'
    name: string
    icon: 'factory' | 'shipyard' | 'tradestation'
    savePoiVisual?: SavePoiOverlayItem
  }
): PlacementPreview | null => {
  return {
    ...input,
    location,
    localRatio
  }
}

const bindingOverlays = computed<PlacementOverlayItem[]>(() => {
  if (!savePoiVisibility.value.playerStation) return []
  if (!activeMapArchive.value) return []
  const activePlan = saveBindingStore.activeBinding
  if (!activePlan) return []

  const overlays: PlacementOverlayItem[] = []

  // stationPlans with position (virtual stations placed on map)
  for (const plan of activePlan.stationPlans) {
    if (!plan.position || !plan.sectorMacro) continue
    const resolved = resolveMapSectorByMacro(gameDataStore.maps || { clusters: {}, sectors: {} }, plan.sectorMacro)
    if (!resolved) continue

    const group = plan.groupId ? activePlan.groups.find(g => g.id === plan.groupId) : null
    const coverageSectorMacros = group
      ? Array.from(new Set([
          ...(group.sectorMacro ? [group.sectorMacro] : []),
          ...(group.coverageSectorMacros || []).map((entry) => entry.ref)
        ]))
      : []

    overlays.push({
      key: `binding:station:${plan.id}`,
      id: plan.id,
      kind: 'station',
      name: plan.name,
      icon: plan.type === 'shipyard' ? 'shipyard' : 'factory',
      location: {
        cluster_id: resolved.clusterId,
        sector_id: resolved.sectorId,
        pos: {
          x: plan.position.x,
          z: plan.position.z
        },
        sunlight: 0,
        resources: []
      },
      localRatio: buildSaveSectorLocalRatio(activePlan.gameGuid, plan.sectorMacro, resolved.sectorId, {
        x: plan.position.x,
        z: plan.position.z
      }),
      draggable: !!(isBindingPanelOpen.value &&
        bindingContextStage.value === 'select-station' &&
        group && dragEnabledBindingSectorGroupId.value === group.id &&
        bindingContextGameGuid.value === activePlan.gameGuid),
      savePoiVisual: buildBindingSavePoiVisual({
        key: `binding:station:${plan.id}`,
        code: plan.name,
        sectorMacro: plan.sectorMacro,
        position: {
          x: plan.position.x,
          z: plan.position.z
        },
        station: {
          id: plan.id,
          name: plan.name,
          type: plan.type,
          modules: plan.modules,
          settings: plan.settings,
          lastUpdated: activePlan.updatedAt
        },
        isVirtualTradestation: false,
        sectorGroupId: group?.id
      }),
      binding: group ? {
        gameGuid: activePlan.gameGuid,
        sectorGroupId: group.id,
        coverageSectorMacros,
        isVirtualTradestation: false
      } : undefined
    })
  }

  // tradeStation per group (only virtual/unbound ones)
  for (const group of activePlan.groups) {
    const stationPlan = group.tradeStation
    // Skip bound tradestations - they show as save station POIs instead
    if (!stationPlan?.position || !stationPlan.sectorMacro || stationPlan.saveStationCode) continue
    const resolved = resolveMapSectorByMacro(gameDataStore.maps || { clusters: {}, sectors: {} }, stationPlan.sectorMacro)
    if (!resolved) continue
    const coverageSectorMacros = Array.from(new Set([
      ...(group.sectorMacro ? [group.sectorMacro] : []),
      ...(group.coverageSectorMacros || []).map((entry) => entry.ref)
    ]))

    overlays.push({
      key: `binding:station:${stationPlan.id}`,
      id: stationPlan.id,
      kind: 'station',
      name: stationPlan.name,
      icon: 'tradestation',
      location: {
        cluster_id: resolved.clusterId,
        sector_id: resolved.sectorId,
        pos: {
          x: stationPlan.position.x,
          z: stationPlan.position.z
        },
        sunlight: 0,
        resources: []
      },
      localRatio: buildSaveSectorLocalRatio(activePlan.gameGuid, stationPlan.sectorMacro, resolved.sectorId, {
        x: stationPlan.position.x,
        z: stationPlan.position.z
      }),
      draggable: isBindingPanelOpen.value &&
        bindingContextStage.value === 'select-station' &&
        dragEnabledBindingSectorGroupId.value === group.id &&
        bindingContextGameGuid.value === activePlan.gameGuid,
      savePoiVisual: buildBindingSavePoiVisual({
        key: `binding:station:${stationPlan.id}`,
        code: stationPlan.name,
        sectorMacro: stationPlan.sectorMacro,
        position: {
          x: stationPlan.position.x,
          z: stationPlan.position.z
        },
        station: {
          id: stationPlan.id,
          name: stationPlan.name,
          type: 'transit',
          modules: [],
          settings: DEFAULT_STATION_SETTINGS,
          lastUpdated: activePlan.updatedAt
        },
        isVirtualTradestation: true,
        sectorGroupId: group.id
      }),
      binding: {
        gameGuid: activePlan.gameGuid,
        sectorGroupId: group.id,
        coverageSectorMacros,
        isVirtualTradestation: true
      }
    })
  }

  return overlays
})

const activeMapArchive = computed<SaveArchive | null>(() => {
  const archive = saveStore.selectedArchive
  if (archive && !archive.isValid) return null
  return archive
})

const savePoiVisibility = computed<SavePoiVisibility>({
  get: () => saveStore.savedArchivesState.settings.visibility,
  set: (value) => saveStore.updateSettings({ visibility: value })
})

const savePoiOverlays = computed<SavePoiOverlayItem[]>(() => {
  if (!activeMapArchive.value) return []
  const activeCategories = getEffectiveVisibleSavePoiCategories(
    savePoiVisibility.value,
    activeSavePoiCategory.value
  )

  // Build a set of save station codes bound to tradestations
  const boundToTradestationCodes = new Set<string>()
  const activeBinding = saveBindingStore.activeBinding
  if (activeBinding) {
    for (const group of activeBinding.groups) {
      if (group.tradeStation?.saveStationCode) {
        boundToTradestationCodes.add(group.tradeStation.saveStationCode)
      }
    }
  }

  return saveStore
    .getArchivePoiOverlays(activeMapArchive.value, activeCategories)
    .map((overlay) => {
      const resolved = mapStore.resolveSectorByMacro?.(overlay.sectorMacro) ||
        resolveMapSectorByMacro({
          clusters: gameDataStore.maps?.clusters || {},
          sectors: gameDataStore.maps?.sectors || {}
        }, overlay.sectorMacro)
      const sectorData = resolved ? sectorsById.value[resolved.sectorId] : null
      
      // Set tag to 'tradestation' if bound to tradestation
      const isBoundTradestation = overlay.category === 'playerStation' && boundToTradestationCodes.has(overlay.code)
      
      return {
        ...overlay,
        sectorName: sectorData?.displayName || overlay.sectorName,
        tag: isBoundTradestation ? 'tradestation' : overlay.tag
      }
    })
})

const saveSectorLinkOverrides = computed<Record<string, SectorData> | undefined>(() => {
  if (!activeMapArchive.value) return undefined
  const next: Record<string, SectorData> = {}
  let hasItems = false

  Object.entries(activeMapArchive.value.sectors).forEach(([sectorMacro, sector]) => {
    if ((sector.clusterGates?.length || 0) === 0 && (sector.superhighwayGates?.length || 0) === 0) return
    const resolved = mapStore.resolveSectorByMacro?.(sectorMacro) ||
      resolveMapSectorByMacro({
        clusters: gameDataStore.maps?.clusters || {},
        sectors: gameDataStore.maps?.sectors || {}
      }, sectorMacro)
    if (!resolved?.sectorId) return
    next[resolved.sectorId] = sector
    hasItems = true
  })

  return hasItems ? next : undefined
})

const liveSavePoiViewportContentBounds = computed(() => {
  const { width, height } = viewportSize.value
  if (!width || !height || !scale.value) return null
  return {
    left: (-panX.value) / scale.value,
    top: (-panY.value) / scale.value,
    right: (width - panX.value) / scale.value,
    bottom: (height - panY.value) / scale.value
  }
})

const savePoiViewportContentBounds = computed(() =>
  (isDragging.value || isZooming.value)
    ? settledSavePoiViewportContentBounds.value
    : liveSavePoiViewportContentBounds.value
)

const sectorOwnerOverride = computed<Record<string, string> | undefined>(() => {
  if (!activeMapArchive.value) return undefined
  const map: Record<string, string> = {}
  let hasOverride = false
  Object.entries(activeMapArchive.value.sectors).forEach(([macro, sector]) => {
    if (sector.owner) {
      const resolved = mapStore.resolveSectorByMacro(macro)
      if (resolved?.sectorId) {
        map[resolved.sectorId] = sector.owner
        hasOverride = true
      }
    }
  })
  return hasOverride ? map : undefined
})

const clusterOwnerOverride = computed<Record<string, string> | undefined>(() => {
  if (!sectorOwnerOverride.value) return undefined
  const clusters = gameDataStore.maps?.clusters || {}
  const result: Record<string, string> = {}
  
  for (const [clusterId, cluster] of Object.entries(clusters)) {
    const sectorIds = cluster.sectors || []
    if (sectorIds.length === 0) continue
    
    const owners = sectorIds
      .map(id => sectorOwnerOverride.value?.[id])
      .filter((o): o is string => !!o)
    
    if (owners.length === sectorIds.length && owners.length > 0) {
      const firstOwner = owners[0]!
      if (owners.every(o => o === firstOwner)) {
        result[clusterId] = firstOwner
      } else {
        result[clusterId] = 'ownerless'
      }
    } else if (owners.length > 0) {
      result[clusterId] = 'ownerless'
    }
  }
  
  return Object.keys(result).length > 0 ? result : undefined
})

const factionColorMap = computed<Record<string, string> | undefined>(() => {
  return gameDataStore.factionColorMap
})

const updateViewportSize = () => {
  const viewport = viewportRef.value
  if (!viewport) {
    viewportSize.value = { width: 0, height: 0 }
    return
  }
  viewportSize.value = {
    width: viewport.clientWidth,
    height: viewport.clientHeight
  }
}

const mapViewBoxBounds = computed(() => {
  const { width, height } = viewportSize.value
  if (!width || !height || !scale.value) return null
  return {
    left: (-panX.value) / scale.value,
    top: (-panY.value) / scale.value,
    width: width / scale.value,
    height: height / scale.value
  }
})

const clampScale = (next: number) => Math.min(maxScale.value, Math.max(minScale.value, next))

const clampPan = (nextX: number, nextY: number) => {
  const { width: vw, height: vh } = viewportSize.value
  const scaledW = imageNaturalWidth.value * scale.value
  const scaledH = imageNaturalHeight.value * scale.value

  let x = nextX
  let y = nextY

  if (scaledW <= vw) {
    x = (vw - scaledW) / 2
  } else {
    const minX = vw - scaledW
    x = Math.min(0, Math.max(minX, x))
  }

  if (scaledH <= vh) {
    y = (vh - scaledH) / 2
  } else {
    const minY = vh - scaledH
    y = Math.min(0, Math.max(minY, y))
  }

  panX.value = x
  panY.value = y
}

const applyScaleFromSlider = (value: number) => {
  const { width: vw, height: vh } = viewportSize.value
  if (!vw || !vh) return

  const ratio = value / 100
  const nextScale = minScale.value + (maxScale.value - minScale.value) * ratio
  const safeScale = clampScale(nextScale)

  const centerContentX = (vw * 0.5 - panX.value) / scale.value
  const centerContentY = (vh * 0.5 - panY.value) / scale.value
  scale.value = safeScale
  const nextPanX = vw * 0.5 - centerContentX * safeScale
  const nextPanY = vh * 0.5 - centerContentY * safeScale
  clampPan(nextPanX, nextPanY)
}

const syncSliderFromScale = () => {
  if (maxScale.value <= minScale.value) {
    zoomPercent.value = 0
    return
  }
  zoomPercent.value = ((scale.value - minScale.value) / (maxScale.value - minScale.value)) * 100
}

const recomputeScaleBounds = () => {
  if (!imageNaturalWidth.value || !imageNaturalHeight.value) return
  const { width: vw, height: vh } = viewportSize.value
  if (!vw || !vh) return

  const fitByWidth = vw / imageNaturalWidth.value
  const nextMin = fitByWidth
  const targetHalfScreen = window.innerHeight * 0.5
  const refHeight = Math.max(1, clusterRefHeightPx.value)
  const nextMax = Math.max(nextMin, targetHalfScreen / refHeight) * MAX_SCALE_MULTIPLIER

  minScale.value = nextMin
  maxScale.value = nextMax
  clusterVisibilityThresholdPx.value = Math.min(vw, vh) / 3
  scale.value = clampScale(scale.value || nextMin)
  syncSliderFromScale()
  clampPan(panX.value, panY.value)
}

const onCanvasSize = async (payload: { width: number; height: number; clusterRefHeight: number }) => {
  imageNaturalWidth.value = payload.width
  imageNaturalHeight.value = payload.height
  clusterRefHeightPx.value = payload.clusterRefHeight
  await nextTick()
  recomputeScaleBounds()
  if (scale.value < minScale.value + 1e-6) {
    scale.value = minScale.value
  }
  syncSliderFromScale()
  clampPan(panX.value, panY.value)
}

const onSectorLayout = (payload: SearchSectorLayout[]) => {
  searchSectors.value = payload
}

const onLayoutState = (payload: { centers: Record<string, { x: number; y: number }>; clusterRadius: number }) => {
  centersFromLayout.value = payload.centers
  clusterRadiusFromLayout.value = payload.clusterRadius
}

const syncViewportStateToStore = () => {
  const bounds = mapViewBoxBounds.value
  if (!bounds) return
  mapStore.syncViewportState({
    viewportBounds: {
      left: bounds.left,
      top: bounds.top,
      right: bounds.left + bounds.width,
      bottom: bounds.top + bounds.height
    },
    viewportHeight: viewportSize.value.height,
    clusterRadius: clusterRadiusFromLayout.value,
    centers: centersFromLayout.value,
    scale: scale.value,
    panX: panX.value,
    panY: panY.value
  })
}

const parseClusterQuery = (query: string) => {
  const match = query.match(/^cluster[\s_-]*([0-9]+)$/i)
  if (!match?.[1]) return null
  return String(Number(match[1]))
}

const extractClusterNumber = (clusterId: string) => {
  const match = clusterId.match(/^cluster_([0-9]+)(?:_|$)/i)
  if (!match?.[1]) return null
  return String(Number(match[1]))
}

const searchResults = computed<SearchResultItem[]>(() => {
  const query = normalizedSearchQuery.value
  if (!query) return []

  const clusterNumber = parseClusterQuery(query)
  if (clusterNumber) {
    return searchSectors.value
      .filter((item) => extractClusterNumber(item.clusterId) === clusterNumber)
      .map((item) => ({ ...item, matchType: 'id' as const }))
  }

  return searchSectors.value.flatMap((item) => {
    const rawName = item.name.toLowerCase()
    const displayName = item.displayName.toLowerCase()
    const matched: SearchResultItem[] = []
    if (rawName.includes(query)) {
      matched.push({ ...item, matchType: 'name' })
      return matched
    }
    if (locale.value !== 'en' && displayName.includes(query)) {
      matched.push({ ...item, matchType: 'localeName' })
    }
    return matched
  })
})

const searchHighlightedSectorIds = computed(() => {
  if (!normalizedSearchQuery.value) return [] as string[]
  if (searchResults.value.length >= 10) return [] as string[]
  return searchResults.value.map((item) => item.sectorId)
})
const shouldShowSearchPopover = computed(() => isSearchFocused.value && normalizedSearchQuery.value.length > 0)
const hasIdMatchedResult = computed(() => searchResults.value.some((item) => item.matchType === 'id'))
const getResultPrimaryLabel = (item: SearchResultItem | SearchSectorLayout) => (
  locale.value === 'en' ? item.name : item.displayName
)
const getResultMeta = (item: SearchResultItem) => {
  if (item.matchType === 'id') return item.sectorId
  if (item.matchType === 'name' && locale.value !== 'en') return item.name
  return ''
}

const clearTooltipHideTimer = () => {
  if (tooltipHideTimer.value !== null) {
    window.clearTimeout(tooltipHideTimer.value)
    tooltipHideTimer.value = null
  }
}

const clearZoomRestoreTimer = () => {
  if (zoomRestoreTimer.value !== null) {
    window.clearTimeout(zoomRestoreTimer.value)
    zoomRestoreTimer.value = null
  }
}

const clearZoomSettleTimer = () => {
  if (zoomSettleTimer.value !== null) {
    window.clearTimeout(zoomSettleTimer.value)
    zoomSettleTimer.value = null
  }
}

const settleZoomViewport = () => {
  isZooming.value = false
  settledSavePoiViewportContentBounds.value = liveSavePoiViewportContentBounds.value
}

const triggerZoomSettling = () => {
  isZooming.value = true
  clearZoomSettleTimer()
  zoomSettleTimer.value = window.setTimeout(() => {
    settleZoomViewport()
    zoomSettleTimer.value = null
  }, 120)
}

const clearBrowserSelection = () => {
  const selection = window.getSelection?.()
  if (!selection) return
  selection.removeAllRanges()
}

const getSectorElementAtPointer = (clientX: number, clientY: number) => {
  const element = document.elementFromPoint(clientX, clientY)
  if (!element) return null
  return element.closest('[data-map-sector-id], [data-sector-hover-id]') as SVGGraphicsElement | null
}

const pointInPolygon = (point: { x: number; y: number }, polygon: Array<{ x: number; y: number }>) => {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]
    const b = polygon[j]
    if (!a || !b) continue
    const intersects = ((a.y > point.y) !== (b.y > point.y)) &&
      (point.x < ((b.x - a.x) * (point.y - a.y)) / ((b.y - a.y) || Number.EPSILON) + a.x)
    if (intersects) inside = !inside
  }
  return inside
}

const resolveSvgPointAtClient = (sectorElement: SVGGraphicsElement, clientX: number, clientY: number) => {
  const svg = sectorElement.ownerSVGElement
  if (!svg) return null
  const ctm = svg.getScreenCTM()
  if (!ctm) return null
  const point = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse())
  return { x: point.x, y: point.y }
}

const resolveSectorPointerGeometrySample = (sectorElement: SVGGraphicsElement, clientX: number, clientY: number) => {
  const sectorId = sectorElement.getAttribute('data-map-sector-id') || sectorElement.getAttribute('data-sector-hover-id')
  if (!sectorId) return null
  const mapSector = sectorsById.value[sectorId]
  if (!mapSector) return null
  const layout = searchSectors.value.find((item) => item.sectorId === sectorId)
  if (!layout || !layout.radius) return null
  const svgPoint = resolveSvgPointAtClient(sectorElement, clientX, clientY)
  if (!svgPoint) return null
  const localRatio = {
    x: (svgPoint.x - layout.centerX) / layout.radius,
    y: (svgPoint.y - layout.centerY) / layout.radius
  }
  const localHex = hexVertices(0, 0, 1)
  if (!pointInPolygon(localRatio, localHex)) return null
  return {
    sectorId,
    mapSector,
    layout,
    svgPoint,
    localRatio
  }
}

const resolveSectorPointerSample = (sectorElement: SVGGraphicsElement, clientX: number, clientY: number) => {
  const geometrySample = resolveSectorPointerGeometrySample(sectorElement, clientX, clientY)
  if (!geometrySample) return null
  const { sectorId, mapSector, localRatio } = geometrySample
  const sector = gameDataStore.maps?.sectors?.[sectorId]
  const rawPoint = sector ? sectorLocalRatioToRawPointWithScale(sector, localRatio) : null
  return {
    localRatio,
    location: {
      cluster_id: mapSector.clusterId,
      sector_id: sectorId,
      pos: {
        x: Math.round(rawPoint?.x ?? 0),
        z: Math.round(rawPoint?.z ?? 0)
      },
      sunlight: mapSector.sunlight,
      resources: Array.from(new Set(mapSector.resources.map((entry) => entry.ware)))
    } satisfies EntityLocation
  }
}

const resolveLocationFromSectorElement = (sectorElement: SVGGraphicsElement, clientX: number, clientY: number): EntityLocation | null => {
  return resolveSectorPointerSample(sectorElement, clientX, clientY)?.location || null
}

const resolveLocationAtPointer = (clientX: number, clientY: number): EntityLocation | null => {
  const sectorElement = getSectorElementAtPointer(clientX, clientY)
  if (!sectorElement) return null
  return resolveLocationFromSectorElement(sectorElement, clientX, clientY)
}

const resolveBindingLocationSampleAtPointer = (clientX: number, clientY: number) => {
  const sectorElement = getSectorElementAtPointer(clientX, clientY)
  if (!sectorElement) return null
  const geometrySample = resolveSectorPointerGeometrySample(sectorElement, clientX, clientY)
  if (!geometrySample) return null
  const { sectorId, mapSector, localRatio } = geometrySample
  const sectorMacro = resolveSectorMacroById(
    gameDataStore.maps || { clusters: {}, sectors: {} },
    mapSector.clusterId,
    sectorId
  )
  if (!sectorMacro) {
    const sector = gameDataStore.maps?.sectors?.[sectorId]
    const fallbackRawPosition = sector
      ? sectorLocalRatioToRawPointWithScale(sector as Parameters<typeof sectorLocalRatioToRawPointWithScale>[0], localRatio)
      : null
    return {
      sample: {
        localRatio,
        location: {
          cluster_id: mapSector.clusterId,
          sector_id: sectorId,
          pos: {
            x: Math.round(fallbackRawPosition?.x ?? 0),
            z: Math.round(fallbackRawPosition?.z ?? 0)
          },
          sunlight: mapSector.sunlight,
          resources: Array.from(new Set(mapSector.resources.map((entry) => entry.ware)))
        } satisfies EntityLocation
      },
      sectorMacro: null
    }
  }
  const sector = gameDataStore.maps?.sectors?.[sectorId]
  const scaleContext = resolveBindingScaleContext(draggingBindingKey.value, sectorMacro, sectorId)
  const effectiveScalePerRadius = scaleContext.scalePerRadius
  const resolvedRawPosition = sector
    ? sectorLocalRatioToRawPointWithScale(
        sector as Parameters<typeof sectorLocalRatioToRawPointWithScale>[0],
        localRatio,
        { scalePerRadius: effectiveScalePerRadius }
      )
    : null
  const bindingSample = {
    localRatio,
    location: {
      cluster_id: mapSector.clusterId,
      sector_id: sectorId,
      pos: {
        x: Math.round(resolvedRawPosition?.x ?? 0),
        z: Math.round(resolvedRawPosition?.z ?? 0)
      },
      sunlight: mapSector.sunlight,
      resources: Array.from(new Set(mapSector.resources.map((entry) => entry.ware)))
    } satisfies EntityLocation
  }
  return {
    sample: bindingSample,
    sectorMacro
  }
}

const resolveBindingPreviewAtPointer = (clientX: number, clientY: number): PlacementPreview | null => {
  if (!activeBindingDragPreview.value) return null
  const bindingSampleResult = resolveBindingLocationSampleAtPointer(clientX, clientY)
  if (!bindingSampleResult) return null
  const { sample, sectorMacro } = bindingSampleResult
  const location = sample.location
  if (!sectorMacro || !draggingCoverageSectorMacros.value.has(sectorMacro)) return null
  return buildBindingPreview(
    draggingBindingKey.value,
    location,
    sample.localRatio,
    activeBindingDragPreview.value
  )
}

const clearPlacementState = () => {
  draggingPlacementItem.value = null
  draggingOverlayKey.value = null
  draggingBindingKey.value = null
  draggingSectorGroupId.value = null
  draggingFreeSector.value = null
  draggingFreeStation.value = null
  draggingVirtualTradestation.value = null
  draggingCoverageSectorMacros.value = new Set()
  placementPreview.value = null
}

const applyLocationToItem = (item: DraggingPlacementItem, location: EntityLocation) => {
  if (item.kind === 'station') {
    if (draggingBindingKey.value && draggingSectorGroupId.value) {
      const sectorMacro = resolveSectorMacroById(gameDataStore.maps || { clusters: {}, sectors: {} }, location.cluster_id, location.sector_id)
      if (!sectorMacro) return
      const moved = saveBindingStore.setStationPlanPosition({
        gameGuid: draggingBindingKey.value,
        stationPlanId: item.id,
        groupId: draggingSectorGroupId.value,
        sectorMacro,
        position: {
          x: location.pos.x,
          y: 0,
          z: location.pos.z
        }
      })
      if (!moved) {
        saveBindingStore.setTradeStationPosition({
          gameGuid: draggingBindingKey.value,
          groupId: draggingSectorGroupId.value,
          sectorMacro,
          position: {
            x: location.pos.x,
            y: 0,
            z: location.pos.z
          }
        })
      }
    } else {
      blueprintStore.setStationLocation(item.id, location)
    }
    return
  }
}

const closeTooltip = () => {
  clearTooltipHideTimer()
  hoveredSector.value = null
  isTooltipHovered.value = false
}

const scheduleTooltipClose = () => {
  clearTooltipHideTimer()
  tooltipHideTimer.value = window.setTimeout(() => {
    if (!isTooltipHovered.value) {
      hoveredSectorSource.value = null
      hoveredSector.value = null
    }
    tooltipHideTimer.value = null
  }, 90)
}

const chooseTooltipPlacement = (
  anchor: SectorHoverPayload['anchorRect'],
  viewportWidth: number,
  viewportHeight: number,
  tooltipWidth: number,
  tooltipHeight: number
): TooltipPlacement => {
  const centerX = anchor.left + anchor.width / 2
  const centerY = anchor.top + anchor.height / 2
  const candidates: Array<{ placement: TooltipPlacement; left: number; top: number }> = [
    { placement: 'bottom', left: centerX - tooltipWidth / 2, top: anchor.bottom + TOOLTIP_OFFSET },
    { placement: 'top', left: centerX - tooltipWidth / 2, top: anchor.top - tooltipHeight - TOOLTIP_OFFSET },
    { placement: 'left', left: anchor.left - tooltipWidth - TOOLTIP_OFFSET, top: centerY - tooltipHeight / 2 },
    { placement: 'right', left: anchor.right + TOOLTIP_OFFSET, top: centerY - tooltipHeight / 2 },
    { placement: 'top-left', left: anchor.left - tooltipWidth - TOOLTIP_OFFSET, top: anchor.top - tooltipHeight - TOOLTIP_OFFSET },
    { placement: 'top-right', left: anchor.right + TOOLTIP_OFFSET, top: anchor.top - tooltipHeight - TOOLTIP_OFFSET },
    { placement: 'bottom-left', left: anchor.left - tooltipWidth - TOOLTIP_OFFSET, top: anchor.bottom + TOOLTIP_OFFSET },
    { placement: 'bottom-right', left: anchor.right + TOOLTIP_OFFSET, top: anchor.bottom + TOOLTIP_OFFSET }
  ]

  const fits = (candidate: { left: number; top: number }) =>
    candidate.left >= TOOLTIP_VIEWPORT_PADDING &&
    candidate.top >= TOOLTIP_VIEWPORT_PADDING &&
    candidate.left + tooltipWidth <= viewportWidth - TOOLTIP_VIEWPORT_PADDING &&
    candidate.top + tooltipHeight <= viewportHeight - TOOLTIP_VIEWPORT_PADDING

  const orthogonal = candidates.slice(0, 4)
  const diagonal = candidates.slice(4)
  return (
    orthogonal.find(fits)?.placement ||
    diagonal.find(fits)?.placement ||
    candidates
      .map((candidate) => {
        const overflowLeft = Math.max(0, TOOLTIP_VIEWPORT_PADDING - candidate.left)
        const overflowTop = Math.max(0, TOOLTIP_VIEWPORT_PADDING - candidate.top)
        const overflowRight = Math.max(0, candidate.left + tooltipWidth - (viewportWidth - TOOLTIP_VIEWPORT_PADDING))
        const overflowBottom = Math.max(0, candidate.top + tooltipHeight - (viewportHeight - TOOLTIP_VIEWPORT_PADDING))
        return {
          placement: candidate.placement,
          overflow: overflowLeft + overflowTop + overflowRight + overflowBottom
        }
      })
      .sort((left, right) => left.overflow - right.overflow)[0]?.placement ||
    'bottom'
  )
}

const positionTooltip = () => {
  if (!ENABLE_MAP_SECTOR_TOOLTIP_MEASUREMENT) return
  if (!hoveredSector.value || !viewportRef.value) return

  const viewportRect = viewportRef.value.getBoundingClientRect()
  const viewportWidth = viewportRef.value.clientWidth
  const viewportHeight = viewportRef.value.clientHeight
  const tooltipWidth = tooltipMeasuredSize.value.width
  const tooltipHeight = tooltipMeasuredSize.value.height
  if (!tooltipWidth || !tooltipHeight) return

  const anchor = {
    left: hoveredSector.value.anchorRect.left - viewportRect.left,
    top: hoveredSector.value.anchorRect.top - viewportRect.top,
    right: hoveredSector.value.anchorRect.right - viewportRect.left,
    bottom: hoveredSector.value.anchorRect.bottom - viewportRect.top,
    width: hoveredSector.value.anchorRect.width,
    height: hoveredSector.value.anchorRect.height
  }
  const placement = chooseTooltipPlacement(anchor, viewportWidth, viewportHeight, tooltipWidth, tooltipHeight)
  tooltipPlacement.value = placement

  const centerX = anchor.left + anchor.width / 2
  const centerY = anchor.top + anchor.height / 2
  let left = centerX - tooltipWidth / 2
  let top = anchor.bottom + TOOLTIP_OFFSET

  switch (placement) {
    case 'top':
      top = anchor.top - tooltipHeight - TOOLTIP_OFFSET
      break
    case 'left':
      left = anchor.left - tooltipWidth - TOOLTIP_OFFSET
      top = centerY - tooltipHeight / 2
      break
    case 'right':
      left = anchor.right + TOOLTIP_OFFSET
      top = centerY - tooltipHeight / 2
      break
    case 'top-left':
      left = anchor.left - tooltipWidth - TOOLTIP_OFFSET
      top = anchor.top - tooltipHeight - TOOLTIP_OFFSET
      break
    case 'top-right':
      left = anchor.right + TOOLTIP_OFFSET
      top = anchor.top - tooltipHeight - TOOLTIP_OFFSET
      break
    case 'bottom-left':
      left = anchor.left - tooltipWidth - TOOLTIP_OFFSET
      top = anchor.bottom + TOOLTIP_OFFSET
      break
    case 'bottom-right':
      left = anchor.right + TOOLTIP_OFFSET
      top = anchor.bottom + TOOLTIP_OFFSET
      break
    default:
      top = anchor.bottom + TOOLTIP_OFFSET
      break
  }

  tooltipPosition.value = {
    left: Math.min(
      viewportWidth - tooltipWidth - TOOLTIP_VIEWPORT_PADDING,
      Math.max(TOOLTIP_VIEWPORT_PADDING, left)
    ),
    top: Math.min(
      viewportHeight - tooltipHeight - TOOLTIP_VIEWPORT_PADDING,
      Math.max(TOOLTIP_VIEWPORT_PADDING, top)
    )
  }
}

const syncTooltipMeasurement = async () => {
  if (!ENABLE_MAP_SECTOR_TOOLTIP_MEASUREMENT) return
  if (!hoveredSector.value) return
  await nextTick()
  const el = tooltipRef.value?.$el as HTMLElement | undefined
  if (!el) return
  const rect = el.getBoundingClientRect()
  if (!rect.width || !rect.height) return
  tooltipMeasuredSize.value = { width: rect.width, height: rect.height }
  positionTooltip()
}

const showTooltipFromSectorElement = async (sectorElement: SVGGraphicsElement) => {
  if (!ENABLE_MAP_SECTOR_TOOLTIP_MEASUREMENT) return
  const sectorId = sectorElement.getAttribute('data-sector-hover-id')
  if (!sectorId) return

  const source = lastHoveredSectorSource.value
  if (!source || source.sectorId !== sectorId) return

  const rect = sectorElement.getBoundingClientRect()
  if (!rect.width || !rect.height) return

  clearTooltipHideTimer()
  hoveredSectorSource.value = {
    ...source,
    anchorRect: {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height
    }
  }
  hoveredSector.value = createTooltipViewModel(hoveredSectorSource.value)
  await syncTooltipMeasurement()
}

const scheduleZoomTooltipRestore = () => {
  if (!ENABLE_MAP_SECTOR_TOOLTIP_MEASUREMENT) return
  clearZoomRestoreTimer()
  zoomRestoreTimer.value = window.setTimeout(() => {
    zoomRestoreTimer.value = null
    const sectorElement = getSectorElementAtPointer(lastMousePos.value.x, lastMousePos.value.y)
    if (!sectorElement) return
    void showTooltipFromSectorElement(sectorElement)
  }, 200)
}

const createTooltipViewModel = (payload: SectorHoverPayload): TooltipViewModel => ({
    sectorId: payload.sectorId,
    anchorRect: payload.anchorRect,
  })

const onSectorHover = (payload: SectorHoverPayload) => {
  lastMousePos.value = {
    x: payload.anchorRect.left + payload.anchorRect.width / 2,
    y: payload.anchorRect.top + payload.anchorRect.height / 2
  }
  clearTooltipHideTimer()
  lastHoveredSectorSource.value = payload
  hoveredSectorSource.value = payload
  hoveredSector.value = createTooltipViewModel(payload)
  void syncTooltipMeasurement()
}

const onSectorLeave = (sectorId: string) => {
  if (hoveredSector.value?.sectorId !== sectorId) return
  scheduleTooltipClose()
}

const onTooltipMouseEnter = () => {
  clearTooltipHideTimer()
  isTooltipHovered.value = true
}

const onTooltipMouseLeave = () => {
  isTooltipHovered.value = false
  scheduleTooltipClose()
}

const focusSector = (sectorId: string) => {
  const target = searchSectors.value.find((item) => item.sectorId === sectorId)
  if (!target) return
  const { width: vw, height: vh } = viewportSize.value
  if (!vw || !vh) return

  const targetScale = scale.value < 1 ? clampScale(1) : scale.value
  scale.value = targetScale
  syncSliderFromScale()
  clampPan(vw * 0.5 - target.centerX * targetScale, vh * 0.5 - target.centerY * targetScale)
}

const fitSectors = (sectorIds: string[]) => {
  const targets = Array.from(new Set(sectorIds))
    .map((sectorId) => searchSectors.value.find((item) => item.sectorId === sectorId))
    .filter((item): item is SearchSectorLayout => Boolean(item))
  if (!targets.length) return

  const { width: vw, height: vh } = viewportSize.value
  if (!vw || !vh) return

  const minX = Math.min(...targets.map((item) => item.centerX - item.radius))
  const maxX = Math.max(...targets.map((item) => item.centerX + item.radius))
  const minY = Math.min(...targets.map((item) => item.centerY - item.verticalExtent))
  const maxY = Math.max(...targets.map((item) => item.centerY + item.verticalExtent))
  const boundsW = Math.max(1, maxX - minX)
  const boundsH = Math.max(1, maxY - minY)
  const safeWidth = boundsW * 1.25
  const safeHeight = boundsH * 1.25
  const fittedScale = Math.min(vw / safeWidth, vh / safeHeight)
  const maxRadius = Math.max(...targets.map((item) => item.radius), 1)
  const maxVerticalExtent = Math.max(...targets.map((item) => item.verticalExtent), 1)
  const targetScale = boundsW <= maxRadius * 2.2 && boundsH <= maxVerticalExtent * 2.2
    ? (scale.value < 1 ? clampScale(1) : scale.value)
    : clampScale(fittedScale)
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2

  focusedPlacementKey.value = null
  selectedSectorId.value = null
  selectedSectorSource.value = null
  scale.value = targetScale
  syncSliderFromScale()
  clampPan(vw * 0.5 - centerX * targetScale, vh * 0.5 - centerY * targetScale)
}

const onSliderInput = (event: Event) => {
  const input = event.target as HTMLInputElement
  const value = Number(input.value)
  zoomPercent.value = value
  triggerZoomSettling()
  applyScaleFromSlider(value)
}

const onSearchInput = (event: Event) => {
  searchQuery.value = (event.target as HTMLInputElement).value
}

const onSearchFocus = () => {
  isSearchFocused.value = true
}

const onSearchBlur = () => {
  window.setTimeout(() => {
    isSearchFocused.value = false
  }, 100)
}

const onClearSearch = () => {
  searchQuery.value = ''
  if (selectedSectorSource.value === 'search') {
    selectedSectorId.value = null
    selectedSectorSource.value = null
  }
  searchInputRef.value?.focus()
}

const selectSector = (sectorId: string, source: 'search' | 'resource') => {
  focusedPlacementKey.value = null
  selectedSectorId.value = sectorId
  selectedSectorSource.value = source
  if (source === 'search') {
    isSearchFocused.value = false
    searchInputRef.value?.blur()
  }
  focusSector(sectorId)
}

const selectSearchResult = (item: SearchSectorLayout) => {
  selectSector(item.sectorId, 'search')
}

const onResourceHighlightChange = (sectorIds: string[]) => {
  if (selectedSectorSource.value === 'resource') {
    selectedSectorId.value = null
    selectedSectorSource.value = null
  }
  resourceHighlightedSectorIds.value = sectorIds
}

const onResourceSectorSelect = (sectorId: string) => {
  selectSector(sectorId, 'resource')
}

const onResourceFitSectors = (sectorIds: string[]) => {
  fitSectors(sectorIds)
}

const onResourceVisualChange = (payload: {
  highlightedSectorIds: string[]
  sectorFills: Record<string, SectorResourceFill>
  sectorGroupBadges?: Record<string, string[]>
}) => {
  resourceHighlightedSectorIds.value = payload.highlightedSectorIds
  resourceSectorFills.value = payload.sectorFills
  resourceSectorGroupBadges.value = payload.sectorGroupBadges || {}
  const firstSectorId = payload.highlightedSectorIds[0]
  const firstFill = firstSectorId ? payload.sectorFills[firstSectorId] : null
  resourcePrimaryColor.value = firstFill?.mode === 'solid' ? firstFill.color : null
}

const onResourceActiveChange = (active: boolean) => {
  void active
}

const onResourcePrimaryColorChange = (color: string | null) => {
  resourcePrimaryColor.value = color
}

const onResourcePanelOpen = () => {
  isSavePanelOpen.value = false
  bindingContextStage.value = 'select-binding'
  clearPlacementState()
  isResourcePanelOpen.value = true
}

const onResourcePanelClose = () => {
  isResourcePanelOpen.value = false
  resourceHighlightedSectorIds.value = []
  resourceSectorFills.value = {}
  resourceSectorGroupBadges.value = {}
  resourcePrimaryColor.value = null
}

const onSavePanelOpen = () => {
  isResourcePanelOpen.value = false
  bindingContextStage.value = 'select-binding'
  clearPlacementState()
  isSavePanelOpen.value = true
}

const onSavePanelClose = () => {
  isSavePanelOpen.value = false
  activeSavePoiCategory.value = null
  focusedSavePoiKey.value = null
  bindingContextGameGuid.value = null
  bindingContextStage.value = 'select-binding'
  clearPlacementState()
}

const onBindingContextChange = (payload: {
  stage: BindingStage
  gameGuid: string | null
  sectorGroupId: string | null
}) => {
  bindingContextStage.value = payload.stage
  bindingContextGameGuid.value = payload.gameGuid
}

const onBindingFocusSector = (sectorMacro: string) => {
  const resolved = mapStore.resolveSectorByMacro?.(sectorMacro) ||
    resolveMapSectorByMacro(gameDataStore.maps || { clusters: {}, sectors: {} }, sectorMacro)
  if (resolved?.sectorId) {
    focusSector(resolved.sectorId)
  }
}

const onBindingFitSectors = (sectorMacros: string[]) => {
  const sectorIds = sectorMacros
    .map((macro) => {
      const resolved = mapStore.resolveSectorByMacro?.(macro) ||
        resolveMapSectorByMacro(gameDataStore.maps || { clusters: {}, sectors: {} }, macro)
      return resolved?.sectorId
    })
    .filter((id): id is string => Boolean(id))
  
  if (sectorIds.length > 0) {
    fitSectors(sectorIds)
  }
}

const onBindingDragStationStart = (payload: { stationId: string; gameGuid: string; sectorGroupId: string; name: string; icon: 'factory' | 'shipyard' | 'tradestation'; coverageSectorMacros: { ref: string; jump: number }[]; isVirtualTradestation?: boolean; blueprintStation?: StationPlan }) => {
  if (payload.isVirtualTradestation) {
    draggingVirtualTradestation.value = {
      sectorGroupId: payload.sectorGroupId,
      name: payload.name
    }
  } else {
    draggingFreeStation.value = {
      stationId: payload.stationId,
      sectorGroupId: payload.sectorGroupId,
      name: payload.name,
      icon: payload.icon as 'factory' | 'shipyard',
      blueprintStation: payload.blueprintStation
    }
  }
  draggingBindingKey.value = payload.gameGuid
  draggingSectorGroupId.value = payload.sectorGroupId
  draggingCoverageSectorMacros.value = new Set(payload.coverageSectorMacros.map(entry => entry.ref))
  draggingPlacementItem.value = null
  draggingOverlayKey.value = null
  draggingFreeSector.value = null
}

const onBindingDragStationEnd = () => {
  clearPlacementState()
  draggingBindingKey.value = null
  draggingSectorGroupId.value = null
  draggingFreeStation.value = null
  draggingVirtualTradestation.value = null
  draggingCoverageSectorMacros.value = new Set()
}

const onSaveSelectArchive = async (payload: { guid: string; time: number } | null) => {
  if (!payload) {
    saveStore.clearSelection()
    activeSavePoiCategory.value = null
    return
  }

  await saveStore.previewArchive(payload.guid, payload.time)
  activeSavePoiCategory.value = null
}

const onSaveVisibilityChange = (visibility: SavePoiVisibility) => {
  savePoiVisibility.value = visibility
}

const onMapDiagnosticVisibilityChange = (visibility: {
  sectorLabels: boolean
  sectorLinks: boolean
  sectorGroupColors: boolean
}) => {
  mapDiagnosticVisibility.value = visibility
}

const onSaveActiveCategoryChange = (category: SavePoiCategory | null) => {
  activeSavePoiCategory.value = category
}

const resolveSavePoiContentPoint = (poi: SavePoiOverlayItem) => {
  if (poi.position.tx === undefined || poi.position.ty === undefined) {
    console.error('[MapWorkbench][SavePoiData] missing-tx-ty', {
      key: poi.key,
      code: poi.code,
      category: poi.category,
      sectorMacro: poi.sectorMacro,
      hasTx: poi.position.tx !== undefined,
      hasTy: poi.position.ty !== undefined
    })
    return null
  }
  const resolved = mapStore.resolveSectorByMacro?.(poi.sectorMacro) ||
    resolveMapSectorByMacro({
      clusters: gameDataStore.maps?.clusters || {},
      sectors: gameDataStore.maps?.sectors || {}
    }, poi.sectorMacro)
  if (!resolved) return null
  const sectorLayout = searchSectors.value.find((item) => item.sectorId === resolved.sectorId)
  if (!sectorLayout) return null
  return {
    x: sectorLayout.centerX + poi.position.tx * sectorLayout.radius,
    y: sectorLayout.centerY + poi.position.ty * sectorLayout.radius
  }
}

const onSavePoiFocus = async (poi: SavePoiOverlayItem) => {
  const viewport = viewportRef.value
  if (!viewport) return

  const targetScale = maxScale.value
  if (targetScale !== scale.value) {
    scale.value = targetScale
    syncSliderFromScale()
    await nextTick()
  }
  focusedSavePoiKey.value = poi.key
  savePoiTooltipItem.value = poi

  const contentPoint = resolveSavePoiContentPoint(poi)
  if (contentPoint) {
    const viewportRect = viewport.getBoundingClientRect()
    clampPan(
      viewportRect.width / 2 - contentPoint.x * scale.value,
      viewportRect.height / 2 - contentPoint.y * scale.value
    )
    return
  }

  await nextTick()
  focusOverlayInViewport(viewport, `[data-save-poi-key="${poi.key}"]`, {
    panX: panX.value,
    panY: panY.value,
    clampPan
  })
}

const onMouseDown = (event: MouseEvent) => {
  if (draggingPlacementItem.value) return
  if (event.button !== 0) return
  event.preventDefault()
  clearBrowserSelection()
  closeTooltip()
  isDragging.value = true
  dragStartX.value = event.clientX
  dragStartY.value = event.clientY
  dragOriginX.value = panX.value
  dragOriginY.value = panY.value
}

const onMouseMove = (event: MouseEvent) => {
  lastMousePos.value = { x: event.clientX, y: event.clientY }
  if (draggingPlacementItem.value && isBindingPanelOpen.value) {
    if (draggingBindingKey.value) {
      const bindingSampleResult = resolveBindingLocationSampleAtPointer(event.clientX, event.clientY)
      const sample = bindingSampleResult?.sample || null
          placementPreview.value = sample
        ? buildBindingPreview(draggingBindingKey.value, sample.location, sample.localRatio, {
            kind: draggingPlacementItem.value.kind,
            name: draggingPlacementItem.value.name,
            icon: draggingPlacementItem.value.icon,
            savePoiVisual: draggingPlacementItem.value.savePoiVisual
          })
        : null
    } else {
      const location = resolveLocationAtPointer(event.clientX, event.clientY)
      placementPreview.value = location ? {
        kind: draggingPlacementItem.value.kind,
        name: draggingPlacementItem.value.name,
        icon: draggingPlacementItem.value.icon,
        location
      } : null
    }
  } else if (draggingFreeSector.value && isBindingPanelOpen.value) {
    const bindingSampleResult = resolveBindingLocationSampleAtPointer(event.clientX, event.clientY)
    const sample = bindingSampleResult?.sample || null
    placementPreview.value = sample
      ? buildBindingPreview(draggingBindingKey.value, sample.location, sample.localRatio, {
          kind: 'sector',
          name: draggingFreeSector.value.name,
          icon: 'tradestation'
        })
      : null
  } else if (activeBindingDragPreview.value && isBindingPanelOpen.value) {
    placementPreview.value = resolveBindingPreviewAtPointer(event.clientX, event.clientY)
  }
  if (!isDragging.value) return
  const dx = event.clientX - dragStartX.value
  const dy = event.clientY - dragStartY.value
  clampPan(dragOriginX.value + dx, dragOriginY.value + dy)
}

const onWheel = (event: WheelEvent) => {
  if (!imageNaturalWidth.value || !imageNaturalHeight.value) return
  event.preventDefault()
  lastMousePos.value = { x: event.clientX, y: event.clientY }
  closeTooltip()

  const { width: vw, height: vh } = viewportSize.value
  if (!vw || !vh) return

  const rect = viewportRef.value?.getBoundingClientRect()
  if (!rect) return

  const mouseX = event.clientX - rect.left
  const mouseY = event.clientY - rect.top
  const contentX = (mouseX - panX.value) / scale.value
  const contentY = (mouseY - panY.value) / scale.value

  const zoomStep = 0.08
  const factor = event.deltaY < 0 ? (1 + zoomStep) : (1 - zoomStep)
  const nextScale = clampScale(scale.value * factor)
  if (nextScale === scale.value) return

  triggerZoomSettling()
  scale.value = nextScale
  const nextPanX = mouseX - contentX * nextScale
  const nextPanY = mouseY - contentY * nextScale
  clampPan(nextPanX, nextPanY)
  syncSliderFromScale()
  scheduleZoomTooltipRestore()
}

const stopDrag = () => {
  isDragging.value = false
  settledSavePoiViewportContentBounds.value = liveSavePoiViewportContentBounds.value

  if (draggingPlacementItem.value && placementPreview.value) {
    applyLocationToItem(draggingPlacementItem.value, placementPreview.value.location)
  } else if (draggingFreeSector.value && placementPreview.value && draggingBindingKey.value) {
    const sectorMacro = resolveSectorMacroById(
      gameDataStore.maps || { clusters: {}, sectors: {} },
      placementPreview.value.location.cluster_id,
      placementPreview.value.location.sector_id
    )
    if (!sectorMacro) {
      clearPlacementState()
      return
    }
    saveBindingStore.updateGroup(draggingBindingKey.value, draggingFreeSector.value.sectorGroupId, {
      sectorMacro,
      coverageSectorMacros: [{ ref: sectorMacro, jump: 0 }]
    })
  } else if (draggingVirtualTradestation.value && placementPreview.value && draggingBindingKey.value && draggingSectorGroupId.value) {
    const sectorMacro = resolveSectorMacroById(gameDataStore.maps || { clusters: {}, sectors: {} }, placementPreview.value.location.cluster_id, placementPreview.value.location.sector_id)
    if (sectorMacro && draggingCoverageSectorMacros.value.has(sectorMacro)) {
      saveBindingStore.upsertTradeStation({
        gameGuid: draggingBindingKey.value,
        groupId: draggingSectorGroupId.value,
        name: draggingVirtualTradestation.value.name,
        sectorMacro,
        position: {
          x: placementPreview.value.location.pos.x,
          y: 0,
          z: placementPreview.value.location.pos.z
        }
      })
    }
  } else if (draggingFreeStation.value && placementPreview.value && draggingBindingKey.value && draggingSectorGroupId.value) {
    const sectorMacro = resolveSectorMacroById(gameDataStore.maps || { clusters: {}, sectors: {} }, placementPreview.value.location.cluster_id, placementPreview.value.location.sector_id)
    if (sectorMacro && draggingCoverageSectorMacros.value.has(sectorMacro)) {
      const source = draggingFreeStation.value.blueprintStation
      saveBindingStore.upsertStationPlan({
        gameGuid: draggingBindingKey.value,
        groupId: draggingSectorGroupId.value,
        name: source?.name || draggingFreeStation.value.name,
        type: source?.type || 'industrial',
        modules: source?.modules || [],
        settings: source?.settings,
        sectorMacro,
        position: {
          x: placementPreview.value.location.pos.x,
          y: 0,
          z: placementPreview.value.location.pos.z
        }
      })
    }
  }
  clearPlacementState()
}

const onResize = () => {
  updateViewportSize()
  recomputeScaleBounds()
  closeTooltip()
}

const onViewportDragOver = (event: DragEvent) => {
  if (!isBindingPanelOpen.value) return
  event.preventDefault()

  if (draggingPlacementItem.value && !draggingBindingKey.value) {
    const location = resolveLocationAtPointer(event.clientX, event.clientY)
    placementPreview.value = location ? {
      kind: draggingPlacementItem.value.kind,
      name: draggingPlacementItem.value.name,
      icon: draggingPlacementItem.value.icon,
      location
    } : null
  } else if (draggingFreeSector.value) {
    const location = resolveLocationAtPointer(event.clientX, event.clientY)
    placementPreview.value = location ? {
      kind: 'sector',
      name: draggingFreeSector.value.name,
      icon: 'tradestation',
      location
    } : null
  } else if (activeBindingDragPreview.value) {
    placementPreview.value = resolveBindingPreviewAtPointer(event.clientX, event.clientY)
  }
}

const onViewportDrop = (event: DragEvent) => {
  if (!isBindingPanelOpen.value) return
  event.preventDefault()
  
  const location = resolveLocationAtPointer(event.clientX, event.clientY)
  if (!location) {
    clearPlacementState()
    return
  }
  
  if (draggingPlacementItem.value) {
    applyLocationToItem(draggingPlacementItem.value, location)
  } else if (draggingFreeSector.value && draggingBindingKey.value) {
    const sectorMacro = resolveSectorMacroById(gameDataStore.maps || { clusters: {}, sectors: {} }, location.cluster_id, location.sector_id)
    if (sectorMacro) {
      saveBindingStore.updateGroup(draggingBindingKey.value, draggingFreeSector.value.sectorGroupId, {
        sectorMacro,
        coverageSectorMacros: [{ ref: sectorMacro, jump: 0 }]
      })
    }
  }
  clearPlacementState()
}

const onOverlayPointerDown = (payload: {
  key: string
  id: string
  kind: 'station' | 'sector'
  name: string
  icon: 'factory' | 'shipyard' | 'tradestation'
  draggable?: boolean
  savePoiVisual?: SavePoiOverlayItem
  binding?: {
    gameGuid: string
    sectorGroupId: string
    coverageSectorMacros: string[]
    isVirtualTradestation?: boolean
  }
}) => {
  if (payload.binding) {
    draggingPlacementItem.value = {
      id: payload.id,
      kind: payload.kind,
      name: payload.name,
      icon: payload.icon,
      savePoiVisual: payload.savePoiVisual
    }
    draggingBindingKey.value = payload.binding.gameGuid
    draggingSectorGroupId.value = payload.binding.sectorGroupId
    draggingCoverageSectorMacros.value = new Set(payload.binding.coverageSectorMacros)
    draggingOverlayKey.value = payload.key
    draggingFreeSector.value = null
    draggingFreeStation.value = null
    draggingVirtualTradestation.value = null
    return
  }

  closeSavePoiTooltip()
  draggingPlacementItem.value = {
    id: payload.id,
    kind: payload.kind,
    name: payload.name,
    icon: payload.icon
  }
  draggingOverlayKey.value = payload.key
}

const onSavePoiPointerDown = (poi: SavePoiOverlayItem) => {
  focusedSavePoiKey.value = poi.key
  savePoiTooltipItem.value = poi
}

const closeSavePoiTooltip = () => {
  savePoiTooltipItem.value = null
  focusedSavePoiKey.value = null
}

watch(isResourcePanelOpen, async () => {
  await nextTick()
  recomputeScaleBounds()
  closeTooltip()
})

watch(locale, () => {
  if (!ENABLE_MAP_SECTOR_TOOLTIP_MEASUREMENT) return
  if (!hoveredSectorSource.value) return
  hoveredSector.value = createTooltipViewModel(hoveredSectorSource.value)
  void syncTooltipMeasurement()
})

watch(hoveredSector, () => {
  if (!ENABLE_MAP_SECTOR_TOOLTIP_MEASUREMENT) return
  if (!hoveredSector.value) {
    tooltipMeasuredSize.value = { width: 0, height: 0 }
    return
  }
  void syncTooltipMeasurement()
})

watch(liveSavePoiViewportContentBounds, (bounds) => {
  if (isDragging.value || isZooming.value) return
  settledSavePoiViewportContentBounds.value = bounds
}, { immediate: true })

watch([mapViewBoxBounds, scale, panX, panY, viewportSize, centersFromLayout, clusterRadiusFromLayout], () => {
  syncViewportStateToStore()
}, { immediate: true })

onMounted(() => {
  updateViewportSize()
  window.addEventListener('resize', onResize)
  if (typeof ResizeObserver !== 'undefined' && viewportRef.value) {
    viewportResizeObserver.value = new ResizeObserver(() => {
      updateViewportSize()
      recomputeScaleBounds()
    })
    viewportResizeObserver.value.observe(viewportRef.value)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  viewportResizeObserver.value?.disconnect()
  viewportResizeObserver.value = null
  clearTooltipHideTimer()
  clearZoomRestoreTimer()
  clearZoomSettleTimer()
})
</script>

<template>
  <section class="map-workbench" data-testid="map-workbench-view">
    <div class="map-layout" :class="{ 'sidebar-active': isResourcePanelOpen, 'save-sidebar-active': isSavePanelOpen, 'binding-sidebar-active': isBindingPanelOpen }">
      <MapResourceFilterPanel
        v-show="isResourcePanelOpen"
        :sector-layouts="searchSectors"
        :mode="isResourcePanelOpen ? 'sidebar' : 'overlay'"
        :show-entry-button="false"
        @highlight-change="onResourceHighlightChange"
        @resource-visual-change="onResourceVisualChange"
        @select-sector="onResourceSectorSelect"
        @fit-sectors="onResourceFitSectors"
        @active-change="onResourceActiveChange"
        @primary-color-change="onResourcePrimaryColorChange"
        @panel-open="onResourcePanelOpen"
        @panel-close="onResourcePanelClose"
      />

      <MapSavePanel
        :open="isSavePanelOpen"
        :archive="activeMapArchive"
        @close="onSavePanelClose"
        @select-archive="onSaveSelectArchive"
        @active-category-change="onSaveActiveCategoryChange"
        @focus-poi="onSavePoiFocus"
        @context-change="onBindingContextChange"
        @focus-sector="onBindingFocusSector"
        @fit-sectors="onBindingFitSectors"
        @drag-station-start="onBindingDragStationStart"
        @drag-station-end="onBindingDragStationEnd"
      />

      <div class="map-shell">
        <div
          ref="viewportRef"
          class="map-viewport"
          data-testid="map-viewport"
          :class="{ dragging: isDragging, 'drop-forbidden': isFreeStationDropForbidden }"
          @mousedown="onMouseDown"
          @mousemove="onMouseMove"
          @mouseup="stopDrag"
          @mouseleave="stopDrag"
          @wheel="onWheel"
          @dragover="onViewportDragOver"
          @drop="onViewportDrop"
        >
          <div
            class="map-content"
          >
            <MapSvgCanvas
              :viewport-width="viewportSize.width"
              :viewport-height="viewportSize.height"
              :view-box-bounds="mapViewBoxBounds"
              :search-highlighted-sector-ids="searchHighlightedSectorIds"
              :resource-highlighted-sector-ids="resourceHighlightedSectorIds"
              :resource-sector-fills="resourceSectorFills"
              :resource-sector-group-badges="resourceSectorGroupBadges"
              :resource-fill-color-override="resourcePrimaryColor"
              :selected-sector-id="selectedSectorId"
              :placement-overlays="bindingOverlays"
              :placement-preview="isBindingPanelOpen ? placementPreview : null"
              :is-dragging="isDragging"
              :is-zooming="isZooming"
              :dragging-overlay-key="draggingOverlayKey"
              :focused-overlay-key="focusedPlacementKey"
              :save-poi-overlays="savePoiOverlays"
              :save-sectors="saveSectorLinkOverrides"
              :viewport-content-bounds="liveSavePoiViewportContentBounds"
              :sector-viewport-content-bounds="savePoiViewportContentBounds"
              :min-scale="minScale"
              :max-scale="maxScale"
              :current-scale="scale"
              :zoom-progress="zoomPercent / 100"
              :cluster-visibility-threshold-px="clusterVisibilityThresholdPx"
              :focused-save-poi-key="focusedSavePoiKey"
              :sector-owner-override="sectorOwnerOverride"
              :cluster-owner-override="clusterOwnerOverride"
              :faction-color-map="factionColorMap"
              :show-sector-labels="mapDiagnosticVisibility.sectorLabels"
              :show-sector-links="mapDiagnosticVisibility.sectorLinks"
              :show-resource-badges="true"
              :show-sector-group-colors="mapDiagnosticVisibility.sectorGroupColors || bindingContextStage === 'select-sector' || bindingContextStage === 'select-station'"
              :sector-group-color-map="sectorGroupColorMap"
              @content-size="onCanvasSize"
              @sector-layout="onSectorLayout"
              @layout-state="onLayoutState"
              @sector-hover="onSectorHover"
              @sector-leave="onSectorLeave"
              @overlay-pointerdown="onOverlayPointerDown"
              @save-poi-pointerdown="onSavePoiPointerDown"
            />
          </div>

          <div
            v-if="hoveredSector"
            class="map-sector-tooltip-layer"
            :class="`placement-${tooltipPlacement}`"
            :style="{
              left: `${tooltipPosition.left}px`,
              top: `${tooltipPosition.top}px`
            }"
            @mouseenter="onTooltipMouseEnter"
            @mouseleave="onTooltipMouseLeave"
            @mousedown.stop
          >
            <MapSectorTooltip
              ref="tooltipRef"
              :sector-id="hoveredSector.sectorId"
              :sector-owner-override="sectorOwnerOverride"
            />
          </div>

        </div>

        <div class="map-top-right-controls">
          <MapSvgDiagnosticVisibilityControl
            :visibility="mapDiagnosticVisibility"
            :expanded="activeControlPanel === 'diagnostic'"
            @visibility-change="onMapDiagnosticVisibilityChange"
            @toggle="activeControlPanel = activeControlPanel === 'diagnostic' ? null : 'diagnostic'"
          />

          <MapSavePoiVisibilityControl
            :visibility="savePoiVisibility"
            :archive="activeMapArchive"
            :expanded="activeControlPanel === 'poi'"
            @visibility-change="onSaveVisibilityChange"
            @toggle="activeControlPanel = activeControlPanel === 'poi' ? null : 'poi'"
          />
        </div>

        <div class="map-search-panel left-6 top-5" @mousedown.stop>
          <div class="search-box group" :class="{ focused: isSearchFocused }">
            <svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true">
              <circle
                cx="11"
                cy="11"
                r="6.5"
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.8"
              />
              <path
                d="M16 16l4 4"
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.8"
              />
            </svg>
            <input
              ref="searchInputRef"
              :value="searchQuery"
              class="search-input"
              data-testid="map-sector-search-input"
              name="map-sector-search"
              :placeholder="t('map.search_sector_placeholder')"
              @input="onSearchInput"
              @focus="onSearchFocus"
              @blur="onSearchBlur"
            />
            <button
              v-show="searchQuery"
              class="clear-btn opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              type="button"
              @mousedown.prevent="onClearSearch"
            >
              ×
            </button>
          </div>

          <Transition name="fade-slide-down">
            <div
              v-if="shouldShowSearchPopover"
              class="map-search-popover scrollbar-thin"
              :class="{ 'map-search-popover-wide': hasIdMatchedResult }"
              data-testid="map-sector-search-popover"
              @mousedown.prevent
            >
              <template v-if="searchResults.length > 0">
                <button
                  v-for="item in searchResults"
                  :key="item.sectorId"
                  type="button"
                  class="result-item"
                  :data-testid="`map-sector-search-result-${item.sectorId}`"
                  @click="selectSearchResult(item)"
                >
                  <span class="result-label">{{ getResultPrimaryLabel(item) }}</span>
                  <span v-if="getResultMeta(item)" class="result-meta">{{ getResultMeta(item) }}</span>
                </button>
              </template>
              <div v-else class="no-results">{{ t('map.no_search_results') }}</div>
            </div>
          </Transition>
        </div>

        <div class="map-panel-tabs left-6 bottom-5" @mousedown.stop>
          <button
            type="button"
            class="map-panel-tab"
            :class="{ active: isResourcePanelOpen }"
            data-testid="map-resource-panel-tab"
            @click="onResourcePanelOpen"
          >
            <span class="map-panel-tab-label">{{ t('map.resource_filter_button') }}</span>
            <svg class="map-panel-tab-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M3 5h18l-7 8v5l-4 2v-7L3 5z"
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.8"
              />
            </svg>
          </button>

          <button
            type="button"
            class="map-panel-tab"
            :class="{ active: isSavePanelOpen }"
            data-testid="map-save-panel-tab"
            @click="onSavePanelOpen"
          >
            <span class="map-panel-tab-label">{{ t('map.save_panel_button') }}</span>
            <svg class="map-panel-tab-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.8"
              />
            </svg>
          </button>

        </div>

        <div class="map-right-stack" @mousedown.stop>
          <div
            v-if="savePoiTooltipItem"
            class="save-poi-tooltip-layer"
          >
            <MapSavePoiTooltip :poi="savePoiTooltipItem" @close="closeSavePoiTooltip" />
          </div>

          <div class="zoom-panel">
            <div class="zoom-label-row">
              <span class="zoom-label">{{ t('map.scale') }}</span>
              <span class="zoom-value">{{ displayScaleText }}</span>
            </div>
            <input
              class="zoom-slider"
              type="range"
              name="map-zoom"
              min="0"
              max="100"
              step="0.5"
              :value="zoomPercent"
              @input="onSliderInput"
            />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.map-workbench {
  @apply w-full;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.map-shell {
  @apply relative min-w-0 flex-1 bg-black/70 rounded-lg border border-amber-300/35 overflow-hidden;
  height: 100%;
}

.map-layout {
  @apply relative flex h-full min-h-0;
}

.map-layout.sidebar-active {
  @apply gap-3;
}

.map-layout.save-sidebar-active {
  @apply gap-3;
}

.map-layout.binding-sidebar-active {
  @apply gap-3;
}

.map-viewport {
  @apply relative w-full overflow-hidden cursor-grab;
  height: 100%;
  min-height: 0;
}

.map-viewport.dragging {
  @apply cursor-grabbing;
  user-select: none;
}

.map-viewport.drop-forbidden {
  cursor: not-allowed;
}

.map-viewport.drop-forbidden * {
  cursor: not-allowed !important;
}

.map-viewport.dragging * {
  user-select: none;
}

.map-content {
  @apply select-none;
  width: 100%;
  height: 100%;
}

.map-sector-tooltip-layer {
  @apply absolute z-20;
  pointer-events: auto;
}

.map-search-panel {
  @apply absolute z-10;
  width: 220px;
}

.map-top-right-controls {
  @apply absolute right-6 top-5 z-10 flex items-start gap-2;
}

.map-resource-entry-btn {
  @apply absolute z-10 inline-flex h-10 items-center justify-center gap-2 rounded border border-amber-300/40 bg-black/75 px-4 text-sm font-semibold text-amber-50 shadow-xl transition-colors duration-150 hover:border-amber-200/70 hover:bg-black/85;
  backdrop-filter: blur(4px);
}

.map-station-entry-btn {
  @apply absolute z-10 inline-flex h-10 items-center justify-center gap-2 rounded border border-amber-300/40 bg-black/75 px-4 text-sm font-semibold text-amber-50 shadow-xl transition-colors duration-150 hover:border-amber-200/70 hover:bg-black/85;
  backdrop-filter: blur(4px);
}

.map-resource-entry-label {
  @apply leading-none;
}

.map-resource-entry-icon {
  @apply h-[18px] w-[18px] text-amber-200/70;
}

.map-station-entry-icon {
  @apply h-[18px] w-[18px] text-amber-200/70;
}

.map-panel-tabs {
  @apply absolute z-10 flex items-center gap-1;
}

.map-panel-tab {
  @apply inline-flex items-center gap-2 rounded border border-amber-300/40 bg-black/75 px-4 h-10 text-sm font-semibold text-amber-50 shadow-xl transition-colors duration-150 hover:border-amber-200/70 hover:bg-black/85;
  backdrop-filter: blur(4px);
}

.map-panel-tab.active {
  @apply border-amber-200/70 bg-amber-200/15 text-amber-50;
}

.map-panel-tab-label {
  @apply leading-none;
}

.map-panel-tab-icon {
  @apply h-[18px] w-[18px] text-amber-200/70;
}

.search-box {
  @apply flex items-center h-10 w-full bg-black/75 border border-amber-300/40 rounded px-2 shadow-xl;
  backdrop-filter: blur(4px);
}

.search-box.focused {
  @apply border-amber-200/80 ring-1 ring-amber-300/30;
}

.search-input {
  @apply flex-1 bg-transparent border-none outline-none text-amber-50 text-sm;
}

.search-input::placeholder {
  @apply text-amber-100/45;
}

.search-icon {
  @apply mr-2 h-[18px] w-[18px] shrink-0 text-amber-200/70;
}

.clear-btn {
  @apply text-amber-100/60 hover:text-amber-50 px-1 cursor-pointer;
}

.map-search-popover {
  @apply mt-2 max-h-80 overflow-y-auto rounded-md border border-amber-300/35 bg-black/85 shadow-2xl;
  backdrop-filter: blur(8px);
  width: 100%;
}

.map-search-popover-wide {
  width: 320px;
}

.result-item {
  @apply flex w-full items-start justify-between gap-3 border-b border-amber-300/10 px-3 py-2 text-left hover:bg-amber-300/10;
}

.result-label {
  @apply truncate text-sm text-amber-50;
}

.result-meta {
  @apply shrink-0 text-[11px] text-amber-100/55;
}

.no-results {
  @apply px-3 py-4 text-center text-xs text-amber-100/55;
}

.map-right-stack {
  @apply absolute right-6 bottom-5 z-30 flex flex-col items-end gap-2;
}

.zoom-panel {
  @apply rounded-md border border-amber-300/40 bg-black/70 px-3 py-2;
  width: 220px;
  backdrop-filter: blur(4px);
}

.zoom-label-row {
  @apply mb-1 flex items-center justify-between text-xs text-amber-200;
}

.zoom-label {
  @apply uppercase tracking-wider;
}

.zoom-value {
  @apply font-semibold text-amber-100;
}

.zoom-slider {
  @apply w-full accent-amber-400;
}

.fade-slide-down-enter-active,
.fade-slide-down-leave-active {
  @apply transition-all duration-100;
}

.fade-slide-down-enter-from,
.fade-slide-down-leave-to {
  @apply opacity-0 -translate-y-1;
}

.save-poi-tooltip-layer {
  @apply w-auto;
}
</style>

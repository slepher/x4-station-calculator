import { computed, type ComputedRef } from 'vue'
import type { BindingSectorGroup, BindingStationPlan, SaveBindingPlan, SavedModule, ShipBlueprint, TradeStationBinding, X4Equipment, X4Map, X4MapSector, X4Module, X4Ship } from '@/types/x4'
import type { PlayerStationEntry, PlayerStationRecord } from '@/types/saveArchive'
import type { StationDerivedMap } from '@/store/state/StationDerivedMap'
import { buildTransitRouteCandidates, type TransitRouteBuildOptions, type TransitRouteResult, type TransitRouteSegment, type TransitRouteSummary, type TransitRouteTerminal, type TransitRouteTarget } from '@/store/logic/transitRouteBuilder'
import {
  buildStationTravelEstimate,
  buildTransportShipCandidateState,
  buildTransportTravelEstimate,
  canUseHighway,
  expandHighwayAlternatives,
  estimateRouteSegmentsTravel,
  estimateSegmentTravelTimeSec,
  selectTransitRouteByTravelTime,
  sumSegmentTravelTime,
  type StationTravelEstimate,
  type TransportSegmentTravelEstimate,
  type TransportShipCandidateGroup,
  type TransportShipTravelProfile,
  type TransportTravelEstimate
} from '@/store/logic/transitTransportShip'
import { generateHighwayAlternative } from '@/store/logic/transitRouteHighway'
import { isSectorMacroInBindingScope } from '@/store/logic/saveBindingSectorScope'
import i18n from '@/i18n'

export type TransportProblemRow = {
  id: string
  targetType: 'sector-group' | 'station'
  targetName: string
  sectorName: string
  problems: string[]
}

export type TransportSectorGroupRouteRow = {
  id: string
  groupName: string
  targetSectorName: string
  targetStationName: string
  summary: TransitRouteSummary
  segments: TransportRouteSegmentView[]
  terminal: TransitRouteTerminal
  travel?: TransportTravelEstimate
}

export type TransportStationRouteRow = {
  id: string
  stationName: string
  stationCode: string
  coordinateKm: { x: number; y: number; z: number }
  terminalDistanceKm: number
  totalNormalDistanceKm: number
  productionLineCount: number
  travel?: StationTravelEstimate
}

export type TransportStationSectorGroup = {
  id: string
  sectorName: string
  summary: TransitRouteSummary
  segments: TransportRouteSegmentView[]
  terminal: TransitRouteTerminal
  stations: TransportStationRouteRow[]
  travel?: TransportTravelEstimate
  hideSectorHeader?: boolean
}

export type TransportRouteSegmentView = TransitRouteSegment & {
  travel?: TransportSegmentTravelEstimate
  highwayAlternative?: Array<TransitRouteSegment & { travel?: TransportSegmentTravelEstimate }>
}

export type TransportShipSelectorState = {
  groups: TransportShipCandidateGroup[]
  selectedBlueprintId: string | null
  selectedProfile: TransportShipTravelProfile | null
  selectedBlueprintValid: boolean
  hasCandidates: boolean
}

export type TransitTransportPanelState = {
  sectorGroupRows: TransportSectorGroupRouteRow[]
  stationSectorGroups: TransportStationSectorGroup[]
  problems: TransportProblemRow[]
  shipSelector: TransportShipSelectorState
  empty: boolean
}

export interface TransitTransportPresenterStore {
  activeBinding?: SaveBindingPlan | null
  activeTransitSectorId?: string | null
  context: { position?: { x: number; y: number; z: number } }
  mode: 'planning' | 'live'
  playerStationRecords: PlayerStationRecord[]
  planningDerivedMap?: StationDerivedMap | null
  liveFlowMap?: StationDerivedMap | null
  gameDataMaps: X4Map
  selectedTransitTransportBlueprintId?: string | null
}

export type TransitTransportPresenterDeps = {
  modulesMap: Record<string, X4Module>
  shipBlueprints: ComputedRef<ShipBlueprint[]>
  findShip: (shipId: string) => X4Ship | null
  findEquipment: (equipmentId: string) => X4Equipment | null
  includeShip: (ship: X4Ship) => boolean
  includeEquipment: (equipment: X4Equipment) => boolean
  translateShip: (ship: X4Ship) => string
  translateEquipment: (equipment: X4Equipment) => string
}

type StationTransportTarget = {
  id: string
  flowIds: string[]
  name: string
  code: string
  sectorMacro: string
  position?: { x: number; y: number; z: number }
  modules: SavedModule[]
}

type SelectedTransportRoute = {
  route: TransitRouteResult
  segments: TransitRouteSegment[]
}

export function useTransitTransportPresenter(
  store: TransitTransportPresenterStore,
  deps: TransitTransportPresenterDeps
): { props: { panel: ComputedRef<TransitTransportPanelState> } } {
  const panel = computed<TransitTransportPanelState>(() => {
    const binding = store.activeBinding
    const activeGroupId = store.activeTransitSectorId
    const activeGroup = binding?.groups.find((group) => group.id === activeGroupId) ?? null
    const hubStation = activeGroup?.tradeStation ?? null
    const hubPosition = resolveStationPosition(hubStation, store.playerStationRecords)
    const maps = store.gameDataMaps
    const problems: TransportProblemRow[] = []
    const shipCandidateState = buildTransportShipCandidateState({
      blueprints: deps.shipBlueprints.value,
      findShip: deps.findShip,
      findEquipment: deps.findEquipment,
      selectedBlueprintId: store.selectedTransitTransportBlueprintId ?? null,
      includeShip: deps.includeShip,
      includeEquipment: deps.includeEquipment,
      resolveShipName: deps.translateShip,
      translateEquipment: deps.translateEquipment
    })
    const shipSelector: TransportShipSelectorState = {
      groups: shipCandidateState.groups,
      selectedBlueprintId: shipCandidateState.selectedProfile?.blueprintId ?? null,
      selectedProfile: shipCandidateState.selectedProfile,
      selectedBlueprintValid: shipCandidateState.selectedBlueprintValid,
      hasCandidates: shipCandidateState.hasCandidates
    }
    const routeSearchCache: NonNullable<TransitRouteBuildOptions['multiTargetRouteCache']> = new Map()

    if (!binding || !activeGroup || !hubStation || !hubPosition || !hubStation.sectorMacro) {
      return {
        sectorGroupRows: [],
        stationSectorGroups: [],
        shipSelector,
        problems: [{
          id: 'active-hub',
          targetType: 'sector-group',
          targetName: activeGroup?.name ?? '',
          sectorName: sectorName(maps, activeGroup?.sectorMacro),
          problems: ['missing-active-transit-hub']
        }],
        empty: false
      }
    }

    const routeSource = {
      sectorMacro: hubStation.sectorMacro,
      position: hubPosition,
      label: hubStation.name || activeGroup.name
    }

    const sectorGroupRows = buildSectorGroupRows({
      binding,
      activeGroup,
      routeSource,
      maps,
      playerStationRecords: store.playerStationRecords,
      problems,
      travelProfile: shipCandidateState.selectedProfile,
      routeSearchCache
    })

    const stationSectorGroups = buildStationSectorGroups({
      binding,
      activeGroup,
      hubStation,
      routeSource,
      maps,
      playerStationRecords: store.playerStationRecords,
      flowMap: store.mode === 'live' ? store.liveFlowMap : store.planningDerivedMap,
      modulesMap: deps.modulesMap,
      problems,
      travelProfile: shipCandidateState.selectedProfile,
      routeSearchCache
    })

    return {
      sectorGroupRows,
      stationSectorGroups,
      problems,
      shipSelector,
      empty: sectorGroupRows.length === 0 && stationSectorGroups.length === 0 && problems.length === 0
    }
  })

  return { props: { panel } }
}

function buildSectorGroupRows(input: {
  binding: SaveBindingPlan
  activeGroup: BindingSectorGroup
  routeSource: { sectorMacro: string; position: { x: number; y: number; z: number }; label: string }
  maps: X4Map
  playerStationRecords: PlayerStationRecord[]
  problems: TransportProblemRow[]
  travelProfile: TransportShipTravelProfile | null
  routeSearchCache: NonNullable<TransitRouteBuildOptions['multiTargetRouteCache']>
}): TransportSectorGroupRouteRow[] {
  const rows: Array<TransportSectorGroupRouteRow & { order: number }> = []
  const connectedIds = input.activeGroup.connectedGroupIds ?? []

  for (const groupId of connectedIds) {
    const linkedGroup = input.binding.groups.find((group) => group.id === groupId)
    const linkedHub = linkedGroup?.tradeStation ?? null
    const linkedPosition = resolveStationPosition(linkedHub, input.playerStationRecords)
    if (!linkedGroup || !linkedHub || !linkedHub.sectorMacro || !linkedPosition) {
      input.problems.push(problemRow('sector-group', groupId, linkedGroup?.name ?? groupId, sectorName(input.maps, linkedHub?.sectorMacro ?? linkedGroup?.sectorMacro), ['missing-linked-group-hub']))
      continue
    }

    const selectedRoute = buildSelectedRoute(input.maps, input.routeSource, {
      kind: 'station',
      sectorMacro: linkedHub.sectorMacro,
      position: linkedPosition,
      label: linkedHub.name || linkedGroup.name
    }, input.travelProfile, input.routeSearchCache)
    const route = selectedRoute.route
    if (route.problems.length > 0) {
      input.problems.push(problemRow('sector-group', groupId, linkedGroup.name, sectorName(input.maps, linkedHub.sectorMacro), route.problems))
      continue
    }

    rows.push({
      id: linkedGroup.id,
      order: linkedGroup.order,
      groupName: linkedGroup.name,
      targetSectorName: sectorName(input.maps, linkedHub.sectorMacro),
      targetStationName: linkedHub.name,
      summary: route.summary,
      segments: attachSegmentTravel(selectedRoute.segments, input.travelProfile),
      terminal: route.terminal,
      travel: routeTravel(selectedRoute.segments, input.travelProfile)
    })
  }

  return rows
    .sort((a, b) =>
      a.summary.gateCount - b.summary.gateCount ||
      a.summary.normalDistanceKm - b.summary.normalDistanceKm ||
      a.order - b.order
    )
    .map(({ order: _order, ...row }) => row)
}

function buildStationSectorGroups(input: {
  binding: SaveBindingPlan
  activeGroup: BindingSectorGroup
  hubStation: TradeStationBinding
  routeSource: { sectorMacro: string; position: { x: number; y: number; z: number }; label: string }
  maps: X4Map
  playerStationRecords: PlayerStationRecord[]
  flowMap?: StationDerivedMap | null
  modulesMap: Record<string, X4Module>
  problems: TransportProblemRow[]
  travelProfile: TransportShipTravelProfile | null
  routeSearchCache: NonNullable<TransitRouteBuildOptions['multiTargetRouteCache']>
}): TransportStationSectorGroup[] {
  const stationTargets = buildStationTargets(input)
  const bySector = new Map<string, StationTransportTarget[]>()
  for (const station of stationTargets) {
    bySector.set(station.sectorMacro, [...(bySector.get(station.sectorMacro) ?? []), station])
  }

  const groups: TransportStationSectorGroup[] = []
  for (const [sectorMacro, stations] of bySector) {
    const selectedSectorRoute = buildSelectedRoute(input.maps, input.routeSource, { kind: 'sector', sectorMacro }, input.travelProfile, input.routeSearchCache)
    const sectorRoute = selectedSectorRoute.route
    if (sectorRoute.problems.length > 0) {
      input.problems.push(problemRow('station', sectorMacro, sectorName(input.maps, sectorMacro), sectorName(input.maps, sectorMacro), sectorRoute.problems))
      continue
    }

    const stationRows = stations
      .map((station) => buildStationRow(station, sectorRoute, selectedSectorRoute.segments, input))
      .filter((row): row is TransportStationRouteRow => !!row)
      .sort((a, b) => b.productionLineCount - a.productionLineCount || a.stationName.localeCompare(b.stationName))

    if (stationRows.length > 0) {
      groups.push({
        id: sectorMacro,
        sectorName: sectorName(input.maps, sectorMacro),
        summary: sectorRoute.summary,
        segments: attachSegmentTravel(selectedSectorRoute.segments, input.travelProfile),
        terminal: sectorRoute.terminal,
        stations: stationRows,
        travel: routeTravel(selectedSectorRoute.segments, input.travelProfile),
        hideSectorHeader: input.routeSource.sectorMacro === sectorMacro
      })
    }
  }

  return groups.sort((a, b) =>
    a.summary.gateCount - b.summary.gateCount ||
    a.summary.normalDistanceKm - b.summary.normalDistanceKm ||
    a.sectorName.localeCompare(b.sectorName)
  )
}

function buildStationRow(
  station: StationTransportTarget,
  sectorRoute: TransitRouteResult,
  highwaySegments: TransitRouteSegment[],
  input: {
    maps: X4Map
    flowMap?: StationDerivedMap | null
    modulesMap: Record<string, X4Module>
    problems: TransportProblemRow[]
    travelProfile: TransportShipTravelProfile | null
  }
): TransportStationRouteRow | null {
  if (!station.position) {
    input.problems.push(problemRow('station', station.id, station.name, sectorName(input.maps, station.sectorMacro), ['missing-station-position']))
    return null
  }
  const terminalDistanceKm = kmDistance(sectorRoute.terminal.position, station.position)
  const localTimeSec = input.travelProfile
    ? estimateSegmentTravelTimeSec(terminalDistanceKm, input.travelProfile)
    : 0
  const sectorTimeSec = input.travelProfile
    ? routeTravelTime(highwaySegments, input.travelProfile)
    : 0
  return {
    id: station.id,
    stationName: station.name,
    stationCode: station.code,
    coordinateKm: { x: station.position.x / 1000, y: station.position.y / 1000, z: station.position.z / 1000 },
    terminalDistanceKm,
    totalNormalDistanceKm: sectorRoute.summary.normalDistanceKm + terminalDistanceKm,
    productionLineCount: productionLineCount(station, input.flowMap, input.modulesMap),
    travel: input.travelProfile
      ? buildStationTravelEstimate({ localTimeSec, sectorTimeSec, profile: input.travelProfile })
      : undefined
  }
}

function attachSegmentTravel(
  segments: TransitRouteSegment[],
  profile: TransportShipTravelProfile | null
): TransportRouteSegmentView[] {
  return segments.map((segment) => {
    const travels = profile ? estimateRouteSegmentsTravel([segment], profile) : [undefined]
    const highwayTravels = segment.highwayAlternative && profile
      ? estimateRouteSegmentsTravel(segment.highwayAlternative, profile)
      : undefined
    return {
      ...segment,
      travel: travels[0],
      highwayAlternative: highwayTravels
        ? segment.highwayAlternative?.map((altSeg, i) => ({ ...altSeg, travel: highwayTravels[i] }))
        : segment.highwayAlternative
    } as TransportRouteSegmentView
  })
}

function injectHighwayAlternatives(
  segments: TransitRouteSegment[],
  sectorPath: string[],
  sectors: Record<string, X4MapSector>,
  profile: TransportShipTravelProfile | null
): TransitRouteSegment[] {
  if (!profile || !canUseHighway(profile)) return segments

  let sectorIndex = 0
  return segments.map((segment) => {
    if (segment.kind === 'gate-transit' || segment.kind === 'superhighway') {
      sectorIndex += 1
      return segment
    }
    if (!segment.countsInSummaryDistance) return segment
    if (segment.distanceKm <= 0) return segment

    const currentSectorMacro = sectorPath[sectorIndex]
    if (!currentSectorMacro) return segment
    const highwaySector = sectors[currentSectorMacro]
    if (!highwaySector) return segment

    const fromPos = segment.fromPosition
    const toPos = segment.toPosition
    if (!fromPos || !toPos) return segment

    const alternative = generateHighwayAlternative(
      { x: fromPos.x, z: fromPos.z },
      { x: toPos.x, z: toPos.z },
      segment.fromLabel,
      segment.toLabel,
      highwaySector
    )

    if (!alternative) return segment

    const altSegments = [
      ...alternative.approachSegments,
      alternative.highwaySegment,
      ...alternative.exitSegments
    ]

    return { ...segment, highwayAlternative: altSegments }
  })
}

function routeTravel(segments: TransitRouteSegment[], profile: TransportShipTravelProfile | null): TransportTravelEstimate | undefined {
  if (!profile) return undefined
  return buildTransportTravelEstimate(routeTravelTime(segments, profile), profile)
}

function routeTravelTime(segments: TransitRouteSegment[], profile: TransportShipTravelProfile): number {
  const expanded = expandHighwayAlternatives(segments, profile)
  return sumSegmentTravelTime(estimateRouteSegmentsTravel(expanded, profile))
}

function buildSelectedRoute(
  maps: X4Map,
  routeSource: { sectorMacro: string; position: { x: number; y: number; z: number }; label: string },
  target: TransitRouteTarget,
  profile: TransportShipTravelProfile | null,
  routeSearchCache: NonNullable<TransitRouteBuildOptions['multiTargetRouteCache']>
): SelectedTransportRoute {
  const canUseRing = !!profile && canUseHighway(profile)
  const candidates = buildTransitRouteCandidates({
    clusters: maps.clusters,
    sectors: maps.sectors,
    highwayRingChains: canUseRing ? maps.highwayRingChains : undefined,
    resolveSectorLabel,
    from: routeSource,
    target
  }, {
    includeHighwayRingCandidates: canUseRing,
    multiTargetRouteCache: routeSearchCache
  })
  const first = candidates[0]!
  if (first.problems.length > 0 || !profile) {
    return { route: first, segments: first.segments }
  }
  const validCandidates = candidates.filter((candidate) => candidate.problems.length === 0)
  const selected = selectTransitRouteByTravelTime(
    validCandidates,
    profile,
    (candidate) => injectHighwayAlternatives(candidate.segments, candidate.sectors, maps.sectors, profile)
  )
  return { route: selected.route, segments: selected.segments }
}

function buildStationTargets(input: {
  binding: SaveBindingPlan
  activeGroup: BindingSectorGroup
  hubStation: TradeStationBinding
  playerStationRecords: PlayerStationRecord[]
}): StationTransportTarget[] {
  const targets: StationTransportTarget[] = []
  const emittedIds = new Set<string>()
  const plansByCode = new Map<string, BindingStationPlan>()
  const tradeStationCodes = new Set<string>()
  const tradeStationIds = new Set<string>()

  for (const group of input.binding.groups) {
    if (group.tradeStation?.saveStationCode) tradeStationCodes.add(group.tradeStation.saveStationCode)
    if (group.tradeStation?.id) tradeStationIds.add(group.tradeStation.id)
  }

  for (const plan of input.binding.stationPlans) {
    if (plan.saveStationCode) plansByCode.set(plan.saveStationCode, plan)
  }

  for (const record of input.playerStationRecords) {
    if (record.type !== 'station') continue
    if (!isSectorMacroInBindingScope(input.activeGroup, record.sectorMacro)) continue
    if (tradeStationCodes.has(record.code)) continue
    const data = record.data as PlayerStationEntry
    const plan = plansByCode.get(record.code)
    const id = plan?.id ?? record.code
    targets.push({
      id,
      flowIds: plan ? [plan.id, record.code] : [record.code],
      name: plan?.name || record.code || data.macro || 'Save Station',
      code: record.code,
      sectorMacro: record.sectorMacro,
      position: data.relative_position,
      modules: plan?.modules?.length ? plan.modules : modulesFromRecord(data)
    })
    emittedIds.add(id)
  }

  for (const plan of input.binding.stationPlans) {
    if (emittedIds.has(plan.id)) continue
    if (plan.groupId !== input.activeGroup.id) continue
    if (tradeStationIds.has(plan.id)) continue
    if (!plan.sectorMacro) continue
    targets.push({
      id: plan.id,
      flowIds: [plan.id],
      name: plan.name,
      code: plan.saveStationCode ?? plan.id,
      sectorMacro: plan.sectorMacro,
      position: plan.position,
      modules: plan.modules
    })
  }

  return targets
}

function modulesFromRecord(station: PlayerStationEntry): SavedModule[] {
  const modules: SavedModule[] = []
  for (const module of station.modules ?? []) {
    if (!module.module_id) continue
    const existing = modules.find((item) => item.id === module.module_id)
    if (existing) {
      existing.count += module.amount || 1
    } else {
      modules.push({ id: module.module_id, count: module.amount || 1 })
    }
  }
  return modules
}

function resolveStationPosition(
  station: { saveStationCode?: string; position?: { x: number; y: number; z: number } } | null | undefined,
  records: PlayerStationRecord[]
): { x: number; y: number; z: number } | null {
  if (station?.position) return station.position
  if (!station?.saveStationCode) return null
  const record = records.find((item) => item.type === 'station' && item.code === station.saveStationCode)
  const data = record?.data as PlayerStationEntry | undefined
  if (!data?.relative_position) return null
  return data.relative_position
}

function productionLineCount(station: StationTransportTarget, flowMap: StationDerivedMap | null | undefined, modulesMap: Record<string, X4Module>): number {
  const wareIdsFromFlows = new Set<string>()
  for (const flowId of station.flowIds) {
    for (const flow of flowMap?.getProductionFlows(flowId) ?? []) {
      if (flow.production > 0) wareIdsFromFlows.add(flow.wareId)
    }
  }
  const flowCount = wareIdsFromFlows.size
  if (flowCount > 0) return flowCount

  const wareIds = new Set<string>()
  for (const module of station.modules) {
    if (module.count <= 0) continue
    const info = modulesMap[module.id]
    for (const wareId of Object.keys(info?.outputs ?? {})) {
      wareIds.add(wareId)
    }
  }
  return wareIds.size
}

function sectorName(maps: X4Map, sectorMacro: string | undefined): string {
  if (!sectorMacro) return ''
  const sector = maps.sectors[sectorMacro]
  if (!sector) return sectorMacro
  return resolveSectorLabel(sector)
}

function resolveSectorLabel(sector: { id: string; name?: string; nameId?: string }): string {
  if (sector.nameId && i18n.global.te(sector.nameId)) return i18n.global.t(sector.nameId)
  return sector.name || sector.id
}

function problemRow(
  targetType: 'sector-group' | 'station',
  id: string,
  targetName: string,
  sectorNameValue: string,
  problems: string[]
): TransportProblemRow {
  return {
    id: `${targetType}:${id}`,
    targetType,
    targetName,
    sectorName: sectorNameValue,
    problems
  }
}

function kmDistance(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = a.z - b.z
  return Math.sqrt(dx * dx + dy * dy + dz * dz) / 1000
}

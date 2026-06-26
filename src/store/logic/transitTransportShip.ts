import type { ShipBlueprint, X4Equipment, X4Ship, X4Ware } from '@/types/x4'
import type { WareProductionFlow } from '@/types/production-flow'
import type { TransitRouteResult, TransitRouteSegment, TransitRouteSummary } from '@/store/logic/transitRouteBuilder'

export type TransportShipEngineInfo = {
  equipmentId: string
  count: number
  name: string
}

export type TransportShipTravelProfile = {
  blueprintId: string
  blueprintName: string
  shipId: string
  shipName: string
  shipClass: string
  containerCapacityM3: number
  baseSpeedMps: number
  travelSpeedMps: number
  chargeSec: number
  attackSec: number
  releaseSec: number
  attackDistanceKm: number
  decelDistanceKm: number
  engines: TransportShipEngineInfo[]
}

export type TransportShipBlueprintCandidate = {
  id: string
  name: string
  profile: TransportShipTravelProfile
}

export type TransportShipCandidateGroup = {
  shipId: string
  shipName: string
  shipType: string
  containerCapacityM3: number
  blueprints: TransportShipBlueprintCandidate[]
}

export type TransportShipCandidateState = {
  groups: TransportShipCandidateGroup[]
  selectedProfile: TransportShipTravelProfile | null
  selectedBlueprintValid: boolean
  hasCandidates: boolean
}

export type TransportTravelEstimate = {
  timeSec: number
  formattedTime: string
  throughputM3PerHour?: number
  formattedThroughput?: string
}

export type TransportSegmentTravelEstimate = {
  timeSec: number
  formattedTime: string
}

export type StationTravelEstimate = {
  localTimeSec: number
  totalTimeSec: number
  formattedLocalTime: string
  formattedTotalTime: string
  throughputM3PerHour?: number
  formattedThroughput?: string
}

export type StationProductItem = {
  wareId: string
  name: string
  priority: number
  tier: number
  netRate: number
}

export type StationProductsSummary = {
  label: string
  count: number
  items: StationProductItem[]
}

export type SelectedTransitRouteTravel = {
  route: TransitRouteResult
  segments: TransitRouteSegment[]
  travelTimeSec: number
}

export function buildTransportShipCandidateState(input: {
  blueprints: ShipBlueprint[]
  findShip: (shipId: string) => X4Ship | null
  findEquipment: (equipmentId: string) => X4Equipment | null
  selectedBlueprintId: string | null
  includeShip?: (ship: X4Ship) => boolean
  includeEquipment?: (equipment: X4Equipment) => boolean
  resolveShipName?: (ship: X4Ship) => string
  translateEquipment?: (equipment: X4Equipment) => string
}): TransportShipCandidateState {
  const groupsByShip = new Map<string, TransportShipCandidateGroup>()
  let selectedProfile: TransportShipTravelProfile | null = null
  let selectedBlueprintSeen = false

  for (const blueprint of input.blueprints) {
    if (!blueprint.favorite) continue
    const ship = input.findShip(blueprint.shipId)
    if (!ship) continue
    if (ship.type !== 'freighter' && ship.type !== 'transporter') continue
    if (input.includeShip && !input.includeShip(ship)) continue

    const profile = buildTransportShipTravelProfile({
      blueprint,
      ship,
      findEquipment: input.findEquipment,
      includeEquipment: input.includeEquipment,
      resolveShipName: input.resolveShipName,
      translateEquipment: input.translateEquipment
    })
    if (!profile) continue

    const candidate: TransportShipBlueprintCandidate = {
      id: blueprint.id,
      name: blueprint.name,
      profile
    }
    const group = groupsByShip.get(ship.id) ?? {
      shipId: ship.id,
      shipName: input.resolveShipName ? input.resolveShipName(ship) : ship.name || ship.id,
      shipType: ship.type,
      containerCapacityM3: profile.containerCapacityM3,
      blueprints: []
    }
    group.blueprints.push(candidate)
    groupsByShip.set(ship.id, group)

    if (blueprint.id === input.selectedBlueprintId) {
      selectedBlueprintSeen = true
      selectedProfile = profile
    }
  }

  const groups = [...groupsByShip.values()]
    .map((group) => ({
      ...group,
      blueprints: [...group.blueprints].sort((a, b) =>
        b.profile.travelSpeedMps - a.profile.travelSpeedMps ||
        a.name.localeCompare(b.name)
      )
    }))
    .sort((a, b) =>
      b.containerCapacityM3 - a.containerCapacityM3 ||
      a.shipName.localeCompare(b.shipName)
    )

  return {
    groups,
    selectedProfile,
    selectedBlueprintValid: input.selectedBlueprintId ? selectedBlueprintSeen : true,
    hasCandidates: groups.length > 0
  }
}

export function buildTransportShipTravelProfile(input: {
  blueprint: ShipBlueprint
  ship: X4Ship
  findEquipment: (equipmentId: string) => X4Equipment | null
  includeEquipment?: (equipment: X4Equipment) => boolean
  resolveShipName?: (ship: X4Ship) => string
  translateEquipment?: (equipment: X4Equipment) => string
}): TransportShipTravelProfile | null {
  const containerCapacityM3 = input.ship.cargo.find((cargo) => cargo.type === 'container')?.capacity ?? 0
  if (containerCapacityM3 <= 0) return null

  let baseThrust = 0
  let travelThrust = 0
  let chargeSec = 0
  let attackSec = 0
  let releaseSec = 0
  const engines: TransportShipEngineInfo[] = []

  for (const connection of input.blueprint.connections) {
    if (connection.slot_type !== 'engine') continue
    for (const group of connection.group) {
      if (!group.equipment_id || group.count <= 0) continue
      const equipment = input.findEquipment(group.equipment_id)
      if (!equipment) continue
      if (input.includeEquipment && !input.includeEquipment(equipment)) continue

      const thrustForward = equipment.thrust?.forward ?? 0
      const travelMultiplier = equipment.travel?.thrust ?? 0
      const charge = equipment.travel?.charge
      const attack = equipment.travel?.attack
      const release = equipment.travel?.release
      if (thrustForward <= 0 || travelMultiplier <= 1 || charge === undefined || attack === undefined || release === undefined) continue
      if (charge < 0 || attack <= 0 || release <= 0) continue

      baseThrust += thrustForward * group.count
      travelThrust += thrustForward * travelMultiplier * group.count
      chargeSec = Math.max(chargeSec, charge)
      attackSec = Math.max(attackSec, attack)
      releaseSec = Math.max(releaseSec, release)

      const name = input.translateEquipment ? input.translateEquipment(equipment) : equipment.name || equipment.id
      const existing = engines.find((e) => e.equipmentId === group.equipment_id)
      if (existing) {
        existing.count += group.count
      } else {
        engines.push({
          equipmentId: group.equipment_id,
          count: group.count,
          name
        })
      }
    }
  }

  const dragForward = input.ship.physics?.drag?.forward ?? 0
  if (dragForward <= 0 || baseThrust <= 0 || travelThrust <= 0 || attackSec <= 0 || releaseSec <= 0) return null

  const baseSpeedMps = baseThrust / dragForward
  const travelSpeedMps = travelThrust / dragForward
  if (baseSpeedMps <= 0 || travelSpeedMps <= baseSpeedMps) return null

  const attackDistanceKm = ((baseSpeedMps + travelSpeedMps) / 2) * attackSec / 1000
  const decelDistanceKm = ((travelSpeedMps + baseSpeedMps) / 2) * releaseSec / 1000

  return {
    blueprintId: input.blueprint.id,
    blueprintName: input.blueprint.name,
    shipId: input.ship.id,
    shipName: input.resolveShipName ? input.resolveShipName(input.ship) : input.ship.name || input.ship.id,
    shipClass: input.ship.class,
    containerCapacityM3,
    baseSpeedMps,
    travelSpeedMps,
    chargeSec,
    attackSec,
    releaseSec,
    attackDistanceKm,
    decelDistanceKm,
    engines
  }
}

export function estimateSegmentTravelTimeSec(distanceKm: number, profile: TransportShipTravelProfile, opts?: { skipRelease?: boolean }): number {
  if (distanceKm <= 0) return 0
  const speedDelta = profile.travelSpeedMps - profile.baseSpeedMps
  if (speedDelta <= 0 || profile.attackSec <= 0 || profile.releaseSec <= 0) return 0

  const attackAndDecelKm = profile.attackDistanceKm + profile.decelDistanceKm
  if (distanceKm > attackAndDecelKm) {
    const cruiseSec = (distanceKm - attackAndDecelKm) / (profile.travelSpeedMps / 1000)
    const releaseSec = opts?.skipRelease ? 0 : profile.releaseSec
    return profile.chargeSec + profile.attackSec + cruiseSec + releaseSec
  }

  if (opts?.skipRelease) {
    const distanceM = distanceKm * 1000
    const accelerationUp = speedDelta / profile.attackSec
    if (accelerationUp <= 0) return 0
    const attackDistM = profile.attackDistanceKm * 1000
    if (distanceM <= attackDistM) {
      const peakSpeedMps = Math.sqrt(profile.baseSpeedMps ** 2 + 2 * accelerationUp * distanceM)
      return profile.chargeSec + (peakSpeedMps - profile.baseSpeedMps) / accelerationUp
    }
    const cruiseM = distanceM - attackDistM
    return profile.chargeSec + profile.attackSec + (cruiseM / profile.travelSpeedMps)
  }

  const distanceM = distanceKm * 1000
  const accelerationUp = speedDelta / profile.attackSec
  const accelerationDown = speedDelta / profile.releaseSec
  if (accelerationUp <= 0 || accelerationDown <= 0) return 0

  const peakSpeedSquared = profile.baseSpeedMps ** 2
    + (2 * distanceM) / ((1 / accelerationUp) + (1 / accelerationDown))
  const peakSpeedMps = Math.sqrt(Math.max(profile.baseSpeedMps ** 2, peakSpeedSquared))
  const attackTimeSec = (peakSpeedMps - profile.baseSpeedMps) / accelerationUp
  const releaseTimeSec = (peakSpeedMps - profile.baseSpeedMps) / accelerationDown
  return profile.chargeSec + attackTimeSec + releaseTimeSec
}

const HIGHWAY_SPEED_MPS = 12000

export function canUseHighway(profile: TransportShipTravelProfile): boolean {
  return profile.shipClass === 'ship_s' || profile.shipClass === 'ship_m'
}

export function estimateHighwaySegmentTimeSec(distanceKm: number): number {
  if (distanceKm <= 0) return 0
  return distanceKm / (HIGHWAY_SPEED_MPS / 1000)
}

export function estimateHighwayExitOverheadSec(profile: TransportShipTravelProfile): number {
  return profile.chargeSec + profile.attackSec
}

export function estimateRouteSegmentsTravel(
  segments: TransitRouteSegment[],
  profile: TransportShipTravelProfile
): Array<TransportSegmentTravelEstimate | undefined> {
  return segments.map((segment) => {
    if (segment.kind === 'highway') {
      const timeSec = estimateHighwaySegmentTimeSec(segment.distanceKm)
      if (timeSec <= 0) return undefined
      return {
        timeSec,
        formattedTime: formatTransportTime(timeSec)
      }
    }
    if (segment.kind === 'highway-exit') {
      const timeSec = estimateSegmentTravelTimeSec(segment.distanceKm, profile)
      if (timeSec <= 0) return undefined
      return {
        timeSec,
        formattedTime: formatTransportTime(timeSec)
      }
    }
    if (segment.kind === 'highway-approach') {
      const timeSec = estimateSegmentTravelTimeSec(segment.distanceKm, profile, { skipRelease: true })
      if (timeSec <= 0) return undefined
      return {
        timeSec,
        formattedTime: formatTransportTime(timeSec)
      }
    }
    if (!segment.countsInSummaryDistance) return undefined
    const timeSec = estimateSegmentTravelTimeSec(segment.distanceKm, profile)
    if (timeSec <= 0) return undefined
    return {
      timeSec,
      formattedTime: formatTransportTime(timeSec)
    }
  })
}

export function sumSegmentTravelTime(travels: Array<TransportSegmentTravelEstimate | undefined>): number {
  return travels.reduce((sum, travel) => sum + (travel?.timeSec ?? 0), 0)
}

export function routeSegmentsTravelTime(segments: TransitRouteSegment[], profile: TransportShipTravelProfile): number {
  return sumSegmentTravelTime(estimateRouteSegmentsTravel(segments, profile))
}

export function expandHighwayAlternatives(
  segments: TransitRouteSegment[],
  profile?: TransportShipTravelProfile | null
): TransitRouteSegment[] {
  if (!profile) return segments
  if (!canUseHighway(profile)) return segments
  return segments.flatMap((segment) => {
    if (!segment.highwayAlternative || segment.highwayAlternative.length === 0) return [segment]
    const directTime = routeSegmentsTravelTime([segment], profile)
    const highwayTime = routeSegmentsTravelTime(segment.highwayAlternative, profile)
    if (highwayTime <= 0) return [segment]
    return highwayTime < directTime ? segment.highwayAlternative : [segment]
  })
}

function routeDominates(
  left: TransitRouteResult,
  right: TransitRouteResult,
  metrics: Array<keyof TransitRouteResult['summary']>
): boolean {
  let hasStrictAdvantage = false
  for (const metric of metrics) {
    const leftValue = left.summary[metric]
    const rightValue = right.summary[metric]
    if (leftValue > rightValue) return false
    if (leftValue < rightValue) hasStrictAdvantage = true
  }
  return hasStrictAdvantage
}

function filterNonDominatedRouteCandidates(
  candidates: TransitRouteResult[],
  metrics: Array<keyof TransitRouteResult['summary']>
): TransitRouteResult[] {
  return candidates.filter((candidate) =>
    !candidates.some((other) => other !== candidate && routeDominates(other, candidate, metrics))
  )
}

export function filterTransitRouteCandidatesForProfile(
  candidates: TransitRouteResult[],
  profile?: TransportShipTravelProfile | null
): TransitRouteResult[] {
  if (candidates.length <= 1) return candidates
  if (!profile || !canUseHighway(profile)) {
    return filterNonDominatedRouteCandidates(candidates, ['gateCount', 'normalDistanceKm'])
  }
  return filterNonDominatedRouteCandidates(candidates, [
    'gateCount',
    'normalDistanceKm',
    'engineDistanceKm',
    'engineGateCount'
  ])
}

export function selectTransitRouteByTravelTime(
  candidates: TransitRouteResult[],
  profile: TransportShipTravelProfile,
  expandSegments: (route: TransitRouteResult) => TransitRouteSegment[] = (route) => route.segments
): SelectedTransitRouteTravel {
  const candidatePool = filterTransitRouteCandidatesForProfile(candidates, profile)
  const ranked = candidatePool.map((route, index) => {
    const injected = expandSegments(route)
    const segments = expandHighwayAlternatives(injected, profile)
    return {
      route,
      segments,
      travelTimeSec: routeSegmentsTravelTime(segments, profile),
      order: route.candidateOrder ?? index
    }
  })

  ranked.sort((a, b) =>
    a.travelTimeSec - b.travelTimeSec ||
    a.route.summary.normalDistanceKm - b.route.summary.normalDistanceKm ||
    a.order - b.order
  )

  const selected = ranked[0]
  if (!selected) {
    throw new Error('selectTransitRouteByTravelTime requires at least one candidate')
  }
  return {
    route: selected.route,
    segments: selected.segments,
    travelTimeSec: selected.travelTimeSec
  }
}

export function buildTransitRouteSummaryForSegments(
  baseSummary: TransitRouteSummary,
  segments: TransitRouteSegment[]
): TransitRouteSummary {
  let engineDistanceKm = 0
  let highwayDistanceKm = 0
  let superhighwayDistanceKm = 0

  for (const segment of segments) {
    if (segment.kind === 'superhighway') {
      superhighwayDistanceKm += segment.distanceKm
      continue
    }
    if (segment.kind === 'highway') {
      highwayDistanceKm += segment.distanceKm
      continue
    }
    if (segment.countsInSummaryDistance) {
      engineDistanceKm += segment.distanceKm
    }
  }

  return {
    ...baseSummary,
    normalDistanceKm: engineDistanceKm + highwayDistanceKm,
    superhighwayDistanceKm,
    highwayDistanceKm,
    engineDistanceKm
  }
}

export function buildStationRouteSummaryForLocalSegments(
  sectorSummary: TransitRouteSummary,
  localSegments: TransitRouteSegment[]
): TransitRouteSummary {
  const localSummary = buildTransitRouteSummaryForSegments({
    gateCount: 0,
    normalDistanceKm: 0,
    superhighwayDistanceKm: 0,
    highwayDistanceKm: 0,
    engineDistanceKm: 0,
    highwayGateCount: 0,
    engineGateCount: 0
  }, localSegments)

  return {
    ...sectorSummary,
    normalDistanceKm: sectorSummary.normalDistanceKm + localSummary.normalDistanceKm,
    superhighwayDistanceKm: sectorSummary.superhighwayDistanceKm + localSummary.superhighwayDistanceKm,
    highwayDistanceKm: sectorSummary.highwayDistanceKm + localSummary.highwayDistanceKm,
    engineDistanceKm: sectorSummary.engineDistanceKm + localSummary.engineDistanceKm
  }
}

export function buildStationProductsFromFlows(input: {
  flows: WareProductionFlow[]
  priorityLevels: Record<string, number>
  waresMap: Record<string, X4Ware>
  resolveWareName: (wareId: string) => string
  emptyLabel: string
}): StationProductsSummary {
  const byWare = new Map<string, StationProductItem>()

  for (const flow of input.flows) {
    const priority = input.priorityLevels[flow.wareId] ?? 0
    if (flow.netRate <= 0 || priority <= 0) continue

    const ware = input.waresMap[flow.wareId]
    const tier = ware ? ware.tier : flow.tier
    const existing = byWare.get(flow.wareId)
    if (existing) {
      existing.netRate += flow.netRate
      existing.priority = Math.max(existing.priority, priority)
      existing.tier = Math.max(existing.tier, tier)
      continue
    }

    byWare.set(flow.wareId, {
      wareId: flow.wareId,
      name: input.resolveWareName(flow.wareId),
      priority,
      tier,
      netRate: flow.netRate
    })
  }

  const items = [...byWare.values()].sort((a, b) =>
    b.priority - a.priority ||
    b.tier - a.tier ||
    a.name.localeCompare(b.name)
  )
  if (items.length === 0) {
    return { label: input.emptyLabel, count: 0, items }
  }

  const visible = items.slice(0, 2).map((item) => item.name).join(', ')
  const hiddenCount = items.length - 2
  return {
    label: hiddenCount > 0 ? `${visible} +${hiddenCount}` : visible,
    count: items.length,
    items
  }
}

export function buildTransportTravelEstimate(
  timeSec: number,
  profile: TransportShipTravelProfile
): TransportTravelEstimate | undefined {
  if (timeSec <= 0) return undefined
  const throughput = profile.containerCapacityM3 / timeSec * 3600
  return {
    timeSec,
    formattedTime: formatTransportTime(timeSec),
    throughputM3PerHour: throughput,
    formattedThroughput: formatThroughput(throughput)
  }
}

export function buildStationTravelEstimate(input: {
  localTimeSec: number
  sectorTimeSec: number
  profile: TransportShipTravelProfile
}): StationTravelEstimate | undefined {
  const totalTimeSec = input.localTimeSec + input.sectorTimeSec
  if (totalTimeSec <= 0) return undefined
  const throughput = input.profile.containerCapacityM3 / totalTimeSec * 3600
  return {
    localTimeSec: input.localTimeSec,
    totalTimeSec,
    formattedLocalTime: formatTransportTime(input.localTimeSec),
    formattedTotalTime: formatTransportTime(totalTimeSec),
    throughputM3PerHour: throughput,
    formattedThroughput: formatThroughput(throughput)
  }
}

export function formatTransportTime(timeSec: number): string {
  const rounded = Math.max(0, Math.round(timeSec))
  if (rounded < 3600) {
    const minutes = Math.floor(rounded / 60)
    const seconds = rounded % 60
    return `${minutes}m ${seconds}s`
  }
  const hours = Math.floor(rounded / 3600)
  const minutes = Math.floor((rounded % 3600) / 60)
  return `${hours}h ${minutes}m`
}

export function formatThroughput(value: number): string {
  return `${Math.round(value).toLocaleString()} m3/h`
}

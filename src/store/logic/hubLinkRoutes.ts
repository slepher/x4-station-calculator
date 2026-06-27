import type { GroupDraftInfo } from './autoGroup'
import { buildTransitRouteCandidates, type TransitRouteResult } from './transitRouteBuilder'
import type { SaveBindingPlan, TradeStationBinding, X4Map } from '@/types/x4'
import type { PlayerStationEntry, PlayerStationRecord } from '@/types/saveArchive'

export type HubLinkRouteCacheScope = 'binding' | 'draft'

export type HubLinkRouteEndpoint = {
  groupId: string
  sectorMacro: string
  stationLabel: string
  position: { x: number; y: number; z: number }
}

export type HubLinkRouteEntry = {
  id: string
  scope: HubLinkRouteCacheScope
  fromGroupId: string
  toGroupId: string
  from: HubLinkRouteEndpoint
  to: HubLinkRouteEndpoint
  colorGroupId: string
  color?: string
  endpointColors?: {
    from?: string
    to?: string
  }
  candidates: TransitRouteResult[]
  problems: string[]
}

export type HubLinkRouteCache = {
  entries: HubLinkRouteEntry[]
  binding: HubLinkRouteEntry[]
  draft: HubLinkRouteEntry[]
}

type RouteGroup = {
  id: string
  name: string
  sectorMacro?: string
  connectedGroupIds?: string[]
  color?: string
  tradeStation?: TradeStationBinding
  selectedTradeStation?: GroupDraftInfo['selectedTradeStation']
  virtualTradeStationPosition?: { x: number; y: number; z: number }
}

export function buildHubLinkRouteEntries(input: {
  scope: HubLinkRouteCacheScope
  groups: RouteGroup[]
  maps: X4Map
  playerStationRecords: PlayerStationRecord[]
  cache?: Map<string, HubLinkRouteEntry>
  resolveSectorLabel?: (sector: { id: string; name?: string; nameId?: string }) => string
  getVirtualTradeStationDefaultPosition?: (sectorMacro: string) => { x: number; y: number; z: number }
}): HubLinkRouteEntry[] {
  const rows: HubLinkRouteEntry[] = []
  const groupsById = new Map(input.groups.map((group) => [group.id, group]))
  const emitted = new Set<string>()

  for (const group of input.groups) {
    for (const linkedGroupId of group.connectedGroupIds ?? []) {
      const linkedGroup = groupsById.get(linkedGroupId)
      if (!linkedGroup) continue

      const from = resolveHubEndpoint(group, input)
      const to = resolveHubEndpoint(linkedGroup, input)
      const colorGroup = colorGroupForEndpoints(group, linkedGroup, from, to)
      const endpointColors = {
        from: group.color,
        to: linkedGroup.color
      }

      if (!from || !to) {
        const linkKey = missingHubLinkRouteKey(input.scope, group.id, linkedGroup.id)
        if (emitted.has(linkKey)) continue
        emitted.add(linkKey)
        rows.push({
          id: linkKey,
          scope: input.scope,
          fromGroupId: group.id,
          toGroupId: linkedGroup.id,
          from: from ?? missingEndpoint(group),
          to: to ?? missingEndpoint(linkedGroup),
          colorGroupId: colorGroup.id,
          color: colorGroup.color,
          endpointColors,
          candidates: [],
          problems: ['missing-hub-route-endpoint']
        })
        continue
      }

      const linkKey = hubLinkRouteKey(from, to)
      if (emitted.has(linkKey)) continue
      emitted.add(linkKey)

      const routeEntry = input.cache?.get(linkKey) ?? createHubLinkRouteEntry({
        scope: input.scope,
        linkKey,
        group,
        linkedGroup,
        from,
        to,
        colorGroup,
        maps: input.maps,
        resolveSectorLabel: input.resolveSectorLabel
      })
      if (input.cache && !input.cache.has(linkKey)) {
        input.cache.set(linkKey, routeEntry)
      }
      rows.push({
        ...routeEntry,
        scope: input.scope,
        fromGroupId: group.id,
        toGroupId: linkedGroup.id,
        colorGroupId: colorGroup.id,
        color: colorGroup.color,
        endpointColors
      })
    }
  }

  return rows
}

function createHubLinkRouteEntry(input: {
  scope: HubLinkRouteCacheScope
  linkKey: string
  group: RouteGroup
  linkedGroup: RouteGroup
  from: HubLinkRouteEndpoint
  to: HubLinkRouteEndpoint
  colorGroup: RouteGroup
  maps: X4Map
  resolveSectorLabel?: (sector: { id: string; name?: string; nameId?: string }) => string
}): HubLinkRouteEntry {
  const candidates = buildTransitRouteCandidates({
    clusters: input.maps.clusters,
    sectors: input.maps.sectors,
    highwayRingChains: input.maps.highwayRingChains,
    resolveSectorLabel: input.resolveSectorLabel,
    from: {
      sectorMacro: input.from.sectorMacro,
      position: input.from.position,
      label: input.from.stationLabel
    },
    target: {
      kind: 'station',
      sectorMacro: input.to.sectorMacro,
      position: input.to.position,
      label: input.to.stationLabel
    }
  }, {
    includeHighwayRingCandidates: true
  })
  const validCandidates = candidates.filter((candidate) => candidate.problems.length === 0)
  return {
    id: input.linkKey,
    scope: input.scope,
    fromGroupId: input.group.id,
    toGroupId: input.linkedGroup.id,
    from: input.from,
    to: input.to,
    colorGroupId: input.colorGroup.id,
    color: input.colorGroup.color,
    candidates: validCandidates,
    problems: validCandidates.length > 0 ? [] : candidates.flatMap((candidate) => candidate.problems)
  }
}

export function buildBindingHubLinkRouteEntries(input: {
  binding: SaveBindingPlan | null | undefined
  maps: X4Map
  playerStationRecords: PlayerStationRecord[]
  cache?: Map<string, HubLinkRouteEntry>
  resolveSectorLabel?: (sector: { id: string; name?: string; nameId?: string }) => string
}): HubLinkRouteEntry[] {
  if (!input.binding) return []
  return buildHubLinkRouteEntries({
    scope: 'binding',
    groups: input.binding.groups,
    maps: input.maps,
    playerStationRecords: input.playerStationRecords,
    cache: input.cache,
    resolveSectorLabel: input.resolveSectorLabel
  })
}

export function buildDraftHubLinkRouteEntries(input: {
  groups: GroupDraftInfo[] | null | undefined
  maps: X4Map
  playerStationRecords: PlayerStationRecord[]
  cache?: Map<string, HubLinkRouteEntry>
  resolveSectorLabel?: (sector: { id: string; name?: string; nameId?: string }) => string
  getVirtualTradeStationDefaultPosition?: (sectorMacro: string) => { x: number; y: number; z: number }
}): HubLinkRouteEntry[] {
  if (!input.groups) {
    return []
  }
  return buildHubLinkRouteEntries({
    scope: 'draft',
    groups: input.groups,
    maps: input.maps,
    playerStationRecords: input.playerStationRecords,
    cache: input.cache,
    resolveSectorLabel: input.resolveSectorLabel,
    getVirtualTradeStationDefaultPosition: input.getVirtualTradeStationDefaultPosition
  })
}

export function findHubLinkRouteEntry(entries: HubLinkRouteEntry[], groupAId: string, groupBId: string): HubLinkRouteEntry | null {
  const [, first, second] = sortedGroupPair(groupAId, groupBId)
  return entries.find((entry) => {
    const [, entryFirst, entrySecond] = sortedGroupPair(entry.fromGroupId, entry.toGroupId)
    return entryFirst === first && entrySecond === second
  }) ?? null
}

function hubLinkRouteKey(first: HubLinkRouteEndpoint, second: HubLinkRouteEndpoint): string {
  const pair = [endpointRouteToken(first), endpointRouteToken(second)].sort((a, b) => a.localeCompare(b))
  return `${pair[0]}|${pair[1]}`
}

function missingHubLinkRouteKey(scope: HubLinkRouteCacheScope, groupAId: string, groupBId: string): string {
  const [, first, second] = sortedGroupPair(groupAId, groupBId)
  return `${scope}:missing:${first}:${second}`
}

function endpointRouteToken(endpoint: HubLinkRouteEndpoint): string {
  return [
    endpoint.sectorMacro,
    formatRouteCoord(endpoint.position.x),
    formatRouteCoord(endpoint.position.y),
    formatRouteCoord(endpoint.position.z)
  ].join('@')
}

function formatRouteCoord(value: number): string {
  return Number.isFinite(value) ? value.toFixed(3) : '0.000'
}

function sortedGroupPair(groupAId: string, groupBId: string): [string, string, string] {
  const pair = [groupAId, groupBId].sort((a, b) => a.localeCompare(b))
  return ['', pair[0]!, pair[1]!]
}

function resolveHubEndpoint(
  group: RouteGroup,
  input: {
    scope: HubLinkRouteCacheScope
    playerStationRecords: PlayerStationRecord[]
    getVirtualTradeStationDefaultPosition?: (sectorMacro: string) => { x: number; y: number; z: number }
  }
): HubLinkRouteEndpoint | null {
  if (input.scope === 'draft' && group.selectedTradeStation?.type === 'virtual') {
    if (!group.sectorMacro) return null
    return {
      groupId: group.id,
      sectorMacro: group.sectorMacro,
      stationLabel: group.name,
      position: group.virtualTradeStationPosition ??
        input.getVirtualTradeStationDefaultPosition?.(group.sectorMacro) ??
        { x: 0, y: 0, z: 0 }
    }
  }

  if (input.scope === 'draft' && group.selectedTradeStation?.type === 'player') {
    return endpointFromRecord(group, group.selectedTradeStation.stationCode, input.playerStationRecords)
  }

  if (group.tradeStation) {
    const position = resolveStationPosition(group.tradeStation, input.playerStationRecords)
    if (!group.tradeStation.sectorMacro || !position) return null
    return {
      groupId: group.id,
      sectorMacro: group.tradeStation.sectorMacro,
      stationLabel: group.tradeStation.name || group.name,
      position
    }
  }

  if (group.selectedTradeStation?.type === 'player') {
    return endpointFromRecord(group, group.selectedTradeStation.stationCode, input.playerStationRecords)
  }

  return null
}

function endpointFromRecord(
  group: RouteGroup,
  stationCode: string,
  records: PlayerStationRecord[]
): HubLinkRouteEndpoint | null {
  const record = records.find((item) => item.type === 'station' && item.code === stationCode)
  const data = record?.data as PlayerStationEntry | undefined
  if (!record?.sectorMacro || !data?.position) return null
  return {
    groupId: group.id,
    sectorMacro: record.sectorMacro,
    stationLabel: stationCode,
    position: data.position
  }
}

function resolveStationPosition(
  station: { saveStationCode?: string; position?: { x: number; y: number; z: number } } | null | undefined,
  records: PlayerStationRecord[]
): { x: number; y: number; z: number } | null {
  if (station?.position) return station.position
  if (!station?.saveStationCode) return null
  const record = records.find((item) => item.type === 'station' && item.code === station.saveStationCode)
  const data = record?.data as PlayerStationEntry | undefined
  return data?.position ?? null
}

function colorGroupForEndpoints(
  firstGroup: RouteGroup,
  secondGroup: RouteGroup,
  firstEndpoint: HubLinkRouteEndpoint | null,
  secondEndpoint: HubLinkRouteEndpoint | null
): RouteGroup {
  if (!firstEndpoint) return secondGroup
  if (!secondEndpoint) return firstGroup
  return firstEndpoint.sectorMacro.localeCompare(secondEndpoint.sectorMacro) <= 0
    ? firstGroup
    : secondGroup
}

function missingEndpoint(group: RouteGroup): HubLinkRouteEndpoint {
  return {
    groupId: group.id,
    sectorMacro: group.sectorMacro ?? '',
    stationLabel: group.name,
    position: { x: 0, y: 0, z: 0 }
  }
}

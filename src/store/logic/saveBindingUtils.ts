import type { GroupSaveBinding, StationSaveBinding, ResolvedGroupSaveBinding, ResolvedStationSaveBinding } from '@/types/x4'
import type { SaveArchive, PlayerStationEntry, NpcStationEntry } from '@/types/saveArchive'
import { buildSectorGraph } from './mapSectorGraph'

export function calculateCoverageSectorMacros(
  sectorMacro: string,
  jumpRange: number,
  sectorGraph: Record<string, string[]>,
  sectorClusterMap: Record<string, string>
): string[] {
  if (jumpRange < 0 || !sectorGraph[sectorMacro]) return [sectorMacro]

  const distances: Record<string, number> = { [sectorMacro]: 0 }
  const queue = [sectorMacro]
  let index = 0

  while (index < queue.length) {
    const current = queue[index++]!
    const currentDepth = distances[current] || 0
    const currentClusterId = sectorClusterMap[current]

    ;(sectorGraph[current] || []).forEach((next) => {
      if (distances[next] !== undefined) return
      const nextClusterId = sectorClusterMap[next]
      const depthIncrease = (currentClusterId && nextClusterId && currentClusterId !== nextClusterId) ? 1 : 0
      const newDepth = currentDepth + depthIncrease
      if (newDepth > jumpRange) return
      distances[next] = newDepth
      queue.push(next)
    })
  }

  return Object.keys(distances).sort()
}

export function resolveGroupSaveBinding(
  binding: GroupSaveBinding,
  archive: SaveArchive | null
): ResolvedGroupSaveBinding {
  if (!archive) {
    return { ...binding, status: 'missing_at_selected_time' }
  }

  if (!binding.sectorMacro) {
    return { ...binding, status: 'missing_at_selected_time' }
  }

  const sector = archive.sectors[binding.sectorMacro]
  if (!sector) {
    return { ...binding, status: 'missing_at_selected_time' }
  }

  const saveStationCode = binding.tradestationBinding?.saveStationCode
  if (!saveStationCode) {
    return { ...binding, status: 'missing_at_selected_time' }
  }

  const boundSaveStation = (sector.playerStations || []).find(
    (station) => station.code === saveStationCode
  )

  if (!boundSaveStation) {
    return { ...binding, status: 'missing_at_selected_time' }
  }

  return { ...binding, status: 'ok' }
}

export function resolveStationSaveBinding(
  binding: StationSaveBinding,
  archive: SaveArchive | null
): ResolvedStationSaveBinding {
  if (!binding.saveStationCode) {
    if (binding.position) {
      return { ...binding, status: 'ok' }
    }
    return { ...binding, status: 'missing_at_selected_time' }
  }

  if (!archive) {
    return { ...binding, status: 'missing_at_selected_time' }
  }

  const sectorMacro = binding.sectorMacro
  if (!sectorMacro) {
    return { ...binding, status: 'missing_at_selected_time' }
  }

  const sector = archive.sectors[sectorMacro]
  if (!sector) {
    return { ...binding, status: 'missing_at_selected_time' }
  }

  const playerStation = (sector.playerStations || []).find(
    (station) => station.code === binding.saveStationCode
  )

  if (!playerStation) {
    return { ...binding, status: 'missing_at_selected_time' }
  }

  return { ...binding, status: 'ok' }
}

export interface SaveStationLookupResult {
  station: PlayerStationEntry
  sectorMacro: string
  sectorName: string
}

export interface TradeStationLookupResult {
  station: NpcStationEntry
  sectorMacro: string
  sectorName: string
}

export function findPlayerStationByCode(
  archive: SaveArchive | null,
  stationCode: string
): SaveStationLookupResult | null {
  if (!archive || !stationCode) return null

  for (const [sectorMacro, sector] of Object.entries(archive.sectors)) {
    const station = (sector.playerStations || []).find((s) => s.code === stationCode)
    if (station) {
      return {
        station,
        sectorMacro,
        sectorName: sector.name || sectorMacro
      }
    }
  }

  return null
}

export function findTradeStationByCode(
  archive: SaveArchive | null,
  stationCode: string
): TradeStationLookupResult | null {
  if (!archive || !stationCode) return null

  for (const [sectorMacro, sector] of Object.entries(archive.sectors)) {
    const station = (sector.npcStations || []).find(
      (s) => s.code === stationCode && s.isTradestation
    )
    if (station) {
      return {
        station,
        sectorMacro,
        sectorName: sector.name || sectorMacro
      }
    }
  }

  return null
}

export function getPlayerStationsInSector(
  archive: SaveArchive | null,
  sectorMacro: string
): PlayerStationEntry[] {
  if (!archive || !sectorMacro) return []
  const sector = archive.sectors[sectorMacro]
  if (!sector) return []
  return sector.playerStations || []
}

export function getTradeStationsInSector(
  archive: SaveArchive | null,
  sectorMacro: string
): NpcStationEntry[] {
  if (!archive || !sectorMacro) return []
  const sector = archive.sectors[sectorMacro]
  if (!sector) return []
  return (sector.npcStations || []).filter((s) => s.isTradestation)
}

export interface SaveSectorWithStations {
  sectorMacro: string
  sectorName: string
  playerStationCount: number
  tradeStationCount: number
  playerStations: PlayerStationEntry[]
  tradeStations: NpcStationEntry[]
}

export function getSaveSectorsWithPlayerStations(
  archive: SaveArchive | null
): SaveSectorWithStations[] {
  if (!archive) return []

  const results: SaveSectorWithStations[] = []

  for (const [sectorMacro, sector] of Object.entries(archive.sectors)) {
    const playerStations = sector.playerStations || []
    const tradeStations = (sector.npcStations || []).filter((s) => s.isTradestation)

    if (playerStations.length > 0 || tradeStations.length > 0) {
      results.push({
        sectorMacro,
        sectorName: sector.name || sectorMacro,
        playerStationCount: playerStations.length,
        tradeStationCount: tradeStations.length,
        playerStations,
        tradeStations
      })
    }
  }

  return results.sort((a, b) => a.sectorName.localeCompare(b.sectorName))
}

export interface SectorCoverageResult {
  sectorMacro: string
  distance: number
}

export function getCoverageSectors(
  startSectorMacro: string,
  jumpRange: number,
  sectorGraph: Record<string, string[]>,
  sectorClusterMap: Record<string, string>
): SectorCoverageResult[] {
  const coverage = calculateCoverageSectorMacros(startSectorMacro, jumpRange, sectorGraph, sectorClusterMap)
  const distances: Record<string, number> = { [startSectorMacro]: 0 }
  const queue = [startSectorMacro]
  let index = 0

  while (index < queue.length) {
    const current = queue[index++]!
    const currentDepth = distances[current] || 0
    const currentClusterId = sectorClusterMap[current]

    ;(sectorGraph[current] || []).forEach((next) => {
      if (distances[next] !== undefined) return
      const nextClusterId = sectorClusterMap[next]
      const depthIncrease = (currentClusterId && nextClusterId && currentClusterId !== nextClusterId) ? 1 : 0
      distances[next] = currentDepth + depthIncrease
      queue.push(next)
    })
  }

  return coverage.map((sectorMacro) => ({
    sectorMacro,
    distance: distances[sectorMacro] ?? 0
  }))
}

export function buildSectorGraphFromMaps(
  clusters: Record<string, {
    sectors?: string[]
    sector_links?: Record<string, { sector_a_id: string; sector_b_id: string }>
  }>,
  sectors: Record<string, {
    id: string
    cluster_id?: string
    cluster_gates?: Record<string, { target_cluster_id?: string }>
  }>
): { sectorGraph: Record<string, string[]>; sectorClusterMap: Record<string, string> } {
  const result = buildSectorGraph(clusters, sectors)
  return {
    sectorGraph: result.graph,
    sectorClusterMap: result.sectorClusterMap
  }
}

export interface FilteredSaveStationsResult {
  playerStations: Array<{
    station: PlayerStationEntry
    sectorMacro: string
    sectorName: string
    distance: number
  }>
  sectors: Array<{
    sectorMacro: string
    sectorName: string
    distance: number
    stationCount: number
  }>
}

export function getFilteredSaveStations(
  archive: SaveArchive | null,
  coverageSectors: SectorCoverageResult[]
): FilteredSaveStationsResult {
  if (!archive || coverageSectors.length === 0) {
    return { playerStations: [], sectors: [] }
  }

  const coverageSet = new Set(coverageSectors.map((s) => s.sectorMacro))
  const distanceMap = new Map(coverageSectors.map((s) => [s.sectorMacro, s.distance]))

  const playerStations: FilteredSaveStationsResult['playerStations'] = []
  const sectorsMap = new Map<string, { sectorName: string; distance: number; stations: PlayerStationEntry[] }>()

  for (const [sectorMacro, sector] of Object.entries(archive.sectors)) {
    if (!coverageSet.has(sectorMacro)) continue

    const distance = distanceMap.get(sectorMacro) ?? 0
    const sectorName = sector.name || sectorMacro
    const stations = sector.playerStations || []

    if (stations.length > 0) {
      sectorsMap.set(sectorMacro, { sectorName, distance, stations })

      for (const station of stations) {
        playerStations.push({
          station,
          sectorMacro,
          sectorName,
          distance
        })
      }
    }
  }

  const sectors = Array.from(sectorsMap.entries()).map(([sectorMacro, data]) => ({
    sectorMacro,
    sectorName: data.sectorName,
    distance: data.distance,
    stationCount: data.stations.length
  }))

  sectors.sort((a, b) => a.sectorName.localeCompare(b.sectorName))
  playerStations.sort((a, b) => {
    if (a.distance !== b.distance) return a.distance - b.distance
    return a.sectorName.localeCompare(b.sectorName)
  })

  return { playerStations, sectors }
}

import type { X4Module } from '@/types/x4'
import type { PlayerStationEntry, PlayerStationConstruction } from '@/types/saveArchive'

export interface HubDetectionConfig {
  containerThreshold: number
}

export const DEFAULT_HUB_CONFIG: HubDetectionConfig = {
  containerThreshold: 5_000_000
}

export interface StationHubInfo {
  containerCap: number
  prodLines: number
  qualified: boolean
  score: number
  stationCode: string
  stationMacro: string
  isPureHub: boolean
}

export interface SectorPureHub {
  sectorMacro: string
  stationCode: string
  score: number
  containerCap: number
}

function getModuleRefs(
  station: PlayerStationEntry
): Array<{ ref: string; count: number }> {
  const refMap = new Map<string, number>()

  if (station.modules) {
    for (const m of station.modules) {
      const prev = refMap.get(m.ref) || 0
      refMap.set(m.ref, prev + m.amount)
    }
  }

  if (station.constructions) {
    for (const c of station.constructions) {
      const count = countConstructionModules(c, station.modules)
      if (count > 0) {
        const prev = refMap.get(c.ref) || 0
        refMap.set(c.ref, prev + count)
      }
    }
  }

  return Array.from(refMap.entries()).map(([ref, count]) => ({ ref, count }))
}

function countConstructionModules(
  _construction: PlayerStationConstruction,
  existingModules: PlayerStationEntry['modules']
): number {
  if (!existingModules || existingModules.length === 0) return 1
  return 1
}

function calculateTotalContainerCapacity(
  refs: Array<{ ref: string; count: number }>,
  modulesByMacroId: Record<string, X4Module>
): number {
  let total = 0
  for (const { ref, count } of refs) {
    const module = modulesByMacroId[ref]
    if (module?.cargo?.type === 'container') {
      total += module.cargo.capacity * count
    }
  }
  return total
}

function countProductionLines(
  refs: Array<{ ref: string; count: number }>,
  modulesByMacroId: Record<string, X4Module>
): number {
  let total = 0
  for (const { ref, count } of refs) {
    const module = modulesByMacroId[ref]
    if (module?.type === 'production') {
      total += count
    }
  }
  return total
}

export function detectStationHub(
  station: PlayerStationEntry,
  modulesByMacroId: Record<string, X4Module>,
  config: HubDetectionConfig = DEFAULT_HUB_CONFIG
): StationHubInfo {
  const refs = getModuleRefs(station)
  const containerCap = calculateTotalContainerCapacity(refs, modulesByMacroId)
  const prodLines = countProductionLines(refs, modulesByMacroId)
  const qualified = containerCap >= config.containerThreshold

  const score = containerCap / (1 + Math.log(1 + prodLines))

  const isPureHub = qualified && prodLines === 0

  return {
    containerCap,
    prodLines,
    qualified,
    score,
    stationCode: station.code,
    stationMacro: station.macro,
    isPureHub
  }
}

export function getSectorPureHub(
  sectorMacro: string,
  stations: PlayerStationEntry[],
  modulesByMacroId: Record<string, X4Module>,
  config: HubDetectionConfig = DEFAULT_HUB_CONFIG
): SectorPureHub | null {
  let best: SectorPureHub | null = null

  for (const station of stations) {
    const info = detectStationHub(station, modulesByMacroId, config)
    if (!info.isPureHub) continue

    const candidate: SectorPureHub = {
      sectorMacro,
      stationCode: info.stationCode,
      score: info.score,
      containerCap: info.containerCap
    }

    if (!best || candidate.score > best.score) {
      best = candidate
    }
  }

  return best
}

export function rankStationHubs(
  stations: PlayerStationEntry[],
  modulesByMacroId: Record<string, X4Module>,
  config: HubDetectionConfig = DEFAULT_HUB_CONFIG
): { tier1: StationHubInfo[]; tier2: StationHubInfo[] } {
  const all: StationHubInfo[] = stations.map((s) => detectStationHub(s, modulesByMacroId, config))

  const tier1 = all.filter((h) => h.qualified).sort((a, b) => b.score - a.score)
  const tier2 = all.filter((h) => !h.qualified).sort((a, b) => b.score - a.score)

  return { tier1, tier2 }
}

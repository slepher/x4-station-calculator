import type { X4Module } from '@/types/x4'
import type { PlayerStationEntry } from '@/types/saveArchive'
import {
  detectStationHub,
  DEFAULT_HUB_CONFIG,
  type HubDetectionConfig,
  type StationHubInfo
} from './autoGroupHub'

export interface TradeStationCandidate {
  stationCode: string
  macro: string
  score: number
  containerCap: number
  prodLines: number
  hasProduction: boolean
  hasVolume: boolean
  isPureHub: boolean
}

export interface TradeStationSelection {
  type: 'player' | 'virtual'
  stationCode: string
}

export function stationHubToCandidate(info: StationHubInfo): TradeStationCandidate {
  return {
    stationCode: info.stationCode,
    macro: info.stationMacro,
    score: info.score,
    containerCap: info.containerCap,
    prodLines: info.prodLines,
    hasProduction: info.prodLines > 0,
    hasVolume: info.containerCap > 0,
    isPureHub: info.isPureHub
  }
}

export function selectTradeStationCandidates(
  stations: PlayerStationEntry[],
  modulesByMacroId: Record<string, X4Module>,
  requireQualified: boolean,
  config: HubDetectionConfig = DEFAULT_HUB_CONFIG
): TradeStationCandidate[] {
  if (stations.length === 0) return []

  const scored = stations
    .map((s) => detectStationHub(s, modulesByMacroId, config))
    .filter((info) => {
      if (requireQualified) return info.qualified
      return true
    })

  if (scored.length === 0 && requireQualified) {
    return stations
      .map((s) => detectStationHub(s, modulesByMacroId, config))
      .map(stationHubToCandidate)
  }

  scored.sort((a, b) => b.score - a.score)

  const top5 = scored.slice(0, 5).map(stationHubToCandidate)

  const pureHubsInTop = top5.filter((c) => c.isPureHub)
  if (pureHubsInTop.length < 2) {
    const remainingPureHubs = scored
      .slice(5)
      .filter((h) => h.isPureHub)
      .map(stationHubToCandidate)
    const needed = 2 - pureHubsInTop.length
    const toAdd = remainingPureHubs.slice(0, needed)
    top5.push(...toAdd)
  }

  return top5
}

export function determineDefaultTradeStation(
  candidates: TradeStationCandidate[],
  scoreTieThreshold: number = 0.3
): TradeStationSelection | null {
  if (candidates.length === 0) return null

  const first = candidates[0]!

  if (first.isPureHub) {
    return { type: 'player', stationCode: first.stationCode }
  }

  const hasPureHub = candidates.some((c) => c.isPureHub)
  const hasProduction = candidates.some((c) => c.hasProduction)

  if (hasPureHub && hasProduction) {
    return null
  }

  if (!hasPureHub && hasProduction) {
    const second = candidates[1]
    if (second && first.score > second.score * (1 + scoreTieThreshold)) {
      return { type: 'player', stationCode: first.stationCode }
    }
    return null
  }

  if (!hasPureHub && !hasProduction) {
    return { type: 'player', stationCode: first.stationCode }
  }

  return null
}

import type { X4Module } from '@/types/x4'
import type { PlayerStationEntry } from '@/types/saveArchive'
import { getPoiIconTag } from './stationPoiSemantics'
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
  qualified: boolean
  iconTag?: string
  tag?: string
  factoryGroup?: string
  isHeadquarter?: boolean
}

export interface TradeStationSelection {
  type: 'player' | 'virtual'
  stationCode: string
}

function resolveStationIconTag(
  station: PlayerStationEntry | undefined
): string | undefined {
  if (!station) return undefined
  const tag = station.tag
  const factoryGroup = station.factoryGroup
  return getPoiIconTag({ tag, factoryGroup }) || undefined
}

export function stationHubToCandidate(
  info: StationHubInfo,
  station?: PlayerStationEntry
): TradeStationCandidate {
  return {
    stationCode: info.stationCode,
    macro: info.stationMacro,
    score: info.score,
    containerCap: info.containerCap,
    prodLines: info.prodLines,
    hasProduction: info.prodLines > 0,
    hasVolume: info.containerCap > 0,
    isPureHub: info.isPureHub,
    qualified: info.qualified,
    iconTag: resolveStationIconTag(station),
    tag: station?.tag,
    factoryGroup: station?.factoryGroup,
    isHeadquarter: station?.is_headquarter
  }
}

export function selectTradeStationCandidates(
  stations: PlayerStationEntry[],
  modulesByMacroId: Record<string, X4Module>,
  _requireQualified: boolean,
  config: HubDetectionConfig = DEFAULT_HUB_CONFIG
): TradeStationCandidate[] {
  if (stations.length === 0) return []

  const scored = stations
    .map((station) => ({
      station,
      info: detectStationHub(station, modulesByMacroId, config)
    }))
  const hasContainerStation = scored.some(({ info }) => info.containerCap > 0)
  const rawCandidates = hasContainerStation
    ? scored.filter(({ info }) => info.containerCap > 0)
    : scored

  rawCandidates.sort((a, b) => b.info.score - a.info.score)

  return rawCandidates.map(({ station, info }) => stationHubToCandidate(info, station))
}

export function selectTradeStationDisplayCandidates(
  candidates: TradeStationCandidate[],
  containerThreshold: number,
  limit: number = 5
): TradeStationCandidate[] {
  if (candidates.length === 0) return []

  const displayCandidates = candidates.map((candidate) => {
    const qualified = candidate.containerCap >= containerThreshold
    return {
      ...candidate,
      qualified,
      isPureHub: qualified && candidate.prodLines === 0
    }
  })

  const top5 = displayCandidates.slice(0, limit)

  const pureHubsInTop = top5.filter((c) => c.isPureHub)
  if (pureHubsInTop.length < 2 && top5.length >= 2) {
    const remainingPureHubs = displayCandidates
      .slice(limit)
      .filter((candidate) => candidate.isPureHub)
    const needed = 2 - pureHubsInTop.length
    const pureHubsToAdd = remainingPureHubs.slice(0, needed)

    for (let i = pureHubsToAdd.length - 1; i >= 0; i--) {
      const replaceIdx = findLastNonPureHubIndex(top5)
      if (replaceIdx === -1) break
      top5[replaceIdx] = pureHubsToAdd[i]!
    }
  }

  return top5
}

function findLastNonPureHubIndex(candidates: TradeStationCandidate[]): number {
  for (let i = candidates.length - 1; i >= 0; i--) {
    if (!candidates[i]!.isPureHub) return i
  }
  return -1
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
    const bestPureHub = candidates.find((c) => c.isPureHub)!
    const bestProduction = candidates.find((c) => c.hasProduction)!
    if (bestPureHub.score >= bestProduction.score * (1 + scoreTieThreshold)) {
      return { type: 'player', stationCode: bestPureHub.stationCode }
    }
    return null
  }

  if (!hasPureHub && hasProduction) {
    const second = candidates[1]
    if (!second) return { type: 'player', stationCode: first.stationCode }
    if (first.score > second.score * (1 + scoreTieThreshold)) {
      return { type: 'player', stationCode: first.stationCode }
    }
    return null
  }

  if (!hasPureHub && !hasProduction) {
    return { type: 'player', stationCode: first.stationCode }
  }

  return null
}

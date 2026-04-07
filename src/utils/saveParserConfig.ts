import type { SaveParserConfig } from '@/types/saveArchive'
import mapsData from '@/assets/x4_game_data/8.0-Diplomacy/data/maps.json'
import localeEn from '@/assets/x4_game_data/8.0-Diplomacy/locales/en.json'

type StaticMapsData = {
  sectors?: Record<string, {
    name?: string
    raw_center_pos?: { x: number; y: number; z: number }
    cluster_gates?: Record<string, { raw_local_pos?: { x?: number; y?: number; z?: number } }>
  }>
}

const typedMapsData = mapsData as unknown as StaticMapsData

function loadSectorNames(): Record<string, string> {
  const sectorNames: Record<string, string> = {}

  for (const [sectorId, sectorInfo] of Object.entries(typedMapsData.sectors || {})) {
    const sector = sectorInfo as { name?: string }
    if (sector.name) {
      sectorNames[sectorId.toLowerCase()] = sector.name
    }
  }

  return sectorNames
}

function loadShipNames(): Record<string, string> {
  return {}
}

function loadPositions(): Record<string, { x: number; y: number; z: number }> {
  const positions: Record<string, { x: number; y: number; z: number }> = {}

  for (const [sectorId, sectorInfo] of Object.entries(typedMapsData.sectors || {})) {
    const sector = sectorInfo as {
      raw_center_pos?: { x: number; y: number; z: number }
      cluster_gates?: Record<string, { raw_local_pos?: { x?: number; y?: number; z?: number } }>
    }

    if (sector.raw_center_pos) {
      positions[sectorId.toLowerCase()] = sector.raw_center_pos
    }

    for (const [gateId, gateInfo] of Object.entries(sector.cluster_gates || {})) {
      const position = gateInfo.raw_local_pos
      if (position?.x !== undefined && position?.y !== undefined && position?.z !== undefined) {
        positions[`${sectorId.toLowerCase()}:${gateId.toLowerCase()}`] = {
          x: position.x,
          y: position.y,
          z: position.z
        }
      }
    }
  }

  return positions
}

function loadStrings(): Record<string, Record<string, string>> {
  const strings: Record<string, Record<string, string>> = {}

  try {
    const entries = Object.entries(localeEn as Record<string, string>)
    for (const [key, value] of entries) {
      const match = key.match(/^\{(\d+),(\d+)\}$/)
      if (!match || !match[1] || !match[2]) continue
      const pageId = match[1]
      const textId = match[2]
      strings[pageId] ||= {}
      strings[pageId][textId] = value
    }
  } catch (e) {
    console.warn('[saveParserConfig] Failed to load strings:', e)
  }

  return strings
}

export function buildSaveParserConfig(currentVersion: string): SaveParserConfig {
  return {
    sectorNames: loadSectorNames(),
    shipNames: loadShipNames(),
    positions: loadPositions(),
    strings: loadStrings(),
    currentVersion
  }
}

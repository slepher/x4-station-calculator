import type { SaveParserConfig } from '@/types/saveArchive'
import mapsData from '@/assets/x4_game_data/8.0-Diplomacy/data/maps.json'
import localeEn from '@/assets/x4_game_data/8.0-Diplomacy/locales/en.json'

function loadSectorNames(): Record<string, string> {
  const sectorNames: Record<string, string> = {}

  for (const [, clusterData] of Object.entries(mapsData.clusters || {})) {
    const cluster = clusterData as { sectors?: Record<string, { name?: string }> }
    for (const [sectorMacro, sectorInfo] of Object.entries(cluster.sectors || {})) {
      const sector = sectorInfo as { name?: string }
      if (sector.name) {
        const key = sectorMacro.toLowerCase()
        sectorNames[key] = sector.name
      }
    }
  }

  return sectorNames
}

function loadShipNames(): Record<string, string> {
  return {}
}

function loadPositions(): Record<string, { x: number; y: number; z: number }> {
  const positions: Record<string, { x: number; y: number; z: number }> = {}

  for (const [, clusterData] of Object.entries(mapsData.clusters || {})) {
    const cluster = clusterData as {
      sectors?: Record<string, { position?: { x: number; y: number; z: number } }>
      gates?: Record<string, { position?: { x: number; y: number; z: number } }>
    }

    for (const [sectorMacro, sectorInfo] of Object.entries(cluster.sectors || {})) {
      const sector = sectorInfo as { position?: { x: number; y: number; z: number } }
      if (sector.position) {
        const key = sectorMacro.toLowerCase()
        positions[key] = sector.position
      }
    }

    for (const [gateMacro, gateInfo] of Object.entries(cluster.gates || {})) {
      const gate = gateInfo as { position?: { x: number; y: number; z: number } }
      if (gate.position) {
        const key = gateMacro.toLowerCase()
        positions[key] = gate.position
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

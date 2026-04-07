import type { StationEntry } from '@/types/saveArchive'
import type { X4Module, X4Map } from '@/types/x4'
import { buildSectorGraph } from '@/store/logic/mapAdvancedResourceFilter'

export interface SearchTag {
  category: 'product' | 'module' | 'faction' | 'sector'
  id: string
  label: string
}

export interface SearchState {
  productModuleTags: SearchTag[]
  factionTags: SearchTag[]
  sectorTags: SearchTag[]
}

export function matchStationByProduct(
  station: StationEntry,
  wareId: string,
  modulesByMacroId: Record<string, X4Module>
): boolean {
  const modules = station.modules
  if (!modules || modules.length === 0) return false

  for (const module of modules) {
    const x4Module = modulesByMacroId[module.ref] || modulesByMacroId[module.module_id || '']
    if (x4Module && x4Module.outputs && wareId in x4Module.outputs) {
      return true
    }
  }
  return false
}

export function matchStationByModule(
  station: StationEntry,
  moduleId: string
): boolean {
  const modules = station.modules
  if (!modules || modules.length === 0) return false

  for (const module of modules) {
    if (module.module_id === moduleId || module.ref === moduleId) {
      return true
    }
  }
  return false
}

export function matchStationByFaction(
  station: StationEntry,
  factionId: string
): boolean {
  return station.owner === factionId
}

export function buildReachableSectorMacros(
  sectorTags: SearchTag[],
  maps: X4Map | undefined,
  maxJumps: number
): Set<string> {
  if (!maps || !maps.clusters || !maps.sectors || sectorTags.length === 0) {
    return new Set()
  }

  const { graph, sectorClusterMap } = buildSectorGraph(maps.clusters, maps.sectors)
  const reachableSectorIds = new Set<string>()

  for (const tag of sectorTags) {
    const targetSectorId = findSectorIdByMacro(maps, tag.id)
    if (!targetSectorId) continue

    const distances = breadthFirstReachable(graph, targetSectorId, maxJumps, sectorClusterMap)
    for (const sectorId of Object.keys(distances)) {
      reachableSectorIds.add(sectorId.toLowerCase())
    }
  }

  return reachableSectorIds
}

export function isSectorReachable(
  sectorMacro: string,
  reachableSectorMacros: Set<string>
): boolean {
  if (reachableSectorMacros.size === 0) return true
  return reachableSectorMacros.has(sectorMacro.toLowerCase())
}

function findSectorIdByMacro(maps: X4Map, sectorMacro: string): string | null {
  const normalizedTarget = sectorMacro.toLowerCase()
  for (const sector of Object.values(maps.sectors || {})) {
    const sectorMacroLower = (sector.macro || sector.id).toLowerCase()
    if (sectorMacroLower === normalizedTarget) {
      return sector.id
    }
  }
  return null
}

function breadthFirstReachable(
  graph: Record<string, string[]>,
  start: string,
  maxDepth: number,
  sectorClusterMap: Record<string, string>
): Record<string, number> {
  const distances: Record<string, number> = { [start]: 0 }
  const queue = [start]
  let index = 0

  while (index < queue.length) {
    const current = queue[index++]!
    const currentDepth = distances[current] || 0
    const currentClusterId = sectorClusterMap[current]

    ;(graph[current] || []).forEach((next) => {
      if (distances[next] !== undefined) return
      const nextClusterId = sectorClusterMap[next]
      const depthIncrease = (currentClusterId && nextClusterId && currentClusterId !== nextClusterId) ? 1 : 0
      const newDepth = currentDepth + depthIncrease
      if (newDepth > maxDepth) return
      distances[next] = newDepth
      queue.push(next)
    })
  }

  return distances
}

export function filterStationBySearchState(
  station: StationEntry,
  searchState: SearchState,
  modulesByMacroId: Record<string, X4Module>
): boolean {
  const { productModuleTags, factionTags } = searchState

  const group1Match =
    productModuleTags.length === 0 ||
    productModuleTags.some((tag) => {
      if (tag.category === 'product') {
        return matchStationByProduct(station, tag.id, modulesByMacroId)
      }
      if (tag.category === 'module') {
        return matchStationByModule(station, tag.id)
      }
      return false
    })

  const group2Match =
    factionTags.length === 0 ||
    factionTags.some((tag) => matchStationByFaction(station, tag.id))

  return group1Match && group2Match
}

export function isSearchStateEmpty(searchState: SearchState): boolean {
  return (
    searchState.productModuleTags.length === 0 &&
    searchState.factionTags.length === 0 &&
    searchState.sectorTags.length === 0
  )
}

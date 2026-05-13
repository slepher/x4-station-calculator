type MapClusterLike = {
  sectors?: string[]
}

type MapSectorLike = {
  id?: string
  macro?: string | null
}

export interface ResolvedMapSector<TSector extends object> {
  clusterId: string
  sectorId: string
  sector: TSector
}

function normalizeMacro(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase()
}

type CachedResolvedMapSector<TSector extends object> = {
  clusterId: string
  sectorId: string
  sector: TSector
}

const sectorMacroIndexCache = new WeakMap<object, Map<string, CachedResolvedMapSector<object>>>()

function getSectorMacroIndex<TSector extends object>(
  maps: {
    clusters: Record<string, MapClusterLike>
    sectors?: Record<string, TSector>
  }
): Map<string, CachedResolvedMapSector<TSector>> {
  const cacheKey = maps as object
  const cached = sectorMacroIndexCache.get(cacheKey)
  if (cached) return cached as Map<string, CachedResolvedMapSector<TSector>>

  const index = new Map<string, CachedResolvedMapSector<TSector>>()
  for (const [clusterId, cluster] of Object.entries(maps.clusters)) {
    for (const sectorId of cluster.sectors || []) {
      const sector = maps.sectors?.[sectorId]
      if (!sector) continue

      const resolved: CachedResolvedMapSector<TSector> = { clusterId, sectorId, sector }
      const normalizedSectorId = normalizeMacro(sectorId)
      if (normalizedSectorId) index.set(normalizedSectorId, resolved)

      const sectorMacro = (sector as MapSectorLike).macro
      const normalizedSectorMacro = normalizeMacro(sectorMacro)
      if (normalizedSectorMacro) index.set(normalizedSectorMacro, resolved)
    }
  }

  sectorMacroIndexCache.set(cacheKey, index)
  return index
}

export function resolveMapSectorByMacro<TSector extends object>(
  maps: {
    clusters: Record<string, MapClusterLike>
    sectors?: Record<string, TSector>
  },
  macro: string | null | undefined
): ResolvedMapSector<TSector> | null {
  const normalizedMacro = normalizeMacro(macro)
  if (!normalizedMacro) return null
  const resolved = getSectorMacroIndex(maps).get(normalizedMacro)
  if (!resolved) return null
  return resolved as ResolvedMapSector<TSector>
}

export function resolveSectorMacroById<TSector extends object>(
  maps: {
    clusters: Record<string, MapClusterLike>
    sectors?: Record<string, TSector>
  },
  clusterId: string,
  sectorId: string
): string | null {
  const cluster = maps.clusters[clusterId]
  if (!cluster || !cluster.sectors?.includes(sectorId)) return null
  const sector = maps.sectors?.[sectorId] as (TSector & { macro?: string | null }) | undefined
  return sector?.macro || sectorId
}

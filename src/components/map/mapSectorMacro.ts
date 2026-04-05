type MapClusterLike<TSector extends object> = {
  sectors?: Record<string, TSector>
}

export interface ResolvedMapSector<TSector extends object> {
  clusterId: string
  sectorId: string
  sector: TSector
}

function normalizeMacro(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase()
}

type CachedResolvedMapSector = {
  clusterId: string
  sectorId: string
  sector: object
}

const sectorMacroIndexCache = new WeakMap<object, Map<string, CachedResolvedMapSector>>()

function getSectorMacroIndex<TSector extends object>(
  clusters: Record<string, MapClusterLike<TSector>>
): Map<string, CachedResolvedMapSector> {
  const cacheKey = clusters as object
  const cached = sectorMacroIndexCache.get(cacheKey)
  if (cached) return cached

  const index = new Map<string, CachedResolvedMapSector>()
  for (const [clusterId, cluster] of Object.entries(clusters)) {
    for (const [sectorId, sector] of Object.entries(cluster.sectors || {})) {
      const resolved: CachedResolvedMapSector = { clusterId, sectorId, sector }
      const normalizedSectorId = normalizeMacro(sectorId)
      if (normalizedSectorId) index.set(normalizedSectorId, resolved)

      const sectorMacro = (sector as { macro?: string | null }).macro
      const normalizedSectorMacro = normalizeMacro(sectorMacro)
      if (normalizedSectorMacro) index.set(normalizedSectorMacro, resolved)
    }
  }

  sectorMacroIndexCache.set(cacheKey, index)
  return index
}

export function resolveMapSectorByMacro<TSector extends object>(
  clusters: Record<string, MapClusterLike<TSector>>,
  macro: string | null | undefined
): ResolvedMapSector<TSector> | null {
  const normalizedMacro = normalizeMacro(macro)
  if (!normalizedMacro) return null
  const resolved = getSectorMacroIndex(clusters).get(normalizedMacro)
  if (!resolved) return null
  return resolved as ResolvedMapSector<TSector>
}

export function resolveSectorMacroById<TSector extends object>(
  clusters: Record<string, MapClusterLike<TSector>>,
  clusterId: string,
  sectorId: string
): string | null {
  const cluster = clusters[clusterId]
  if (!cluster) return null
  const sector = cluster.sectors?.[sectorId]
  if (!sector) return null
  return (sector as { macro?: string | null }).macro || sectorId
}

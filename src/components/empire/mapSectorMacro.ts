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

export function resolveMapSectorByMacro<TSector extends object>(
  clusters: Record<string, MapClusterLike<TSector>>,
  macro: string | null | undefined
): ResolvedMapSector<TSector> | null {
  const normalizedMacro = normalizeMacro(macro)
  if (!normalizedMacro) return null

  for (const [clusterId, cluster] of Object.entries(clusters)) {
    for (const [sectorId, sector] of Object.entries(cluster.sectors || {})) {
      const sectorMacro = (sector as { macro?: string | null }).macro
      if (normalizeMacro(sectorId) === normalizedMacro || normalizeMacro(sectorMacro) === normalizedMacro) {
        return { clusterId, sectorId, sector }
      }
    }
  }

  return null
}

export type SectorGraphClusterInput = {
  sectors?: string[]
  sector_links?: Record<string, {
    sector_a_id: string
    sector_b_id: string
    from_zone_id?: string
    render?: { lane_count?: number }
  }>
}

export type SectorGraphSectorInput = {
  id: string
  cluster_id?: string
  cluster_gates?: Record<string, { target_cluster_id?: string }>
}

export type SectorGraphResult = {
  graph: Record<string, string[]>
  sectorClusterMap: Record<string, string>
}

export function breadthFirstReachable(
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

export function buildSectorGraph(
  clusters: Record<string, SectorGraphClusterInput>,
  sectors: Record<string, SectorGraphSectorInput>
): SectorGraphResult {
  const graph: Record<string, Set<string>> = {}
  const sectorClusterIdMap: Record<string, string> = {}
  const sectorGateTargets: Record<string, Set<string>> = {}
  const sectorsByCluster: Record<string, string[]> = {}

  Object.entries(clusters).forEach(([clusterId, cluster]) => {
    sectorsByCluster[clusterId] ||= []

    ;(cluster.sectors || []).forEach((sectorId) => {
      const sector = sectors[sectorId]
      if (!sector) return
      graph[sector.id] ||= new Set<string>()
      sectorClusterIdMap[sector.id] = sector.cluster_id || clusterId
      sectorsByCluster[clusterId]!.push(sector.id)
      sectorGateTargets[sector.id] ||= new Set<string>()

      Object.values(sector.cluster_gates || {}).forEach((gate) => {
        if (gate.target_cluster_id) sectorGateTargets[sector.id]!.add(gate.target_cluster_id)
      })
    })

    Object.values(cluster.sector_links || {}).forEach((link) => {
      graph[link.sector_a_id] ||= new Set<string>()
      graph[link.sector_b_id] ||= new Set<string>()

      const laneCount = link.render?.lane_count ?? 0
      if (laneCount === 1) {
        // One-way superhighway: not traversable for transport (ship can go but can't return)
        // Don't add edge — treat as disconnected
      } else {
        // Bidirectional (lane_count >= 2 or unknown)
        graph[link.sector_a_id]!.add(link.sector_b_id)
        graph[link.sector_b_id]!.add(link.sector_a_id)
      }
    })
  })

  Object.entries(sectorGateTargets).forEach(([sectorId, targetClusters]) => {
    const sourceClusterId = sectorClusterIdMap[sectorId]
    if (!sourceClusterId) return

    targetClusters.forEach((targetClusterId) => {
      const targetSectorIds = sectorsByCluster[targetClusterId] || []
      targetSectorIds.forEach((targetSectorId) => {
        if (!sectorGateTargets[targetSectorId]?.has(sourceClusterId)) return
        graph[sectorId] ||= new Set<string>()
        graph[targetSectorId] ||= new Set<string>()
        graph[sectorId]!.add(targetSectorId)
        graph[targetSectorId]!.add(sectorId)
      })
    })
  })

  return {
    graph: Object.fromEntries(
      Object.entries(graph).map(([sectorId, neighbors]) => [sectorId, Array.from(neighbors)])
    ) as Record<string, string[]>,
    sectorClusterMap: sectorClusterIdMap
  }
}

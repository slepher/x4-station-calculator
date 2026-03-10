export interface SectorNetInput {
  sectorId: string
  net: number
}

export interface SectorLinkInput {
  linkId: string
  a: string
  b: string
  distance: number
}

export interface SolveSingleWareDistancePullInput {
  sectors: SectorNetInput[]
  links: SectorLinkInput[]
  epsilon?: number
}

export interface LinkFlow {
  linkId: string
  from: string
  to: string
  amount: number
}

export interface SectorResidual {
  sectorId: string
  amount: number
}

export interface DeficitBySectorEntry extends SectorResidual {}

export interface ProducerSectorsBySectorEntry {
  sectorId: string
  producerSectorIds: string[]
}

export interface AllocatedDemandBySectorEntry extends SectorResidual {}

export interface MultiWareAllocatedDemandBySectorEntry {
  sectorId: string
  totalAmount: number
  byWare: Record<string, number>
}

export interface DeficitSummary {
  totalDeficit: number
}

export interface SolveSingleWareDistancePullOutput {
  linkFlows: LinkFlow[]
  unmetDemand: SectorResidual[]
  unusedSupply: SectorResidual[]
  allocatedDemandBySector: AllocatedDemandBySectorEntry[]
  deficitSummary: DeficitSummary
}

export interface SectorMultiWareNetInput {
  sectorId: string
  netByWare: Record<string, number>
}

export interface SolveMultiWareByLinkInput {
  sectors: SectorMultiWareNetInput[]
  links: SectorLinkInput[]
  epsilon?: number
}

export interface LinkWareFlow extends LinkFlow {
  wareId: string
}

export interface MultiWareDeficitByNodeEntry {
  sectorId: string
  totalAmount: number
  byWare: Record<string, number>
}

export interface MultiWareDeficitSummary {
  totalDeficit: number
  deficitByNode: MultiWareDeficitByNodeEntry[]
  producerNodes: ProducerSectorsBySectorEntry[]
}

export interface SolveMultiWareByLinkOutput {
  linkWareFlows: LinkWareFlow[]
  allocatedDemandBySector: MultiWareAllocatedDemandBySectorEntry[]
  deficitSummary: MultiWareDeficitSummary
}

export interface SectorNetworkComponent {
  componentId: number
  sectorIds: string[]
  linkIds: string[]
}

interface AdjEdge {
  linkId: string
  to: string
  distance: number
}

interface PairPath {
  supplierId: string
  demanderId: string
  distance: number
  pathEdges: Array<{ linkId: string; from: string; to: string }>
}

interface DistanceLayer {
  value: number
  pairs: PairPath[]
}

interface DijkstraState {
  dist: Map<string, number>
  pathKey: Map<string, string>
  prev: Map<string, { node: string; linkId: string }>
}

function normalizeEpsilon(epsilon?: number): number {
  return typeof epsilon === 'number' && Number.isFinite(epsilon) && epsilon > 0 ? epsilon : 1e-9
}

function normalizeAmount(value: number, epsilon: number): number {
  const fixed = Number(value.toFixed(12))
  return Math.abs(fixed) <= epsilon ? 0 : fixed
}

function isLess(a: number, b: number, epsilon: number): boolean {
  return a < b - epsilon
}

function isEqual(a: number, b: number, epsilon: number): boolean {
  return Math.abs(a - b) <= epsilon
}

function pushMapAmount(map: Map<string, number>, key: string, amount: number): void {
  map.set(key, (map.get(key) ?? 0) + amount)
}

function encodeEdgeFlowKey(linkId: string, from: string, to: string): string {
  // linkId may contain '|', so use JSON tuple encoding to keep parse stable.
  return JSON.stringify([linkId, from, to])
}

function decodeEdgeFlowKey(key: string): { linkId: string; from: string; to: string } | null {
  try {
    const parsed = JSON.parse(key)
    if (!Array.isArray(parsed) || parsed.length !== 3) return null
    const [linkId, from, to] = parsed
    if (typeof linkId !== 'string' || typeof from !== 'string' || typeof to !== 'string') return null
    if (!linkId || !from || !to) return null
    return { linkId, from, to }
  } catch {
    return null
  }
}

function getValidLinks(links: SectorLinkInput[]): SectorLinkInput[] {
  const out: SectorLinkInput[] = []
  links.forEach((link) => {
    if (!link || typeof link.linkId !== 'string') return
    if (typeof link.a !== 'string' || typeof link.b !== 'string') return
    if (!link.a || !link.b || link.a === link.b) return
    const distance = Number(link.distance)
    if (!Number.isFinite(distance) || distance < 0) return
    out.push({
      linkId: link.linkId,
      a: link.a,
      b: link.b,
      distance
    })
  })
  return out
}

function buildGraph(links: SectorLinkInput[], nodes: Iterable<string> = []): Map<string, AdjEdge[]> {
  const graph = new Map<string, AdjEdge[]>()
  for (const node of nodes) {
    if (!node) continue
    if (!graph.has(node)) graph.set(node, [])
  }
  getValidLinks(links).forEach((link) => {
    if (!graph.has(link.a)) graph.set(link.a, [])
    if (!graph.has(link.b)) graph.set(link.b, [])
    graph.get(link.a)!.push({ linkId: link.linkId, to: link.b, distance: link.distance })
    graph.get(link.b)!.push({ linkId: link.linkId, to: link.a, distance: link.distance })
  })
  return graph
}

export function splitSectorNetwork(sectorIds: string[], links: SectorLinkInput[]): SectorNetworkComponent[] {
  const uniqueSectors = Array.from(new Set((sectorIds || []).filter((id) => typeof id === 'string' && id)))
  const validLinks = getValidLinks(links || [])
  const graph = buildGraph(validLinks, uniqueSectors)
  const allSectors = Array.from(new Set([...uniqueSectors, ...Array.from(graph.keys())])).sort()
  const visited = new Set<string>()
  const components: SectorNetworkComponent[] = []

  allSectors.forEach((startSector) => {
    if (visited.has(startSector)) return
    const stack = [startSector]
    const sectorSet = new Set<string>()
    while (stack.length > 0) {
      const sector = stack.pop()!
      if (visited.has(sector)) continue
      visited.add(sector)
      sectorSet.add(sector)
      ;(graph.get(sector) || []).forEach((edge) => {
        if (!visited.has(edge.to)) stack.push(edge.to)
      })
    }
    const sectorList = Array.from(sectorSet).sort()
    const set = new Set(sectorList)
    const linkIds = Array.from(new Set(validLinks
      .filter((l) => set.has(l.a) && set.has(l.b))
      .map((l) => l.linkId)))
      .sort()
    components.push({
      componentId: components.length,
      sectorIds: sectorList,
      linkIds
    })
  })

  return components
}

export function getSectorNetworkComponent(
  sectorId: string,
  sectorIds: string[],
  links: SectorLinkInput[]
): SectorNetworkComponent | null {
  if (typeof sectorId !== 'string' || !sectorId) return null
  const components = splitSectorNetwork(sectorIds, links)
  return components.find((component) => component.sectorIds.includes(sectorId)) || null
}

function runDijkstra(source: string, graph: Map<string, AdjEdge[]>, epsilon: number): DijkstraState {
  const nodes = Array.from(graph.keys()).sort()
  const dist = new Map<string, number>()
  const pathKey = new Map<string, string>()
  const prev = new Map<string, { node: string; linkId: string }>()
  const visited = new Set<string>()

  nodes.forEach((node) => {
    dist.set(node, Number.POSITIVE_INFINITY)
    pathKey.set(node, '\uffff')
  })
  if (!graph.has(source)) {
    return { dist, pathKey, prev }
  }

  dist.set(source, 0)
  pathKey.set(source, source)

  while (visited.size < nodes.length) {
    let current = ''
    let currentDist = Number.POSITIVE_INFINITY
    nodes.forEach((node) => {
      if (visited.has(node)) return
      const d = dist.get(node) ?? Number.POSITIVE_INFINITY
      if (d < currentDist) {
        current = node
        currentDist = d
      } else if (d === currentDist && node < current) {
        current = node
      }
    })
    if (!current || !Number.isFinite(currentDist)) break
    visited.add(current)

    const currentPathKey = pathKey.get(current) || '\uffff'
    const edges = (graph.get(current) || []).slice().sort((l, r) => {
      if (l.to !== r.to) return l.to.localeCompare(r.to)
      if (l.distance !== r.distance) return l.distance - r.distance
      return l.linkId.localeCompare(r.linkId)
    })
    edges.forEach((edge) => {
      if (visited.has(edge.to)) return
      const alt = currentDist + edge.distance
      const old = dist.get(edge.to) ?? Number.POSITIVE_INFINITY
      const candidatePathKey = `${currentPathKey}>${edge.to}`
      const existingPathKey = pathKey.get(edge.to) || '\uffff'
      if (isLess(alt, old, epsilon) || (isEqual(alt, old, epsilon) && candidatePathKey < existingPathKey)) {
        dist.set(edge.to, alt)
        pathKey.set(edge.to, candidatePathKey)
        prev.set(edge.to, { node: current, linkId: edge.linkId })
      }
    })
  }

  return { dist, pathKey, prev }
}

function buildSupplierToDemanderPath(
  supplierId: string,
  demanderId: string,
  prev: Map<string, { node: string; linkId: string }>
): Array<{ linkId: string; from: string; to: string }> | null {
  const walked: Array<{ from: string; to: string; linkId: string }> = []
  let cursor = supplierId
  while (cursor !== demanderId) {
    const step = prev.get(cursor)
    if (!step) return null
    walked.push({ from: cursor, to: step.node, linkId: step.linkId })
    cursor = step.node
  }
  return walked
}

function buildDistanceLayers(
  graph: Map<string, AdjEdge[]>,
  demanders: string[],
  suppliers: string[],
  epsilon: number
): DistanceLayer[] {
  const allPairs: PairPath[] = []

  demanders.forEach((demanderId) => {
    const { dist, prev } = runDijkstra(demanderId, graph, epsilon)
    suppliers.forEach((supplierId) => {
      if (supplierId === demanderId) return
      const d = dist.get(supplierId)
      if (d == null || !Number.isFinite(d)) return
      const pathEdges = buildSupplierToDemanderPath(supplierId, demanderId, prev)
      if (!pathEdges || pathEdges.length === 0) return
      allPairs.push({
        supplierId,
        demanderId,
        distance: d,
        pathEdges
      })
    })
  })

  allPairs.sort((a, b) => {
    if (!isEqual(a.distance, b.distance, epsilon)) return a.distance - b.distance
    if (a.demanderId !== b.demanderId) return a.demanderId.localeCompare(b.demanderId)
    return a.supplierId.localeCompare(b.supplierId)
  })

  const layers: DistanceLayer[] = []
  allPairs.forEach((pair) => {
    const last = layers[layers.length - 1]
    if (!last || !isEqual(last.value, pair.distance, epsilon)) {
      layers.push({ value: pair.distance, pairs: [pair] })
      return
    }
    last.pairs.push(pair)
  })
  return layers
}

function allocateOneDistanceLayer(
  layerPairs: PairPath[],
  demandRemains: Map<string, number>,
  supplyRemains: Map<string, number>,
  epsilon: number
): Map<string, number> {
  const allocated = new Map<string, number>()
  const localDemand = new Map<string, number>()
  const localSupply = new Map<string, number>()
  const demandersBySupplier = new Map<string, string[]>()

  layerPairs.forEach((pair) => {
    const d = demandRemains.get(pair.demanderId) ?? 0
    const s = supplyRemains.get(pair.supplierId) ?? 0
    if (d <= epsilon || s <= epsilon) return
    localDemand.set(pair.demanderId, d)
    localSupply.set(pair.supplierId, s)
    if (!demandersBySupplier.has(pair.supplierId)) demandersBySupplier.set(pair.supplierId, [])
    const arr = demandersBySupplier.get(pair.supplierId)!
    if (!arr.includes(pair.demanderId)) arr.push(pair.demanderId)
  })

  for (let i = 0; i < 128; i += 1) {
    let hasEdge = false
    const proposals = new Map<string, number>()
    const incomingByDemander = new Map<string, number>()

    localSupply.forEach((supplierRemain, supplierId) => {
      if (supplierRemain <= epsilon) return
      const candidates = (demandersBySupplier.get(supplierId) || []).filter((demanderId) => (localDemand.get(demanderId) ?? 0) > epsilon)
      const normalizedCandidates = candidates
      if (normalizedCandidates.length === 0) return
      const totalDemand = normalizedCandidates.reduce((sum, demanderId) => sum + (localDemand.get(demanderId) ?? 0), 0)
      if (totalDemand <= epsilon) return
      hasEdge = true
      normalizedCandidates.forEach((demanderId) => {
        const demanderRemain = localDemand.get(demanderId) ?? 0
        const proposal = supplierRemain * (demanderRemain / totalDemand)
        const key = `${supplierId}|${demanderId}`
        proposals.set(key, proposal)
        incomingByDemander.set(demanderId, (incomingByDemander.get(demanderId) ?? 0) + proposal)
      })
    })

    if (!hasEdge || proposals.size === 0) break

    let moved = 0
    proposals.forEach((proposal, key) => {
      const [supplierId, demanderId] = key.split('|')
      if (!supplierId || !demanderId) return
      const incoming = incomingByDemander.get(demanderId) ?? 0
      const demanderRemain = localDemand.get(demanderId) ?? 0
      const factor = incoming > demanderRemain + epsilon ? demanderRemain / incoming : 1
      const accepted = proposal * factor
      if (accepted <= epsilon) return
      moved += accepted
      pushMapAmount(allocated, key, accepted)
      localDemand.set(demanderId, Math.max(0, demanderRemain - accepted))
      localSupply.set(supplierId, Math.max(0, (localSupply.get(supplierId) ?? 0) - accepted))
    })

    if (moved <= epsilon) break
  }

  allocated.forEach((amount, key) => {
    const [supplierId, demanderId] = key.split('|')
    if (!supplierId || !demanderId) return
    demandRemains.set(demanderId, Math.max(0, (demandRemains.get(demanderId) ?? 0) - amount))
    supplyRemains.set(supplierId, Math.max(0, (supplyRemains.get(supplierId) ?? 0) - amount))
  })

  return allocated
}

export function solveSingleWareDistancePull(
  input: SolveSingleWareDistancePullInput
): SolveSingleWareDistancePullOutput {
  const epsilon = normalizeEpsilon(input.epsilon)
  const sectorIds = (input.sectors || []).map((item) => item.sectorId).filter((id) => typeof id === 'string' && !!id)
  const graph = buildGraph(input.links || [], sectorIds)
  const allNodes = new Set<string>(Array.from(graph.keys()))

  const netBySector = new Map<string, number>()
  ;(input.sectors || []).forEach((item) => {
    if (!item || typeof item.sectorId !== 'string' || !item.sectorId) return
    if (!Number.isFinite(item.net)) return
    allNodes.add(item.sectorId)
    netBySector.set(item.sectorId, normalizeAmount((netBySector.get(item.sectorId) ?? 0) + item.net, epsilon))
  })

  const demandRemains = new Map<string, number>()
  const supplyRemains = new Map<string, number>()
  const initialDemand = new Map<string, number>()
  Array.from(allNodes).forEach((sectorId) => {
    const net = netBySector.get(sectorId) ?? 0
    if (net > epsilon) supplyRemains.set(sectorId, net)
    if (net < -epsilon) {
      const demand = -net
      demandRemains.set(sectorId, demand)
      initialDemand.set(sectorId, demand)
    }
  })

  const suppliers = Array.from(supplyRemains.keys()).sort()
  const demanders = Array.from(demandRemains.keys()).sort()
  const layers = buildDistanceLayers(graph, demanders, suppliers, epsilon)

  const pairByKey = new Map<string, PairPath>()
  layers.forEach((layer) => {
    layer.pairs.forEach((pair) => {
      pairByKey.set(`${pair.supplierId}|${pair.demanderId}`, pair)
    })
  })

  const edgeFlowMap = new Map<string, number>()
  layers.forEach((layer) => {
    if (!Array.from(demandRemains.values()).some((v) => v > epsilon)) return
    if (!Array.from(supplyRemains.values()).some((v) => v > epsilon)) return
    const allocated = allocateOneDistanceLayer(layer.pairs, demandRemains, supplyRemains, epsilon)
    allocated.forEach((amount, key) => {
      if (amount <= epsilon) return
      const pair = pairByKey.get(key)
      if (!pair) return
      pair.pathEdges.forEach((edge) => {
        const edgeKey = encodeEdgeFlowKey(edge.linkId, edge.from, edge.to)
        pushMapAmount(edgeFlowMap, edgeKey, amount)
      })
    })
  })

  const linkFlows: LinkFlow[] = Array.from(edgeFlowMap.entries())
    .map(([key, amount]) => {
      const decoded = decodeEdgeFlowKey(key)
      if (!decoded) return null
      const { linkId, from, to } = decoded
      return { linkId, from, to, amount: normalizeAmount(amount, epsilon) }
    })
    .filter((item): item is LinkFlow => !!item && item.amount > epsilon)
    .sort((a, b) => {
      if (a.linkId !== b.linkId) return a.linkId.localeCompare(b.linkId)
      if (a.from !== b.from) return a.from.localeCompare(b.from)
      return a.to.localeCompare(b.to)
    })

  const unmetDemand: SectorResidual[] = Array.from(demandRemains.entries())
    .map(([sectorId, amount]) => ({ sectorId, amount: normalizeAmount(amount, epsilon) }))
    .filter((item) => item.amount > epsilon)
    .sort((a, b) => a.sectorId.localeCompare(b.sectorId))

  const unusedSupply: SectorResidual[] = Array.from(supplyRemains.entries())
    .map(([sectorId, amount]) => ({ sectorId, amount: normalizeAmount(amount, epsilon) }))
    .filter((item) => item.amount > epsilon)
    .sort((a, b) => a.sectorId.localeCompare(b.sectorId))

  const allocatedDemandBySector: AllocatedDemandBySectorEntry[] = Array.from(initialDemand.entries())
    .map(([sectorId, initial]) => {
      const remain = demandRemains.get(sectorId) ?? 0
      return {
        sectorId,
        amount: normalizeAmount(Math.max(0, initial - remain), epsilon)
      }
    })
    .filter((item) => item.amount > epsilon)
    .sort((a, b) => a.sectorId.localeCompare(b.sectorId))

  const totalDeficit = normalizeAmount(unmetDemand.reduce((sum, item) => sum + item.amount, 0), epsilon)

  return {
    linkFlows,
    unmetDemand,
    unusedSupply,
    allocatedDemandBySector,
    deficitSummary: {
      totalDeficit
    }
  }
}

export function solveMultiWareByLink(
  input: SolveMultiWareByLinkInput
): SolveMultiWareByLinkOutput {
  const epsilon = normalizeEpsilon(input.epsilon)
  const wareIds = new Set<string>()
  ;(input.sectors || []).forEach((sector) => {
    if (!sector || !sector.netByWare) return
    Object.keys(sector.netByWare).forEach((wareId) => wareIds.add(wareId))
  })

  const linkWareFlows: LinkWareFlow[] = []
  const allocatedDemandBySectorMap = new Map<string, { totalAmount: number; byWare: Record<string, number> }>()
  const deficitByNodeMap = new Map<string, { totalAmount: number; byWare: Record<string, number> }>()
  const producerNodesByNodeMap = new Map<string, Set<string>>()
  let totalDeficit = 0

  Array.from(wareIds).sort().forEach((wareId) => {
    const singleInput: SolveSingleWareDistancePullInput = {
      sectors: (input.sectors || []).map((sector) => ({
        sectorId: sector.sectorId,
        net: Number(sector.netByWare?.[wareId] ?? 0)
      })),
      links: input.links || [],
      epsilon
    }
    const singleOutput = solveSingleWareDistancePull(singleInput)
    singleOutput.linkFlows.forEach((flow) => {
      linkWareFlows.push({ ...flow, wareId })
    })
    singleOutput.allocatedDemandBySector.forEach((item) => {
      const current = allocatedDemandBySectorMap.get(item.sectorId) || { totalAmount: 0, byWare: {} }
      current.totalAmount += item.amount
      current.byWare[wareId] = normalizeAmount((current.byWare[wareId] ?? 0) + item.amount, epsilon)
      allocatedDemandBySectorMap.set(item.sectorId, current)
    })
    totalDeficit += singleOutput.deficitSummary.totalDeficit
    singleOutput.unmetDemand.forEach((item) => {
      const current = deficitByNodeMap.get(item.sectorId) || { totalAmount: 0, byWare: {} }
      current.totalAmount += item.amount
      current.byWare[wareId] = normalizeAmount((current.byWare[wareId] ?? 0) + item.amount, epsilon)
      deficitByNodeMap.set(item.sectorId, current)
    })

    const wareNetBySector = new Map<string, number>()
    singleInput.sectors.forEach((sector) => {
      if (!sector.sectorId || !Number.isFinite(sector.net)) return
      wareNetBySector.set(sector.sectorId, sector.net)
    })
    const allNodes = new Set<string>()
    singleInput.sectors.forEach((sector) => {
      if (sector.sectorId) allNodes.add(sector.sectorId)
    })
    getValidLinks(singleInput.links || []).forEach((link) => {
      allNodes.add(link.a)
      allNodes.add(link.b)
    })
    const components = splitSectorNetwork(Array.from(allNodes), singleInput.links || [])
    const componentBySector = new Map<string, number>()
    const producersByComponent = new Map<number, string[]>()
    components.forEach((component) => {
      component.sectorIds.forEach((sectorId) => componentBySector.set(sectorId, component.componentId))
      const producers = component.sectorIds
        .filter((sectorId) => (wareNetBySector.get(sectorId) ?? 0) > epsilon)
        .sort()
      producersByComponent.set(component.componentId, producers)
    })

    singleOutput.unmetDemand.forEach((item) => {
      const componentId = componentBySector.get(item.sectorId)
      const producerSectorIds = componentId == null ? [] : producersByComponent.get(componentId) || []
      if (!producerNodesByNodeMap.has(item.sectorId)) producerNodesByNodeMap.set(item.sectorId, new Set<string>())
      const set = producerNodesByNodeMap.get(item.sectorId)!
      producerSectorIds.forEach((sectorId) => set.add(sectorId))
    })
  })

  linkWareFlows.sort((a, b) => {
    if (a.linkId !== b.linkId) return a.linkId.localeCompare(b.linkId)
    if (a.wareId !== b.wareId) return a.wareId.localeCompare(b.wareId)
    if (a.from !== b.from) return a.from.localeCompare(b.from)
    return a.to.localeCompare(b.to)
  })

  const allocatedDemandBySector: MultiWareAllocatedDemandBySectorEntry[] = Array.from(allocatedDemandBySectorMap.entries())
    .map(([sectorId, data]) => ({
      sectorId,
      totalAmount: normalizeAmount(data.totalAmount, epsilon),
      byWare: Object.fromEntries(
        Object.entries(data.byWare)
          .filter(([, amount]) => amount > epsilon)
          .sort(([a], [b]) => a.localeCompare(b))
      )
    }))
    .filter((item) => item.totalAmount > epsilon)
    .sort((a, b) => a.sectorId.localeCompare(b.sectorId))

  const deficitByNode: MultiWareDeficitByNodeEntry[] = Array.from(deficitByNodeMap.entries())
    .map(([sectorId, data]) => ({
      sectorId,
      totalAmount: normalizeAmount(data.totalAmount, epsilon),
      byWare: Object.fromEntries(
        Object.entries(data.byWare)
          .filter(([, amount]) => amount > epsilon)
          .sort(([a], [b]) => a.localeCompare(b))
      )
    }))
    .filter((item) => item.totalAmount > epsilon)
    .sort((a, b) => a.sectorId.localeCompare(b.sectorId))

  const producerNodes: ProducerSectorsBySectorEntry[] = Array.from(producerNodesByNodeMap.entries())
    .map(([sectorId, producers]) => ({
      sectorId,
      producerSectorIds: Array.from(producers).sort()
    }))
    .sort((a, b) => a.sectorId.localeCompare(b.sectorId))

  return {
    linkWareFlows,
    allocatedDemandBySector,
    deficitSummary: {
      totalDeficit: normalizeAmount(totalDeficit, epsilon),
      deficitByNode,
      producerNodes
    }
  }
}

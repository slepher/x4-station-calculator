import { XMLParser } from 'fast-xml-parser'
// Save coordinates use meter-scale units; resource grid cells are 64 km cubes.
const RESOURCE_BLOCK_HALF_SIZE = 32000
const RESOURCE_BLOCK_HALF_DIAGONAL = Math.sqrt(
  3 * RESOURCE_BLOCK_HALF_SIZE * RESOURCE_BLOCK_HALF_SIZE
)

// Core area bounds for cutted calculation (15x15x3 64km blocks centered at origin)
const CORE_AREA_XZ_LIMIT = 448000 // 448km
const CORE_AREA_Y_LIMIT = 64000 // 64km

export type SaveResourcePoint = {
  x: number
  y: number
  z: number
  ware: string
  max: number
  time: number
  yield_name: string
}

export type SectorJsonResource = {
  yield_names: string[]
  x: number
  y: number
  z: number
  max: number
  time: number
  regions: string[]
}

export type SectorJsonData = {
  sector_id: string
  ware: Record<string, SectorJsonResource[]>
}

export type RegionSummary = {
  ref: string
}

export type WareRegionGroup = {
  max: number
  cutted: number
  regions: RegionSummary[]
}

export type TotalJsonSector = {
  sector_id: string
  ware: Record<string, WareRegionGroup[]>
}

export type TotalJsonData = {
  sectors: TotalJsonSector[]
}

type Vector3 = {
  x: number
  y: number
  z: number
}

type ResourceDefinition = {
  ware: string
  yield_name: string
  resourcedensity: number
  respawn?: number
  falloff?: number
  delay?: number
}

type Boundary =
  | {
      class: 'sphere'
      size: { r: number }
    }
  | {
      class: 'cylinder'
      size: { r: number; linear: number }
    }
  | {
      class: 'box'
      size: { x: number; y: number; z: number }
    }
  | {
      class: 'splinetube'
      size: { r: number; linear: number }
      spline?: Vector3[]
    }

type RegionArea = {
  ref: string
  sectorId: string
  position: Vector3
  boundary: Boundary
  resources: ResourceDefinition[]
}

type RegionDefinition = {
  id: string
  boundary: Boundary
  resources: ResourceDefinition[]
}

type ResourceAreaEntry = {
  ref?: string
  position?: Partial<Vector3>
  boundary?: {
    class?: string
    size?: Record<string, number>
  }
  resources?: Array<{
    ware?: string
    yield_name?: string
    resourcedensity?: number
    respawn?: number
    falloff?: number
    delay?: number
  }>
}

type ResourceAreasData = Record<string, ResourceAreaEntry[]>

type RegionYieldLookup = Record<
  string,
  Record<string, { resourcedensity: number; replenishtime: number }>
>

export type ExtractContext = {
  mapsData: {
    clusters?: Record<
      string,
      {
        sectors?: Record<string, unknown>
      }
    >
  }
  resourceAreasData: ResourceAreasData
  regionsData: Array<{
    id?: string
    boundary?: {
      class?: string
      size?: Record<string, number>
      spline?: Array<Partial<Vector3>>
    }
    resources?: Array<{
      ware?: string
      yield_name?: string
      resourcedensity?: number
      respawn?: number
      falloff?: number
      delay?: number
    }>
  }>
  regionYieldsData: Array<{
    ware?: string
    yields?: Array<{
      name?: string
      resourcedensity?: number
      replenishtime?: number
    }>
  }>
}

function normalizeId(value: string): string {
  return value.trim().toLowerCase()
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function toNumber(value: string | number | undefined, fallback = 0): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback
  }
  if (typeof value !== 'string' || value.length === 0) {
    return fallback
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function findBlockXml(xml: string, tagName: string): string | null {
  const blockRegex = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i')
  const match = blockRegex.exec(xml)
  return match?.[1] ?? null
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) {
    return []
  }
  return Array.isArray(value) ? value : [value]
}

function createXmlParser(): XMLParser {
  return new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    parseAttributeValue: true,
    trimValues: false
  })
}

function extractSectorComponentXml(
  saveXml: string,
  sectorMacro: string
): string | null {
  const startRegex = new RegExp(
    `<component\\b(?=[^>]*\\bclass="sector")(?=[^>]*\\bmacro="${escapeRegExp(sectorMacro)}")[^>]*>`,
    'i'
  )
  const startMatch = startRegex.exec(saveXml)
  if (!startMatch) {
    return null
  }

  const startIndex = startMatch.index
  const endTag = '</component>'
  const endIndex = saveXml.indexOf(endTag, startIndex)
  if (endIndex < 0) {
    return null
  }

  return saveXml.slice(startIndex, endIndex + endTag.length)
}

function findFallbackYieldName(
  regionYieldLookup: RegionYieldLookup,
  ware: string,
  time: number
): string {
  const yieldEntries = regionYieldLookup[ware]
  if (!yieldEntries) {
    return ''
  }

  const expectedReplenishTime = time / 60
  for (const [yieldName, data] of Object.entries(yieldEntries)) {
    if (Math.abs(data.replenishtime - expectedReplenishTime) < 0.001) {
      return yieldName
    }
  }

  return ''
}

function parseBoundary(rawBoundary: {
  class?: string
  size?: Record<string, number>
  spline?: Array<Partial<Vector3>>
} | undefined): Boundary | null {
  const boundaryClass = rawBoundary?.class
  const size = rawBoundary?.size ?? {}

  if (boundaryClass === 'sphere') {
    return {
      class: 'sphere',
      size: { r: toNumber(size.r) }
    }
  }

  if (boundaryClass === 'cylinder') {
    return {
      class: 'cylinder',
      size: {
        r: toNumber(size.r),
        linear: toNumber(size.linear)
      }
    }
  }

  if (boundaryClass === 'box') {
    return {
      class: 'box',
      size: {
        x: toNumber(size.x),
        y: toNumber(size.y),
        z: toNumber(size.z)
      }
    }
  }

  if (boundaryClass === 'splinetube') {
    return {
      class: 'splinetube',
      size: {
        r: toNumber(size.r),
        linear: toNumber(size.linear)
      },
      spline: rawBoundary?.spline?.map((point) => ({
        x: toNumber(point.x),
        y: toNumber(point.y),
        z: toNumber(point.z)
      }))
    }
  }

  return null
}

function parseRegionYieldLookup(
  regionYieldsData: ExtractContext['regionYieldsData']
): RegionYieldLookup {
  const lookup: RegionYieldLookup = {}

  for (const wareEntry of regionYieldsData) {
    const ware = wareEntry.ware
    if (!ware) {
      continue
    }

    const wareLookup: Record<string, { resourcedensity: number; replenishtime: number }> = {}
    for (const yieldEntry of wareEntry.yields ?? []) {
      const yieldName = yieldEntry.name
      if (!yieldName) {
        continue
      }
      wareLookup[yieldName] = {
        resourcedensity: toNumber(yieldEntry.resourcedensity),
        replenishtime: toNumber(yieldEntry.replenishtime)
      }
    }

    lookup[ware] = wareLookup
  }

  return lookup
}

function parseRegionDefinitions(
  regionsData: ExtractContext['regionsData']
): Map<string, RegionDefinition> {
  const regions = new Map<string, RegionDefinition>()

  for (const region of regionsData) {
    if (!region.id) {
      continue
    }
    const boundary = parseBoundary(region.boundary)
    if (!boundary) {
      continue
    }

    regions.set(normalizeId(region.id), {
      id: region.id,
      boundary,
      resources: (region.resources ?? []).flatMap((resource) => {
        if (!resource.ware || !resource.yield_name) {
          return []
        }
        return [
          {
            ware: resource.ware,
            yield_name: resource.yield_name,
            resourcedensity: toNumber(resource.resourcedensity),
            respawn: toNumber(resource.respawn),
            falloff: toNumber(resource.falloff),
            delay: toNumber(resource.delay)
          }
        ]
      })
    })
  }

  return regions
}

function buildSectorRegionAreas(
  resourceAreasData: ExtractContext['resourceAreasData'],
  regionsById: Map<string, RegionDefinition>
): Map<string, RegionArea[]> {
  const sectors = new Map<string, RegionArea[]>()

  for (const [sectorIdKey, areasEntries] of Object.entries(resourceAreasData)) {
    const sectorId = normalizeId(sectorIdKey)
    const areas: RegionArea[] = []

    for (const area of areasEntries) {
      const ref = area.ref
      if (!ref) {
        continue
      }

      const areaBoundary = parseBoundary(area.boundary)
      const regionDefinition = regionsById.get(normalizeId(ref))
      const boundary = regionDefinition?.boundary ?? areaBoundary
      if (!boundary) {
        continue
      }

      const resources = (regionDefinition?.resources.length
        ? regionDefinition.resources
        : (area.resources ?? []).flatMap((resource: NonNullable<typeof area.resources>[number]) => {
            if (!resource.ware || !resource.yield_name) {
              return []
            }
            return [
              {
                ware: resource.ware,
                yield_name: resource.yield_name,
                resourcedensity: toNumber(resource.resourcedensity),
                respawn: toNumber(resource.respawn),
                falloff: toNumber(resource.falloff),
                delay: toNumber(resource.delay)
              }
            ]
          }))

      if (!resources.length) {
        continue
      }

      areas.push({
        ref,
        sectorId,
        position: {
          x: toNumber(area.position?.x),
          y: toNumber(area.position?.y),
          z: toNumber(area.position?.z)
        },
        boundary,
        resources
      })
    }

    sectors.set(sectorId, areas)
  }

  return sectors
}

function squaredDistance(a: Vector3, b: Vector3): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = a.z - b.z
  return dx * dx + dy * dy + dz * dz
}

function distancePointToSegment(point: Vector3, start: Vector3, end: Vector3): number {
  const vx = end.x - start.x
  const vy = end.y - start.y
  const vz = end.z - start.z
  const segmentLengthSquared = vx * vx + vy * vy + vz * vz
  if (segmentLengthSquared <= 0) {
    return Math.sqrt(squaredDistance(point, start))
  }

  const wx = point.x - start.x
  const wy = point.y - start.y
  const wz = point.z - start.z
  const rawT = (wx * vx + wy * vy + wz * vz) / segmentLengthSquared
  const t = Math.max(0, Math.min(1, rawT))
  const projection = {
    x: start.x + vx * t,
    y: start.y + vy * t,
    z: start.z + vz * t
  }
  return Math.sqrt(squaredDistance(point, projection))
}

function boundaryCenter(position: Vector3, _boundary: Boundary): Vector3 {
  // cylinder and box position is already the center (linear/size are half-extents)
  return position
}

function pointMatchesBoundary(
  point: Vector3,
  position: Vector3,
  boundary: Boundary,
  radiusScale = 1
): boolean {
  if (boundary.class === 'sphere') {
    const limit = boundary.size.r * radiusScale + RESOURCE_BLOCK_HALF_DIAGONAL
    return squaredDistance(point, position) <= limit * limit
  }

  if (boundary.class === 'box') {
    // size is half-extent, range is [position - size, position + size]
    return (
      Math.abs(point.x - position.x) <= boundary.size.x + RESOURCE_BLOCK_HALF_SIZE &&
      Math.abs(point.y - position.y) <= boundary.size.y + RESOURCE_BLOCK_HALF_SIZE &&
      Math.abs(point.z - position.z) <= boundary.size.z + RESOURCE_BLOCK_HALF_SIZE
    )
  }

  if (boundary.class === 'cylinder') {
    const dx = point.x - position.x
    const dz = point.z - position.z
    const radialDistance = Math.sqrt(dx * dx + dz * dz)
    // linear is half-height, range is [position.y - linear, position.y + linear]
    const minY = position.y - boundary.size.linear - RESOURCE_BLOCK_HALF_SIZE
    const maxY = position.y + boundary.size.linear + RESOURCE_BLOCK_HALF_SIZE
    return (
      radialDistance <= boundary.size.r * radiusScale + RESOURCE_BLOCK_HALF_DIAGONAL &&
      point.y >= minY &&
      point.y <= maxY
    )
  }

  if (boundary.spline && boundary.spline.length >= 2) {
    const limit = boundary.size.r * radiusScale + RESOURCE_BLOCK_HALF_DIAGONAL
    for (let index = 0; index < boundary.spline.length - 1; index += 1) {
      const start = boundary.spline[index]
      const end = boundary.spline[index + 1]
      if (!start || !end) {
        continue
      }
      // spline coordinates are relative to position
      const worldStart = {
        x: start.x + position.x,
        y: start.y + position.y,
        z: start.z + position.z
      }
      const worldEnd = {
        x: end.x + position.x,
        y: end.y + position.y,
        z: end.z + position.z
      }
      if (distancePointToSegment(point, worldStart, worldEnd) <= limit) {
        return true
      }
    }
    return false
  }

  const fallbackLimit = boundary.size.r + boundary.size.linear + RESOURCE_BLOCK_HALF_DIAGONAL
  return squaredDistance(point, position) <= fallbackLimit * fallbackLimit
}

function boundaryReachRadius(boundary: Boundary): number {
  if (boundary.class === 'sphere') {
    return boundary.size.r
  }

  if (boundary.class === 'box') {
    // size is half-extent
    return Math.sqrt(
      boundary.size.x * boundary.size.x +
        boundary.size.y * boundary.size.y +
        boundary.size.z * boundary.size.z
    )
  }

  if (boundary.class === 'cylinder') {
    // linear is half-height
    return Math.sqrt(
      boundary.size.r * boundary.size.r + boundary.size.linear * boundary.size.linear
    )
  }

  return boundary.size.r + boundary.size.linear
}

function distancePointToArea(point: Vector3, area: RegionArea): number {
  if (area.boundary.class === 'splinetube' && area.boundary.spline && area.boundary.spline.length >= 2) {
    let bestDistance = Number.POSITIVE_INFINITY
    for (let index = 0; index < area.boundary.spline.length - 1; index += 1) {
      const start = area.boundary.spline[index]
      const end = area.boundary.spline[index + 1]
      if (!start || !end) {
        continue
      }
      // spline coordinates are relative to position
      const worldStart = {
        x: start.x + area.position.x,
        y: start.y + area.position.y,
        z: start.z + area.position.z
      }
      const worldEnd = {
        x: end.x + area.position.x,
        y: end.y + area.position.y,
        z: end.z + area.position.z
      }
      bestDistance = Math.min(bestDistance, distancePointToSegment(point, worldStart, worldEnd))
    }
    if (bestDistance < Number.POSITIVE_INFINITY) {
      return bestDistance
    }
  }

  return Math.sqrt(squaredDistance(point, boundaryCenter(area.position, area.boundary)))
}

function distanceSegmentToSegment(a0: Vector3, a1: Vector3, b0: Vector3, b1: Vector3): number {
  const u = { x: a1.x - a0.x, y: a1.y - a0.y, z: a1.z - a0.z }
  const v = { x: b1.x - b0.x, y: b1.y - b0.y, z: b1.z - b0.z }
  const w = { x: a0.x - b0.x, y: a0.y - b0.y, z: a0.z - b0.z }

  const a = u.x * u.x + u.y * u.y + u.z * u.z
  const b = u.x * v.x + u.y * v.y + u.z * v.z
  const c = v.x * v.x + v.y * v.y + v.z * v.z
  const d = u.x * w.x + u.y * w.y + u.z * w.z
  const e = v.x * w.x + v.y * w.y + v.z * w.z
  const denominator = a * c - b * b
  const epsilon = 1e-9

  let sNumerator = 0
  let sDenominator = denominator
  let tNumerator = 0
  let tDenominator = denominator

  if (denominator < epsilon) {
    sNumerator = 0
    sDenominator = 1
    tNumerator = e
    tDenominator = c
  } else {
    sNumerator = b * e - c * d
    tNumerator = a * e - b * d
    if (sNumerator < 0) {
      sNumerator = 0
      tNumerator = e
      tDenominator = c
    } else if (sNumerator > sDenominator) {
      sNumerator = sDenominator
      tNumerator = e + b
      tDenominator = c
    }
  }

  if (tNumerator < 0) {
    tNumerator = 0
    if (-d < 0) {
      sNumerator = 0
    } else if (-d > a) {
      sNumerator = sDenominator
    } else {
      sNumerator = -d
      sDenominator = a
    }
  } else if (tNumerator > tDenominator) {
    tNumerator = tDenominator
    if (-d + b < 0) {
      sNumerator = 0
    } else if (-d + b > a) {
      sNumerator = sDenominator
    } else {
      sNumerator = -d + b
      sDenominator = a
    }
  }

  const s = Math.abs(sNumerator) < epsilon ? 0 : sNumerator / sDenominator
  const t = Math.abs(tNumerator) < epsilon ? 0 : tNumerator / tDenominator

  const separation = {
    x: w.x + s * u.x - t * v.x,
    y: w.y + s * u.y - t * v.y,
    z: w.z + s * u.z - t * v.z
  }

  return Math.sqrt(
    separation.x * separation.x + separation.y * separation.y + separation.z * separation.z
  )
}

function areasOverlap(left: RegionArea, right: RegionArea): boolean {
  if (left.ref === right.ref) {
    return true
  }

  const leftSplineBoundary = left.boundary.class === 'splinetube' ? left.boundary : null
  const rightSplineBoundary = right.boundary.class === 'splinetube' ? right.boundary : null
  const leftSpline = leftSplineBoundary?.spline
  const rightSpline = rightSplineBoundary?.spline
  const leftRadius = boundaryReachRadius(left.boundary)
  const rightRadius = boundaryReachRadius(right.boundary)

  if (leftSpline && leftSpline.length >= 2 && rightSpline && rightSpline.length >= 2) {
    const limit = leftSplineBoundary.size.r + rightSplineBoundary.size.r
    for (let leftIndex = 0; leftIndex < leftSpline.length - 1; leftIndex += 1) {
      const leftStart = leftSpline[leftIndex]
      const leftEnd = leftSpline[leftIndex + 1]
      if (!leftStart || !leftEnd) {
        continue
      }
      for (let rightIndex = 0; rightIndex < rightSpline.length - 1; rightIndex += 1) {
        const rightStart = rightSpline[rightIndex]
        const rightEnd = rightSpline[rightIndex + 1]
        if (!rightStart || !rightEnd) {
          continue
        }
        if (distanceSegmentToSegment(leftStart, leftEnd, rightStart, rightEnd) <= limit) {
          return true
        }
      }
    }
    return false
  }

  if (leftSpline && leftSpline.length >= 2) {
    return distancePointToArea(right.position, left) <= leftSplineBoundary.size.r + rightRadius
  }

  if (rightSpline && rightSpline.length >= 2) {
    return distancePointToArea(left.position, right) <= rightSplineBoundary.size.r + leftRadius
  }

  const centerDistance = Math.sqrt(
    squaredDistance(boundaryCenter(left.position, left.boundary), boundaryCenter(right.position, right.boundary))
  )
  return centerDistance <= leftRadius + rightRadius
}

function buildRegionOverlapComponents(
  sectorAreas: RegionArea[],
  wareName: string
): Map<string, string[]> {
  const relevantAreas = sectorAreas.filter((area) =>
    area.resources.some((resource) => normalizeId(resource.ware) === normalizeId(wareName))
  )
  const adjacency = new Map<string, Set<string>>()

  for (const area of relevantAreas) {
    if (!adjacency.has(area.ref)) {
      adjacency.set(area.ref, new Set([area.ref]))
    }
  }

  for (let leftIndex = 0; leftIndex < relevantAreas.length; leftIndex += 1) {
    const left = relevantAreas[leftIndex]
    if (!left) {
      continue
    }
    for (let rightIndex = leftIndex + 1; rightIndex < relevantAreas.length; rightIndex += 1) {
      const right = relevantAreas[rightIndex]
      if (!right) {
        continue
      }
      if (!areasOverlap(left, right)) {
        continue
      }
      adjacency.get(left.ref)?.add(right.ref)
      adjacency.get(right.ref)?.add(left.ref)
    }
  }

  const componentsByRef = new Map<string, string[]>()
  const visited = new Set<string>()

  for (const ref of adjacency.keys()) {
    if (visited.has(ref)) {
      continue
    }

    const stack = [ref]
    const component: string[] = []
    visited.add(ref)

    while (stack.length > 0) {
      const current = stack.pop()
      if (!current) {
        continue
      }
      component.push(current)
      for (const neighbor of adjacency.get(current) ?? []) {
        if (visited.has(neighbor)) {
          continue
        }
        visited.add(neighbor)
        stack.push(neighbor)
      }
    }

    component.sort((left, right) => left.localeCompare(right))
    for (const componentRef of component) {
      componentsByRef.set(componentRef, component)
    }
  }

  return componentsByRef
}

export function loadMapsSectors(context: ExtractContext): string[] {
  const sectors: string[] = []
  for (const clusterData of Object.values(context.mapsData.clusters ?? {})) {
    for (const sectorId of Object.keys(clusterData.sectors ?? {})) {
      sectors.push(normalizeId(sectorId))
    }
  }
  return sectors
}

export function extractSectorResourcesFromComponentXml(
  componentXml: string,
  context: ExtractContext
): SaveResourcePoint[] {
  const yieldLookup = parseRegionYieldLookup(context.regionYieldsData)
  const parsed = createXmlParser().parse(componentXml) as {
    component?: {
      resourceareas?: {
        area?: Array<{
          x?: number
          y?: number
          z?: number
          wares?: {
            ware?: Array<{
              ware?: string
              recharge?: {
                max?: number
                time?: number
              }
            }>
          }
          yields?: {
            ware?: Array<{
              ware?: string
              yield?: Array<{
                name?: string
              }>
            }>
          }
        }>
      }
    }
  }
  const areas = asArray(parsed.component?.resourceareas?.area)
  const results: SaveResourcePoint[] = []

  for (const area of areas) {
    const x = toNumber(area.x)
    const y = toNumber(area.y)
    const z = toNumber(area.z)
    const yieldsByWare: Record<string, string[]> = {}

    for (const yieldWare of asArray(area.yields?.ware)) {
      const wareName = yieldWare.ware ?? ''
      if (!wareName) {
        continue
      }
      yieldsByWare[wareName] = asArray(yieldWare.yield)
        .map((yieldItem) => yieldItem.name ?? '')
        .filter((yieldName) => yieldName.length > 0)
    }

    for (const wareNode of asArray(area.wares?.ware)) {
      const wareName = wareNode.ware ?? ''
      if (!wareName) {
        continue
      }
      const rechargeEntries = asArray(wareNode.recharge)
      const xmlYieldNames = yieldsByWare[wareName] ?? []

      for (let rechargeIndex = 0; rechargeIndex < rechargeEntries.length; rechargeIndex += 1) {
        const rechargeEntry = rechargeEntries[rechargeIndex]
        const max = toNumber(rechargeEntry?.max)
        const time = toNumber(rechargeEntry?.time)
        const yieldName = xmlYieldNames[rechargeIndex] ?? findFallbackYieldName(yieldLookup, wareName, time)

        results.push({
          x,
          y,
          z,
          ware: wareName,
          max,
          time,
          yield_name: yieldName
        })
      }

      if (xmlYieldNames.length > rechargeEntries.length && rechargeEntries.length > 0) {
        const lastRecharge = rechargeEntries[rechargeEntries.length - 1]
        const max = toNumber(lastRecharge?.max)
        const time = toNumber(lastRecharge?.time)
        for (let extraIndex = rechargeEntries.length; extraIndex < xmlYieldNames.length; extraIndex += 1) {
          const yieldName = xmlYieldNames[extraIndex] ?? ''
          results.push({
            x,
            y,
            z,
            ware: wareName,
            max,
            time,
            yield_name: yieldName
          })
        }
      }
    }
  }

  return results
}

export function extractSectorResources(
  saveXml: string,
  sectorMacro: string,
  context: ExtractContext
): SaveResourcePoint[] {
  const componentXml = extractSectorComponentXml(saveXml, sectorMacro)
  if (!componentXml) {
    return []
  }

  return extractSectorResourcesFromComponentXml(componentXml, context)
}

export function extractSectorResourceXmlFromComponentXml(
  componentXml: string,
  sectorMacro: string
): string | null {
  if (!componentXml) {
    return null
  }

  const resourceAreasXml = findBlockXml(componentXml, 'resourceareas')
  if (!resourceAreasXml) {
    return null
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    processEntities: false
  })
  const resourceAreasObject = parser.parse(`<resourceareas>${resourceAreasXml.trim()}</resourceareas>`)
  const reparsedResourceAreasXml = buildXmlFromObject(resourceAreasObject)
  const formattedResourceAreasXml = prettyPrintXml(reparsedResourceAreasXml)

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<sector_resources sector="${normalizeId(sectorMacro)}" class="sector">`,
    formattedResourceAreasXml,
    '</sector_resources>'
  ].join('\n')
}

function buildXmlFromObject(value: unknown, tagName?: string): string {
  if (value === null || value === undefined) {
    return tagName ? `<${tagName}/>` : ''
  }

  if (Array.isArray(value)) {
    return value.map((item) => buildXmlFromObject(item, tagName)).join('')
  }

  if (typeof value !== 'object') {
    const text = escapeXmlText(String(value))
    return tagName ? `<${tagName}>${text}</${tagName}>` : text
  }

  const obj = value as Record<string, unknown>
  const attrs = Object.entries(obj)
    .filter(([key]) => key.startsWith('@_'))
    .map(([key, attrValue]) => ` ${key.slice(2)}="${escapeXmlText(String(attrValue))}"`)
    .join('')
  const children = Object.entries(obj).filter(([key]) => !key.startsWith('@_') && key !== '#text')
  const textValue = typeof obj['#text'] === 'string' ? obj['#text'] : ''

  const inner = [
    textValue ? escapeXmlText(textValue) : '',
    ...children.map(([childKey, childValue]) => buildXmlFromObject(childValue, childKey))
  ].join('')

  if (!tagName) {
    return children.map(([childKey, childValue]) => buildXmlFromObject(childValue, childKey)).join('')
  }

  if (!inner) {
    return `<${tagName}${attrs}/>`
  }

  return `<${tagName}${attrs}>${inner}</${tagName}>`
}

function prettyPrintXml(xml: string): string {
  const normalized = xml.replace(/>\s*</g, '>\n<').trim()
  const lines = normalized.split('\n')
  const formatted: string[] = []
  let depth = 0

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) {
      continue
    }
    if (line.startsWith('</')) {
      depth = Math.max(0, depth - 1)
    }
    formatted.push(`${'  '.repeat(depth)}${line}`)
    const isOpeningTag = /^<[^!?/][^>]*[^/]>$/.test(line)
    if (isOpeningTag && !line.includes('</')) {
      depth += 1
    }
  }

  return formatted.join('\n')
}

function escapeXmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function extractSectorResourceXml(
  saveXml: string,
  sectorMacro: string
): string | null {
  const componentXml = extractSectorComponentXml(saveXml, sectorMacro)
  if (!componentXml) {
    return null
  }

  return extractSectorResourceXmlFromComponentXml(componentXml, sectorMacro)
}

export function buildSectorJson(
  data: SaveResourcePoint[],
  sectorName: string
): SectorJsonData {
  const wareMap = new Map<string, Map<string, SectorJsonResource>>()

  for (const entry of data) {
    const wareName = entry.ware
    const key = `${entry.x},${entry.y},${entry.z},${entry.max},${entry.time}`

    if (!wareMap.has(wareName)) {
      wareMap.set(wareName, new Map())
    }

    const wareEntries = wareMap.get(wareName)!
    const existing = wareEntries.get(key)

    if (existing) {
      if (entry.yield_name && !existing.yield_names.includes(entry.yield_name)) {
        existing.yield_names.push(entry.yield_name)
      }
    } else {
      wareEntries.set(key, {
        yield_names: entry.yield_name ? [entry.yield_name] : [],
        x: entry.x,
        y: entry.y,
        z: entry.z,
        max: entry.max,
        time: entry.time,
        regions: []
      })
    }
  }

  const ware: Record<string, SectorJsonResource[]> = {}
  for (const [wareName, entries] of wareMap) {
    ware[wareName] = Array.from(entries.values())
  }

  return {
    sector_id: normalizeId(sectorName),
    ware
  }
}

function matchRegionsForPoint(
  sectorAreas: RegionArea[],
  ware: string,
  yieldNames: string[],
  resource: { x: number; y: number; z: number }
): Array<{ area: RegionArea; definition: ResourceDefinition }> {
  const point = { x: resource.x, y: resource.y, z: resource.z }

  // Stage 1: Filter by ware + yield_name
  const candidates: Array<{ area: RegionArea; definition: ResourceDefinition }> = []
  for (const area of sectorAreas) {
    const definition = area.resources.find(
      (candidate) =>
        normalizeId(candidate.ware) === normalizeId(ware) &&
        yieldNames.some((yn) => normalizeId(yn) === normalizeId(candidate.yield_name))
    )
    if (definition) {
      candidates.push({ area, definition })
    }
  }

  // If no candidates or only one, return directly (skip spatial matching)
  if (candidates.length <= 1) {
    return candidates
  }

  // Stage 2: Spatial matching from candidates
  const spatialMatches: Array<{ area: RegionArea; definition: ResourceDefinition }> = []
  for (const candidate of candidates) {
    if (pointMatchesBoundary(point, candidate.area.position, candidate.area.boundary, 1)) {
      spatialMatches.push(candidate)
    }
  }

  // If spatial matches found, use them; otherwise fall back to all candidates
  return spatialMatches.length > 0 ? spatialMatches : candidates
}

function isInCoreArea(x: number, y: number, z: number): boolean {
  return (
    Math.abs(x) <= CORE_AREA_XZ_LIMIT &&
    Math.abs(z) <= CORE_AREA_XZ_LIMIT &&
    Math.abs(y) <= CORE_AREA_Y_LIMIT
  )
}

export type AggregationResult = {
  sectorJson: SectorJsonData
  totalJson: TotalJsonSector
}

export function aggregateSectorWithRegions(
  sectorData: SectorJsonData,
  context: ExtractContext
): AggregationResult {
  const regionsById = parseRegionDefinitions(context.regionsData)
  const sectorAreasMap = buildSectorRegionAreas(context.resourceAreasData, regionsById)
  const sectorAreas = sectorAreasMap.get(normalizeId(sectorData.sector_id)) ?? []

  const updatedWare: Record<string, SectorJsonResource[]> = {}
  const wareSummary: TotalJsonSector['ware'] = {}

  for (const [wareName, resources] of Object.entries(sectorData.ware)) {
    const overlapComponents = buildRegionOverlapComponents(sectorAreas, wareName)
    const bucketMap = new Map<string, { refs: string[]; max: number; cutted: number }>()

    const updatedResources: SectorJsonResource[] = []

    for (const resource of resources) {
      const matches = matchRegionsForPoint(
        sectorAreas,
        wareName,
        resource.yield_names,
        resource
      )

      // Direct match results for sector JSON (no overlap expansion)
      const matchedRegionRefs = matches
        .map((m) => m.area.ref)
        .filter((ref, index, arr) => arr.indexOf(ref) === index)
        .sort((left, right) => left.localeCompare(right))

      updatedResources.push({
        ...resource,
        regions: matchedRegionRefs
      })

      // For total.json, expand to overlap components
      const bucketRefs = new Set<string>()
      if (matches.length > 0) {
        for (const match of matches) {
          for (const ref of overlapComponents.get(match.area.ref) ?? [match.area.ref]) {
            bucketRefs.add(ref)
          }
        }
      }

      const expandedRefs = Array.from(bucketRefs).sort((left, right) => left.localeCompare(right))
      const refsKey = expandedRefs.length > 0 ? expandedRefs.join('\u0001') : ''
      const existing = bucketMap.get(refsKey) ?? { refs: expandedRefs, max: 0, cutted: 0 }
      existing.max += resource.max
      if (isInCoreArea(resource.x, resource.y, resource.z)) {
        existing.cutted += resource.max
      }
      bucketMap.set(refsKey, existing)
    }

    updatedWare[wareName] = updatedResources

    wareSummary[wareName] = Array.from(bucketMap.values())
      .sort((left, right) => left.refs.join('|').localeCompare(right.refs.join('|')))
      .map((bucket) => ({
        max: bucket.max,
        cutted: bucket.cutted,
        regions: bucket.refs.length > 0 ? bucket.refs.map((ref) => ({ ref })) : [{ ref: '' }]
      }))
  }

  return {
    sectorJson: {
      sector_id: sectorData.sector_id,
      ware: updatedWare
    },
    totalJson: {
      sector_id: normalizeId(sectorData.sector_id),
      ware: wareSummary
    }
  }
}

export function aggregateSectorToTotal(
  sectorData: SectorJsonData,
  context: ExtractContext
): TotalJsonSector {
  return aggregateSectorWithRegions(sectorData, context).totalJson
}

export function aggregateToTotal(
  sectorDataList: SectorJsonData[],
  context: ExtractContext
): TotalJsonData {
  return {
    sectors: sectorDataList.map((sectorData) => aggregateSectorToTotal(sectorData, context))
  }
}

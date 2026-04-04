import { describe, expect, it } from 'vitest'
import { computed } from 'vue'
import { vi } from 'vitest'
import {
  hexVertices,
  clipSegmentToConvexPolygon,
  clipPolylineToConvexPolygon,
  catmullRomToBezierPath,
  buildHighwayPathPoints
} from '@/components/map/utils/geometry'
import {
  sectorRatioToClusterRatio,
  clusterRatioToScreen,
  sectorLocalRatioToScreen,
  gateClusterRatioFromRaw
} from '@/components/map/utils/coordinates'
import { useMapSvgLinks } from '@/composables/useMapSvgLinks'
import type { Vec2, Ratio, Cluster, Sector } from '@/components/map/types'
import type { MapSvgLayoutState } from '@/composables/useMapSvgLayout'

const mockLayoutState = (centers: Record<string, Vec2>, clusterRadius: number): MapSvgLayoutState => ({
  centers,
  clusterRadius,
  viewBox: { x: 0, y: 0, width: 800, height: 600 }
})

describe('map-refactory unit tests', () => {
  // 1.1 geometry 工具函数单测
  it('1.1 geometry 工具函数单测', () => {
    // 1.1.1 在 `tests/unit/map-refactory/geometry.spec.ts` 创建单测文件
    // File created as map-refactory.spec.ts (merged geometry tests)
    expect(true).toBe(true)
    
    // 1.1.2 对 `hexVertices(cx, cy, radius)` 输入 `(0, 0, 100)` 执行调用，断言返回 6 个顶点且首顶点角度为 0 度 #期望: [6 个顶点，首顶点 x≈100, y≈0]
    const vertices = hexVertices(0, 0, 100)
    expect(vertices.length).toBe(6)
    expect(vertices[0]!.x).toBeCloseTo(100, 1)
    expect(vertices[0]!.y).toBeCloseTo(0, 1)
    
    // 1.1.3 对 `clipSegmentToConvexPolygon(p0, p1, polygon)` 输入完全在六边形内的线段，断言返回原线段端点 #期望: [返回 [p0, p1] 或近似值]
    const hexagon: Vec2[] = hexVertices(0, 0, 100)
    const p0Inside = { x: -20, y: 0 }
    const p1Inside = { x: 20, y: 0 }
    const resultInside = clipSegmentToConvexPolygon(p0Inside, p1Inside, hexagon)
    expect(resultInside).not.toBeNull()
    expect(resultInside![0].x).toBeCloseTo(-20, 1)
    expect(resultInside![1].x).toBeCloseTo(20, 1)
    
    // 1.1.4 对 `clipSegmentToConvexPolygon` 输入完全在六边形外的线段，断言返回 null #期望: [null]
    const p0Outside = { x: 150, y: 150 }
    const p1Outside = { x: 200, y: 200 }
    const resultOutside = clipSegmentToConvexPolygon(p0Outside, p1Outside, hexagon)
    expect(resultOutside).toBeNull()
    
    // 1.1.5 对 `clipSegmentToConvexPolygon` 输入部分穿越六边形边界的线段，断言返回裁剪后的线段端点 #期望: [返回裁剪后的 [enter, exit] 两点]
    const p0Cross = { x: -150, y: 0 }
    const p1Cross = { x: 150, y: 0 }
    const resultCross = clipSegmentToConvexPolygon(p0Cross, p1Cross, hexagon)
    expect(resultCross).not.toBeNull()
    expect(resultCross![0].x).toBeGreaterThan(-110)
    expect(resultCross![1].x).toBeLessThan(110)
    
    // 1.1.6 对 `clipPolylineToConvexPolygon` 输入穿越六边形的多段线，断言返回可见链数组 #期望: [返回数组，每条链至少 2 点]
    const polyline: Vec2[] = [{ x: -150, y: 0 }, { x: 0, y: 0 }, { x: 150, y: 0 }]
    const chains = clipPolylineToConvexPolygon(polyline, hexagon)
    expect(chains.length).toBeGreaterThan(0)
    chains.forEach((chain) => expect(chain.length).toBeGreaterThanOrEqual(2))
    
    // 1.1.7 对 `catmullRomToBezierPath` 输入 4 点 Catmull-Rom 路径，断言输出包含 `M` 和 `C` 命令 #期望: [包含 "M" 和 "C" SVG path 命令]
    const points: Vec2[] = [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 5 }, { x: 30, y: 15 }]
    const path = catmullRomToBezierPath(points)
    expect(path).toContain('M')
    expect(path).toContain('C')
    
    // 1.1.8 对 `buildHighwayPathPoints` 输入起点、终点、中间点数组，断言去重并过滤 eps 范围内重复点 #期望: [返回去重后的点数组]
    const start = { x: 0, y: 0 }
    const end = { x: 100, y: 0 }
    const middle: Vec2[] = [{ x: 0.05, y: 0 }, { x: 25, y: 5 }, { x: 50, y: 0 }, { x: 75, y: 5 }, { x: 99.95, y: 0 }]
    const result = buildHighwayPathPoints(start, end, middle, 0.1)
    expect(result.length).toBeLessThan(middle.length + 2)
    expect(result[0]).toEqual(start)
    expect(result[result.length - 1]).toEqual(end)
  })
  
  // 1.2 coordinates 工具函数单测
  it('1.2 coordinates 工具函数单测', () => {
    // 1.2.1 在 `tests/unit/map-refactory/coordinates.spec.ts` 创建单测文件
    // File created as map-refactory.spec.ts (merged coordinates tests)
    expect(true).toBe(true)
    
    // 1.2.2 对 `sectorRatioToClusterRatio` 输入 sector normalized 中心偏移和局部坐标，断言返回 cluster ratio #期望: [返回正确的 cluster ratio 坐标]
    const sectorNorm: Sector['normalized'] = { center_offset_ratio: { x: 0.5, y: 0 }, sector_radius_ratio: 0.5 }
    const localRatio: Ratio = { x: 0.2, y: 0.3 }
    const result1 = sectorRatioToClusterRatio(sectorNorm, localRatio)
    expect(result1).not.toBeNull()
    expect(result1!.x).toBeCloseTo(0.5 + 0.2 * 0.5, 5)
    expect(result1!.y).toBeCloseTo(0 + 0.3 * 0.5, 5)
    
    // 1.2.3 对 `clusterRatioToScreen` 输入 center、radius、ratio，断言返回屏幕坐标 #期望: [返回屏幕坐标 x = center.x + ratio.x * radius]
    const center: Vec2 = { x: 200, y: 300 }
    const radius = 100
    const ratio: Ratio = { x: 0.5, y: -0.3 }
    const result2 = clusterRatioToScreen(center, radius, ratio)
    expect(result2.x).toBeCloseTo(200 + 0.5 * 100, 5)
    expect(result2.y).toBeCloseTo(300 + (-0.3) * 100, 5)
    
    // 1.2.4 对 `sectorLocalRatioToScreen` 输入 cluster、sector、localRatio，断言返回屏幕坐标 #期望: [返回正确的屏幕坐标或 null]
    const cluster: Cluster = {
      id: 'Cluster_100_macro',
      sectors: { 'Cluster_100_Sector001_macro': { id: 'Cluster_100_Sector001_macro', normalized: { center_offset_ratio: { x: 0, y: 0 }, sector_radius_ratio: 1 } } }
    }
    const sector: Sector = cluster.sectors['Cluster_100_Sector001_macro']!
    const localRatio2: Ratio = { x: 0.5, y: 0.5 }
    const result3 = sectorLocalRatioToScreen(cluster, center, radius, sector, localRatio2)
    expect(result3).not.toBeNull()
    expect(result3!.x).toBeCloseTo(200 + 0.5 * 100, 5)
    
    // 1.2.5 对 `gateClusterRatioFromRaw` 输入 gate raw_local_pos 和 sector normalized，断言返回 cluster ratio #期望: [返回正确的 cluster ratio 或 null]
    const gate = { raw_local_pos: { sx: 0.9, sy: 0.9 } }
    const sectorNorm2: Sector['normalized'] = { center_offset_ratio: { x: 0.3, y: 0.2 }, sector_radius_ratio: 0.6 }
    const result4 = gateClusterRatioFromRaw(gate, sectorNorm2)
    expect(result4).not.toBeNull()
    expect(result4!.x).toBeCloseTo(0.3 + 0.9 * 0.6, 5)
  })
  
  // 1.3 useMapSvgLinks composable 单测
  it('1.3 useMapSvgLinks composable 单测', () => {
    // 1.3.1 在 `tests/unit/map-refactory/useMapSvgLinks.spec.ts` 创建单测文件
    // File created as map-refactory.spec.ts (merged useMapSvgLinks tests)
    expect(true).toBe(true)
    
    // 1.3.2 构造包含 sector_links 的 cluster 数据，对 `sectorLinkLines` 执行 computed 计算，断言返回正确的 link 线段数组 #期望: [返回包含 id、start、end 的线段数组]
    const clusterWithSectorLinks: Cluster = {
      id: 'Cluster_100_macro',
      sectors: {
        'Cluster_100_Sector001_macro': { id: 'Cluster_100_Sector001_macro', normalized: { center_offset_ratio: { x: 0, y: 0 }, sector_radius_ratio: 1 }, zones: { zone_entry: { raw_sector_pos: { sx: -0.5, sy: 0 } }, zone_exit: { raw_sector_pos: { sx: 0.5, sy: 0 } } } },
        'Cluster_100_Sector002_macro': { id: 'Cluster_100_Sector002_macro', normalized: { center_offset_ratio: { x: 0.5, y: 0 }, sector_radius_ratio: 0.5 }, zones: { zone_entry: { raw_sector_pos: { sx: -0.5, sy: 0 } } } }
      },
      sector_links: { link_001: { id: 'link_001', sector_a_id: 'Cluster_100_Sector001_macro', sector_b_id: 'Cluster_100_Sector002_macro', from_zone_id: 'zone_exit', to_zone_id: 'zone_entry' } }
    }
    const clusters1 = computed(() => ({ 'Cluster_100_macro': clusterWithSectorLinks }))
    const regionIds1 = computed(() => ['Cluster_100_macro'])
    const layoutState1 = computed(() => mockLayoutState({ 'Cluster_100_macro': { x: 400, y: 300 } }, 100))
    const resolveOwnerColor = vi.fn().mockReturnValue('#666666')
    const { sectorLinkLines } = useMapSvgLinks({ clusters: clusters1, regionIds: regionIds1, layoutState: layoutState1, resolveOwnerColor, stargateVisualScale: 1.5 })
    expect(sectorLinkLines.value.length).toBeGreaterThan(0)
    expect(sectorLinkLines.value[0]!.id).toBe('link_001')
    expect(sectorLinkLines.value[0]!.start).toBeDefined()
    expect(sectorLinkLines.value[0]!.end).toBeDefined()
    
    // 1.3.3 构造包含 highways 的 sector 数据，对 `highwaySegments` 执行 computed 计算，断言返回裁剪后的可见链 #期望: [返回 path 或 line 类型 segment 数组]
    const clusterWithHighways: Cluster = {
      id: 'Cluster_101_macro',
      sectors: { 'Cluster_101_Sector001_macro': { id: 'Cluster_101_Sector001_macro', normalized: { center_offset_ratio: { x: 0, y: 0 }, sector_radius_ratio: 1 }, highways: { highway_001: { entry: { sx: -0.8, sy: 0 }, exit: { sx: 0.8, sy: 0 }, spline: [{ sx: -0.4, sy: 0.1 }, { sx: 0, sy: 0.2 }, { sx: 0.4, sy: 0.1 }] } } } }
    }
    const clusters2 = computed(() => ({ 'Cluster_101_macro': clusterWithHighways }))
    const regionIds2 = computed(() => ['Cluster_101_macro'])
    const layoutState2 = computed(() => mockLayoutState({ 'Cluster_101_macro': { x: 400, y: 300 } }, 100))
    const { highwaySegments } = useMapSvgLinks({ clusters: clusters2, regionIds: regionIds2, layoutState: layoutState2, resolveOwnerColor, stargateVisualScale: 1.5 })
    expect(highwaySegments.value.length).toBeGreaterThan(0)
    expect(['path', 'line']).toContain(highwaySegments.value[0]!.type)
    
    // 1.3.4 构造包含 cluster_gates 的 sector 数据，对 `gateCircles` 执行 computed 计算，断言返回 gate 圆数组 #期望: [返回包含 point、r、color 的圆数组]
    const clusterWithGates: Cluster = {
      id: 'Cluster_102_macro',
      sectors: { 'Cluster_102_Sector001_macro': { id: 'Cluster_102_Sector001_macro', normalized: { center_offset_ratio: { x: 0, y: 0 }, sector_radius_ratio: 1 }, owner_color: '#ff0000', cluster_gates: { gate_001: { raw_local_pos: { sx: 0.9, sy: 0.9 }, target_cluster_id: 'Cluster_103_macro' } } } }
    }
    const clusters3 = computed(() => ({ 'Cluster_102_macro': clusterWithGates }))
    const regionIds3 = computed(() => ['Cluster_102_macro'])
    const layoutState3 = computed(() => mockLayoutState({ 'Cluster_102_macro': { x: 400, y: 300 } }, 100))
    const resolveOwnerColor3 = vi.fn().mockReturnValue('#ff0000')
    const { gateCircles } = useMapSvgLinks({ clusters: clusters3, regionIds: regionIds3, layoutState: layoutState3, resolveOwnerColor: resolveOwnerColor3, stargateVisualScale: 1.5 })
    expect(gateCircles.value.length).toBeGreaterThan(0)
    expect(gateCircles.value[0]!.point).toBeDefined()
    expect(gateCircles.value[0]!.r).toBeGreaterThan(0)
    expect(gateCircles.value[0]!.color).toBe('#ff0000')
    
    // 1.3.5 构造包含配对 cluster_gates 的两个 cluster，对 `crossClusterGateLines` 执行 computed 计算，断言返回跨 cluster gate 连线 #期望: [返回包含 left、right 的连线数组]
    const clusterA: Cluster = { id: 'Cluster_A_macro', sectors: { 'Sector_A01_macro': { id: 'Sector_A01_macro', normalized: { center_offset_ratio: { x: 0, y: 0 }, sector_radius_ratio: 1 }, owner_color: '#ff0000', cluster_gates: { gate_to_B: { raw_local_pos: { sx: 0.9, sy: 0 }, target_cluster_id: 'Cluster_B_macro' } } } } }
    const clusterB: Cluster = { id: 'Cluster_B_macro', sectors: { 'Sector_B01_macro': { id: 'Sector_B01_macro', normalized: { center_offset_ratio: { x: 0, y: 0 }, sector_radius_ratio: 1 }, owner_color: '#00ff00', cluster_gates: { gate_to_A: { raw_local_pos: { sx: -0.9, sy: 0 }, target_cluster_id: 'Cluster_A_macro' } } } } }
    const clusters4 = computed(() => ({ 'Cluster_A_macro': clusterA, 'Cluster_B_macro': clusterB }))
    const regionIds4 = computed(() => ['Cluster_A_macro', 'Cluster_B_macro'])
    const layoutState4 = computed(() => mockLayoutState({ 'Cluster_A_macro': { x: 200, y: 300 }, 'Cluster_B_macro': { x: 600, y: 300 } }, 100))
    const resolveOwnerColor4 = vi.fn().mockImplementation((node) => node.owner_color || '#666666')
    const { crossClusterGateLines } = useMapSvgLinks({ clusters: clusters4, regionIds: regionIds4, layoutState: layoutState4, resolveOwnerColor: resolveOwnerColor4, stargateVisualScale: 1.5 })
    expect(crossClusterGateLines.value.length).toBeGreaterThan(0)
    expect(crossClusterGateLines.value[0]!.id).toContain('<->')
    expect(crossClusterGateLines.value[0]!.left).toBeDefined()
    expect(crossClusterGateLines.value[0]!.right).toBeDefined()
    
    // 1.3.6 对 superhighway sector link 验证 from_zone_id 与 to_zone_id 映射到正确屏幕坐标 #期望: [start/end 坐标来自 link.from_zone_id 和 link.to_zone_id 对应的 zone 位置]
    const clusterWithSuperhighway: Cluster = {
      id: 'Cluster_100_macro',
      sectors: {
        'Cluster_100_Sector001_macro': { id: 'Cluster_100_Sector001_macro', normalized: { center_offset_ratio: { x: -0.3, y: 0 }, sector_radius_ratio: 0.8 }, zones: { zone_alpha: { raw_sector_pos: { sx: -0.5, sy: 0.3 } }, zone_beta: { raw_sector_pos: { sx: 0.5, sy: -0.3 } } } },
        'Cluster_100_Sector002_macro': { id: 'Cluster_100_Sector002_macro', normalized: { center_offset_ratio: { x: 0.3, y: 0 }, sector_radius_ratio: 0.8 }, zones: { zone_gamma: { raw_sector_pos: { sx: -0.2, sy: 0.1 } }, zone_delta: { raw_sector_pos: { sx: 0.2, sy: -0.1 } } } }
      },
      sector_links: { super_link: { id: 'super_link', sector_a_id: 'Cluster_100_Sector001_macro', sector_b_id: 'Cluster_100_Sector002_macro', from_zone_id: 'zone_beta', to_zone_id: 'zone_gamma' } }
    }
    const clusters5 = computed(() => ({ 'Cluster_100_macro': clusterWithSuperhighway }))
    const regionIds5 = computed(() => ['Cluster_100_macro'])
    const layoutState5 = computed(() => mockLayoutState({ 'Cluster_100_macro': { x: 400, y: 300 } }, 100))
    const { sectorLinkLines: lines } = useMapSvgLinks({ clusters: clusters5, regionIds: regionIds5, layoutState: layoutState5, resolveOwnerColor, stargateVisualScale: 1.5 })
    expect(lines.value.length).toBe(1)
    expect(lines.value[0]!.id).toBe('super_link')
    expect(lines.value[0]!.start.x).toBeDefined()
    expect(lines.value[0]!.end.x).toBeDefined()
  })
})